import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { persistence } from '@/server/persistence';
import { postgresPool, transaction } from '@/server/persistence/postgres-pool';
import { POST } from './route';

vi.mock('@/server/persistence', () => ({ persistence: vi.fn() }));
vi.mock('@/server/persistence/postgres-pool', () => ({
  postgresPool: vi.fn(),
  transaction: vi.fn(),
}));

const actor = { userId: 'user-qa', organizationId: 'org-qa', role: 'NURSE' };
const decisionId = 'e30cfd6c-63a6-4e93-8f71-822df02a4ad3';
const quote = {
  id: 'quote-qa',
  patientId: 'patient-qa',
  version: 1,
  status: 'DRAFT',
  summary: 'Cotización sintética',
  careSetting: 'HOSPITALIZATION',
  primaryDoctorId: 'doctor-qa',
  admissionDate: '2026-10-29',
  items: [
    { id: 'line-qa', category: 'SERVICES', name: 'Servicio sintético', quantity: 1, unitPrice: 10 },
  ],
  total: 10,
  patientAmount: 10,
  immutable: false,
  createdAt: '2026-10-29T00:00:00.000Z',
};
const rows = (items: unknown[]) => ({ rows: items, rowCount: items.length });
const context = { params: Promise.resolve({ id: 'quote-qa' }) };

