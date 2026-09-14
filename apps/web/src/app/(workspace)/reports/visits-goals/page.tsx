'use client';
import { useState, type FormEvent } from 'react';
import { Button, Dialog, EmptyState, Panel, StatusTag } from '@analiza/ui';
import { useAuth, useWorkspace } from '@/components/providers';
import { useOperations } from '@/lib/use-operations';
const money = (value: number) =>
  new Intl.NumberFormat('es-SV', { style: 'currency', currency: 'USD' }).format(value);

export default function VisitsGoalsPage() {
  const operations = useOperations();
  const { patients } = useWorkspace();
  const { can, session } = useAuth();
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [dialog, setDialog] = useState<'visit' | 'goal' | null>(null);
  const [message, setMessage] = useState('');
  const [commandKey, setCommandKey] = useState(() => crypto.randomUUID());
  const visits = operations.visits.filter((item) => item.occurredAt.slice(0, 7) === month);
  const goals = operations.goals.filter((item) => item.month === month);
  const professionals = operations.professionals;
  const manage = can('nurses:manage') || can('payments:write');
  const totalSales = visits.reduce((sum, item) => sum + item.saleAmount, 0);
  const salesGoal = goals.reduce((sum, item) => sum + item.salesTarget, 0);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const professional = professionals.find((item) => item.userId === values.get('professional'));
    if (!professional) return;
    const command =
      dialog === 'goal'
        ? {
            command: 'goal.save',
            goal: {
              professionalUserId: professional.userId,
              professionalName: professional.name,
              month,
              visitTarget: Number(values.get('visits')),
              salesTarget: Number(values.get('sales')),
            },
          }
        : {
            command: 'visit.create',
            visit: {
              professionalUserId: professional.userId,
              professionalName: professional.name,
              profession: professional.profession,
              occurredAt: new Date(String(values.get('date'))).toISOString(),
              patientId: values.get('patient'),
              saleAmount: Number(values.get('amount')),
              saleReference: values.get('reference'),
              note: values.get('note'),
              idempotencyKey: commandKey,
            },
          };
    if (await operations.execute(command)) {
      setDialog(null);
      setCommandKey(crypto.randomUUID());
      setMessage('Registro guardado en MongoDB.');
    }
  }
  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">Analiza en Casa</p>
          <h1>Visitas y metas</h1>
          <p>Atención a domicilio y ventas registradas por enfermera o médico.</p>
        </div>
        <div className="header-actions">
          {manage ? (
            <Button className="button-secondary" onClick={() => setDialog('goal')}>
              Definir meta
            </Button>
          ) : null}
          <Button data-action-id="HOME-VISIT-CREATE" onClick={() => setDialog('visit')}>
            + Registrar visita
          </Button>
        </div>
      </header>
      <Panel className="studio-toolbar">
        <label>
          Mes{' '}
          <input
            aria-label="Mes del reporte"
            type="month"
            value={month}
            onChange={(event) => setMonth(event.target.value)}
          />
        </label>
        <span>{professionals.length} profesionales</span>
      </Panel>
      <section className="studio-metrics">
        {[
          [
            '⌂',
            'Visitas realizadas',
            String(visits.length),
            'Visitas registradas, no turnos programados',
          ],
          ['$', 'Ventas registradas', money(totalSales), 'Con referencia de respaldo'],
          [
            '◎',
            'Meta de ventas',
            money(salesGoal),
            salesGoal
              ? `${Math.round((totalSales / salesGoal) * 100)}% de avance`
              : 'Defina una meta para el mes',
          ],
        ].map(([icon, label, value, detail]) => (
          <Panel key={label}>
            <article>
              <span aria-hidden="true">{icon}</span>
              <div>
                <small>{label}</small>
                <strong>{value}</strong>
                <p>{detail}</p>
              </div>
            </article>
          </Panel>
        ))}
      </section>
      {message ? (
        <p role="status" className="notice success">
          {message}
        </p>
      ) : null}
      {operations.error ? (
        <p className="notice" role="alert">
          {operations.error}
        </p>
      ) : null}
      <Panel>
        <div className="table-heading">
          <h2>Resultados por profesional</h2>
          <StatusTag>{month}</StatusTag>
        </div>
        {professionals.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Profesional</th>
                  <th>Visitas</th>
                  <th>Meta de visitas</th>
                  <th>Ventas</th>
                  <th>Meta de ventas</th>
                  <th>Avance de ventas</th>
                </tr>
              </thead>
              <tbody>
                {professionals.map((person) => {
                  const rows = visits.filter((item) => item.professionalUserId === person.userId);
                  const sales = rows.reduce((sum, item) => sum + item.saleAmount, 0);
                  const goal = goals.find((item) => item.professionalUserId === person.userId);
                  return (
                    <tr key={person.userId}>
                      <td>
                        <strong>{person.name}</strong>
                        <small style={{ display: 'block' }}>
                          {person.profession === 'DOCTOR' ? 'Médico' : 'Enfermería'}
                        </small>
                      </td>
                      <td>{rows.length}</td>
                      <td>{goal?.visitTarget ?? 'Sin meta'}</td>
                      <td>{money(sales)}</td>
                      <td>{goal ? money(goal.salesTarget) : 'Sin meta'}</td>
                      <td>
                        {goal?.salesTarget ? (
                          <div className="goal-progress">
                            <progress
                              max={goal.salesTarget}
                              value={Math.min(sales, goal.salesTarget)}
                            />
                            <span>{Math.round((sales / goal.salesTarget) * 100)}%</span>
                          </div>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="Sin cuentas de profesionales"
            detail="Registre las cuentas del equipo para asignar visitas y metas."
          />
        )}
      </Panel>
      <Panel>
        <div className="table-heading">
          <h2>Detalle de visitas a domicilio</h2>
        </div>
        {visits.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Profesional</th>
                  <th>Paciente</th>
                  <th>Venta</th>
                  <th>Referencia</th>
                </tr>
              </thead>
              <tbody>
                {visits.map((visit) => (
                  <tr key={visit.id}>
                    <td>{new Date(visit.occurredAt).toLocaleString('es-SV')}</td>
                    <td>{visit.professionalName}</td>
                    <td>{patients.find((item) => item.id === visit.patientId)?.fullName}</td>
                    <td>{money(visit.saleAmount)}</td>
                    <td>{visit.saleReference || 'Sin venta'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="Sin visitas registradas en este mes"
            detail="Una cotización o un turno no se contabilizan automáticamente como una venta."
          />
        )}
      </Panel>
      <Dialog
        open={dialog !== null}
        onClose={() => setDialog(null)}
        title={dialog === 'goal' ? 'Definir meta mensual' : 'Registrar visita a domicilio'}
        description="Las metas y ventas son registros administrativos; no modifican pagos ni cotizaciones."
        footer={
          <>
            <Button className="button-secondary" onClick={() => setDialog(null)}>
              Cancelar
            </Button>
            <Button form="visit-form" type="submit" disabled={operations.busy}>
              Guardar
            </Button>
          </>
        }
      >
        <form className="form-grid" id="visit-form" onSubmit={submit}>
          <label className="full">
            Profesional
            <select name="professional" required>
              <option value="">Seleccionar profesional</option>
              {professionals
                .filter((item) => manage || item.userId === session?.userId)
                .map((person) => (
                  <option key={person.userId} value={person.userId}>
                    {person.name} · {person.profession === 'DOCTOR' ? 'Médico' : 'Enfermería'}
                  </option>
                ))}
            </select>
          </label>
          {dialog === 'goal' ? (
            <>
              <label>
                Meta de visitas · {month}
                <input name="visits" type="number" min="0" step="1" required />
              </label>
              <label>
                Meta de ventas ($)
                <input name="sales" type="number" min="0" step="0.01" required />
              </label>
            </>
          ) : (
            <>
              <label>
                Fecha de visita
                <input name="date" type="datetime-local" required />
              </label>
              <label>
                Paciente
                <select name="patient" required>
                  <option value="">Seleccionar paciente</option>
                  {patients.map((patient) => (
                    <option key={patient.id} value={patient.id}>
                      {patient.fullName}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Venta registrada ($)
                <input name="amount" type="number" min="0" step="0.01" defaultValue="0" required />
              </label>
              <label>
                Referencia de venta
                <input name="reference" />
                <span className="field-help">Obligatoria si registra un monto mayor a cero.</span>
              </label>
              <label className="full">
                Observaciones
                <textarea name="note" rows={3} />
              </label>
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
