import type { Quote } from '@analiza/contracts';
import { describe, expect, it } from 'vitest';
import {
  formatQuoteSavedDate,
  formatQuoteSavedTime,
  newestSavedQuotesFirst,
  quoteLastSavedAt,
} from './quote-timestamps';

const base = {
  caseId: 'case-1',
  patientId: 'patient-1',
  version: 1,
  status: 'DRAFT',
  summary: 'Seguimiento',
  items: [],
  subtotal: 0,
  discountAmount: 0,
  total: 0,
  insurerAmount: 0,
  patientAmount: 0,
  immutable: false,
} satisfies Omit<Quote, 'id' | 'createdAt'>;

describe('quote save timestamps', () => {
  it('orders the latest persisted changes first without mutating the source', () => {
    const quotes: Quote[] = [
      {
        ...base,
        id: 'older-edited',
        createdAt: '2026-09-20T10:00:00.000Z',
        updatedAt: '2026-09-29T19:00:00.000Z',
      },
      { ...base, id: 'newer-created', createdAt: '2026-09-28T10:00:00.000Z' },
      { ...base, id: 'oldest', createdAt: '2026-09-19T10:00:00.000Z' },
    ];

    expect(newestSavedQuotesFirst(quotes).map((quote) => quote.id)).toEqual([
      'older-edited',
      'newer-created',
      'oldest',
    ]);
    expect(quotes[0].id).toBe('older-edited');
    expect(quoteLastSavedAt(quotes[1])).toBe(quotes[1].createdAt);
  });

  it('formats day and time in the same Salvadoran timezone', () => {
    const savedAt = '2026-09-29T19:00:00.000Z';
    expect(formatQuoteSavedDate(savedAt)).toContain('2026');
    expect(formatQuoteSavedTime(savedAt)).toContain('1:00');
  });
});
