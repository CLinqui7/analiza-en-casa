import { describe, expect, it } from 'vitest';
import { can, permissionForPath } from './permissions';
import { supplyRequestInputSchema } from './supply-requests';

const valid = {
  idempotencyKey: '11111111-1111-4111-8111-111111111111',
  patientId: 'synthetic-patient',
  catalogItemId: 'synthetic-supply',
  quantity: 2,
  priority: 'MEDIUM',
  note: 'Entrega de material sintético',
};

describe('internal supply requests', () => {
  it('requires a bounded quantity, declared priority and idempotency key', () => {
    expect(supplyRequestInputSchema.safeParse(valid).success).toBe(true);
    expect(supplyRequestInputSchema.safeParse({ ...valid, quantity: 0 }).success).toBe(false);
    expect(supplyRequestInputSchema.safeParse({ ...valid, quantity: 1.5 }).success).toBe(false);
    expect(supplyRequestInputSchema.safeParse({ ...valid, priority: 'URGENT' }).success).toBe(
      false,
    );
    expect(supplyRequestInputSchema.safeParse({ ...valid, idempotencyKey: 'reuse' }).success).toBe(
      false,
    );
    expect(supplyRequestInputSchema.safeParse({ ...valid, organizationId: 'other' }).success).toBe(
      false,
    );
  });

  it('limits request creation to nursing and administrative roles', () => {
    expect(permissionForPath('/supply-requests')).toBe('supply-requests:read');
    expect(can('NURSE', 'supply-requests:write')).toBe(true);
    expect(can('NURSE_MANAGER', 'supply-requests:write')).toBe(true);
    expect(can('WEBMASTER', 'supply-requests:write')).toBe(true);
    expect(can('INVENTORY', 'supply-requests:read')).toBe(true);
    expect(can('INVENTORY', 'supply-requests:write')).toBe(false);
    expect(can('DOCTOR', 'supply-requests:read')).toBe(false);
  });
});
