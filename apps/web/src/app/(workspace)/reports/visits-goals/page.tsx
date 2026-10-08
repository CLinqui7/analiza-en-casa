'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { Button, Dialog, EmptyState, Panel, StatusTag } from '@analiza/ui';
import { useWorkspace } from '@/components/providers';
import { useOperations } from '@/lib/use-operations';
import { commercialTotals, periodStarts } from '@/lib/field-metrics';

const money = (value: number) =>
  new Intl.NumberFormat('es-SV', { style: 'currency', currency: 'USD' }).format(value);
type Action = 'visit' | 'admission' | 'goal' | 'sale';

export default function CommercialVisitsGoalsPage() {
  const operations = useOperations();
  const { hospitalizations, patients } = useWorkspace();
  const [action, setAction] = useState<Action | null>(null);
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [formTime, setFormTime] = useState('');
  const [message, setMessage] = useState('');
  const [period, setPeriod] = useState<'WEEK' | 'MONTH'>('WEEK');
  const [selectedMonth, setSelectedMonth] = useState(() =>
    periodStarts(new Date()).month.slice(0, 7),
  );
  const [selectedWeek, setSelectedWeek] = useState(() => periodStarts(new Date()).week);
  const periodStart = period === 'WEEK' ? selectedWeek : `${selectedMonth}-01`;
  const totals = useMemo(
    () =>
      commercialTotals(
        operations.commercialVisits,
        operations.commercialAdmissions,
        operations.confirmedSales,
        periodStart,
        period,
      ),
    [
      operations.commercialVisits,
      operations.commercialAdmissions,
      operations.confirmedSales,
      periodStart,
      period,
    ],
  );
  const goal = operations.commercialGoals.find(
    (item) => item.period === period && item.periodStart === periodStart,
  );
  const doctorNames = new Map(
    operations.commercialDoctors.map((doctor) => [doctor.id, doctor.fullName]),
  );
  const patientNames = new Map(patients.map((patient) => [patient.id, patient.fullName]));
  const isManager = operations.commercialAccess === 'MANAGER';
  const isRep = operations.commercialAccess === 'REP';
  const startAction = (next: Action) => {
    setAction(next);
    setKey(crypto.randomUUID());
    const now = new Date();
    setFormTime(
      new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16),
    );
  };
  const chart = [
    {
      label: 'Médicos visitados',
      value: totals.doctors,
      target: goal?.doctorTarget ?? 0,
      unit: 'médicos',
    },
    {
      label: 'Pacientes ingresados',
      value: totals.patients,
      target: goal?.admissionTarget ?? 0,
      unit: 'ingresos',
    },
    {
      label: 'Ventas vinculadas',
      value: totals.sales,
      target: goal?.salesTarget ?? 0,
      unit: 'USD',
    },
  ];

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const id = key;
    let command: unknown;
    if (action === 'visit')
      command = {
        command: 'commercial.visit.record',
        visit: {
          id,
          idempotencyKey: id,
          doctorId: String(values.get('doctorId')),
          occurredAt: new Date(String(values.get('occurredAt'))).toISOString(),
          outcome: values.get('outcome'),
          note: String(values.get('note') ?? ''),
        },
      };
    else if (action === 'admission')
      command = {
        command: 'commercial.admission.link',
        admission: {
          id,
          idempotencyKey: id,
          visitId: String(values.get('visitId')),
          hospitalizationId: String(values.get('hospitalizationId')),
        },
      };
    else if (action === 'goal')
      command = {
        command: 'commercial.goal.save',
        goal: {
          id,
          idempotencyKey: id,
          period,
          periodStart,
          doctorTarget: Number(values.get('doctors')),
          admissionTarget: Number(values.get('admissions')),
          salesTarget: Number(values.get('sales')),
        },
      };
    else
      command = {
        command: 'sale.confirmed.record',
        sale: {
          id,
          idempotencyKey: id,
          occurredAt: new Date(String(values.get('occurredAt'))).toISOString(),
          reference: String(values.get('reference')).trim(),
          amount: Number(values.get('amount')),
          category: values.get('category'),
          commercialVisitId: String(values.get('visitId')),
        },
      };
    if (await operations.execute(command)) {
      setAction(null);
      setKey(crypto.randomUUID());
      setMessage('Registro guardado con referencia y auditoría.');
    }
  }

  if (!operations.connected)
    return (
      <Panel>
        <EmptyState
          title="Conexión requerida"
          detail="Las visitas comerciales y metas sólo se guardan en el servidor seguro."
        />
      </Panel>
    );
  if (operations.error && !operations.commercialAccess)
    return (
      <p className="notice warning" role="alert">
        {operations.error}
      </p>
    );
  if (!operations.commercialAccess)
    return (
      <Panel>
        <EmptyState
          title="Acceso comercial restringido"
          detail="Este tablero requiere una cuenta administrativa o comercial autorizada."
        />
      </Panel>
    );

  return (
    <div className="page-stack">
      <header className="page-header page-header-actions">
        <div>
          <p className="eyebrow">Comercial · Venta de equipos y servicios</p>
          <h1>Visitas y metas · venta de equipos</h1>
          <p>
            Seguimiento de Claudia: contactos médicos, ingresos vinculados y ventas confirmadas con
            referencia. No representa utilidad ni facturación fiscal.
          </p>
        </div>
        <div className="header-actions">
          {isRep ? <Button onClick={() => startAction('visit')}>Registrar visita</Button> : null}
          {operations.commercialVisits.length ? (
            <Button className="button-secondary" onClick={() => startAction('admission')}>
              Vincular ingreso
            </Button>
          ) : null}
          {isManager ? (
            <>
              <Button className="button-secondary" onClick={() => startAction('goal')}>
                Definir meta
              </Button>
              <Button onClick={() => startAction('sale')}>Confirmar venta</Button>
            </>
          ) : null}
        </div>
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
      <Panel className="studio-toolbar">
        <label>
          Período{' '}
          <select
            aria-label="Tipo de período"
            value={period}
            onChange={(event) => setPeriod(event.target.value as typeof period)}
          >
            <option value="WEEK">Semana</option>
            <option value="MONTH">Mes</option>
          </select>
        </label>
        {period === 'WEEK' ? (
          <label>
            Lunes de la semana{' '}
            <input
              aria-label="Lunes de la semana"
              type="date"
              value={selectedWeek}
              onChange={(event) => {
                const date = new Date(`${event.target.value}T12:00:00Z`);
                if (Number.isNaN(date.getTime())) return;
                date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
                setSelectedWeek(date.toISOString().slice(0, 10));
              }}
            />
          </label>
        ) : (
          <label>
            Mes{' '}
            <input
              aria-label="Mes comercial"
              type="month"
              value={selectedMonth}
              onChange={(event) => setSelectedMonth(event.target.value)}
            />
          </label>
        )}
        <span className="field-help">Las semanas comienzan lunes · zona horaria El Salvador.</span>
      </Panel>
      <section className="studio-metrics" aria-label="Resultados comerciales">
        {chart.map((item) => (
          <Panel key={item.label}>
            <article>
              <div>
                <small>{item.label}</small>
                <strong>{item.unit === 'USD' ? money(item.value) : item.value}</strong>
                <p>
                  Meta:{' '}
                  {goal
                    ? item.unit === 'USD'
                      ? money(item.target)
                      : item.target
                    : 'Aún no definida'}
                </p>
              </div>
            </article>
          </Panel>
        ))}
      </section>
      <Panel>
        <div className="table-heading">
          <h2>Avance de metas</h2>
          <StatusTag tone={goal ? 'success' : 'warning'}>
            {goal ? 'Meta definida' : 'Sin meta'}
          </StatusTag>
        </div>
        {goal ? (
          <div className="commercial-goal-bars">
            {chart.map((item) => (
              <div className="commercial-goal-row" key={item.label}>
                <div>
                  <strong>{item.label}</strong>
                  <span>
                    {item.unit === 'USD'
                      ? `${money(item.value)} / ${money(item.target)}`
                      : `${item.value} / ${item.target}`}
                  </span>
                </div>
                <div
                  className="commercial-goal-track"
                  role="progressbar"
                  aria-label={item.label}
                  aria-valuenow={item.value}
                  aria-valuemin={0}
                  aria-valuemax={Math.max(item.target, item.value, 1)}
                >
                  <span
                    style={{
                      width: `${item.target ? Math.min(100, Math.round((item.value / item.target) * 100)) : 0}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            title="Sissy aún no ha definido esta meta"
            detail="Los resultados se registran de todos modos; la meta puede fijarse posteriormente."
          />
        )}
      </Panel>
      <Panel>
        <div className="table-heading">
          <h2>Visitas comerciales registradas</h2>
          <StatusTag>{operations.commercialVisits.length}</StatusTag>
        </div>
        {operations.commercialVisits.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Médico</th>
                  <th>Resultado</th>
                  <th>Nota</th>
                </tr>
              </thead>
              <tbody>
                {operations.commercialVisits.map((visit) => (
                  <tr key={visit.id}>
                    <td>{new Date(visit.occurredAt).toLocaleDateString('es-SV')}</td>
                    <td>{doctorNames.get(visit.doctorId) ?? 'Médico'}</td>
                    <td>
                      {visit.outcome === 'NO_CONTACT'
                        ? 'Sin contacto'
                        : visit.outcome === 'FOLLOW_UP'
                          ? 'Seguimiento'
                          : 'Contactado'}
                    </td>
                    <td>{visit.note || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="Aún sin visitas"
            detail="Claudia puede registrar el primer contacto con un médico del directorio."
          />
        )}
      </Panel>
      <p className="notice" role="note">
        Un ingreso cuenta sólo al vincular una hospitalización existente con una visita comercial.
        Una venta cuenta sólo con referencia confirmada; las cotizaciones por sí solas no suman.
      </p>
      <Dialog
        open={action !== null}
        onClose={() => setAction(null)}
        title={
          {
            visit: 'Registrar visita a médico',
            admission: 'Vincular paciente ingresado',
            goal: 'Definir meta comercial',
            sale: 'Confirmar venta con referencia',
          }[action ?? 'visit']
        }
        footer={
          <>
            <Button className="button-secondary" onClick={() => setAction(null)}>
              Cancelar
            </Button>
            <Button disabled={operations.busy} form="commercial-form" type="submit">
              {operations.busy ? 'Guardando…' : 'Guardar registro'}
            </Button>
          </>
        }
      >
        <form className="form-grid" id="commercial-form" onSubmit={(event) => void submit(event)}>
          {action === 'visit' ? (
            <>
              <label>
                Médico{' '}
                <select name="doctorId" required>
                  <option value="">Seleccione</option>
                  {operations.commercialDoctors.map((doctor) => (
                    <option key={doctor.id} value={doctor.id}>
                      {doctor.fullName}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Fecha y hora{' '}
                <input name="occurredAt" type="datetime-local" required defaultValue={formTime} />
              </label>
              <label>
                Resultado{' '}
                <select name="outcome">
                  <option value="CONTACTED">Contactado</option>
                  <option value="FOLLOW_UP">Seguimiento</option>
                  <option value="NO_CONTACT">Sin contacto</option>
                </select>
              </label>
              <label className="full">
                Nota comercial (sin datos clínicos){' '}
                <textarea name="note" maxLength={1000} rows={2} />
              </label>
            </>
          ) : null}
          {action === 'admission' ? (
            <>
              <label>
                Visita comercial{' '}
                <select name="visitId" required>
                  <option value="">Seleccione</option>
                  {operations.commercialVisits.map((visit) => (
                    <option key={visit.id} value={visit.id}>
                      {doctorNames.get(visit.doctorId)} ·{' '}
                      {new Date(visit.occurredAt).toLocaleDateString('es-SV')}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Hospitalización{' '}
                <select name="hospitalizationId" required>
                  <option value="">Seleccione</option>
                  {hospitalizations.map((item) => (
                    <option key={item.id} value={item.id}>
                      {patientNames.get(item.patientId) ?? 'Paciente'} · {item.id}
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : null}
          {action === 'goal' ? (
            <>
              <p className="field-help full">
                Meta para {period === 'WEEK' ? 'semana' : 'mes'} desde {periodStart}. Reemplaza la
                meta anterior de este período con auditoría.
              </p>
              <label>
                Médicos visitados{' '}
                <input
                  name="doctors"
                  type="number"
                  min="0"
                  step="1"
                  required
                  defaultValue={goal?.doctorTarget ?? 0}
                />
              </label>
              <label>
                Pacientes ingresados{' '}
                <input
                  name="admissions"
                  type="number"
                  min="0"
                  step="1"
                  required
                  defaultValue={goal?.admissionTarget ?? 0}
                />
              </label>
              <label>
                Ventas confirmadas (USD){' '}
                <input
                  name="sales"
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  defaultValue={goal?.salesTarget ?? 0}
                />
              </label>
            </>
          ) : null}
          {action === 'sale' ? (
            <>
              <label>
                Referencia verificable{' '}
                <input name="reference" minLength={3} maxLength={200} required />
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
                Visita de Claudia{' '}
                <select name="visitId" required>
                  <option value="">Seleccione</option>
                  {operations.commercialVisits.map((visit) => (
                    <option key={visit.id} value={visit.id}>
                      {doctorNames.get(visit.doctorId)} ·{' '}
                      {new Date(visit.occurredAt).toLocaleDateString('es-SV')}
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : null}
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
