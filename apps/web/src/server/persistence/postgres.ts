import { createHash, randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { z } from 'zod';
import {
  patientSchema,
  doctorSchema,
  hospitalizationSchema,
  nursingResourceSchema,
  shiftSchema,
  configurationEntrySchema,
  catalogItemSchema,
  emptyOperations,
  type Patient,
  type Doctor,
  type Hospitalization,
  type NursingResource,
  type OperationsSnapshot,
  type Quote,
  type Shift,
} from '@analiza/contracts';
import { can, type Permission } from '@/lib/permissions';
import { emptyServerWorkspace } from '@/lib/workspace-empty';
import { AuthService, hashPassword } from '../auth-service';
import {
  MongoAccessError,
  MongoInputError,
  MongoConflictError,
  MongoDuplicatePatientError,
  parsePatientCreate,
  parsePatientReplace,
  rejectBrowserAuthority,
  type ServerActor,
} from '../validation/patients';
import { parseDoctorCreate, parseDoctorReplace } from '../validation/doctors';
import {
  parseHospitalizationCreate,
  parseHospitalizationReplace,
} from '../validation/hospitalizations';
import { parseShiftSeriesCommand, assertNoSeriesCollisions } from '../validation/shifts';
import type { EntityRepository, Persistence } from './contracts';
import { postgresPool, transaction } from './postgres-pool';
import { postgresAuthStore } from './postgres-auth';
import { postgresFiles } from './postgres-files';
import { PostgresWorkspaceSetupRepository } from './postgres-workspace-setup';
import { PostgresNurseProfileRepository } from './postgres-nurse-profile';
import { PostgresFeedbackRepository } from './postgres-feedback';
import { PostgresInformationImportRepository } from './postgres-information-import';
import { postgresQuotes } from './postgres-quotes';

export function authorize(actor: ServerActor, permission: Permission) {
  if (!can(actor.role, permission)) throw new MongoAccessError();
}
export async function audit(
  client: PoolClient,
  actor: ServerActor,
  action: string,
  type: string,
  id: string,
) {
  await client.query(
    'INSERT INTO analiza.audit_events(organization_id,id,actor_user_id,action,resource_type,resource_id) VALUES($1,$2,$3,$4,$5,$6)',
    [actor.organizationId, randomUUID(), actor.userId, action, type, id],
  );
}
type Entity = Patient | Doctor | Hospitalization;
type Kind = 'patients' | 'doctors' | 'hospitalizations';
const tables: Record<Kind, string> = {
  patients: 'analiza.patients',
  doctors: 'analiza.doctors',
  hospitalizations: 'analiza.hospitalizations',
};

function entityRepository<T extends Entity, K extends string>(
  pool: Pool,
  kind: Kind,
  key: K,
  schema: z.ZodType<T>,
  readPermission: Permission,
  writePermission: Permission,
  create: (input: unknown) => T,
  replace: (input: unknown) => { value: T; expectedVersion: number },
): EntityRepository<T, K> {
  // SQL identifiers come exclusively from this static allowlist, never HTTP or environment values.
  const table = tables[kind];
  async function resolveCase(client: PoolClient, actor: ServerActor, value: T): Promise<T> {
    if (kind !== 'hospitalizations') return value;
    const h = value as Hospitalization;
    const patient = await client.query(
      'SELECT id FROM analiza.patients WHERE organization_id=$1 AND id=$2',
      [actor.organizationId, h.patientId],
    );
    if (!patient.rowCount) throw new MongoInputError('El paciente asociado no está disponible.');
    const ids = [...new Set(h.assignedNursingResourceIds ?? [])];
    if (!ids.length)
      throw new MongoInputError('Asigne al menos una enfermera con cuenta de usuario.');
    const nurses = await client.query(
      `SELECT r.id,r.user_id FROM analiza.nursing_resources r JOIN analiza.memberships m ON m.user_id=r.user_id AND m.organization_id=r.organization_id
      WHERE r.organization_id=$1 AND r.id=ANY($2::text[]) AND m.active AND m.role IN ('ADMIN','NURSE','NURSE_MANAGER')`,
      [actor.organizationId, ids],
    );
    if (nurses.rowCount !== ids.length)
      throw new MongoInputError('Una enfermera no tiene una cuenta activa en esta organización.');
    return {
      ...h,
      assignedNursingResourceIds: ids,
      assignedNurseUserIds: ids.map((id) => nurses.rows.find((r) => r.id === id).user_id),
    } as T;
  }
  async function write(actor: ServerActor, value: T, version?: number): Promise<T> {
    try {
      return await transaction(pool, actor, async (client) => {
        const resolved = await resolveCase(client, actor, value);
        const values: unknown[] = [actor.organizationId, resolved.id, JSON.stringify(resolved)];
        let extra = '';
        if (kind === 'patients') {
          values.push((resolved as Patient).documentId.replace(/\s/g, '').toUpperCase());
          extra = 'document_key';
        }
        if (kind === 'hospitalizations') {
          values.push((resolved as Hospitalization).patientId);
          extra = 'patient_id';
        }
        if (version === undefined) {
          await client.query(
            `INSERT INTO ${table}(organization_id,id,body${extra ? ',' + extra : ''}) VALUES($1,$2,$3::jsonb${extra ? ',$4' : ''})`,
            values,
          );
        } else {
          values.push(version);
          const result = await client.query(
            `UPDATE ${table} SET body=$3::jsonb,version=version+1,updated_at=now()${extra ? ',' + extra + '=$4' : ''} WHERE organization_id=$1 AND id=$2 AND version=$${values.length}`,
            values,
          );
          if (result.rowCount !== 1) throw new MongoConflictError();
        }
        if (kind === 'hospitalizations') {
          await client.query(
            'UPDATE analiza.hospitalization_nurses SET active=false WHERE organization_id=$1 AND hospitalization_id=$2',
            [actor.organizationId, value.id],
          );
          for (const id of (resolved as Hospitalization).assignedNursingResourceIds ?? [])
            await client.query(
              'INSERT INTO analiza.hospitalization_nurses(organization_id,hospitalization_id,resource_id) VALUES($1,$2,$3) ON CONFLICT(organization_id,hospitalization_id,resource_id) DO UPDATE SET active=true',
              [actor.organizationId, value.id, id],
            );
        }
        await audit(client, actor, version === undefined ? 'CREATED' : 'UPDATED', kind, value.id);
        return schema.parse(resolved);
      });
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === '23505') {
        if (kind === 'patients') throw new MongoDuplicatePatientError();
        throw new MongoConflictError();
      }
      throw error;
    }
  }
  return {
    async listWithVersions(actor) {
      authorize(actor, readPermission);
      return transaction(pool, actor, async (client) =>
        (
          await client.query(
            `SELECT body,version FROM ${table} WHERE organization_id=$1 ORDER BY id`,
            [actor.organizationId],
          )
        ).rows.map(
          (r) =>
            ({ [key]: schema.parse(r.body), version: r.version }) as Record<K, T> & {
              version: number;
            },
        ),
      );
    },
    async get(actor, id) {
      authorize(actor, readPermission);
      return transaction(pool, actor, async (client) => {
        const row = (
          await client.query(`SELECT body FROM ${table} WHERE organization_id=$1 AND id=$2`, [
            actor.organizationId,
            id,
          ])
        ).rows[0];
        return row ? schema.parse(row.body) : null;
      });
    },
    async create(actor, input) {
      authorize(actor, writePermission);
      return write(actor, create(input));
    },
    async replace(actor, id, input) {
      authorize(actor, writePermission);
      const parsed = replace(input);
      if (parsed.value.id !== id)
        throw new MongoInputError('El identificador de ruta no coincide.');
      return write(actor, parsed.value, parsed.expectedVersion);
    },
  };
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object')
    return (
      '{' +
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => JSON.stringify(k) + ':' + canonical(v))
        .join(',') +
      '}'
    );
  return JSON.stringify(value);
}

