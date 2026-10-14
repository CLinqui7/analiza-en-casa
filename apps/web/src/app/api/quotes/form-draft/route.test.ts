import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { CsrfError, SessionError } from '@/server/auth-service';
import { persistence } from '@/server/persistence';
import { postgresPool, transaction } from '@/server/persistence/postgres-pool';
import { DELETE, GET, PUT } from './route';

vi.mock('@/server/persistence', () => ({ persistence: vi.fn() }));
vi.mock('@/server/persistence/postgres-pool', () => ({
  postgresPool: vi.fn(),
  transaction: vi.fn(),
}));

const actor = { userId: 'synthetic-user', organizationId: 'synthetic-org', role: 'ADMIN' };
const draft = {
  caseId: '',
  patientId: '',
  patientQuery: '',
  referralQuery: '',
  summary: 'Cotización sintética',
  careSetting: 'HOSPITALIZATION',
  comments: '',
  paymentCondition: '',
  invoiceDate: '2026-10-14',
  invoiceDocumentType: 'INVOICE',
  discountGroup: 'Regular',
  referralLabel: '',
  referralSelections: [],
  items: [],
  insurerAmount: 0,
  revisionReason: '',
};
const query = vi.fn(async (sql: string, params?: unknown[]) => {
  void params;
  return {
    rows: sql.startsWith('SELECT body')
      ? [{ body: draft, updated_at: new Date('2026-10-14T00:00:00Z') }]
      : [],
  };
});
const requireSession = vi.fn(async (token?: string) => {
  if (token !== 'synthetic-session') throw new SessionError();
  return actor;
});
const requireCsrf = vi.fn(async (_token?: string, csrf?: string) => {
  if (csrf !== 'synthetic-csrf') throw new CsrfError();
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('ANALIZA_DATA_MODE', 'postgresql');
  vi.mocked(persistence).mockResolvedValue({ auth: { requireSession, requireCsrf } } as never);
  vi.mocked(postgresPool).mockReturnValue({} as never);
  vi.mocked(transaction).mockImplementation(async (_pool, _actor, operation) =>
    operation({ query } as never),
  );
});
afterEach(() => vi.unstubAllEnvs());

function request(method: 'GET' | 'PUT' | 'DELETE', body?: unknown, csrf?: string) {
  return new NextRequest('http://localhost/api/quotes/form-draft?key=quote.create.new', {
    method,
    headers: {
      cookie: 'analiza_session=synthetic-session',
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(csrf ? { 'x-analiza-csrf': csrf } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

describe('private quote form draft boundary', () => {
  it('requires a session and returns only the authenticated user draft', async () => {
    expect(
      (await GET(new NextRequest('http://localhost/api/quotes/form-draft?key=quote.create.new')))
        .status,
    ).toBe(401);
    const response = await GET(request('GET'));
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(query).toHaveBeenCalledWith(expect.stringContaining('user_id=$2'), [
      actor.organizationId,
      actor.userId,
      'quote.create.new',
    ]);
  });

  it('does not expose drafts to a read-only role', async () => {
    requireSession.mockResolvedValueOnce({ ...actor, role: 'AUDITOR' });
    expect((await GET(request('GET'))).status).toBe(403);
    expect(query).not.toHaveBeenCalled();
  });

  it('requires CSRF and never trusts a browser supplied owner', async () => {
    expect((await PUT(request('PUT', draft))).status).toBe(403);
    expect(query).not.toHaveBeenCalled();
    const response = await PUT(
      request('PUT', { ...draft, userId: 'another-user' }, 'synthetic-csrf'),
    );
    expect(response.status).toBe(200);
    const insert = query.mock.calls.find(([sql]) =>
      sql.includes('INSERT INTO analiza.quote_form_drafts'),
    );
    expect(insert?.[1]).toEqual([
      actor.organizationId,
      actor.userId,
      'quote.create.new',
      expect.not.stringContaining('another-user'),
    ]);
  });

  it('rejects malformed draft data and scopes deletion', async () => {
    expect(
      (await PUT(request('PUT', { ...draft, insurerAmount: -1 }, 'synthetic-csrf'))).status,
    ).toBe(400);
    expect(query).not.toHaveBeenCalled();
    expect((await DELETE(request('DELETE', undefined, 'synthetic-csrf'))).status).toBe(200);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM analiza.quote_form_drafts'),
      [actor.organizationId, actor.userId, 'quote.create.new'],
    );
  });
});
