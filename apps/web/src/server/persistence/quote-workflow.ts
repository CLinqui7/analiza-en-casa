import type { PoolClient } from 'pg';
import type { Quote } from '@analiza/contracts';
import { MongoInputError, type ServerActor } from '../validation/patients';

/** All quote writers lock the logical root first, including decisions and fulfillment. */
export async function lockQuoteRoot(client: PoolClient, actor: ServerActor, id: string) {
  const result = await client.query<{ root_quote_id: string }>(
    'SELECT root_quote_id FROM analiza.quotes WHERE organization_id=$1 AND id=$2',
    [actor.organizationId, id],
  );
  const root = result.rows[0]?.root_quote_id;
  if (root)
    await client.query(
      'SELECT id FROM analiza.quotes WHERE organization_id=$1 AND id=$2 FOR UPDATE',
      [actor.organizationId, root],
    );
  return root;
}
export async function requireOpenQuote(client: PoolClient, actor: ServerActor, rootId: string) {
  const decision = await client.query(
    `SELECT 1 FROM analiza.quote_decisions d JOIN analiza.quotes q
     ON q.organization_id=d.organization_id AND q.id=d.quote_id
     WHERE q.organization_id=$1 AND q.root_quote_id=$2 LIMIT 1`,
    [actor.organizationId, rootId],
  );
  if (decision.rowCount)
    throw new MongoInputError('Las cotizaciones aprobadas o rechazadas ya no se pueden editar.');
}
export async function preserveDeliveredLines(
  client: PoolClient,
  actor: ServerActor,
  quote: Quote,
  previous: Quote,
) {
  const deliveries = await client.query<{ line_id: string; quantity: string }>(
    'SELECT line_id,sum(quantity) AS quantity FROM analiza.received_order_deliveries WHERE organization_id=$1 AND root_quote_id=$2 GROUP BY line_id',
    [actor.organizationId, previous.rootQuoteId ?? previous.originalQuoteId ?? previous.id],
  );
  for (const delivery of deliveries.rows) {
    const next = quote.items.find((item) => item.id === delivery.line_id);
    const old = previous.items.find((item) => item.id === delivery.line_id);
    if (
      !next ||
      !old ||
      next.inventoryItemId !== old.inventoryItemId ||
      next.category !== old.category ||
      next.quantity < Number(delivery.quantity)
    )
      throw new MongoInputError(
        'No se puede quitar, sustituir ni reducir una línea por debajo de la cantidad ya entregada.',
      );
  }
}
