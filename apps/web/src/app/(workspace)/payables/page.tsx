'use client';

import type { Purchase } from '@analiza/contracts';
import { Button, EmptyState, Panel } from '@analiza/ui';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useAuth, useWorkspace } from '@/components/providers';
import { mongoMutationHeaders } from '@/lib/auth';
import { purchaseOrderSchema, type PurchaseOrder } from '@/lib/purchase-order';
import { purchaseTotals } from '@/lib/purchase-totals';

type Approval = {
  invoiceGroupId: string;
  purchaseOrderId: string | null;
  invoiceNumber: string;
  total: number;
  approvedAt: string;
};
const money = (amount: number) => `USD ${amount.toFixed(2)}`;

export default function PayablesPage() {
  const { can, session } = useAuth();
  const { purchases, catalogItems } = useWorkspace();
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [query, setQuery] = useState('');
  const [busyGroup, setBusyGroup] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const supplierNames = useMemo(
    () => new Map(catalogItems.map((item) => [item.id, item.name])),
    [catalogItems],
  );

  useEffect(() => {
    if (session?.mode !== 'postgresql') return;
    let active = true;
    void Promise.all([
      fetch('/api/purchase-orders', { cache: 'no-store' }),
      fetch('/api/purchase-invoices/approvals', { cache: 'no-store' }),
    ])
      .then(async ([ordersResponse, approvalsResponse]) => {
        if (!ordersResponse.ok || !approvalsResponse.ok) throw new Error();
        const orderPayload = (await ordersResponse.json()) as { orders: unknown[] };
        const approvalPayload = (await approvalsResponse.json()) as { approvals: Approval[] };
        if (active) {
          setOrders(orderPayload.orders.map((item) => purchaseOrderSchema.parse(item)));
          setApprovals(approvalPayload.approvals);
        }
      })
      .catch(() => {
        if (active) setError('No se pudieron cargar las órdenes y facturas.');
      });
    return () => {
      active = false;
    };
  }, [session?.mode]);

  const invoices = useMemo(() => {
    const groups = new Map<string, Purchase[]>();
    for (const purchase of purchases) {
      if (!purchase.invoiceNumber || purchase.invoiceVoidedAt) continue;
      const id = purchase.invoiceGroupId ?? purchase.id;
      groups.set(id, [...(groups.get(id) ?? []), purchase]);
    }
    return [...groups].map(([id, lines]) => ({
      id,
      first: lines[0],
      total: lines.every((line) => line.status === 'RECEIVED')
        ? (purchaseTotals(lines)?.total ?? null)
        : null,
    }));
  }, [purchases]);
  const approvedByGroup = useMemo(
    () => new Map(approvals.map((item) => [item.invoiceGroupId, item])),
    [approvals],
  );
  const approvedTotal = approvals.reduce((sum, item) => sum + item.total, 0);
  const matchingOrders = orders.filter((order) =>
    `${order.orderNumber} ${order.supplierName}`
      .toLocaleLowerCase()
      .includes(query.toLocaleLowerCase()),
  );
  const matchingInvoices = invoices.filter((invoice) =>
    `${invoice.first.invoiceNumber} ${supplierNames.get(invoice.first.supplierCatalogItemId ?? '') ?? ''}`
      .toLocaleLowerCase()
      .includes(query.toLocaleLowerCase()),
  );

  async function approve(invoiceGroupId: string) {
    setBusyGroup(invoiceGroupId);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch('/api/purchase-invoices/approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...mongoMutationHeaders() },
        body: JSON.stringify({ invoiceGroupId }),
      });
      if (!response.ok)
        throw new Error(
          response.status === 409
            ? 'Esta factura ya tiene una aprobación diferente.'
            : 'No se pudo aprobar la factura. Verifique que fue recibida y sigue vigente.',
        );
      const approval = (await response.json()) as Approval;
      setApprovals((current) => [
        approval,
        ...current.filter((item) => item.invoiceGroupId !== invoiceGroupId),
      ]);
      setMessage(`Factura ${approval.invoiceNumber} aprobada y agregada a cuentas por pagar.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo aprobar la factura.');
    } finally {
      setBusyGroup(null);
    }
  }

  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">Financiero</p>
          <h1>Cuentas por pagar</h1>
          <p>
            Las órdenes se muestran desde su emisión. Una factura entra al saldo por pagar al
            recibirse y aprobarse.
          </p>
        </div>
      </header>
      {error ? (
        <p role="alert" className="field-error">
          {error}
        </p>
      ) : null}
      {message ? <p role="status">{message}</p> : null}
      <Panel>
        <div className="table-heading">
          <div>
            <h2>Órdenes de compra</h2>
            <p className="field-help">
              {orders.length} órdenes emitidas · {money(approvedTotal)} en facturas aprobadas
            </p>
          </div>
          {can('purchases:write') ? (
            <Link className="action-link-button action-link-button--inline" href="/purchase-orders">
              Crear orden
            </Link>
          ) : null}
        </div>
        <label>
          Buscar orden o proveedor
          <input onChange={(event) => setQuery(event.target.value)} type="search" value={query} />
        </label>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Orden</th>
                <th>Proveedor</th>
                <th>Fecha</th>
                <th>Referencia</th>
                <th>Estado de factura</th>
                <th>Saldo aprobado</th>
              </tr>
            </thead>
            <tbody>
              {matchingOrders.map((order) => {
                const linked = invoices.filter(
                  (invoice) => invoice.first.purchaseOrderId === order.id,
                );
                const approved = linked.reduce(
                  (sum, invoice) => sum + (approvedByGroup.get(invoice.id)?.total ?? 0),
                  0,
                );
                const status = linked.some((invoice) => approvedByGroup.has(invoice.id))
                  ? 'Factura aprobada'
                  : linked.some((invoice) => invoice.total !== null)
                    ? 'Factura recibida · pendiente de aprobación'
                    : linked.length
                      ? 'Factura pendiente de recepción'
                      : 'Sin factura recibida';
                return (
                  <tr key={order.id}>
                    <td>{order.orderNumber}</td>
                    <td>{order.supplierName}</td>
                    <td>{new Date(order.issuedAt).toLocaleDateString('es-SV')}</td>
                    <td>{money(order.total)}</td>
                    <td>{status}</td>
                    <td>{money(approved)}</td>
                  </tr>
                );
              })}
              {!matchingOrders.length ? (
                <tr>
                  <td colSpan={6}>
                    <EmptyState title="Sin órdenes" detail="No hay órdenes para esta búsqueda." />
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Panel>
      <Panel>
        <h2>Facturas de proveedores</h2>
        <p className="field-help">
          El monto procede de la factura recibida. Aprobarla deja evidencia auditada; los pagos a
          proveedores requieren conciliación.
        </p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Factura</th>
                <th>Proveedor</th>
                <th>Orden</th>
                <th>Monto</th>
                <th>Estado</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {matchingInvoices.map((invoice) => {
                const approval = approvedByGroup.get(invoice.id);
                const status = approval
                  ? 'Aprobada'
                  : invoice.total === null
                    ? 'Pendiente de recepción'
                    : 'Recibida · pendiente de aprobación';
                return (
                  <tr key={invoice.id}>
                    <td>{invoice.first.invoiceNumber}</td>
                    <td>
                      {supplierNames.get(invoice.first.supplierCatalogItemId ?? '') ??
                        'Proveedor registrado'}
                    </td>
                    <td>
                      {orders.find((order) => order.id === invoice.first.purchaseOrderId)
                        ?.orderNumber ?? 'Sin vincular'}
                    </td>
                    <td>{invoice.total === null ? '—' : money(invoice.total)}</td>
                    <td>{status}</td>
                    <td>
                      {!approval && invoice.total !== null && can('payments:write') ? (
                        <Button
                          disabled={busyGroup !== null}
                          onClick={() => void approve(invoice.id)}
                          type="button"
                        >
                          {busyGroup === invoice.id ? 'Aprobando…' : 'Aprobar factura'}
                        </Button>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                );
              })}
              {!matchingInvoices.length ? (
                <tr>
                  <td colSpan={6}>
                    <EmptyState title="Sin facturas" detail="No hay facturas para esta búsqueda." />
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