function request(body: unknown, csrf = 'csrf-qa') {
  return new NextRequest('http://localhost/api/quotes/quote-qa/decision', {
    method: 'POST',
    headers: {
      cookie: 'analiza_session=session-qa',
      'x-analiza-csrf': csrf,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('ANALIZA_DATA_MODE', 'postgresql');
  vi.mocked(persistence).mockResolvedValue({
    auth: {
      requireSession: vi.fn().mockResolvedValue(actor),
      requireCsrf: vi.fn().mockImplementation(async (_token: string, csrf: string) => {
        if (csrf !== 'csrf-qa') throw new Error('Invalid CSRF');
      }),
    },
  } as never);
  vi.mocked(postgresPool).mockReturnValue({} as never);
});
afterEach(() => vi.unstubAllEnvs());

describe('quote approval boundary', () => {
  it('approves a hospitalized quote once, locks its version, and creates one audited admission', async () => {
    const queries: Array<{ sql: string; params?: unknown[] }> = [];
    const query = vi.fn(async (sql: string, params?: unknown[]) => {
      queries.push({ sql, params });
      if (sql.includes('SELECT body,record_version,root_quote_id'))
        return rows([{ body: quote, record_version: 1, root_quote_id: quote.id }]);
      if (sql.includes('SELECT id FROM analiza.quotes')) return rows([{ id: quote.id }]);
      if (sql.includes('SELECT 1 FROM analiza.doctors')) return rows([{ '?column?': 1 }]);
      if (sql.includes('SELECT id FROM analiza.hospitalizations')) return rows([]);
      if (sql.includes('INSERT INTO analiza.quote_decisions'))
        return rows([
          {
            id: decisionId,
            quote_id: quote.id,
            decision: 'APPROVED',
            reason: null,
            created_at: new Date('2026-10-29T10:00:00.000Z'),
          },
        ]);
      if (sql.includes('SELECT') && sql.includes('quote_decisions')) return rows([]);
      if (sql.includes('UPDATE analiza.quotes')) return { rows: [], rowCount: 1 };
      return rows([]);
    });
    vi.mocked(transaction).mockImplementation(async (_pool, _actor, operation) =>
      operation({ query } as never),
    );
    const response = await POST(
      request({ id: decisionId, decision: 'APPROVED', reason: null }),
      context,
    );
    expect(response.status).toBe(201);
    expect(queries.some(({ sql }) => sql.includes('INSERT INTO analiza.hospitalizations'))).toBe(
      true,
    );
    expect(
      queries.some(
        ({ sql, params }) =>
          sql.includes('UPDATE analiza.quotes') && String(params?.[3]).includes('"immutable":true'),
      ),
    ).toBe(true);
    expect(
      queries.filter(({ sql }) => sql.includes('INSERT INTO analiza.audit_events')).length,
    ).toBe(3);
    expect(queries.every(({ params }) => !params || params[0] === actor.organizationId)).toBe(true);
  });

  it('does not create an admission for outpatient approval and rejects missing hospital doctor', async () => {
    const outpatient = { ...quote, careSetting: 'HOME_OUTPATIENT' };
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('SELECT body,record_version,root_quote_id'))
        return rows([{ body: outpatient, record_version: 1, root_quote_id: quote.id }]);
      if (sql.includes('SELECT id FROM analiza.quotes')) return rows([{ id: quote.id }]);
      if (sql.includes('INSERT INTO analiza.quote_decisions'))
        return rows([
          {
            id: decisionId,
            quote_id: quote.id,
            decision: 'APPROVED',
            reason: null,
            created_at: new Date('2026-10-29T10:00:00.000Z'),
          },
        ]);
      if (sql.includes('UPDATE analiza.quotes')) return { rows: [], rowCount: 1 };
      return rows([]);
    });
    vi.mocked(transaction).mockImplementation(async (_pool, _actor, operation) =>
      operation({ query } as never),
    );
    expect((await POST(request({ id: decisionId, decision: 'APPROVED' }), context)).status).toBe(
      201,
    );
    expect(
      query.mock.calls.some(([sql]) => sql.includes('INSERT INTO analiza.hospitalizations')),
    ).toBe(false);
    query.mockClear();
    query.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT body,record_version,root_quote_id'))
        return rows([
          { body: { ...quote, primaryDoctorId: '' }, record_version: 1, root_quote_id: quote.id },
        ]);
      if (sql.includes('SELECT id FROM analiza.quotes')) return rows([{ id: quote.id }]);
      return rows([]);
    });
    expect((await POST(request({ id: decisionId, decision: 'APPROVED' }), context)).status).toBe(
      422,
    );
    expect(
      query.mock.calls.some(([sql]) => sql.includes('INSERT INTO analiza.quote_decisions')),
    ).toBe(false);
  });

  it('freezes a rejected draft with its reason and creates no admission', async () => {
    const reason = 'El paciente rechazó la propuesta sintética.';
    const queries: Array<{ sql: string; params?: unknown[] }> = [];
    const query = vi.fn(async (sql: string, params?: unknown[]) => {
      queries.push({ sql, params });
      if (sql.includes('SELECT body,record_version,root_quote_id'))
        return rows([{ body: quote, record_version: 1, root_quote_id: quote.id }]);
      if (sql.includes('SELECT') && sql.includes('quote_decisions')) return rows([]);
      if (sql.includes('UPDATE analiza.quotes')) return { rows: [], rowCount: 1 };
      if (sql.includes('INSERT INTO analiza.quote_decisions'))
        return rows([
          {
            id: decisionId,
            quote_id: quote.id,
            decision: 'NOT_APPROVED',
            reason,
            created_at: new Date('2026-10-29T10:00:00.000Z'),
          },
        ]);
      return rows([]);
    });
    vi.mocked(transaction).mockImplementation(async (_pool, _actor, operation) =>
      operation({ query } as never),
    );
    const response = await POST(
      request({ id: decisionId, decision: 'NOT_APPROVED', reason }),
      context,
    );
    expect(response.status).toBe(201);
    expect(queries.some(({ sql }) => sql.includes('UPDATE analiza.quotes'))).toBe(true);
    expect(queries.some(({ sql }) => sql.includes('INSERT INTO analiza.hospitalizations'))).toBe(
      false,
    );
    expect(
      queries.some(
        ({ sql, params }) =>
          sql.includes('INSERT INTO analiza.quote_decisions') && params?.[5] === reason,
      ),
    ).toBe(true);
  });
});
