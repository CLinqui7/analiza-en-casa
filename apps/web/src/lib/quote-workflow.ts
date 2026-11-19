import type { Quote } from '@analiza/contracts';
import type { QuoteDecision } from './quote-decision';

export const quoteRoot = (quote: Quote) => quote.rootQuoteId ?? quote.originalQuoteId ?? quote.id;
export type QuoteWorkflowStatus = 'DRAFT' | 'SENT' | 'APPROVED' | 'NOT_APPROVED';
export const quoteStatusLabels: Record<QuoteWorkflowStatus, string> = {
  DRAFT: 'Borrador',
  SENT: 'Enviada',
  APPROVED: 'Aprobada',
  NOT_APPROVED: 'Rechazada',
};
export function latestLogicalQuotes(quotes: readonly Quote[]): Quote[] {
  const latest = new Map<string, Quote>();
  for (const quote of quotes) {
    const previous = latest.get(quoteRoot(quote));
    if (!previous || quote.version > previous.version) latest.set(quoteRoot(quote), quote);
  }
  return [...latest.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export function quoteWorkflowStatus(
  quote: Quote,
  quotes: readonly Quote[],
  decisions: readonly QuoteDecision[],
): QuoteWorkflowStatus {
  const ids = new Set(
    quotes.filter((item) => quoteRoot(item) === quoteRoot(quote)).map((item) => item.id),
  );
  const decision = decisions
    .filter((item) => ids.has(item.quoteId))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  return decision?.decision ?? quote.status;
}
