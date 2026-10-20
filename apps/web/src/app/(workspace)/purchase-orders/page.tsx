'use client';

import { Button, EmptyState, Panel } from '@analiza/ui';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { SearchableSelect } from '@/components/common/searchable-select';
import { useAuth, useWorkspace } from '@/components/providers';
import { mongoMutationHeaders } from '@/lib/auth';
import {
  purchaseOrderInputSchema,
  purchaseOrderLineTotal,
  purchaseOrderTotals,
  purchaseOrderSchema,
  type PurchaseOrder,
} from '@/lib/purchase-order';

type Line = { catalogItemId: string; quantity: number; referenceUnitPrice: number };
const money = (value: number) => `USD ${value.toFixed(2)}`;
const unitPrice = (value: number) => `USD ${value.toFixed(4)}`;

export default function PurchaseOrdersPage() {
  const { session, can } = useAuth();
  const { catalogItems } = useWorkspace();
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [supplierId, setSupplierId] = useState('');
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [price, setPrice] = useState('');
  const [lines, setLines] = useState<Line[]>([]);
  const [applyPerception, setApplyPerception] = useState(false);
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const suppliers = useMemo(
    () => catalogItems.filter((item) => item.status === 'ACTIVE' && item.category === 'PROVIDERS'),
    [catalogItems],
  );
  const products = useMemo(
    () =>
      catalogItems.filter(
        (item) =>
          item.status === 'ACTIVE' &&
          ['MEDICATIONS', 'SUPPLIES', 'EQUIPMENT'].includes(item.category ?? ''),
      ),
    [catalogItems],
  );
  const names = useMemo(
    () => new Map(catalogItems.map((item) => [item.id, `${item.sku} · ${item.name}`])),
    [catalogItems],
  );
  const totals = purchaseOrderTotals(lines, applyPerception);

  useEffect(() => {
    if (session?.mode !== 'postgresql' || !can('purchases:read')) return;
    let active = true;
    void fetch('/api/purchase-orders', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('No se pudo cargar el historial de órdenes.');
        const payload = (await response.json()) as { orders: unknown[] };
        if (active) setOrders(payload.orders.map((order) => purchaseOrderSchema.parse(order)));
      })
      .catch(() => {
        if (active) setError('No se pudo cargar el historial de órdenes.');
      });
    return () => {
      active = false;
    };
  }, [session?.mode, can]);

  function addLine() {
    const candidate = {
      catalogItemId: productId,
      quantity: Number(quantity),
      referenceUnitPrice: Number(price),
    };
    const valid = purchaseOrderInputSchema.shape.items.element.safeParse(candidate);
    if (!valid.success || !products.some((item) => item.id === productId) || !price.trim()) {
      setError(
        'Seleccione un producto activo, una cantidad entera y un precio de referencia positivo con hasta cuatro decimales.',
      );
      return;
    }
    setLines((current) => [...current, valid.data]);
    setQuantity('1');
    setPrice('');
    setError(null);
    setMessage(null);
  }

  async function issue() {
    const parsed = purchaseOrderInputSchema.safeParse({
      id: requestId,
      supplierCatalogItemId: supplierId,
      applyPerception,
      items: lines,
    });
    if (!parsed.success || !suppliers.some((item) => item.id === supplierId)) {
      setError('Seleccione un proveedor activo y agregue al menos un producto.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...mongoMutationHeaders() },
        body: JSON.stringify(parsed.data),
      });
      if (!response.ok)
        throw new Error(
          response.status === 409
            ? 'La solicitud ya pertenece a otra orden.'
            : 'No se pudo emitir la orden. Conserve los datos e inténtelo de nuevo.',
        );
      const order = purchaseOrderSchema.parse(await response.json());
      setOrders((current) => [order, ...current.filter((item) => item.id !== order.id)]);
      setMessage(`Orden ${order.orderNumber} guardada. Puede descargar su PDF.`);
      setLines([]);
      setSupplierId('');
      setApplyPerception(false);
      setRequestId(crypto.randomUUID());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo emitir la orden.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page-stack">
      <header className="page-header page-header-actions">
        <div>
          <p className="eyebrow">Inventario y compras</p>
          <h1>Órdenes a proveedores</h1>
          <p>
            Solicite insumos, medicamentos y equipos con varios productos en una orden y descargue
            el PDF. Esta orden no recibe inventario ni sustituye una factura.
          </p>
        </div>
        <Link className="action-link-button" href="/purchases">
          Ver compras recibidas
        </Link>
      </header>
      {session?.mode !== 'postgresql' ? (
        <p className="notice">Las órdenes persistentes requieren la base PostgreSQL conectada.</p>
      ) : null}
      {error ? (
        <p className="notice danger" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="notice success" role="status">
          {message}
        </p>
      ) : null}
      {can('purchases:write') && session?.mode === 'postgresql' ? (
        <Panel>
          <h2>Nueva orden</h2>
          <p className="field-help">
            El número y la fecha se asignan al guardar. Los precios son referencias ingresadas por
            usted, sin IVA. Se calcula el IVA solicitado del 13%; la percepción del 1% se activa
            manualmente cuando corresponda.
          </p>
          <div className="form-grid">
            <label>
              Proveedor
              <SearchableSelect
                ariaLabel="Proveedor de la orden"
                onChange={setSupplierId}
                options={suppliers.map((item) => ({ value: item.id, label: item.name }))}
                placeholder="Buscar proveedor"
                value={supplierId}
              />
            </label>
            <label>
              Producto
              <SearchableSelect
                ariaLabel="Producto de la orden"
                onChange={setProductId}
                options={products.map((item) => ({
                  value: item.id,
                  label: `${item.sku} · ${item.name}`,
                }))}
                placeholder="Buscar producto"
                value={productId}
              />
            </label>
            <label>
              Cantidad entera
              <input
                min="1"
                onChange={(event) => setQuantity(event.target.value)}
                step="1"
                type="number"
                value={quantity}
              />
            </label>
            <label>
              Precio de referencia por unidad (USD)
              <input
                min="0.0001"
                onChange={(event) => setPrice(event.target.value)}
                step="0.0001"
                type="number"
                value={price}
              />
            </label>
          </div>
          <label>
            <input
              checked={applyPerception}
              data-action-id="PURCHASE-ORDER-PERCEPTION"
              onChange={(event) => setApplyPerception(event.target.checked)}
              type="checkbox"
            />{' '}
            Aplicar percepción del 1%
          </label>
          <div className="action-row">
            <Button data-action-id="PURCHASE-ORDER-ADD-LINE" onClick={addLine} type="button">
              Agregar producto
            </Button>
          </div>
          {lines.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Cantidad</th>
                    <th>Precio de referencia</th>
                    <th>Total</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, index) => (
                    <tr key={`${line.catalogItemId}-${index}`}>
                      <td>{names.get(line.catalogItemId) ?? line.catalogItemId}</td>
                      <td>{line.quantity}</td>
                      <td>{unitPrice(line.referenceUnitPrice)}</td>
                      <td>
                        {money(purchaseOrderLineTotal(line.quantity, line.referenceUnitPrice))}
                      </td>
                      <td>
                        <Button
                          className="button-secondary"
                          onClick={() =>
                            setLines((current) =>
                              current.filter((_, position) => position !== index),
                            )
                          }
                          type="button"
                        >
                          Quitar
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          <p>
            Subtotal: {money(totals.subtotal)} · IVA 13%: {money(totals.iva)} · Percepción:{' '}
            {money(totals.perception)} · <strong>Total de orden: {money(totals.total)}</strong>
          </p>
          <Button
            data-action-id="PURCHASE-ORDER-ISSUE"
            disabled={busy || !lines.length || !supplierId}
            onClick={() => void issue()}
            type="button"
          >
            {busy ? 'Guardando…' : 'Guardar orden'}
          </Button>
        </Panel>
      ) : null}
      <Panel>
        <h2>Últimas 100 órdenes emitidas</h2>
        {orders.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Número</th>
                  <th>Fecha</th>
                  <th>Proveedor</th>
                  <th>Productos</th>
                  <th>Total</th>
                  <th>PDF</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td>{order.orderNumber}</td>
                    <td>{new Date(order.issuedAt).toLocaleDateString('es-SV')}</td>
                    <td>{order.supplierName}</td>
                    <td>{order.items.length}</td>
                    <td>{money(order.total)}</td>
                    <td>
                      <a
                        className="action-link-button action-link-button--inline"
                        href={`/api/purchase-orders/${order.id}/pdf`}
                      >
                        Descargar PDF
                      </a>{' '}
                      <a
                        className="action-link-button action-link-button--inline"
                        href={`/api/purchase-orders/${order.id}/pdf?inline=1`}
                        rel="noopener noreferrer"
                        target="_blank"
                      >
                        Abrir para imprimir
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="Sin órdenes emitidas"
            detail="Agregue productos y guarde la primera orden para crear su PDF."
          />
        )}
      </Panel>
    </div>
  );
}
