import { quoteLineOrigin } from '@/lib/quote-line-origin';

export function QuoteLineOrigin({ id }: { id: string }) {
  const origin = quoteLineOrigin(id);
  return (
    <span className="quote-line-origin" data-additional={origin === 'Adicional'}>
      {origin}
    </span>
  );
}
