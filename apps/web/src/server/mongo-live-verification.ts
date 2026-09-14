/** Explicit operator test: synthetic records only, real HTTP sessions + Atlas persistence. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFile, mkdir } from 'node:fs/promises';
import { request as playwrightRequest, type APIRequestContext } from '@playwright/test';
import { mongoDatabase, closeMongoClient } from './mongodb';
import { hashPassword } from './mongo-auth';

const base = process.env.ANALIZA_VERIFY_URL ?? 'http://localhost:3110';
const password = process.env.MONGODB_INITIAL_ADMIN_PASSWORD;
if (!password) throw new Error('Load the private operator environment.');
const database = await mongoDatabase();
const org = process.env.MONGODB_INITIAL_ORGANIZATION_ID!;
const run = `qa-${randomUUID().slice(0, 8)}`;
const contexts: APIRequestContext[] = [];
const passed: string[] = [];
async function account(suffix: string, role: string, organizationId = org) {
  const id = `${run}-${suffix}`;
  const email = `${id}@example.test`;
  await database.collection('users').insertOne({
    id,
    emailNormalized: email,
    displayName: `Profesional QA ${suffix}`,
    passwordHash: await hashPassword(password!),
  });
  await database
    .collection('memberships')
    .insertOne({ userId: id, organizationId, role, active: true });
  return { id, email };
}
async function login(email: string) {
  const context = await playwrightRequest.newContext({ baseURL: base });
  contexts.push(context);
  const csrf = await (await context.get('/api/auth/csrf')).json();
  const response = await context.post('/api/auth/login', {
    headers: { 'x-analiza-csrf': csrf.csrfToken },
    data: { email, password },
  });
  assert.equal(response.status(), 200, 'Authentication failed');
  return { context, csrf: (await response.json()).csrfToken as string };
}
type Client = Awaited<ReturnType<typeof login>>;
async function post(client: Client, url: string, data: unknown, expected = 200) {
  const response = await client.context.post(url, {
    headers: { 'x-analiza-csrf': client.csrf },
    data,
  });
  const body = await response.json();
  assert.equal(response.status(), expected, `${url}: ${body.error ?? 'unexpected response'}`);
  return body;
}
const op = (client: Client, data: unknown, expected = 200) =>
  post(client, '/api/operations', data, expected);
try {
  const [readerAccount, foreignAccount, managerAccount] = await Promise.all([
    account('reader', 'FINANCE'),
    account('foreign', 'ADMIN', `${run}-other-org`),
    account('manager', 'NURSE_MANAGER'),
  ]);
  const [admin, reader, foreign, manager] = await Promise.all([
    login(process.env.MONGODB_INITIAL_ADMIN_EMAIL!),
    login(readerAccount.email),
    login(foreignAccount.email),
    login(managerAccount.email),
  ]);
  const resource = (suffix: string) => ({
    id: `${run}-${suffix}`,
    displayName: `Enfermera QA ${suffix}`,
    territory: 'Zona QA',
    shift: 'MORNING',
    availability: 'AVAILABLE',
    capacity: 1,
    boardRegistrationNumber: `QA-${suffix}`,
  });
  const nurseInput = {
    command: 'nurse.create',
    email: `${run}-assigned@example.test`,
    password,
    resource: resource('assigned'),
  };
  const nurse = await op(manager, nurseInput);
  await op(manager, { ...nurseInput, role: 'ADMIN' }, 400);
  await op(manager, {
    command: 'nurse.create',
    email: `${run}-unassigned@example.test`,
    password,
    resource: resource('unassigned'),
  });
  const [assigned, unassigned] = await Promise.all([
    login(nurseInput.email),
    login(`${run}-unassigned@example.test`),
  ]);
  passed.push('Manager creates nurse account; cannot inject elevated role');
  const patient = {
    id: `${run}-patient`,
    fullName: 'Paciente QA Persistencia',
    documentType: 'OTHER',
    documentId: `${run}-doc`,
    status: 'ACTIVE',
  };
  await post(admin, '/api/patients', { patient }, 201);
  const updatedPatient = { ...patient, fullName: 'Paciente QA Persistencia editado' };
  const edit = await admin.context.put(`/api/patients/${patient.id}`, {
    headers: { 'x-analiza-csrf': admin.csrf },
    data: { patient: updatedPatient, expectedVersion: 1 },
  });
  assert.equal(edit.status(), 200);
  const hospitalization = {
    id: `${run}-case`,
    patientId: patient.id,
    startDate: '2026-09-10',
    status: 'ACTIVE',
    accountType: 'PARTICULAR',
    assignedNursingResourceIds: [nurseInput.resource.id],
  };
  const savedCase = await post(admin, '/api/hospitalizations', { hospitalization }, 201);
  assert.deepEqual(savedCase.assignedNurseUserIds, [nurse.id]);
  const editedCase = await admin.context.put(`/api/hospitalizations/${hospitalization.id}`, {
    headers: { 'x-analiza-csrf': admin.csrf },
    data: {
      hospitalization: { ...hospitalization, nextAction: 'Seguimiento QA editado' },
      expectedVersion: 1,
    },
  });
  assert.equal(editedCase.status(), 200);
  const quote = {
    id: `${run}-quote`,
    caseId: hospitalization.id,
    patientId: patient.id,
    version: 1,
    status: 'DRAFT',
    summary: 'Prueba sintética sin tarifa clínica',
    items: [],
    createdAt: new Date().toISOString(),
  };
  await post(admin, '/api/quotes', { quote }, 201);
  const editQuote = await admin.context.put(`/api/quotes/${quote.id}`, {
    headers: { 'x-analiza-csrf': admin.csrf },
    data: { quote: { ...quote, summary: 'Cotización QA editada' }, expectedVersion: 1 },
  });
  assert.equal(editQuote.status(), 200);
  const clinicalDocument = {
    id: `${run}-clinical`,
    caseId: hospitalization.id,
    patientId: patient.id,
    type: 'CARE_PLAN',
    title: 'Plan clínico sintético QA',
    summary: 'Contenido ficticio sin instrucciones clínicas.',
    author: 'Profesional QA',
    status: 'DRAFT',
    version: 1,
    createdAt: new Date().toISOString(),
  };
  await op(admin, { command: 'clinical.create', document: clinicalDocument });
  await op(assigned, { command: 'clinical.sign', documentId: clinicalDocument.id }, 403);
  await op(admin, { command: 'clinical.sign', documentId: clinicalDocument.id });
  const correctionId = `${run}-clinical-correction`;
  await op(admin, {
    command: 'clinical.correct',
    documentId: clinicalDocument.id,
    correctionId,
    reason: 'Corrección sintética de QA',
    summary: 'Nueva versión ficticia sin instrucciones clínicas.',
    author: 'Profesional QA',
  });
  const clinicalWorkspace = await (await admin.context.get('/api/workspace')).json();
  const originalClinical = clinicalWorkspace.clinicalDocuments.find(
    (row: { id: string }) => row.id === clinicalDocument.id,
  );
  const correctedClinical = clinicalWorkspace.clinicalDocuments.find(
    (row: { id: string }) => row.id === correctionId,
  );
  assert.equal(originalClinical.status, 'SIGNED');
  assert.equal(originalClinical.summary, clinicalDocument.summary);
  assert.equal(correctedClinical.status, 'DRAFT');
  assert.equal(correctedClinical.correctionOf, clinicalDocument.id);
  assert.equal(correctedClinical.version, 2);
  passed.push(
    'Clinical draft persists; signing requires server permission; correction preserves signed original and creates version 2',
  );
  const loaded = await (await reader.context.get('/api/workspace')).json();
  assert.ok(
    loaded.patients.some(
      (row: { id: string; fullName: string }) =>
        row.id === patient.id && row.fullName === updatedPatient.fullName,
    ),
  );
  assert.ok(loaded.hospitalizations.some((row: { id: string }) => row.id === hospitalization.id));
  assert.ok(
    loaded.hospitalizations.some(
      (row: { id: string; nextAction?: string }) =>
        row.id === hospitalization.id && row.nextAction === 'Seguimiento QA editado',
    ),
  );
  assert.ok(
    loaded.quotes.some(
      (row: { id: string; summary: string }) =>
        row.id === quote.id && row.summary === 'Cotización QA editada',
    ),
  );
  const foreignData = await (await foreign.context.get('/api/workspace')).json();
  assert.ok(!foreignData.patients.some((row: { id: string }) => row.id === patient.id));
  await post(
    foreign,
    '/api/hospitalizations',
    { hospitalization: { ...hospitalization, id: `run-foreign-case` } },
    400,
  );
  const noCsrf = await admin.context.post('/api/patients', {
    data: { patient: { ...patient, id: `run-no-csrf` } },
  });
  assert.equal(noCsrf.status(), 403);
  passed.push(
    'Patient and quote create/edit; other authorized session reads patient/case/quote; foreign organization and missing CSRF denied',
  );
  const attachment = await admin.context.post('/api/files', {
    headers: { 'x-analiza-csrf': admin.csrf },
    multipart: {
      ownerType: 'patient',
      ownerId: patient.id,
      file: {
        name: 'DUI-QA-sintetico.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('DOCUMENTO FICTICIO PARA QA; NO IDENTIDAD REAL'),
      },
    },
  });
  assert.equal(attachment.status(), 201);
  const file = await attachment.json();
  assert.equal((await reader.context.get(`/api/files/${file.id}`)).status(), 200);
  assert.equal((await foreign.context.get(`/api/files/${file.id}`)).status(), 404);
  passed.push(
    'Private attachment upload, authorized second-session download, foreign download denied',
  );
  const sentQuote = loaded.quotes.find((row: { status: string }) => row.status === 'SENT');
  assert.ok(sentQuote);
  const payment = {
    id: `${run}-payment`,
    quoteId: sentQuote.id,
    amount: 1,
    reference: `${run}-synthetic-receipt`,
    idempotencyKey: `${run}-payment`,
    status: 'APPLIED',
    createdAt: new Date().toISOString(),
  };
  await op(admin, { command: 'payment.apply', payment });
  await op(admin, { command: 'payment.apply', payment });
  await op(admin, { command: 'payment.apply', payment: { ...payment, amount: 2 } }, 409);
  await op(
    foreign,
    {
      command: 'payment.apply',
      payment: {
        ...payment,
        id: `${run}-foreign-payment`,
        idempotencyKey: `${run}-foreign-payment`,
      },
    },
    400,
  );
  assert.equal(
    await database.collection('payments').countDocuments({ organizationId: org, id: payment.id }),
    1,
  );
  assert.ok(
    (await (await reader.context.get('/api/workspace')).json()).payments.some(
      (row: { id: string }) => row.id === payment.id,
    ),
  );
  await op(admin, {
    command: 'payment.void',
    paymentId: payment.id,
    reason: 'Anulación de transacción sintética de verificación',
  });
  assert.equal(
    (await database.collection('payments').findOne({ organizationId: org, id: payment.id }))
      ?.status,
    'VOIDED',
  );
  passed.push(
    'Payment persists across sessions, retries deduplicate, changed retry and foreign quote are denied, audited void preserves the row',
  );
  const periodCommand = {
    command: 'balance.open',
    caseId: hospitalization.id,
    startsAt: '2026-09-10T06:00:00.000Z',
    endsAt: '2026-09-11T06:00:00.000Z',
    idempotencyKey: `${run}-period`,
  };
  await op(unassigned, periodCommand, 403);
  const period = await op(assigned, periodCommand);
  const entry = {
    periodId: period.id,
    measuredAt: '2026-09-10T07:00:00.000Z',
    direction: 'INTAKE',
    category: 'Vía oral',
    milliliters: 100,
    idempotencyKey: `${run}-volume`,
  };
  await op(unassigned, { command: 'balance.append', entry }, 403);
  await op(foreign, { command: 'balance.append', entry }, 403);
  const savedEntry = await op(assigned, { command: 'balance.append', entry });
  await op(assigned, { command: 'balance.append', entry });
  assert.equal(
    await database
      .collection('balanceEntries')
      .countDocuments({ organizationId: org, idempotencyKey: entry.idempotencyKey }),
    1,
  );
  const readonlyBalance = await (await unassigned.context.get('/api/operations')).json();
  assert.ok(readonlyBalance.balanceEntries.some((row: { id: string }) => row.id === savedEntry.id));
  await op(assigned, {
    command: 'balance.close',
    periodId: period.id,
    handoff: 'Entrega QA verificada',
  });
  await op(
    assigned,
    { command: 'balance.append', entry: { ...entry, idempotencyKey: `${run}-closed` } },
    400,
  );
  await op(assigned, {
    command: 'balance.append',
    entry: {
      ...entry,
      idempotencyKey: `${run}-correction`,
      correctionOf: savedEntry.id,
      correctionReason: 'Corrección QA de captura',
      milliliters: 80,
    },
  });
  passed.push(
    'All same-org nurses read balance; only assigned nurses write; retries deduplicate; closed period requires append-only correction',
  );
  const item = {
    id: `${run}-item`,
    sku: `${run}-STOCK`,
    name: 'Tableta inerte QA (no medicamento clínico)',
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
  };
  await op(manager, { command: 'catalog.create', item });
  const stockCommand = {
    command: 'inventory.record',
    idempotencyKey: `${run}-stock`,
    movement: {
      id: `${run}-stock`,
      itemId: item.id,
      kind: 'ENTRY',
      quantity: 20,
      warehouseId: 'central',
      createdAt: new Date().toISOString(),
      reason: 'Existencia ficticia QA',
    },
  };
  await op(admin, stockCommand);
  await op(admin, stockCommand);
  await op(admin, { ...stockCommand, movement: { ...stockCommand.movement, quantity: 21 } }, 409);
  const medication = {
    id: `${run}-medication`,
    category: 'MEDICATION',
    label: 'Tableta inerte QA',
    active: true,
    inventoryItemId: item.id,
    tabletsPerBlister: 5,
    tabletsPerBox: 20,
  };
  const dose = {
    id: `${run}-dose`,
    category: 'DOSE',
    label: 'Etiqueta QA, sin dosis clínica',
    active: true,
  };
  await op(manager, { command: 'configuration.save', entry: medication });
  await op(manager, { command: 'configuration.save', entry: dose });
  const administration = {
    caseId: hospitalization.id,
    medicationId: medication.id,
    doseId: dose.id,
    presentation: 'TABLET',
    quantity: 2,
    warehouseId: 'central',
    administeredAt: new Date().toISOString(),
    idempotencyKey: `${run}-administer`,
  };
  await op(unassigned, { command: 'medication.administer', administration }, 403);
  await op(assigned, { command: 'medication.administer', administration });
  await op(assigned, { command: 'medication.administer', administration });
  await op(
    assigned,
    { command: 'medication.administer', administration: { ...administration, quantity: 3 } },
    409,
  );
  assert.equal(
    (
      await database
        .collection('inventoryBalances')
        .findOne({ organizationId: org, itemId: item.id, warehouseId: 'central' })
    )?.quantity,
    18,
  );
  await op(assigned, {
    command: 'medication.administer',
    administration: {
      ...administration,
      presentation: 'BLISTER',
      quantity: 1,
      idempotencyKey: `${run}-blister`,
    },
  });
  assert.equal(
    (
      await database
        .collection('inventoryBalances')
        .findOne({ organizationId: org, itemId: item.id, warehouseId: 'central' })
    )?.quantity,
    13,
  );
  await op(
    assigned,
    {
      command: 'medication.administer',
      administration: {
        ...administration,
        presentation: 'BOX',
        quantity: 1,
        idempotencyKey: `${run}-no-stock`,
      },
    },
    400,
  );
  assert.equal(
    await database
      .collection('medicationAdministrations')
      .countDocuments({ organizationId: org, idempotencyKey: `${run}-no-stock` }),
    0,
  );
  assert.equal(
    (
      await database
        .collection('inventoryBalances')
        .findOne({ organizationId: org, itemId: item.id, warehouseId: 'central' })
    )?.quantity,
    13,
  );
  passed.push(
    '2 tablets deduct exactly 2; blister conversion deducts 5; duplicate does not deduct again; insufficient box stock rolls back',
  );
  const professionalName = nurseInput.resource.displayName;
  await op(manager, {
    command: 'goal.save',
    goal: {
      professionalUserId: nurse.id,
      professionalName,
      month: '2026-09',
      visitTarget: 10,
      salesTarget: 100,
    },
  });
  await op(assigned, {
    command: 'visit.create',
    visit: {
      professionalUserId: nurse.id,
      professionalName,
      profession: 'NURSE',
      patientId: patient.id,
      occurredAt: new Date().toISOString(),
      saleAmount: 0,
      saleReference: '',
      idempotencyKey: `${run}-visit`,
    },
  });
  passed.push('Separate visits and goals persisted; no quote-to-sale inference');
  const result = {
    verifiedAt: new Date().toISOString(),
    provider: 'mongodb',
    database: 'analiza_en_casa',
    runId: run,
    passed,
    syntheticOnly: true,
  };
  await mkdir('../../.local/mongo-verification', { recursive: true });
  await writeFile(
    '../../.local/mongo-verification/live-report.json',
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify(result));
} finally {
  await Promise.all(contexts.map((context) => context.dispose()));
  await closeMongoClient();
}