export function postgresPersistence(): Persistence {
  const pool = postgresPool();
  const patients = entityRepository(
    pool,
    'patients',
    'patient',
    patientSchema,
    'patients:read',
    'patients:write',
    parsePatientCreate,
    (input) => {
      const p = parsePatientReplace(input);
      return { value: p.patient, expectedVersion: p.expectedVersion };
    },
  );
  const doctors = entityRepository(
    pool,
    'doctors',
    'doctor',
    doctorSchema,
    'settings:write',
    'settings:write',
    parseDoctorCreate,
    (input) => {
      const p = parseDoctorReplace(input);
      return { value: p.doctor, expectedVersion: p.expectedVersion };
    },
  );
  const hospitalizations = entityRepository(
    pool,
    'hospitalizations',
    'hospitalization',
    hospitalizationSchema,
    'cases:read',
    'cases:write',
    parseHospitalizationCreate,
    (input) => {
      const p = parseHospitalizationReplace(input);
      return { value: p.hospitalization, expectedVersion: p.expectedVersion };
    },
  );
  const quotes = postgresQuotes(pool);
  const shifts: Persistence['shifts'] = {
    async list(actor) {
      authorize(actor, 'agenda:read');
      return transaction(pool, actor, async (c) =>
        (
          await c.query(
            'SELECT body FROM analiza.shifts WHERE organization_id=$1 ORDER BY starts_at,id',
            [actor.organizationId],
          )
        ).rows.map((r) => shiftSchema.parse(r.body)),
      );
    },
    async listResources(actor) {
      authorize(actor, 'agenda:read');
      return transaction(pool, actor, async (c) =>
        (
          await c.query(
            'SELECT body FROM analiza.nursing_resources WHERE organization_id=$1 ORDER BY id',
            [actor.organizationId],
          )
        ).rows.map((r) => nursingResourceSchema.parse(r.body)),
      );
    },
    async createSeries(actor, input) {
      authorize(actor, 'agenda:write');
      const parsed = parseShiftSeriesCommand(input);
      assertNoSeriesCollisions(parsed.shifts);
      return transaction(pool, actor, async (c) => {
        const hash = createHash('sha256').update(canonical(parsed.shifts)).digest('hex');
        await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
          actor.organizationId + ':shift:' + parsed.idempotencyKey,
        ]);
        const old = (
          await c.query(
            'SELECT payload_hash,result FROM analiza.commands WHERE organization_id=$1 AND idempotency_key=$2',
            [actor.organizationId, parsed.idempotencyKey],
          )
        ).rows[0];
        if (old) {
          if (old.payload_hash !== hash) throw new MongoConflictError();
          return z.array(shiftSchema).parse(old.result);
        }
        // Lock resources in a stable order so different concurrent commands cannot double-book.
        for (const id of [...new Set(parsed.shifts.map((s) => s.resourceId))].sort()) {
          if (
            !(
              await c.query(
                'SELECT id FROM analiza.nursing_resources WHERE organization_id=$1 AND id=$2 FOR UPDATE',
                [actor.organizationId, id],
              )
            ).rowCount
          )
            throw new MongoInputError('El recurso asignado no está disponible.');
        }
        for (const shift of parsed.shifts) {
          if (
            shift.patientId &&
            !(
              await c.query('SELECT id FROM analiza.patients WHERE organization_id=$1 AND id=$2', [
                actor.organizationId,
                shift.patientId,
              ])
            ).rowCount
          )
            throw new MongoInputError('El paciente asignado no está disponible.');
          if (
            shift.status !== 'CANCELLED' &&
            (
              await c.query(
                "SELECT id FROM analiza.shifts WHERE organization_id=$1 AND resource_id=$2 AND status<>'CANCELLED' AND starts_at<$4 AND ends_at>$3 LIMIT 1",
                [actor.organizationId, shift.resourceId, shift.startsAt, shift.endsAt],
              )
            ).rowCount
          )
            throw new MongoInputError('El recurso ya tiene un turno que colisiona.');
          await c.query(
            'INSERT INTO analiza.shifts(organization_id,id,resource_id,patient_id,starts_at,ends_at,status,body) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
            [
              actor.organizationId,
              shift.id,
              shift.resourceId,
              shift.patientId ?? null,
              shift.startsAt,
              shift.endsAt,
              shift.status,
              JSON.stringify(shift),
            ],
          );
        }
        await c.query(
          'INSERT INTO analiza.commands(organization_id,idempotency_key,payload_hash,result) VALUES($1,$2,$3,$4)',
          [actor.organizationId, parsed.idempotencyKey, hash, JSON.stringify(parsed.shifts)],
        );
        await audit(c, actor, 'SHIFT_SERIES_CREATED', 'shifts', parsed.idempotencyKey);
        return parsed.shifts;
      });
    },
  };
  const operations: Persistence['operations'] = {
    async list(actor) {
      return transaction(pool, actor, async (c) => {
        const result: OperationsSnapshot = emptyOperations();
        if (can(actor.role, 'catalogs:read') || can(actor.role, 'clinical:read'))
          result.configuration = (
            await c.query(
              'SELECT body FROM analiza.configuration_entries WHERE organization_id=$1 ORDER BY id',
              [actor.organizationId],
            )
          ).rows.map((r) => configurationEntrySchema.parse(r.body));
        if (can(actor.role, 'reports:read'))
          result.professionals = (
            await c.query(
              `SELECT u.id,u.display_name,m.role FROM analiza.users u JOIN analiza.memberships m ON m.user_id=u.id WHERE m.organization_id=$1 AND m.active AND m.role IN ('ADMIN','NURSE','NURSE_MANAGER','DOCTOR')`,
              [actor.organizationId],
            )
          ).rows.map((r) => ({
            userId: r.id,
            name: r.display_name,
            profession: r.role === 'DOCTOR' ? 'DOCTOR' : 'NURSE',
          }));
        return result;
      });
    },
    async execute(actor, input) {
      rejectBrowserAuthority(input);
      const command = z.object({ command: z.string() }).passthrough().parse(input);
      if (command.command === 'configuration.save') {
        authorize(actor, 'catalogs:write');
        const { entry } = z
          .object({ command: z.literal('configuration.save'), entry: configurationEntrySchema })
          .strict()
          .parse(input);
        return transaction(pool, actor, async (c) => {
          if (entry.category === 'MEDICATION' && entry.inventoryItemId) {
            const item = await c.query(
              "SELECT id FROM analiza.catalog_items WHERE organization_id=$1 AND id=$2 AND body->>'status'='ACTIVE'",
              [actor.organizationId, entry.inventoryItemId],
            );
            if (!item.rowCount)
              throw new MongoInputError('Seleccione un artículo activo del inventario.');
          }
          await c.query(
            'INSERT INTO analiza.configuration_entries(organization_id,id,body) VALUES($1,$2,$3) ON CONFLICT(organization_id,id) DO UPDATE SET body=EXCLUDED.body',
            [actor.organizationId, entry.id, JSON.stringify(entry)],
          );
          await audit(c, actor, 'CONFIGURATION_SAVED', 'configuration', entry.id);
          return entry;
        });
      }
      if (command.command === 'nurse.create') {
        authorize(actor, 'nurses:manage');
        const data = z
          .object({
            command: z.literal('nurse.create'),
            email: z.email(),
            password: z.string().min(12).max(1024),
            resource: nursingResourceSchema.omit({ userId: true }).strict(),
          })
          .strict()
          .parse(input);
        const id = randomUUID(),
          hash = await hashPassword(data.password);
        const resource: NursingResource = { ...data.resource, userId: id };
        try {
          return await transaction(pool, actor, async (c) => {
            await c.query(
              'INSERT INTO analiza.users(id,email_normalized,password_hash,display_name) VALUES($1,$2,$3,$4)',
              [id, data.email.trim().toLowerCase(), hash, resource.displayName],
            );
            await c.query(
              "INSERT INTO analiza.memberships(user_id,organization_id,role) VALUES($1,$2,'NURSE')",
              [id, actor.organizationId],
            );
            await c.query(
              'INSERT INTO analiza.nursing_resources(organization_id,id,user_id,body) VALUES($1,$2,$3,$4)',
              [actor.organizationId, resource.id, id, JSON.stringify(resource)],
            );
            await audit(c, actor, 'NURSE_CREATED', 'nursing_resources', resource.id);
            return { id, resource };
          });
        } catch (error) {
          if (error && typeof error === 'object' && 'code' in error && error.code === '23505')
            throw new MongoInputError('No fue posible crear la cuenta.');
          throw error;
        }
      }
      if (command.command === 'workspace.seed-demo') {
        authorize(actor, 'patients:write');
        authorize(actor, 'cases:write');
        return transaction(pool, actor, async (c) => {
          const account = (
            await c.query(
              `SELECT u.display_name,m.role FROM analiza.users u
               JOIN analiza.memberships m ON m.user_id=u.id
               WHERE u.id=$1 AND m.organization_id=$2 AND m.active`,
              [actor.userId, actor.organizationId],
            )
          ).rows[0];
          if (!account || !['ADMIN', 'NURSE', 'NURSE_MANAGER'].includes(account.role))
            throw new MongoAccessError();

          const resource: NursingResource = nursingResourceSchema.parse({
            id: `demo-resource-${actor.userId}`,
            userId: actor.userId,
            displayName: `${account.display_name} · recurso de prueba`,
            territory: 'Zona de demostración',
            shift: 'MORNING',
            availability: 'AVAILABLE',
            capacity: 3,
            boardRegistrationNumber: 'DEMO-001',
          });
          const resourceInsert = await c.query(
            `INSERT INTO analiza.nursing_resources(organization_id,id,user_id,body)
             VALUES($1,$2,$3,$4::jsonb) ON CONFLICT DO NOTHING`,
            [actor.organizationId, resource.id, actor.userId, JSON.stringify(resource)],
          );

          const samples: Patient[] = [
            {
              id: 'patient-demo-001',
              fullName: 'Paciente de prueba Aurora',
              documentType: 'OTHER',
              documentId: 'DEMO-001',
              phone: '7000-0001',
              insurer: 'Particular',
              status: 'ACTIVE',
            },
            {
              id: 'patient-demo-002',
              fullName: 'Paciente de prueba Brisa',
              documentType: 'OTHER',
              documentId: 'DEMO-002',
              phone: '7000-0002',
              insurer: 'Aseguradora de demostración',
              status: 'ACTIVE',
            },
            {
              id: 'patient-demo-003',
              fullName: 'Paciente de prueba Celeste',
              documentType: 'OTHER',
              documentId: 'DEMO-003',
              phone: '7000-0003',
              status: 'ACTIVE',
            },
          ].map((patient) => patientSchema.parse(patient));
          let patientsCreated = 0;
          for (const patient of samples) {
            const inserted = await c.query(
              `INSERT INTO analiza.patients(organization_id,id,body,document_key)
               VALUES($1,$2,$3::jsonb,$4) ON CONFLICT DO NOTHING`,
              [
                actor.organizationId,
                patient.id,
                JSON.stringify(patient),
                patient.documentId.replace(/\s/g, '').toUpperCase(),
              ],
            );
            patientsCreated += inserted.rowCount ?? 0;
          }

          const today = new Date().toISOString().slice(0, 10);
          const hospitalization: Hospitalization = hospitalizationSchema.parse({
            id: 'case-demo-001',
            patientId: samples[0].id,
            startDate: today,
            admissionPeriods: [{ admissionDate: today }],
            status: 'ACTIVE',
            accountType: 'PARTICULAR',
            priority: 'MEDIUM',
            diagnosisSummary: 'Caso creado exclusivamente para conocer el flujo del sistema.',
            nextAction: 'Revisar la cotización de prueba.',
            assignedNursingResourceIds: [resource.id],
            assignedNurseUserIds: [actor.userId],
          });
          const hospitalizationInsert = await c.query(
            `INSERT INTO analiza.hospitalizations(organization_id,id,body,patient_id)
             VALUES($1,$2,$3::jsonb,$4) ON CONFLICT DO NOTHING`,
            [
              actor.organizationId,
              hospitalization.id,
              JSON.stringify(hospitalization),
              hospitalization.patientId,
            ],
          );
          await c.query(
            `INSERT INTO analiza.hospitalization_nurses(organization_id,hospitalization_id,resource_id)
             VALUES($1,$2,$3) ON CONFLICT(organization_id,hospitalization_id,resource_id)
             DO UPDATE SET active=true`,
            [actor.organizationId, hospitalization.id, resource.id],
          );

          const tomorrow = new Date();
          tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
          tomorrow.setUTCHours(8, 0, 0, 0);
          const end = new Date(tomorrow);
          end.setUTCHours(14, 0, 0, 0);
          const shift: Shift = shiftSchema.parse({
            id: 'shift-demo-001',
            resourceId: resource.id,
            patientId: samples[0].id,
            startsAt: tomorrow.toISOString(),
            endsAt: end.toISOString(),
            status: 'SCHEDULED',
            note: 'Turno creado con el botón Datos de prueba.',
          });
          const shiftInsert = await c.query(
            `INSERT INTO analiza.shifts(organization_id,id,resource_id,patient_id,starts_at,ends_at,status,body)
             VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb) ON CONFLICT DO NOTHING`,
            [
              actor.organizationId,
              shift.id,
              shift.resourceId,
              shift.patientId,
              shift.startsAt,
              shift.endsAt,
              shift.status,
              JSON.stringify(shift),
            ],
          );

          let quoteCreated = 0;
          if (can(actor.role, 'quotes:write')) {
            const quote: Quote = {
              id: 'quote-demo-001',
              caseId: hospitalization.id,
              patientId: samples[0].id,
              version: 1,
              status: 'DRAFT',
              summary: 'Cotización de prueba para conocer el flujo.',
              comments: 'Los importes son únicamente un ejemplo editable.',
              items: [
                {
                  id: 'quote-item-demo-001',
                  category: 'SERVICES',
                  name: 'Servicio de atención de prueba',
                  quantity: 1,
                  unitPrice: 100,
                  discountAmount: 0,
                },
              ],
              subtotal: 100,
              discountAmount: 0,
              total: 100,
              insurerAmount: 0,
              patientAmount: 100,
              immutable: false,
              createdAt: new Date().toISOString(),
              rootQuoteId: 'quote-demo-001',
              originalQuoteId: 'quote-demo-001',
            };
            const quoteInsert = await c.query(
              `INSERT INTO analiza.quotes(organization_id,id,case_id,patient_id,root_quote_id,quote_version,body)
               VALUES($1,$2,$3,$4,$5,$6,$7::jsonb) ON CONFLICT DO NOTHING`,
              [
                actor.organizationId,
                quote.id,
                quote.caseId,
                quote.patientId,
                quote.rootQuoteId,
                quote.version,
                JSON.stringify(quote),
              ],
            );
            quoteCreated = quoteInsert.rowCount ?? 0;
          }

          await audit(c, actor, 'DEMO_WORKSPACE_SEEDED', 'workspace', actor.organizationId);
          return {
            patientsCreated,
            resourceCreated: resourceInsert.rowCount ?? 0,
            hospitalizationCreated: hospitalizationInsert.rowCount ?? 0,
            shiftCreated: shiftInsert.rowCount ?? 0,
            quoteCreated,
          };
        });
      }
      throw new MongoInputError('Operación no disponible en esta edición.');
    },
  };
  return {
    auth: new AuthService(postgresAuthStore(pool)),
    informationImports: new PostgresInformationImportRepository(pool),
    onboarding: new PostgresWorkspaceSetupRepository(pool),
    nurseProfile: new PostgresNurseProfileRepository(pool),
    feedback: new PostgresFeedbackRepository(pool),
    patients,
    doctors,
    hospitalizations,
    quotes,
    shifts,
    operations,
    files: postgresFiles(pool),
    async ready() {
      const result = await pool.query(
        "SELECT current_setting('server_version_num')::int AS version,(SELECT count(*) FROM analiza.schema_migrations WHERE version IN ('001_core.sql','002_workspace_registration.sql','003_nurse_profiles.sql','004_feedback_reports.sql','005_all_memberships_admin.sql','006_single_designated_admin.sql','007_expand_feedback_options.sql','008_quotes.sql','009_information_imports.sql'))::int AS migrations, r.rolsuper OR r.rolbypassrls AS privileged FROM pg_roles r WHERE r.rolname=current_user",
      );
      const row = result.rows[0];
      if (
        !row ||
        row.version < 160000 ||
        row.version >= 200000 ||
        row.migrations !== 9 ||
        row.privileged
      )
        throw new Error('Esquema o identidad PostgreSQL no disponible.');
    },
    async workspace(actor) {
      const [p, d, h, s, r, q, catalogs, audits] = await Promise.all([
        can(actor.role, 'patients:read') ? patients.listWithVersions(actor) : [],
        can(actor.role, 'settings:write') ? doctors.listWithVersions(actor) : [],
        can(actor.role, 'cases:read') ? hospitalizations.listWithVersions(actor) : [],
        can(actor.role, 'agenda:read') ? shifts.list(actor) : [],
        can(actor.role, 'agenda:read') ? shifts.listResources(actor) : [],
        can(actor.role, 'quotes:read') ? quotes.listWithVersions(actor) : [],
        can(actor.role, 'catalogs:read')
          ? transaction(pool, actor, async (c) =>
              (
                await c.query(
                  'SELECT body FROM analiza.catalog_items WHERE organization_id=$1 ORDER BY id',
                  [actor.organizationId],
                )
              ).rows.map((r) => catalogItemSchema.parse(r.body)),
            )
          : [],
        can(actor.role, 'audit:read')
          ? transaction(pool, actor, async (c) =>
              (
                await c.query(
                  'SELECT id,action,resource_id AS subject,occurred_at FROM analiza.audit_events WHERE organization_id=$1 ORDER BY occurred_at DESC LIMIT 100',
                  [actor.organizationId],
                )
              ).rows.map((r) => ({
                id: r.id,
                action: r.action,
                subject: r.subject,
                at: r.occurred_at.toISOString(),
              })),
            )
          : [],
      ]);
      return {
        ...emptyServerWorkspace(),
        patients: p.map((r) => r.patient),
        doctors: d.map((r) => r.doctor),
        hospitalizations: h.map((r) => r.hospitalization),
        shifts: s,
        nursingResources: r,
        quotes: q.map((row) => row.quote),
        catalogItems: catalogs,
        auditEntries: audits,
        patientVersions: Object.fromEntries(p.map((r) => [r.patient.id, r.version])),
        doctorVersions: Object.fromEntries(d.map((r) => [r.doctor.id, r.version])),
        hospitalizationVersions: Object.fromEntries(
          h.map((r) => [r.hospitalization.id, r.version]),
        ),
        quoteVersions: Object.fromEntries(q.map((row) => [row.quote.id, row.version])),
      };
    },
  };
}
