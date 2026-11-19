import { describe, expect, it } from 'vitest';
import { quoteDecisionInputSchema } from './quote-decision';

const id = 'c9fa2c1d-886a-4c8a-9786-ff878523fcca';
describe('quote approval decision', () => {
  it('requires a bounded written reason when rejected', () => {
    expect(quoteDecisionInputSchema.safeParse({ id, decision: 'NOT_APPROVED' }).success).toBe(
      false,
    );
    expect(
      quoteDecisionInputSchema.safeParse({
        id,
        decision: 'NOT_APPROVED',
        reason: 'El paciente no aceptó el presupuesto.',
      }).success,
    ).toBe(true);
    expect(
      quoteDecisionInputSchema.safeParse({ id, decision: 'NOT_APPROVED', reason: ' '.repeat(3) })
        .success,
    ).toBe(false);
    expect(
      quoteDecisionInputSchema.safeParse({ id, decision: 'NOT_APPROVED', reason: 'x'.repeat(1001) })
        .success,
    ).toBe(false);
  });
  it('rejects a non-approval reason on approved decisions', () => {
    expect(
      quoteDecisionInputSchema.safeParse({ id, decision: 'APPROVED', reason: 'COST' }).success,
    ).toBe(false);
  });
});
