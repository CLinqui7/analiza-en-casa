import type { Hospitalization, Quote } from '@analiza/contracts';
export function caseQuotes(quotes: Quote[], hospitalization?: Hospitalization) {
  if (!hospitalization) return [];
  const roots = new Map<string, Quote>();
  for (const quote of quotes.filter(
    (quote) =>
      quote.patientId === hospitalization.patientId &&
      (quote.caseId === hospitalization.id || hospitalization.linkedQuoteIds?.includes(quote.id)),
  )) {
    const root = quote.rootQuoteId ?? quote.originalQuoteId ?? quote.id;
    if (!roots.has(root) || roots.get(root)!.version < quote.version) roots.set(root, quote);
  }
  return [...roots.values()];
}
export const clinicalDate = () => new Date().toLocaleDateString('en-CA');
export function printClinicalSection(id: string) {
  const section = document.getElementById(id);
  if (!section) return;
  section.classList.add('clinical-print-target');
  document.body.classList.add('clinical-printing');
  const cleanup = () => {
    section.classList.remove('clinical-print-target');
    document.body.classList.remove('clinical-printing');
  };
  window.addEventListener('afterprint', cleanup, { once: true });
  window.print();
  window.setTimeout(cleanup, 1000);
}
