'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import type { Payment } from '@analiza/contracts';
import { Button, Dialog, EmptyState, Panel, StatusTag } from '@analiza/ui';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { quoteDisplayCode } from '@analiza/domain';
import { SearchableSelect } from '@/components/common/searchable-select';
import { useAuth, useWorkspace } from '@/components/providers';
import { receivableAccounts } from '@/lib/receivables';
const money = (value: number) =>
  new Intl.NumberFormat('es-SV', { style: 'currency', currency: 'USD' }).format(value);

const paymentSchema = z.object({
  quoteId: z.string().min(1, 'Seleccione una cotización enviada.'),
  amount: z.number().positive('Ingrese un monto positivo.'),
  reference: z.string().trim().min(1, 'Ingrese una referencia.'),
  idempotencyKey: z.string().trim().min(1, 'Ingrese una clave idempotente.'),
});
type PaymentForm = z.infer<typeof paymentSchema>;
const paymentStatus = { APPLIED: 'Aplicado', VOIDED: 'Reversado' };

export function PaymentsPage({ receivables = false }: { receivables?: boolean }) {
  const { addPayment, payments, quotes, patients, voidPayment, error } = useWorkspace();
  const { can } = useAuth();
  const [open, setOpen] = useState(false);
  const [voiding, setVoiding] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const accounts = receivableAccounts(quotes, payments);
  const openAccounts = accounts.filter((account) => account.balance > 0);
  const sentQuotes = openAccounts.map((account) => account.quote);
  const quoteOptions = openAccounts.map((account) => ({
    value: account.quote.id,
    label:
      (patients.find((patient) => patient.id === account.quote.patientId)?.fullName ?? 'Paciente') +
      ' · ' +
      quoteDisplayCode(account.quote.id) +
      ' · saldo ' +
      money(account.balance),
  }));
  const form = useForm<PaymentForm>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      quoteId: quotes.find((quote) => quote.status === 'SENT')?.id ?? '',
      amount: 1,
      reference: '',
      idempotencyKey: crypto.randomUUID(),
    },
  });
  const voidForm = useForm<{ reason: string }>({ defaultValues: { reason: '' } });
  const selectedQuoteId = useWatch({ control: form.control, name: 'quoteId' });
  function close() {
    setOpen(false);
    form.reset({
      quoteId: quotes.find((quote) => quote.status === 'SENT')?.id ?? '',
      amount: 1,
      reference: '',
      idempotencyKey: crypto.randomUUID(),
    });
  }
  async function submit(values: PaymentForm) {
    const account = accounts.find((candidate) => candidate.quote.id === values.quoteId);
    if (!account || account.balance <= 0) {
      form.setError('quoteId', { message: 'La cuenta seleccionada ya está pagada.' });
      return;
    }
    if (Math.round(values.amount * 100) > Math.round(account.balance * 100)) {
      form.setError('amount', {
        message: `El monto no puede superar el saldo de ${money(account.balance)}.`,
      });
      return;
    }
    if (payments.some((payment) => payment.idempotencyKey === values.idempotencyKey)) {
      form.setError('idempotencyKey', {
        type: 'duplicate',
        message: 'La clave ya fue aplicada; la operación no se duplicó.',
      });
      return;
    }
    const payment: Payment = {
      id: crypto.randomUUID(),
      ...values,
      status: 'APPLIED',
      createdAt: new Date().toISOString(),
    };
    if (!(await addPayment(payment))) {
      form.setError('root', {
        message: 'No se pudo guardar el pago; no se confirmó la operación.',
      });
      return;
    }
    setMessage('Pago aplicado una sola vez con clave idempotente y evidencia de auditoría.');
    close();
  }
  async function voidSubmit(values: { reason: string }) {
    if (!voiding || !values.reason.trim()) {
      voidForm.setError('reason', {
        type: 'required',
        message: 'El motivo es obligatorio para reversar.',
      });
      return;
    }
    if (!(await voidPayment(voiding, values.reason))) {
      voidForm.setError('reason', { message: 'No se pudo guardar la reversión.' });
      return;
    }
    setMessage('Pago reversado con motivo y evidencia de auditoría.');
    setVoiding(null);
    voidForm.reset();
  }
  async function downloadReceipt(payment: Payment) {
    const { buildPaymentReceiptPdf, downloadPdf } = await import('@/lib/financial-pdf');
    const quote = quotes.find((candidate) => candidate.id === payment.quoteId);
    if (!quote) {
      setMessage('No se encontró la cotización asociada al comprobante.');
      return;
    }
    const patient = patients.find((candidate) => candidate.id === quote.patientId);
    const bytes = await buildPaymentReceiptPdf(payment, quote, patient);
    downloadPdf(bytes, `comprobante-pago-${payment.id}.pdf`);
    setMessage('Comprobante interno no fiscal generado.');
  }
  const totals = accounts.reduce(
    (sum, item) => ({
      responsibility: sum.responsibility + item.responsibility,
      paid: sum.paid + item.paid,
      balance: sum.balance + item.balance,
    }),
    { responsibility: 0, paid: 0, balance: 0 },
  );
  const title = receivables ? 'Cuentas por cobrar' : 'Pagos';
  return (
    <div className="page-stack payments-page">
      <header className="page-header page-header-actions">
        <div>
          <p className="eyebrow">Analiza en Casa</p>
          <h1>{title}</h1>
          <p>Responsabilidad del paciente, pagos, comprobantes y estado de cuenta.</p>
        </div>
        <div className="header-actions">
          {can('payments:write') ? (
            <Button
              data-action-id="PAYMENT-APPLY"
              disabled={!openAccounts.length}
              onClick={() => {
                form.setValue('quoteId', sentQuotes[0]?.id ?? '');
                setMessage(null);
                setOpen(true);
              }}
              type="button"
            >
              Aplicar pago
            </Button>
          ) : null}
          <Button className="button-secondary" onClick={() => window.print()}>
            Imprimir estado global
          </Button>
        </div>
      </header>
      <section className="studio-metrics" aria-label="Resumen de cuentas">
        {[
          ['$', 'Responsabilidad total', totals.responsibility, 'Suma de cuentas de pacientes'],
          ['✓', 'Pagos aplicados', totals.paid, 'Movimientos confirmados'],
          ['◷', 'Saldo abierto', totals.balance, 'Responsabilidad menos pagos'],
        ].map(([icon, label, value, detail]) => (
          <Panel key={label}>
            <article>
              <span aria-hidden="true">{icon}</span>
              <div>
                <small>{label}</small>
                <strong>{money(Number(value))}</strong>
                <p>{detail}</p>
              </div>
            </article>
          </Panel>
        ))}
      </section>
      {error ? (
        <p className="notice" role="alert">
          {error}
        </p>
      ) : null}
      <Panel>
        <div className="table-heading">
          <h2>Estado de cuentas</h2>
          <StatusTag>{accounts.length} cuentas</StatusTag>
        </div>
        {accounts.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Cotización</th>
                  <th>Paciente</th>
                  <th>Responsabilidad</th>
                  <th>Pagado</th>
                  <th>Saldo</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((account) => (
                  <tr key={account.quote.id}>
                    <td>
                      <strong title={account.quote.id}>{quoteDisplayCode(account.quote.id)}</strong>
                      <small style={{ display: 'block' }}>v{account.quote.version}</small>
                    </td>
                    <td>
                      {patients.find((patient) => patient.id === account.quote.patientId)
                        ?.fullName ?? 'Paciente'}
                    </td>
                    <td>{money(account.responsibility)}</td>
                    <td>{money(account.paid)}</td>
                    <td>{money(account.balance)}</td>
                    <td>
                      <StatusTag tone={account.balance > 0 ? 'neutral' : 'success'}>
                        {account.balance > 0 ? 'Pendiente' : 'Pagado'}
                      </StatusTag>
                    </td>
                    <td>
                      {can('payments:write') && account.balance > 0 ? (
                        <Button
                          className="button-secondary"
                          data-action-id="PAYMENT-APPLY"
                          onClick={() => {
                            form.setValue('quoteId', account.quote.id);
                            form.setValue('amount', account.balance);
                            setOpen(true);
                          }}
                        >
                          Registrar pago
                        </Button>
                      ) : account.balance <= 0 ? (
                        <StatusTag tone="success">Pago completado</StatusTag>
                      ) : (
                        'Lectura'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="Sin cuentas por cobrar"
            detail="Las cotizaciones enviadas aparecerán aquí con la responsabilidad registrada del paciente."
          />
        )}
      </Panel>
      {!sentQuotes.length ? (
        <p className="notice" role="status">
          Envíe una cotización antes de aplicar un pago.
        </p>
      ) : null}
      {message ? (
        <p className="notice success" role="status">
          {message}
        </p>
      ) : null}
      <Panel>
        <div className="table-heading">
          <h2>Pagos y comprobantes</h2>
          <StatusTag>{payments.length} registros</StatusTag>
        </div>
        {payments.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Cotización</th>
                  <th>Monto ingresado</th>
                  <th>Referencia</th>
                  <th>Clave idempotente</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.id}>
                    <td>{new Date(payment.createdAt).toLocaleString('es-SV')}</td>
                    <td title={payment.quoteId}>{quoteDisplayCode(payment.quoteId)}</td>
                    <td>{money(payment.amount)}</td>
                    <td>{payment.reference}</td>
                    <td>
                      <details>
                        <summary>Ver clave</summary>
                        <small>{payment.idempotencyKey}</small>
                      </details>
                    </td>
                    <td>{paymentStatus[payment.status]}</td>
                    <td>
                      <div className="action-row">
                        <Button
                          className="button-secondary"
                          data-action-id="PAYMENT-RECEIPT-PDF"
                          onClick={() => void downloadReceipt(payment)}
                          type="button"
                        >
                          Comprobante PDF
                        </Button>
                        {payment.status === 'APPLIED' && can('payments:write') ? (
                          <Button
                            className="button-secondary"
                            data-action-id="PAYMENT-VOID"
                            onClick={() => setVoiding(payment.id)}
                            type="button"
                          >
                            Reversar
                          </Button>
                        ) : (
                          (payment.voidReason ?? '—')
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState detail="Aplique un pago sobre una cotización enviada." title="Sin pagos" />
        )}
      </Panel>
      <Dialog
        description="El monto no puede superar el saldo pendiente. La clave idempotente evita duplicar la operación."
        footer={
          <>
            <Button className="button-secondary" onClick={close} type="button">
              Cancelar
            </Button>
            <Button form="payment-form" type="submit" disabled={form.formState.isSubmitting}>
              Aplicar pago
            </Button>
          </>
        }
        onClose={close}
        open={open}
        title="Aplicar pago"
      >
        <form
          className="form-grid"
          id="payment-form"
          noValidate
          onSubmit={form.handleSubmit(submit)}
        >
          {form.formState.errors.root ? (
            <p className="field-error full" role="alert">
              {form.formState.errors.root.message}
            </p>
          ) : null}
          <label>
            Cotización enviada
            <SearchableSelect
              actionId="PAYMENT-QUOTE-SEARCH"
              ariaLabel="Buscar paciente o cotización"
              onChange={(value) =>
                form.setValue('quoteId', value, { shouldDirty: true, shouldValidate: true })
              }
              options={quoteOptions}
              placeholder="Buscar por paciente o código de cotización"
              value={selectedQuoteId}
            />
            {form.formState.errors.quoteId ? (
              <span className="field-error">{form.formState.errors.quoteId.message}</span>
            ) : null}
          </label>
          <label>
            Monto ingresado
            <input
              {...form.register('amount', { valueAsNumber: true })}
              max={accounts.find((account) => account.quote.id === selectedQuoteId)?.balance}
              min="0.01"
              step="0.01"
              type="number"
            />
            {form.formState.errors.amount ? (
              <span className="field-error">{form.formState.errors.amount.message}</span>
            ) : null}
          </label>
          <label>
            Referencia
            <input {...form.register('reference')} />
            {form.formState.errors.reference ? (
              <span className="field-error">{form.formState.errors.reference.message}</span>
            ) : null}
          </label>
          <label>
            Clave idempotente
            <input {...form.register('idempotencyKey')} />
            {form.formState.errors.idempotencyKey ? (
              <span className="field-error">{form.formState.errors.idempotencyKey.message}</span>
            ) : null}
          </label>
        </form>
      </Dialog>
      <Dialog
        description="La reversión conserva el pago original y exige un motivo."
        footer={
          <>
            <Button className="button-secondary" onClick={() => setVoiding(null)} type="button">
              Cancelar
            </Button>
            <Button form="void-payment-form" type="submit">
              Confirmar reversión
            </Button>
          </>
        }
        onClose={() => setVoiding(null)}
        open={Boolean(voiding)}
        title="Reversar pago"
      >
        <form
          className="form-grid"
          id="void-payment-form"
          noValidate
          onSubmit={voidForm.handleSubmit(voidSubmit)}
        >
          <label>
            Motivo
            <textarea {...voidForm.register('reason', { required: true })} rows={3} />
            {voidForm.formState.errors.reason ? (
              <span className="field-error">{voidForm.formState.errors.reason.message}</span>
            ) : null}
          </label>
        </form>
      </Dialog>
    </div>
  );
}
