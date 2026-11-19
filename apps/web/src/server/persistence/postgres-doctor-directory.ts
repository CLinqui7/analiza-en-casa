import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import type { DoctorSnapshot } from '../doctor-import-preflight';
import {
  directoryHash,
  doctorSnapshotHash,
  planDoctorDirectory,
  type DirectorySource,
  type DirectoryOptions,
} from '../doctor-directory-import';
import { transaction } from './postgres-pool';

export type DirectoryManifest = {
  organizationId: string;
  actorUserId: string;
  sourceSha256: string;
  sourceSheet: string;
  snapshotSha256: string;
  planSha256: string;
  options: DirectoryOptions;
};
async function authorizeOperator(client: PoolClient, manifest: DirectoryManifest) {
  const identity = await client.query(
    'SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user',
  );
  if (identity.rows[0]?.rolsuper !== false || identity.rows[0]?.rolbypassrls !== false)
    throw new Error('Se requiere un rol SQL sin privilegios elevados.');
  const member = await client.query(
    "SELECT m.role FROM analiza.memberships m JOIN analiza.users u ON u.id=m.user_id WHERE m.organization_id=$1 AND m.user_id=$2 AND m.active AND u.disabled_at IS NULL AND m.role IN ('ADMIN','WEBMASTER')",
    [manifest.organizationId, manifest.actorUserId],
  );
  if (member.rowCount !== 1) throw new Error('Operador no autorizado para esta organización.');
  const rls = await client.query(
    "SELECT relrowsecurity,relforcerowsecurity FROM pg_class WHERE oid=ANY(ARRAY['analiza.doctors'::regclass,'analiza.commands'::regclass,'analiza.audit_events'::regclass])",
  );
  if (rls.rowCount !== 3 || rls.rows.some((r) => !r.relrowsecurity || !r.relforcerowsecurity))
    throw new Error('RLS debe permanecer habilitado y forzado.');
}
async function snapshot(client: PoolClient, organizationId: string): Promise<DoctorSnapshot> {
  const result = await client.query(
    'SELECT body AS doctor,version FROM analiza.doctors WHERE organization_id=$1 ORDER BY id',
    [organizationId],
  );
  return { organizationId, doctors: result.rows };
}
export async function applyDoctorDirectory(
  pool: Pool,
  source: DirectorySource,
  manifest: DirectoryManifest,
) {
  if (
    manifest.sourceSha256 !== source.sha256 ||
    manifest.sourceSheet !== source.sheet ||
    !/^[a-f0-9]{64}$/.test(manifest.planSha256) ||
    !/^[a-f0-9]{64}$/.test(manifest.snapshotSha256)
  )
    throw new Error('La fuente no coincide con el plan revisado.');
  const commandKey = 'doctor-directory:v1:' + source.sha256;
  const payloadHash = directoryHash(manifest);
  return transaction(pool, { organizationId: manifest.organizationId }, async (client) => {
    await authorizeOperator(client, manifest);
    await client.query("SET LOCAL lock_timeout='5s'");
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
      'doctor-directory:' + manifest.organizationId,
    ]);
    const prior = await client.query(
      'SELECT payload_hash,result FROM analiza.commands WHERE organization_id=$1 AND idempotency_key=$2',
      [manifest.organizationId, commandKey],
    );
    if (prior.rowCount) {
      if (prior.rows[0].payload_hash !== payloadHash)
        throw new Error('El archivo ya tiene un lote con un plan distinto.');
      return { batchKey: commandKey, replayed: true, ...prior.rows[0].result.summary };
    }
    // Prevent concurrent interactive writes from changing matching identities mid-import.
    await client.query('LOCK TABLE analiza.doctors IN SHARE ROW EXCLUSIVE MODE');
    const before = await snapshot(client, manifest.organizationId);
    if (doctorSnapshotHash(before) !== manifest.snapshotSha256)
      throw new Error('El directorio cambió: debe conciliar de nuevo antes de cargar.');
    const plan = planDoctorDirectory(source, before, manifest.options);
    if (directoryHash(plan) !== manifest.planSha256)
      throw new Error('El plan calculado no coincide con el revisado.');
    if (!plan.actions.length) throw new Error('No hay perfiles conciliados para cargar.');
    const evidence = [];
    for (const action of plan.actions) {
      const args = [manifest.organizationId, action.doctor.id, JSON.stringify(action.doctor)];
      if (action.kind === 'INSERT') {
        await client.query(
          'INSERT INTO analiza.doctors(organization_id,id,body) VALUES($1,$2,$3::jsonb)',
          args,
        );
      } else if (action.kind === 'ENRICH') {
        const updated = await client.query(
          'UPDATE analiza.doctors SET body=$3::jsonb,version=version+1,updated_at=now() WHERE organization_id=$1 AND id=$2 AND version=$4',
          [...args, action.expectedVersion],
        );
        if (updated.rowCount !== 1) throw new Error('Una versión cambió antes de guardar.');
      }
      if (action.kind !== 'UNCHANGED')
        await client.query(
          'INSERT INTO analiza.audit_events(organization_id,id,actor_user_id,action,resource_type,resource_id) VALUES($1,$2,$3,$4,$5,$6)',
          [
            manifest.organizationId,
            randomUUID(),
            manifest.actorUserId,
            action.kind === 'INSERT' ? 'IMPORTED' : 'IMPORT_ENRICHED',
            'doctors',
            action.doctor.id,
          ],
        );
      evidence.push({
        ...action,
        versionAfter:
          action.kind === 'INSERT'
            ? 1
            : action.expectedVersion! + (action.kind === 'ENRICH' ? 1 : 0),
      });
    }
    const after = await snapshot(client, manifest.organizationId);
    if (after.doctors.length !== before.doctors.length + plan.summary.insert)
      throw new Error('La conciliación del total de médicos falló.');
    for (const action of evidence) {
      const saved = after.doctors.find((e) => e.doctor.id === action.doctor.id);
      if (
        !saved ||
        directoryHash(saved.doctor) !== directoryHash(action.doctor) ||
        saved.version !== action.versionAfter
      )
        throw new Error('La conciliación por registro falló.');
    }
    const result = {
      kind: 'DOCTOR_DIRECTORY_IMPORT',
      sourceSha256: source.sha256,
      sourceSheet: source.sheet,
      records: plan.records,
      held: plan.held,
      summary: { ...plan.summary, before: before.doctors.length, after: after.doctors.length },
      evidence,
      beforeSnapshotSha256: manifest.snapshotSha256,
      afterSnapshotSha256: doctorSnapshotHash(after),
    };
    await client.query(
      'INSERT INTO analiza.commands(organization_id,idempotency_key,payload_hash,result) VALUES($1,$2,$3,$4::jsonb)',
      [manifest.organizationId, commandKey, payloadHash, JSON.stringify(result)],
    );
    await client.query(
      'INSERT INTO analiza.audit_events(organization_id,id,actor_user_id,action,resource_type,resource_id) VALUES($1,$2,$3,$4,$5,$6)',
      [
        manifest.organizationId,
        randomUUID(),
        manifest.actorUserId,
        'IMPORTED',
        'doctor_directory_import',
        commandKey,
      ],
    );
    return { batchKey: commandKey, replayed: false, ...result.summary };
  });
}
