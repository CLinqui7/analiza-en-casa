'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { type InventoryMovement } from '@analiza/contracts';
import { canRecordMovement, currentInventoryBalance, deriveKardex } from '@analiza/domain';
import { Button, Dialog, EmptyState, Panel, StatusTag } from '@analiza/ui';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { useWorkspace } from '@/components/providers';

const itemId = 'inventory-demo-kit';
const movementFormSchema = z.object({
  kind: z.enum(['ENTRY', 'EXIT', 'ADJUSTMENT']),
  adjustmentDirection: z.enum(['IN', 'OUT']).optional(),
  quantity: z.coerce.number().int().positive('La cantidad debe ser un entero positivo.'),
  reason: z.string().trim().min(1, 'Indique el motivo del movimiento.'),
});
type MovementFormInput = z.input<typeof movementFormSchema>;
type MovementForm = z.output<typeof movementFormSchema>;

const kindLabel = { ENTRY: 'Entrada', EXIT: 'Salida', ADJUSTMENT: 'Ajuste' };

export default function KardexPage() {
  const { addInventoryMovement, inventoryMovements } = useWorkspace();
  const [isOpen, setOpen] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const rows = deriveKardex(inventoryMovements, itemId).slice().reverse();
  const balance = currentInventoryBalance(inventoryMovements, itemId);
  const form = useForm<MovementFormInput, unknown, MovementForm>({
    resolver: zodResolver(movementFormSchema),
    defaultValues: { kind: 'ENTRY', quantity: 1, reason: '' },
  });
  const kind = useWatch({ control: form.control, name: 'kind' });

  function closeDialog() {
    setOpen(false);
    form.reset();
  }
  function submit(values: MovementForm) {
    const movement: InventoryMovement = {
      id: crypto.randomUUID(),
      itemId,
      createdAt: new Date().toISOString(),
      kind: values.kind,
      adjustmentDirection:
        values.kind === 'ADJUSTMENT' ? (values.adjustmentDirection ?? 'IN') : undefined,
      quantity: values.quantity,
      reason: values.reason,
    };
    if (!canRecordMovement(inventoryMovements, movement)) {
      form.setError('quantity', {
        type: 'validate',
        message:
          'El movimiento dejaría un saldo negativo; corrija la cantidad o registre una entrada auditada.',
      });
      return;
    }
    addInventoryMovement(movement);
    setResult('Movimiento agregado. El saldo se recalculó desde el kárdex, sin edición directa.');
    closeDialog();
  }

  return (
    <div className="page-stack">
      <header className="page-header page-header-actions">
        <div>
          <p className="eyebrow">Inventario</p>
          <h1>Kárdex</h1>
          <p>Saldo calculado a partir de entradas, salidas y ajustes auditados.</p>
        </div>
        <Button
          onClick={() => {
            setResult(null);
            setOpen(true);
          }}
          type="button"
        >
          Registrar movimiento
        </Button>
      </header>
      {result ? (
        <p className="notice success" role="status">
          {result}
        </p>
      ) : null}
      <section className="metric-grid">
        <Panel>
          <span>Ítem de demostración</span>
          <strong>Kit operativo demo</strong>
        </Panel>
        <Panel>
          <span>Saldo derivado</span>
          <strong>{balance}</strong>
        </Panel>
        <Panel>
          <span>Movimientos</span>
          <strong>{rows.length}</strong>
        </Panel>
      </section>
      <Panel>
        <div className="table-heading">
          <h2>Historial inmutable</h2>
          <StatusTag tone={balance > 0 ? 'success' : 'warning'}>
            {balance > 0 ? 'Saldo disponible' : 'Sin saldo'}
          </StatusTag>
        </div>
        {rows.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Tipo</th>
                  <th>Motivo</th>
                  <th>Variación</th>
                  <th>Saldo</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>{new Date(row.createdAt).toLocaleString('es-SV')}</td>
                    <td>
                      {kindLabel[row.kind]}
                      {row.kind === 'ADJUSTMENT'
                        ? ` ${row.adjustmentDirection === 'OUT' ? '(-)' : '(+)'}`
                        : ''}
                    </td>
                    <td>{row.reason}</td>
                    <td className={row.delta >= 0 ? 'positive-value' : 'negative-value'}>
                      {row.delta >= 0 ? '+' : ''}
                      {row.delta}
                    </td>
                    <td>{row.balance}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            detail="Registre una entrada para iniciar el historial."
            title="Sin movimientos"
          />
        )}
      </Panel>
      <Dialog
        description="El saldo no es editable: se obtiene del historial ordenado de movimientos."
        footer={
          <>
            <Button className="button-secondary" onClick={closeDialog} type="button">
              Cancelar
            </Button>
            <Button form="movement-form" type="submit">
              Guardar movimiento
            </Button>
          </>
        }
        onClose={closeDialog}
        open={isOpen}
        title="Registrar movimiento de inventario"
      >
        <form
          className="form-grid"
          id="movement-form"
          noValidate
          onSubmit={form.handleSubmit(submit)}
        >
          <label>
            Tipo de movimiento
            <select
              {...form.register('kind')}
              onChange={(event) => {
                form.setValue('kind', event.target.value as MovementForm['kind']);
                form.clearErrors('quantity');
              }}
            >
              <option value="ENTRY">Entrada</option>
              <option value="EXIT">Salida</option>
              <option value="ADJUSTMENT">Ajuste</option>
            </select>
          </label>
          {kind === 'ADJUSTMENT' ? (
            <label>
              Dirección del ajuste
              <select {...form.register('adjustmentDirection')}>
                <option value="IN">Aumenta saldo</option>
                <option value="OUT">Reduce saldo</option>
              </select>
            </label>
          ) : null}
          <label>
            Cantidad
            <input {...form.register('quantity')} min="1" type="number" />
            {form.formState.errors.quantity ? (
              <span className="field-error">{form.formState.errors.quantity.message}</span>
            ) : null}
          </label>
          <label>
            Motivo
            <input {...form.register('reason')} />
            {form.formState.errors.reason ? (
              <span className="field-error">{form.formState.errors.reason.message}</span>
            ) : null}
          </label>
        </form>
      </Dialog>
    </div>
  );
}
