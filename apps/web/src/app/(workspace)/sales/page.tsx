'use client';

import { useState, type FormEvent } from 'react';
import { Button, Dialog, EmptyState, Panel, StatusTag } from '@analiza/ui';
import { useAuth, useWorkspace } from '@/components/providers';
import { useOperations } from '@/lib/use-operations';
import { companySales, periodStarts } from '@/lib/field-metrics';

const money = (value: number) =>
  new Intl.NumberFormat('es-SV', { style: 'currency', currency: 'USD' }).format(value);

export default function ConfirmedSalesPage() {
  const operations = useOperations();
  const { quotes } = useWorkspace();
  const { can } = useAuth();
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [formTime, setFormTime] = useState('');
  const [message, setMessage] = useState('');
  const current = periodStarts(new Date());
  const week = companySales(operations.confirmedSales, current.week, 'WEEK');
  const month = companySales(operations.confirmedSales, current.month, 'MONTH');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    if (
      await operations.execute({
        command: 'sale.confirmed.record',
        sale: {
          id: key,
          idempotencyKey: key,
          occurredAt: new Date(String(values.get('occurredAt'))).toISOString(),
          reference: String(values.get('reference')).trim(),
          amount: Number(values.get('amount')),
          category: values.get('category'),
          ...(values.get('quoteId') ? { quoteId: String(values.get('quoteId')) } : {}),
        },
      })
    ) {
      setOpen(false);
      setKey(crypto.randomUUID());
      setMessage('Venta confirmada con referencia y registro de auditoría.');
    }
  }

  return (
    <div className="page-stack">
      <header className="page-header page-header-actions">
        <div>
          <p className="eyebrow">Financiero · Registro interno</p>
          <h1>Ventas confirmadas</h1>
          <p>
            Sólo ventas respaldadas por una referencia verificable. Este importe no es utilidad,
            cobro aplicado ni facturación fiscal.
          </p>
        </div>
        {can('payments:write') ? (
          <Button
            onClick={() => {
              const now = new Date();
              setFormTime(
                new Date(now.getTime() - now.getTimezoneOffset() * 60000)
                  .toISOString()
                  .slice(0, 16),
              );
              setOpen(true);
              setKey(crypto.randomUUID());
            }}
          >
            Confirmar venta
          </Button>
        ) : null}
      </header>
      {message ? (
        <p className="notice success" role="status">
          {message}
        </p>
      ) : null}
      {operations.error ? (
        <p className="notice warning" role="alert">
          {operations.error}
        </p>
      ) : null}
      <section className="studio-metrics" aria-label="Ventas confirmadas">
        <Panel>
          <article>
            <div>
              <small>Esta semana</small>
              <strong>{money(week)}</strong>
              <p>Desde el lunes · hora El Salvador</p>
            </div>
          </article>
        </Panel>
        <Panel>
          <article>
            <div>
              <small>Este mes</small>
              <strong>{money(month)}</strong>
              <p>Referencia obligatoria</p>
            </div>
          </article>
        </Panel>
        <Panel>
          <article>
            <div>
              <small>Registros</small>
              <strong>{operations.confirmedSales.length}</strong>
              <p>No incluye cotizaciones pendientes</p>
            </div>
          </article>
        </Panel>
      </section>
      <Panel>
        <div className="table-heading">
          <h2>Registro de ventas</h2>
          <StatusTag>{operations.confirmedSales.length} confirmadas</StatusTag>
        </div>
        {operations.confirmedSales.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Referencia</th>
                  <th>Categoría</th>
                  <th>Importe</th>
                  <th>Origen</th>
                </tr>
              </thead>
              <tbody>
                {operations.confirmedSales.map((sale) => (
                  <tr key={sale.id}>
                    <td>{new Date(sale.occurredAt).toLocaleDateString('es-SV')}</td>
                    <td>{sale.reference}</td>
                    <td>{sale.category}</td>
                    <td>{money(sale.amount)}</td>
                    <td>
                      {sale.commercialVisitId
                        ? 'Visita comercial'
                        : sale.quoteId
                          ? 'Cotización enviada'
                          : 'Registro interno'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="Sin ventas confirmadas"
            detail="Una cotización o un pago no se incorpora automáticamente a esta métrica; confirme cada venta con su referencia."
          />
        )}
      </Panel>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Confirmar venta"
        description="La referencia se usa para evitar duplicados. No ingrese datos bancarios ni clínicos."
        footer={
          <>
            <Button className="button-secondary" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button disabled={operations.busy} form="sale-form" type="submit">
              {operations.busy ? 'Guardando…' : 'Guardar venta'}
            </Button>
          </>
        }
      >
        <form className="form-grid" id="sale-form" onSubmit={(event) => void submit(event)}>
          <label>
            Referencia de respaldo <input name="reference" minLength={3} maxLength={200} required />
          </label>
          <label>
            Monto (USD) <input name="amount" type="number" min="0.01" step="0.01" required />
          </label>
          <label>
            Fecha y hora{' '}
            <input name="occurredAt" type="datetime-local" required defaultValue={formTime} />
          </label>
          <label>
            Categoría{' '}
            <select name="category">
              <option value="EQUIPMENT">Equipo</option>
              <option value="MEDICATIONS">Medicamentos</option>
              <option value="SUPPLIES">Insumos</option>
              <option value="SERVICES">Servicios</option>
              <option value="OTHER">Otro</option>
            </select>
          </label>
          <label className="full">
            Cotización enviada (opcional){' '}
            <select name="quoteId">
              <option value="">Sin cotización vinculada</option>
              {quotes
                .filter((item) => item.status === 'SENT' && item.immutable)
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.id} · {money(item.total)}
                  </option>
                ))}
            </select>
          </label>
          {operations.error ? (
            <p className="field-error full" role="alert">
              {operations.error}
            </p>
          ) : null}
        </form>
      </Dialog>
    </div>
  );
}
