import { z } from 'zod';

export const quoteDecisionReasonSchema = z.string().trim().min(1).max(1000);

export const quoteDecisionInputSchema = z.discriminatedUnion('decision', [
  z
    .object({ id: z.string().uuid(), decision: z.literal('APPROVED'), reason: z.null().optional() })
    .strict(),
  z
    .object({
      id: z.string().uuid(),
      decision: z.literal('NOT_APPROVED'),
      reason: quoteDecisionReasonSchema,
    })
    .strict(),
]);

export const quoteDecisionSchema = z.object({
  id: z.string().uuid(),
  quoteId: z.string(),
  decision: z.enum(['APPROVED', 'NOT_APPROVED']),
  reason: quoteDecisionReasonSchema.nullable(),
  createdAt: z.string().datetime(),
});

export type QuoteDecision = z.infer<typeof quoteDecisionSchema>;

/** Labels for decisions recorded before free-text rejection reasons were enabled. */
export const quoteDecisionReasonLabels: Record<string, string> = {
  COST: 'Costos',
  DEATH: 'Fallecimiento',
  INSURER_NOT_APPROVED: 'No aprobación de la aseguradora',
  OUT_OF_COVERAGE: 'Fuera del área de cobertura',
  CONTINUE_IN_HOSPITAL: 'Continuará su servicio en el hospital',
};
