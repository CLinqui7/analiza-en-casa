'use client';
import { useState, type FormEvent } from 'react';
import { balanceTotals, type BalanceEntry } from '@analiza/contracts';
import { Button, Dialog, EmptyState, Panel, StatusTag } from '@analiza/ui';
import { useAuth, useWorkspace } from '@/components/providers';
import { useOperations } from '@/lib/use-operations';

export default function BalancePage() {
  const operations = useOperations();
  const { hospitalizations, patients, nursingResources } = useWorkspace();
  const { session } = useAuth();
  const [caseId, setCaseId] = useState('');
  const [periodId, setPeriodId] = useState('');
  const [dialog, setDialog] = useState<'period' | 'entry' | 'close' | null>(null);
  const [correction, setCorrection] = useState<BalanceEntry | null>(null);
  const [message, setMessage] = useState('');
  const [requestKey, setRequestKey] = useState(() => crypto.randomUUID());
  const currentCase = hospitalizations.find((item) => item.id === caseId) ?? hospitalizations[0];
  const patient = patients.find((item) => item.id === currentCase?.patientId);
  const periods = operations.periods
    .filter((period) => period.caseId === currentCase?.id)
    .sort((a, b) => b.startsAt.localeCompare(a.startsAt));
  const period = periods.find((item) => item.id === periodId) ?? periods[0];
  const entries = operations.balanceEntries
    .filter((entry) => entry.periodId === period?.id)
    .sort((a, b) => a.measuredAt.localeCompare(b.measuredAt));
  const totals = balanceTotals(entries);
  const editable = Boolean(
    currentCase &&
    currentCase.status !== 'CLOSED' &&
    (session?.role === 'ADMIN' ||
      (session &&
        ['NURSE', 'NURSE_MANAGER'].includes(session.role) &&
        currentCase.assignedNurseUserIds?.includes(session.userId))),
  );
  const corrected = new Set(entries.map((entry) => entry.correctionOf).filter(Boolean));
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!currentCase) return;
    const values = new FormData(event.currentTarget);
    let command: unknown;
    if (dialog === 'period') {
      const startsAt = new Date(String(values.get('startsAt'))).toISOString();
      command = {
        command: 'balance.open',
        caseId: currentCase.id,
        startsAt,
        endsAt: new Date(
          Date.parse(startsAt) + Number(values.get('hours')) * 3600000,
        ).toISOString(),
        idempotencyKey: requestKey,
      };
    } else if (dialog === 'close' && period)
      command = { command: 'balance.close', periodId: period.id, handoff: values.get('handoff') };
    else if (period)
      command = {
        command: 'balance.append',
        entry: {
          periodId: period.id,
          measuredAt: new Date(String(values.get('measuredAt'))).toISOString(),
          direction: values.get('direction'),
          category: values.get('category'),
          milliliters: Number(values.get('milliliters')),
          note: String(values.get('note') || ''),
          idempotencyKey: requestKey,
          ...(correction
            ? { correctionOf: correction.id, correctionReason: String(values.get('reason')) }
            : {}),
        },
      };
    if (command && (await operations.execute(command))) {
      setRequestKey(crypto.randomUUID());
      setDialog(null);
      setCorrection(null);
      setMessage('Balance guardado en la base de datos.');
    }
  }
  const author = (userId: string) =>
    nursingResources.find((resource) => resource.userId === userId)?.displayName ??
    (userId === session?.userId ? 'Mi usuario' : 'Profesional autorizado');
  return (
    <div className="page-stack clinical-suite-page">
      <header className="page-header clinical-module-header">
        <div>
          <p className="eyebrow">Analiza en Casa</p>
          <h1>Balance hídrico</h1>
          <p>Ingresos, egresos, períodos de atención y entrega de turno.</p>
        </div>
        <div className="header-actions">
          <Button className="button-secondary" onClick={() => window.print()}>
            Imprimir balance
          </Button>
          <Button
            data-action-id="BALANCE-PERIOD-CREATE"
            disabled={!editable}
            onClick={() => setDialog('period')}
          >
            + Nuevo período
          </Button>
        </div>
      </header>
      <Panel className="studio-toolbar">
        <select
          aria-label="Paciente y hospitalización"
          value={currentCase?.id ?? ''}
          onChange={(event) => {
            setCaseId(event.target.value);
            setPeriodId('');
          }}
        >
          {hospitalizations.map((item) => (
            <option key={item.id} value={item.id}>
              {patients.find((row) => row.id === item.patientId)?.fullName} · {item.id}
            </option>
          ))}
        </select>
        <select
          aria-label="Período de balance"
          value={period?.id ?? ''}
          onChange={(event) => setPeriodId(event.target.value)}
        >
          {periods.length ? (
            periods.map((item) => (
              <option key={item.id} value={item.id}>
                {new Date(item.startsAt).toLocaleString('es-SV')} ·{' '}
                {item.status === 'OPEN' ? 'Abierto' : 'Cerrado'}
              </option>
            ))
          ) : (
            <option value="">Sin períodos</option>
          )}
        </select>
        <StatusTag tone={editable ? 'success' : 'neutral'}>
          {editable ? 'Asignado · Puede registrar' : 'Sólo lectura'}
        </StatusTag>
      </Panel>
      {!editable ? (
        <p className="notice">
          Puede consultar este paciente. Sólo el personal asignado a esta hospitalización puede
          editar el balance.
        </p>
      ) : null}
      {message ? (
        <p className="notice success" role="status">
          {message}
        </p>
      ) : null}
      {operations.error ? (
        <p className="notice" role="alert">
          {operations.error}
        </p>
      ) : null}
      <section className="studio-metrics" aria-label="Resumen del período">
        {[
          ['↓', 'Ingresos', totals.intake],
          ['↑', 'Egresos', totals.output],
          ['≈', 'Balance registrado', totals.balance],
        ].map(([icon, label, value]) => (
          <Panel key={label}>
            <article>
              <span aria-hidden="true">{icon}</span>
              <div>
                <small>{label}</small>
                <strong>{Number(value).toLocaleString('es-SV')} ml</strong>
                <p>{patient?.fullName ?? 'Seleccione un paciente'}</p>
              </div>
            </article>
          </Panel>
        ))}
      </section>
      <Panel>
        <div className="table-heading">
          <div>
            <h2>Registro del período</h2>
            <p>Los totales excluyen observaciones sustituidas por una corrección.</p>
          </div>
          <div className="header-actions">
            {period ? (
              <StatusTag tone={period.status === 'OPEN' ? 'success' : 'neutral'}>
                {period.status === 'OPEN' ? 'Abierto' : 'Cerrado'}
              </StatusTag>
            ) : null}
            <Button
              className="button-secondary"
              disabled={!editable || !period || period.status === 'CLOSED'}
              onClick={() => setDialog('close')}
            >
              Cerrar y entregar turno
            </Button>
            <Button
              data-action-id="BALANCE-ENTRY-CREATE"
              disabled={!editable || !period || period.status === 'CLOSED'}
              onClick={() => {
                setCorrection(null);
                setDialog('entry');
              }}
            >
              + Registrar
            </Button>
          </div>
        </div>
        {entries.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Hora</th>
                  <th>Tipo</th>
                  <th>Concepto</th>
                  <th>Volumen</th>
                  <th>Profesional</th>
                  <th>Observación</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id}>
                    <td>
                      {new Date(entry.measuredAt).toLocaleTimeString('es-SV', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td>
                      <StatusTag tone={entry.direction === 'INTAKE' ? 'success' : 'neutral'}>
                        {entry.direction === 'INTAKE' ? 'Ingreso' : 'Egreso'}
                      </StatusTag>
                    </td>
                    <td>
                      {entry.category}
                      {corrected.has(entry.id) ? (
                        <small> · Sustituida; original conservado</small>
                      ) : null}
                    </td>
                    <td>{entry.milliliters} ml</td>
                    <td>{author(entry.actorUserId)}</td>
                    <td>
                      {entry.note || '—'}
                      {entry.correctionReason ? (
                        <small> Corrección: {entry.correctionReason}</small>
                      ) : null}
                    </td>
                    <td>
                      {editable && !corrected.has(entry.id) ? (
                        <Button
                          className="button-secondary"
                          data-action-id="BALANCE-CORRECT"
                          onClick={() => {
                            setCorrection(entry);
                            setDialog('entry');
                          }}
                        >
                          Corregir
                        </Button>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="Sin registros en este período"
            detail="El personal asignado puede registrar ingresos y egresos de líquidos."
          />
        )}
        {period?.handoff ? <p className="notice">Entrega de turno: {period.handoff}</p> : null}
      </Panel>
      <Dialog
        open={dialog !== null}
        onClose={() => setDialog(null)}
        title={
          dialog === 'period'
            ? 'Nuevo período de balance'
            : dialog === 'close'
              ? 'Entrega de turno'
              : correction
                ? 'Corregir observación'
                : 'Registrar volumen'
        }
        description="Se conserva el usuario autor y el historial de cada registro."
        footer={
          <>
            <Button className="button-secondary" onClick={() => setDialog(null)}>
              Cancelar
            </Button>
            <Button form="balance-form" type="submit" disabled={operations.busy}>
              Guardar registro
            </Button>
          </>
        }
      >
        <form className="form-grid" id="balance-form" onSubmit={submit}>
          {dialog === 'period' ? (
            <>
              <label>
                Inicio
                <input type="datetime-local" name="startsAt" required />
              </label>
              <label>
                Duración en horas
                <input type="number" name="hours" min="1" max="48" defaultValue="24" required />
              </label>
            </>
          ) : dialog === 'close' ? (
            <label className="full">
              Entrega / observaciones
              <textarea name="handoff" required rows={4} />
            </label>
          ) : (
            <>
              <label>
                Hora de medición
                <input
                  name="measuredAt"
                  type="datetime-local"
                  required
                  defaultValue={
                    correction
                      ? new Date(
                          Date.parse(correction.measuredAt) -
                            new Date(correction.measuredAt).getTimezoneOffset() * 60000,
                        )
                          .toISOString()
                          .slice(0, 16)
                      : undefined
                  }
                />
              </label>
              <label>
                Tipo
                <select name="direction" defaultValue={correction?.direction ?? 'INTAKE'}>
                  <option value="INTAKE">Ingreso</option>
                  <option value="OUTPUT">Egreso</option>
                </select>
              </label>
              <label>
                Concepto
                <select name="category" defaultValue={correction?.category ?? 'Vía oral'}>
                  {[
                    'Vía oral',
                    'Parenteral',
                    'Orina',
                    'Drenaje',
                    'Vómito',
                    'Otro ingreso',
                    'Otro egreso',
                  ].map((label) => (
                    <option key={label}>{label}</option>
                  ))}
                </select>
              </label>
              <label>
                Volumen (ml)
                <input
                  name="milliliters"
                  type="number"
                  min="0"
                  step="0.1"
                  required
                  defaultValue={correction?.milliliters}
                />
              </label>
              <label className="full">
                Observaciones
                <textarea name="note" rows={3} defaultValue={correction?.note} />
              </label>
              {correction ? (
                <label className="full">
                  Motivo de corrección
                  <input name="reason" required />
                </label>
              ) : null}
            </>
          )}
          {operations.error ? (
            <p role="alert" className="field-error full">
              {operations.error}
            </p>
          ) : null}
        </form>
      </Dialog>
    </div>
  );
}
