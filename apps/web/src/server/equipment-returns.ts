import { homeCustodySchema, type HomeCustody } from '@analiza/contracts';
import { z } from 'zod';
import { MongoInputError } from './validation/patients';

export const equipmentReturnSchema = z
  .object({
    id: z.uuid(),
    custodyId: z.string().trim().min(1).max(200),
    quantity: z.number().int().positive().max(1000000),
    receivedAt: z.iso.datetime(),
  })
  .strict();
export type EquipmentReturn = z.infer<typeof equipmentReturnSchema>;

export function applyEquipmentReturn(
  current: HomeCustody,
  receipt: EquipmentReturn,
  actorId: string,
) {
  if (current.status !== 'OPEN' || receipt.quantity > current.quantity - current.returnedQuantity)
    throw new MongoInputError(
      'La devolución supera la cantidad que el paciente aún tiene de este préstamo.',
    );
  const returnedQuantity = current.returnedQuantity + receipt.quantity;
  const complete = returnedQuantity === current.quantity;
  return homeCustodySchema.parse({
    ...current,
    returnedQuantity,
    status: complete ? 'CLOSED' : 'OPEN',
    receivedAt: receipt.receivedAt,
    ...(complete ? { closeKey: receipt.id } : {}),
    returns: [
      ...(current.returns ?? []),
      {
        id: receipt.id,
        quantity: receipt.quantity,
        receivedAt: receipt.receivedAt,
        receivedBy: actorId,
      },
    ],
  });
}
