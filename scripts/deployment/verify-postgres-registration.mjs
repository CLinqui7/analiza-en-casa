// Synthetic integration assertions against the final web image and its real QA database.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { request } from '@playwright/test';

export async function verifyPostgresRegistration({ base, admin, limited, clients, finance }) {
  async function register(email = `sql-${randomUUID()}@example.test`) {
    const context = await request.newContext({ baseURL: base });
    clients.push(context);
    const csrf = (await (await context.get('/api/auth/csrf')).json()).csrfToken;
    const response = await context.post('/api/auth/register', {
      headers: { origin: base, 'x-analiza-csrf': csrf },
      data: { displayName: 'Cuenta sintética PostgreSQL', email, password: randomUUID() },
    });
    return { context, response, email };
  }
  const first = await register();
  assert.equal(first.response.status(), 201, await first.response.text());
  const session = await first.response.json();
  const csrf = session.csrfToken;
  const user = (
    await admin.query('SELECT id,password_hash FROM analiza.users WHERE email_normalized=$1', [
      first.email,
    ])
  ).rows[0];
  assert.ok(user.password_hash.startsWith('scrypt$'));
  const membership = (
    await admin.query('SELECT organization_id,role FROM analiza.memberships WHERE user_id=$1', [
      user.id,
    ])
  ).rows[0];
  assert.equal(membership.role, 'ADMIN');
  const counts = async () =>
    (
      await admin.query(
        'SELECT (SELECT count(*) FROM analiza.organizations) AS organizations,(SELECT count(*) FROM analiza.users) AS users,(SELECT count(*) FROM analiza.sessions) AS sessions',
      )
    ).rows[0];
  const beforeDuplicate = await counts();
  assert.equal((await register(first.email)).response.status(), 400);
  assert.deepEqual(
    await counts(),
    beforeDuplicate,
    'Duplicate registration rolls back organization, user and session',
  );
  // Force failure after the identity/session inserts, to verify the entire transaction rolls back.
  await admin.query(
    "CREATE FUNCTION analiza.qa_reject_registration() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic registration failure'; END $$",
  );
  await admin.query(
    'CREATE TRIGGER qa_reject_registration BEFORE INSERT ON analiza.workspace_profiles FOR EACH ROW EXECUTE FUNCTION analiza.qa_reject_registration()',
  );
  try {
    assert.equal((await register()).response.status(), 503);
    assert.deepEqual(await counts(), beforeDuplicate, 'Late SQL failure leaves no orphan account');
  } finally {
    await admin.query('DROP TRIGGER qa_reject_registration ON analiza.workspace_profiles');
    await admin.query('DROP FUNCTION analiza.qa_reject_registration()');
  }
  const second = await register();
  assert.equal(second.response.status(), 201);
  const empty = await (await first.context.get('/api/onboarding')).json();
  const payload = {
    ...empty,
    organization: { ...empty.organization, name: 'Organización sintética SQL' },
    staff: [
      {
        id: randomUUID(),
        name: 'Personal sintético',
        position: 'Administración',
        specialty: '',
        registrationNumber: '',
        email: '',
        phone: '',
        active: true,
      },
    ],
    services: [
      {
        id: randomUUID(),
        name: 'Servicio sintético',
        description: '',
        modality: 'HOME',
        currency: '',
        active: true,
      },
    ],
  };
  const save = (data) =>
    first.context.post('/api/onboarding', { headers: { 'x-analiza-csrf': csrf }, data });
  assert.equal((await first.context.post('/api/onboarding', { data: payload })).status(), 403);
  assert.equal(
    (
      await finance.context.post('/api/onboarding', {
        headers: { 'x-analiza-csrf': finance.csrf },
        data: payload,
      })
    ).status(),
    403,
  );
  assert.equal((await save({ ...payload, organizationId: 'qa-org-c' })).status(), 400);
  const concurrent = await Promise.all([save(payload), save(payload)]);
  assert.deepEqual(
    concurrent.map((r) => r.status()).sort(),
    [200, 409],
    'Exactly one concurrent writer commits',
  );
  let saved = await (await first.context.get('/api/onboarding')).json();
  assert.equal(saved.expectedVersion, 1);
  assert.equal(saved.staff.length, 1);
  assert.equal(saved.services.length, 1);
  assert.equal(
    (await save({ ...saved, staff: [] })).status(),
    400,
    'Removing persisted staff is forbidden',
  );
  assert.deepEqual(
    await (await first.context.get('/api/onboarding')).json(),
    saved,
    'Rejected directory change rolls back version and profile',
  );
  assert.equal(
    (
      await save({ ...saved, services: saved.services.map((s) => ({ ...s, active: false })) })
    ).status(),
    200,
  );
  saved = await (await first.context.get('/api/onboarding')).json();
  assert.equal(saved.services[0].active, false);
  assert.equal((await (await second.context.get('/api/onboarding')).json()).staff.length, 0);
  for (const table of ['workspace_profiles', 'organization_staff', 'organization_services']) {
    assert.equal(
      (await limited.query(`SELECT count(*)::int AS n FROM analiza.${table}`)).rows[0].n,
      0,
    );
    await limited.query('BEGIN');
    try {
      await limited.query("SELECT set_config('analiza.organization_id','qa-org-c',true)");
      assert.equal(
        (
          await limited.query(
            `SELECT count(*)::int AS n FROM analiza.${table} WHERE organization_id=$1`,
            [membership.organization_id],
          )
        ).rows[0].n,
        0,
      );
      assert.equal(
        (
          await limited.query("SELECT has_table_privilege(current_user,$1,'DELETE') AS allowed", [
            `analiza.${table}`,
          ])
        ).rows[0].allowed,
        false,
      );
    } finally {
      await limited.query('ROLLBACK');
    }
  }
  return {
    async outage() {
      assert.equal(
        (await save(saved)).status(),
        503,
        'SQL outage cannot report onboarding success',
      );
    },
    async persistent() {
      assert.deepEqual(
        await (await first.context.get('/api/onboarding')).json(),
        saved,
        'New registration session and questionnaire persist across container restart',
      );
    },
  };
}
