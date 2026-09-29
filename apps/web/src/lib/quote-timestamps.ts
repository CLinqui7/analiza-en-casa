import type { Quote } from '@analiza/contracts';

type QuoteTimestamp = Pick<Quote, 'createdAt' | 'updatedAt'>;

const timeZone = 'America/El_Salvador';
const dateFormatter = new Intl.DateTimeFormat('es-SV', { dateStyle: 'medium', timeZone });
const timeFormatter = new Intl.DateTimeFormat('es-SV', { timeStyle: 'short', timeZone });

export function quoteLastSavedAt(quote: QuoteTimestamp): string {
  return quote.updatedAt ?? quote.createdAt;
}

export function newestSavedQuotesFirst(quotes: readonly Quote[]): Quote[] {
  return [...quotes].sort((left, right) => {
    const lastSavedDifference =
      Date.parse(quoteLastSavedAt(right)) - Date.parse(quoteLastSavedAt(left));
    if (Number.isFinite(lastSavedDifference) && lastSavedDifference !== 0)
      return lastSavedDifference;
    return right.createdAt.localeCompare(left.createdAt) || left.id.localeCompare(right.id);
  });
}

export function formatQuoteSavedDate(value: string): string {
  return dateFormatter.format(new Date(value));
}

export function formatQuoteSavedTime(value: string): string {
  return timeFormatter.format(new Date(value));
}
