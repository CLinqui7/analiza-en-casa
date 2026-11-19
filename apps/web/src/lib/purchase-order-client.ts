import { mongoMutationHeaders } from './auth';
import { purchaseOrderSchema, type OrderAction } from './purchase-order';

export async function updatePurchaseOrder(id: string, action: OrderAction) {
  const response = await fetch(`/api/purchase-orders?id=${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...mongoMutationHeaders() },
    body: JSON.stringify(action),
  });
  const payload = await response.json();
  if (!response.ok)
    throw new Error(
      typeof payload.error === 'string' ? payload.error : 'No se pudo guardar la orden.',
    );
  return purchaseOrderSchema.parse(payload);
}
