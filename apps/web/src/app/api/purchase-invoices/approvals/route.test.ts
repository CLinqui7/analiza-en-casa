import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { persistence } from '@/server/persistence';
import { postgresPool, transaction } from '@/server/persistence/postgres-pool';
import { POST } from './route';

vi.mock('@/server/persistence', () => ({ persistence: vi.fn() }));
vi.mock('@/server/persistence/postgres-pool', () => ({
  postgresPool: vi.fn(),
  transaction: vi.fn(),
}));

const actor = { userId: 'finance-qa', organizationId: 'org-qa', role: 'FINANCE' };
const purchase = {
  id: 'line-qa',
  catalogItemId: 'item-qa',
  supplierCatalogItemId: 'supplier-qa',
  warehouseId: 'warehouse-qa',
  reference: 'REF-QA',
  invoiceNumber: 'INV-QA',
  invoiceGroupId: 'group-qa',
  quantity: 2,
  unitCost: 10,
  taxRates: { iva: 0.13, perception: 0 },
  status: 'RECEIVED',
  createdAt: '2026-10-29T00:00:00.000Z',
};
const rows = (items: unknown[]) => ({ rows: items, rowCount: items.length });
const approvalRow = {
  invoice_group_id: 'group-qa',
  purchase_order_id: null,
  invoice_number: 'INV-QA',
  supplier_catalog_item_id: 'supplier-qa',
  total_cents: '2260',
  approved_at: new Date('2026-10-29T10:00:00.000Z'),
};
function request() {
  return new NextRequest('http://localhost/api/purchase-invoices/approvals', {
    method: 'POST',
    headers: {
      cookie: 'analiza_session=session-qa',
      'x-analiza-csrf': 'csrf-qa',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ invoiceGroupId: 'group-qa' }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('ANALIZA_DATA_MODE', 'postgresql');
  vi.mocked(persistence).mockResolvedValue({
    auth: {
      requireSession: vi.fn().mockResolvedValue(actor),
      requireCsrf: vi.fn().mockResolvedValue(undefined),
    },
  } as never);
  vi.mocked(postgresPool).mockReturnValue({} as never);
});
afterEach(() => vi.unstubAllEnvs());

describe('purchase invoice approval', () => {
  it('creates an audited payable from received invoice totals, scoped to the organization', async () => {
    const query = vi.fn(async (sql: string, params?: unknown[]) => {
      if (sql.includes('SELECT id,body FROM analiza.purchases'))
        return rows([{ id: purchase.id, body: purchase }]);
      if (sql.includes('SELECT invoice_group_id')) return rows([]);
      if (sql.includes('INSERT INTO analiza.purchase_invoice_approvals')) {
        expect(params).toEqual([
          actor.organizationId,
          'group-qa',
          null,
          'INV-QA',
          'supplier-qa',
          2260,
          actor.userId,
        ]);
        return rows([approvalRow]);
      }
      return rows([]);
    });
    vi.mocked(transaction).mockImplementation(async (_pool, _actor, operation) =>
      operation({ query } as never),
    );
    const response = await POST(request());
    expect(response.status).toBe(201);
    expect((await response.json()).total).toBe(22.6);
    expect(query.mock.calls.some(([sql]) => sql.includes('INSERT INTO analiza.audit_events'))).toBe(
      true,
    );
    expect(
      query.mock.calls.every(([, params]) => !params || params[0] === actor.organizationId),
    ).toBe(true);
  });

  it('rejects an invoice that was not received without creating a payable', async () => {
    const query = vi.fn(async (sql: string) =>
      sql.includes('SELECT id,body FROM analiza.purchases')
        ? rows([{ id: purchase.id, body: { ...purchase, status: 'DRAFT' } }])
        : rows([]),
    );
    vi.mocked(transaction).mockImplementation(async (_pool, _actor, operation) =>
      operation({ query } as never),
    );
    expect((await POST(request())).status).toBe(400);
    expect(
      query.mock.calls.some(([sql]) =>
        sql.includes('INSERT INTO analiza.purchase_invoice_approvals'),
      ),
    ).toBe(false);
  });
});
