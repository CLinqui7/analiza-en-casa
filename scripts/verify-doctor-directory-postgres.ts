import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';
import { patientSchema, quoteSchema } from '../packages/contracts/src/index';
import { postgresQuotes } from '../apps/web/src/server/persistence/postgres-quotes';
import { postgresPersistence } from '../apps/web/src/server/persistence/postgres';
import {
  directoryHeaders,
  planDoctorDirectory,
  directoryHash,
  type DirectorySource,
} from '../apps/web/src/server/doctor-directory-import';
import {
  applyDoctorDirectory,
  type DirectoryManifest,
} from '../apps/web/src/server/persistence/postgres-doctor-directory';

assert.equal(process.env.ANALIZA_QA_MODE, '1');
assert.equal(process.env.PGDATABASE, 'analiza_doctor_import_qa');
assert.equal(process.env.PGHOST, '127.0.0.1');
assert.ok(process.env.QA_RUNTIME_PASSWORD);
const admin = new Pool({ max: 1 });
const runtime = new Pool({
  max: 3,
  user: 'doctor_qa_runtime',
  password: process.env.QA_RUNTIME_PASSWORD,
});
const actor = 'qa-directory-operator';
const org = 'qa-directory-a';
const checks: string[] = [];
const pass = (s: string) => {
  checks.push(s);
  console.log('PASS ' + s);
};
const source = (rows: (string | number | null)[][], sha = 'a'): DirectorySource => ({
  sha256: sha.repeat(64),
  sheet: 'Synthetic doctors',
  rows: [directoryHeaders, ...rows],
});
const row = (i: number) => [
  String(i),
  `Doctor sintético ${i}`,
  'Especialidad sintética',
  String(1000 + i),
  null,
  null,
  '7777-0000',
  `Clínica QA ${i}`,
  'Dirección QA',
  'Ciudad QA',
  'Departamento QA',
  `doctor-${i}@example.test`,
];
async function snap(organizationId = org) {
  return {
    organizationId,
    doctors: (
      await admin.query(
        'SELECT body AS doctor,version FROM analiza.doctors WHERE organization_id=$1 ORDER BY id',
        [organizationId],
      )
    ).rows,
  };
}
function manifest(
  s: DirectorySource,
  snapshot: Awaited<ReturnType<typeof snap>>,
): DirectoryManifest {
  const plan = planDoctorDirectory(s, snapshot, { allowIncompleteHistorical: true });
  return {
    organizationId: snapshot.organizationId,
    actorUserId: actor,
    sourceSha256: s.sha256,
    sourceSheet: s.sheet,
    snapshotSha256: plan.snapshotSha256,
    planSha256: directoryHash(plan),
    options: plan.options,
  };
}
async function main() {
  try {
    await admin.query(await readFile('database/postgresql/migrations/001_core.sql', 'utf8'));
    await admin.query(await readFile('database/postgresql/migrations/008_quotes.sql', 'utf8'));
    await admin.query(
      await readFile(
        'database/postgresql/migrations/021_quotes_without_hospitalization.sql',
        'utf8',
      ),
    );
    const connection = await admin.connect();
    try {
      await connection.query(
        `CREATE ROLE doctor_qa_runtime LOGIN NOSUPERUSER NOBYPASSRLS PASSWORD ${connection.escapeLiteral(process.env.QA_RUNTIME_PASSWORD!)}`,
      );
    } finally {
      connection.release();
    }
    await admin.query(
      'GRANT USAGE ON SCHEMA analiza TO doctor_qa_runtime; GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA analiza TO doctor_qa_runtime',
    );
    await admin.query(
      "INSERT INTO analiza.organizations(id,name) VALUES('qa-directory-a','Synthetic A'),('qa-directory-b','Synthetic B'),('qa-directory-fail','Synthetic rollback')",
    );
    await admin.query(
      "INSERT INTO analiza.users(id,email_normalized,password_hash) VALUES($1,'directory@example.test','disabled-synthetic'),('qa-nurse','nurse-directory@example.test','disabled-synthetic')",
      [actor],
    );
    await admin.query(
      "INSERT INTO analiza.memberships(user_id,organization_id,role) VALUES($1,'qa-directory-a','ADMIN'),($1,'qa-directory-fail','ADMIN'),('qa-nurse','qa-directory-a','NURSE')",
      [actor],
    );
    await admin.query(
      "INSERT INTO analiza.doctors(organization_id,id,body) VALUES('qa-directory-b','foreign', $1::jsonb)",
      [
        JSON.stringify({
          id: 'foreign',
          fullName: 'Médico sintético extranjero',
          specialty: 'QA',
          attachments: [],
        }),
      ],
    );
    const rows = Array.from({ length: 700 }, (_, i) => row(i));
    const duplicate = row(0);
    duplicate[0] = '700';
    duplicate[7] = 'Segunda clínica QA';
    rows.push(duplicate);
    const s = source(rows),
      m = manifest(s, await snap());
    await assert.rejects(
      applyDoctorDirectory(runtime, s, { ...m, actorUserId: 'qa-nurse' }),
      /autorizado/,
    );
    await assert.rejects(
      applyDoctorDirectory(runtime, s, { ...m, organizationId: 'qa-directory-b' }),
      /autorizado/,
    );
    await assert.rejects(applyDoctorDirectory(admin, s, m), /privilegios elevados/);
    pass('role authorization, organization membership and non-bypass SQL identity');
    const results = await Promise.all([
      applyDoctorDirectory(runtime, s, m),
      applyDoctorDirectory(runtime, s, m),
    ]);
    assert.equal(results.filter((r) => r.replayed).length, 1);
    const saved = await snap();
    assert.equal(saved.doctors.length, 700);
    assert.equal(
      saved.doctors.find((d) => d.doctor.fullName === 'Doctor sintético 0')?.doctor
        .practiceLocations.length,
      2,
    );
    assert.equal(
      (
        await admin.query(
          'SELECT count(*)::int AS n FROM analiza.audit_events WHERE organization_id=$1',
          [org],
        )
      ).rows[0].n,
      701,
    );
    const batch = (
      await admin.query('SELECT result FROM analiza.commands WHERE organization_id=$1', [org])
    ).rows[0].result;
    assert.equal(batch.records.length, 701);
    assert.equal(batch.evidence.length, 700);
    assert.equal(batch.summary.consolidatedRows, 1);
    assert.equal((await snap('qa-directory-b')).doctors.length, 1);
    pass('701 source rows, 700 doctors, practices, per-record audit and concurrent idempotency');
    await assert.rejects(
      applyDoctorDirectory(runtime, s, { ...m, planSha256: 'f'.repeat(64) }),
      /plan distinto/,
    );
    pass('same source refuses an altered plan');
    const enrichment = source([row(0)], 'b');
    enrichment.rows[1][7] = 'Clínica adicional QA';
    const next = manifest(enrichment, saved);
    await applyDoctorDirectory(runtime, enrichment, next);
    const enriched = (await snap()).doctors.find(
      (d) => d.doctor.fullName === 'Doctor sintético 0',
    )!;
    assert.equal(enriched.version, 2);
    assert.equal(enriched.doctor.practiceLocations.length, 3);
    assert.equal(enriched.doctor.clinicName, 'Clínica QA 0');
    pass('existing doctor enriched with versioning, preserving primary fields and ID');
    const staleSource = source([row(1)], 'c'),
      stale = manifest(staleSource, await snap());
    await admin.query(
      'UPDATE analiza.doctors SET version=version+1 WHERE organization_id=$1 AND id=$2',
      [org, enriched.doctor.id],
    );
    await assert.rejects(applyDoctorDirectory(runtime, staleSource, stale), /directorio cambió/);
    pass('stale snapshot rejected before writes');
    await admin.query(
      "CREATE FUNCTION analiza.synthetic_import_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.body->>'fullName' = 'SYNTHETIC_REJECT' THEN RAISE EXCEPTION 'synthetic forced failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER synthetic_import_failure BEFORE INSERT ON analiza.doctors FOR EACH ROW EXECUTE FUNCTION analiza.synthetic_import_failure()",
    );
    const badRows = [row(1), row(2), row(3)];
    badRows[1][1] = 'SYNTHETIC_REJECT';
    const bad = source(badRows, 'd'),
      badManifest = manifest(bad, await snap('qa-directory-fail'));
    await assert.rejects(applyDoctorDirectory(runtime, bad, badManifest));
    assert.equal((await snap('qa-directory-fail')).doctors.length, 0);
    assert.equal(
      (
        await admin.query(
          "SELECT count(*)::int AS n FROM analiza.commands WHERE organization_id='qa-directory-fail'",
        )
      ).rows[0].n,
      0,
    );
    assert.equal(
      (
        await admin.query(
          "SELECT count(*)::int AS n FROM analiza.audit_events WHERE organization_id='qa-directory-fail'",
        )
      ).rows[0].n,
      0,
    );
    pass('mid-batch SQL failure rolls back doctors, command and audit atomically');
    const quotes = postgresQuotes(runtime);
    const quoteActor = { userId: actor, organizationId: org, role: 'ADMIN' as const };
    const imported = (await snap()).doctors;
    const primary = imported[0].doctor.id,
      secondary = imported.at(-1)!.doctor.id;
    (globalThis as typeof globalThis & { analizaPgPool?: Pool }).analizaPgPool = runtime;
    const doctorRepository = postgresPersistence().doctors;
    for (const role of ['FINANCE', 'DOCTOR', 'MANAGER'] as const) {
      const reader = { ...quoteActor, role };
      const choices = await doctorRepository.listWithVersions(reader);
      assert.equal(choices.length, 700);
      assert.ok(!choices.some(({ doctor }) => doctor.id === 'foreign'));
      const choice = choices.find(({ doctor }) => doctor.id === primary)!.doctor;
      assert.ok(choice.jvpm);
      assert.ok(!('phone' in choice));
      assert.ok(!('address' in choice));
      assert.ok(!choice.practiceLocations?.some((p) => 'phone' in p || 'address' in p));
      assert.deepEqual(await doctorRepository.get(reader, primary), choice);
      assert.equal(await doctorRepository.get(reader, 'foreign'), null);
      await assert.rejects(doctorRepository.create(reader, { doctor: choice }));
      await assert.rejects(
        doctorRepository.replace(reader, primary, { doctor: choice, expectedVersion: 1 }),
      );
    }
    await assert.rejects(doctorRepository.listWithVersions({ ...quoteActor, role: 'NURSE' }));
    assert.ok((await doctorRepository.get(quoteActor, primary))?.phone);
    pass(
      'quote-author roles read all 700 scoped selections without personal data or doctor edit rights',
    );
    const patient = patientSchema.parse({
      id: 'doctor-quote-patient',
      fullName: 'Paciente QA directorio',
      documentType: 'OTHER',
      documentId: 'QA-DIRECTORY',
      phone: '0000-0000',
      status: 'ACTIVE',
      referralOrigin: 'FAMILY_FRIENDS',
    });
    await admin.query(
      'INSERT INTO analiza.patients(organization_id,id,document_key,body) VALUES($1,$2,$3,$4::jsonb)',
      [org, patient.id, patient.documentId, JSON.stringify(patient)],
    );
    const template = quoteSchema.parse({
      id: 'doctor-quote-valid',
      patientId: patient.id,
      version: 1,
      status: 'DRAFT',
      careSetting: 'HOME_OUTPATIENT',
      summary: 'Cotización QA directorio',
      primaryDoctorId: primary,
      secondaryDoctorId: secondary,
      items: [],
      createdAt: new Date().toISOString(),
    });
    const created = await quotes.create(quoteActor, { quote: template });
    assert.equal((await quotes.get(quoteActor, created.id))?.primaryDoctorId, primary);
    assert.equal((await quotes.get(quoteActor, created.id))?.secondaryDoctorId, secondary);
    const edited = await quotes.replace(quoteActor, created.id, {
      quote: { ...created, primaryDoctorId: secondary, secondaryDoctorId: primary },
      expectedVersion: 1,
    });
    assert.equal(edited.primaryDoctorId, secondary);
    assert.equal(
      (await quotes.listWithVersions(quoteActor)).find((x) => x.quote.id === created.id)?.version,
      2,
    );
    pass('historical doctors with pending fields save, reload and change in quotes');
    for (const field of ['primaryDoctorId', 'secondaryDoctorId']) {
      for (const invalid of ['foreign', 'nonexistent']) {
        await assert.rejects(
          quotes.create(quoteActor, {
            quote: { ...template, id: `invalid-${field}-${invalid}`, [field]: invalid },
          }),
          /médicos registrados/,
        );
        await assert.rejects(
          quotes.replace(quoteActor, edited.id, {
            quote: { ...edited, [field]: invalid },
            expectedVersion: 2,
          }),
          /médicos registrados/,
        );
      }
    }
    assert.equal((await quotes.listWithVersions(quoteActor)).length, 1);
    assert.equal((await quotes.get(quoteActor, edited.id))?.primaryDoctorId, secondary);
    assert.equal(
      await quotes.get({ ...quoteActor, organizationId: 'qa-directory-b' }, edited.id),
      null,
    );
    pass(
      'quotes reject foreign or nonexistent primary and secondary doctors without partial writes',
    );
    const damaged = {
      ...template,
      id: 'doctor-quote-legacy-invalid',
      secondaryDoctorId: 'foreign',
    };
    await admin.query(
      'INSERT INTO analiza.quotes(organization_id,id,patient_id,root_quote_id,quote_version,body) VALUES($1,$2,$3,$2,1,$4::jsonb)',
      [org, damaged.id, patient.id, JSON.stringify(damaged)],
    );
    await assert.rejects(quotes.send(quoteActor, damaged.id, 1), /médicos registrados/);
    assert.equal((await quotes.get(quoteActor, damaged.id))?.status, 'DRAFT');
    const sent = await quotes.send(quoteActor, edited.id, 2);
    assert.equal(sent.status, 'SENT');
    await assert.rejects(
      quotes.replace(quoteActor, sent.id, {
        quote: { ...edited, primaryDoctorId: primary },
        expectedVersion: 3,
      }),
    );
    assert.equal((await quotes.get(quoteActor, sent.id))?.primaryDoctorId, secondary);
    pass('sending validates doctor references and preserves the immutable sent selection');
    console.log(
      JSON.stringify({
        status: 'PASS',
        checks,
        sourceRows: 701,
        inserted: 700,
        productionWrites: 0,
      }),
    );
  } finally {
    await runtime.end();
    await admin.end();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
