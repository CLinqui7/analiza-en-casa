import type { Payment, Quote } from '@analiza/contracts';
import { calculateQuoteBalance } from '@analiza/domain';

export const quoteAccountRoot = (quote: Quote) =>
  quote.rootQuoteId ?? quote.originalQuoteId ?? quote.id;

/** Quotes and accounts display the same current balance; drafts never replace a sent charge. */
export function balanceForQuote(
  quote: Quote,
  accounts: ReturnType<typeof receivableAccounts>,
  payments: readonly Payment[],
) {
  const account = accounts.find(
    (candidate) => quoteAccountRoot(candidate.quote) === quoteAccountRoot(quote),
  );
  return account
    ? { paid: account.paid, balance: account.balance, version: account.quote.version }
    : { ...calculateQuoteBalance(quote, payments), version: null };
}

/** Last sent version per quote chain, with payments across that same chain. No inferred taxes. */
export function receivableAccounts(quotes: readonly Quote[], payments: readonly Payment[]) {
  const root = quoteAccountRoot;
  const byId = new Map(quotes.map((quote) => [quote.id, quote]));
  const latest = new Map<string, Quote>();
  for (const quote of quotes) {
    if (quote.status !== 'SENT') continue;
    const previous = latest.get(root(quote));
    if (!previous || previous.version < quote.version) latest.set(root(quote), quote);
  }
  const paid = new Map<string, number>();
  for (const payment of payments) {
    if (payment.status !== 'APPLIED') continue;
    const quote = byId.get(payment.quoteId);
    if (!quote) continue;
    paid.set(root(quote), (paid.get(root(quote)) ?? 0) + Math.round(payment.amount * 100));
  }
  return [...latest].map(([id, quote]) => {
    const paidCents = paid.get(id) ?? 0;
    const responsibilityCents = Math.round(quote.patientAmount * 100);
    return {
      quote,
      responsibility: responsibilityCents / 100,
      paid: paidCents / 100,
      balance: (responsibilityCents - paidCents) / 100,
    };
  });
}
