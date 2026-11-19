'use client';

import { Button, Dialog, Panel } from '@analiza/ui';
import type { CatalogItem } from '@analiza/contracts';
import { useState, type FormEvent } from 'react';
import {
  receiptDocumentNames,
  receiptWarehouseNames,
  type PurchaseOrder,
  type OrderAction,
} from '@/lib/purchase-order';
import styles from './receipt.module.css';
import { updatePurchaseOrder } from '@/lib/purchase-order-client';

type Props = {
  orders: PurchaseOrder[];
  catalog: CatalogItem[];
  canReceive: boolean;
  canCancel: boolean;
  onSaved: (order: PurchaseOrder) => Promise<boolean>;
};

export function ApprovedOrders({ orders, catalog, canReceive, canCancel, onSaved }: Props) {
  const [selected, setSelected] = useState<PurchaseOrder | null>(null);
  const [mode, setMode] = useState<'receive' | 'cancel'>('receive');
  const [kind, setKind] = useState<keyof typeof receiptDocumentNames>('INVOICE');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const equipment = new Set(
    catalog.filter((item) => item.category === 'EQUIPMENT').map((item) => item.id),
  );
  const approved = orders.filter((order) => order.status === 'APPROVED');
  function open(order: PurchaseOrder, action: typeof mode) {
    setSelected(order);
    setMode(action);
    setKind('INVOICE');
    setError('');
    setMessage('');
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || busy) return;
    const data = new FormData(event.currentTarget);
    const value = (name: string) => String(data.get(name) ?? '').trim();
    const action: OrderAction =
      mode === 'cancel'
        ? { action: 'cancel', revision: selected.revision, reason: value('reason') }
        : {
            action: 'receive',
            revision: selected.revision,
            destination: value('destination') as keyof typeof receiptWarehouseNames,
            documentKind: kind,
            documentNumber: value('number'),
            lines: selected.items.map((_, index) => ({
              index,
              quantity: Number(value('qty' + index)),
              lotNumber: value('lot' + index),
              expiresOn: value('expiry' + index),
              serialNumbers: value('series' + index)
                .split(/\r?\n/)
                .map((s) => s.trim())
                .filter(Boolean),
              usefulLife: value('life' + index),
              isFixedAsset: data.has('asset' + index),
            })),
          };
    setBusy(true);
    setError('');
    try {
      const order = await updatePurchaseOrder(selected.id, action);
      setSelected(null);
      const synced = await onSaved(order);
      setMessage(
        (mode === 'cancel'
          ? 'Orden anulada.'
          : 'Recepción registrada en el Kárdex. El documento ya está disponible en Cuentas por pagar para revisión financiera.') +
          (synced ? '' : ' Actualice la página para cargar el historial guardado.'),
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo guardar.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Panel>
      <div className="table-heading">
        <div>
          <h2>Por recibir</h2>
          <p className="field-help">Órdenes aprobadas pendientes de recepción.</p>
        </div>
        <span className="status-pill">{approved.length} pendientes</span>
      </div>
      {message ? (
        <p role="status" className="notice success">
          {message}
        </p>
      ) : null}
      {approved.length ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Orden</th>
                <th>Proveedor</th>
                <th>Productos</th>
                <th>Total de referencia</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {approved.map((order) => (
                <tr key={order.id}>
                  <td>{order.orderNumber}</td>
                  <td>{order.supplierName}</td>
                  <td>{order.items.map((item) => item.name).join(', ')}</td>
                  <td>USD {order.total.toFixed(2)}</td>
                  <td>
                    <div className="action-row">
                      {canReceive ? (
                        <Button onClick={() => open(order, 'receive')}>Recibir líneas</Button>
                      ) : null}
                      <a
                        className="action-link-button action-link-button--inline"
                        href={`/api/purchase-orders/${order.id}/pdf`}
                      >
                        Descargar PDF
                      </a>
                      <a
                        className="action-link-button action-link-button--inline"
                        href={`/api/purchase-orders/${order.id}/pdf?inline=1`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Imprimir
                      </a>
                      {canCancel ? (
                        <Button className="button-secondary" onClick={() => open(order, 'cancel')}>
                          Anular
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="field-help">Al aprobar una orden de compra, aparecerá aquí.</p>
      )}
      <Dialog
        open={Boolean(selected)}
        onClose={() => {
          if (!busy) setSelected(null);
        }}
        title={mode === 'receive' ? 'Recibir líneas' : 'Anular orden de compra'}
        description={selected?.supplierName ?? ''}
        footer={
          <>
            <Button className="button-secondary" disabled={busy} onClick={() => setSelected(null)}>
              Volver
            </Button>
            <Button disabled={busy} type="submit" form="order-receipt">
              {busy ? 'Guardando…' : mode === 'receive' ? 'Guardar recepción' : 'Anular orden'}
            </Button>
          </>
        }
      >
        {selected ? (
          <form
            key={selected.id + mode}
            id="order-receipt"
            className={styles.receiving}
            onSubmit={submit}
          >
            {mode === 'cancel' ? (
              <label>
                Motivo de anulación
                <textarea name="reason" maxLength={1000} required />
              </label>
            ) : (
              <>
                <div className="form-grid">
                  <label>
                    Bodega destino
                    <select name="destination" required defaultValue="">
                      <option value="" disabled>
                        Seleccione la bodega
                      </option>
                      {Object.entries(receiptWarehouseNames).map(([key, label]) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Tipo de documento
                    <select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
                      {Object.entries(receiptDocumentNames).map(([key, label]) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Número de {receiptDocumentNames[kind].toLowerCase()}
                    <input name="number" maxLength={100} required />
                  </label>
                </div>
                {kind === 'CREDIT_NOTE' ? (
                  <p className="field-help">
                    Financiero podrá consultar la nota para su conciliación con la factura original.
                  </p>
                ) : null}
                {selected.items.map((item, i) => (
                  <fieldset className="form-section" key={i}>
                    <legend>{item.name}</legend>
                    <div className="form-grid">
                      <label>
                        Cantidad recibida · {item.quantity} solicitadas
                        <input
                          type="number"
                          name={'qty' + i}
                          required
                          defaultValue={item.quantity}
                          min={0}
                          max={item.quantity}
                          step={1}
                        />
                      </label>
                      <label>
                        Vida útil del artículo
                        <input name={'life' + i} maxLength={120} />
                      </label>
                      <label>
                        Lote
                        <input name={'lot' + i} maxLength={120} />
                      </label>
                      <label>
                        Fecha de vencimiento
                        <input type="date" name={'expiry' + i} />
                      </label>
                      {equipment.has(item.catalogItemId) ? (
                        <label>
                          Series de los equipos · una por línea
                          <textarea name={'series' + i} rows={2} />
                        </label>
                      ) : null}
                      <label className="checkbox-row">
                        <input type="checkbox" name={'asset' + i} /> Activo fijo
                      </label>
                    </div>
                  </fieldset>
                ))}
              </>
            )}
            {error ? (
              <p role="alert" className="notice danger">
                {error}
              </p>
            ) : null}
          </form>
        ) : null}
      </Dialog>
    </Panel>
  );
}
