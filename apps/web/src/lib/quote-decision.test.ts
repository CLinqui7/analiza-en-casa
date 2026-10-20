import { describe, expect, it } from 'vitest';
import { quoteDecisionInputSchema } from './quote-decision';

const id = 'c9fa2c1d-886a-4c8a-9786-ff878523fcca';
describe('quote approval decision', () => {
  it('requires one of the stated reasons when not approved', () => {
    expect(quoteDecisionInputSchema.safeParse({ id, decision: 'NOT_APPROVED' }).success).toBe(
      false,
    );
    expect(
      quoteDecisionInputSchema.safeParse({ id, decision: 'NOT_APPROVED', reason: 'COST' }).success,
    ).toBe(true);
    expect(
      quoteDecisionInputSchema.safeParse({ id, decision: 'NOT_APPROVED', reason: 'OTHER' }).success,
    ).toBe(false);
  });
  it('rejects a non-approval reason on approved decisions', () => {
    expect(
      quoteDecisionInputSchema.safeParse({ id, decision: 'APPROVED', reason: 'COST' }).success,
    ).toBe(false);
  });
});
