'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Dialog, EmptyState, Panel, StatusTag } from '@analiza/ui';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { useAuth, useWorkspace } from '@/components/providers';
import { buildShiftSeries, endForPreset, type ShiftPreset } from '@/lib/agenda-series';

const shiftSchema = z.object({
  resourceId: z.string().min(1, 'Seleccione un recurso.'),
  patientId: z.string().optional(),
  startTime: z.string().min(1, 'Indique el inicio.'),
  endTime: z.string().min(1, 'Indique el fin.'),
  status: z.enum(['SCHEDULED', 'CANCELLED', 'COMPLETED']),
  note: z.string().trim(),
});
type ShiftForm = z.infer<typeof shiftSchema>;
const statusLabel = { SCHEDULED: 'Programado', CANCELLED: 'Cancelado', COMPLETED: 'Completado' };
const initialDate = '2026-08-29';
type CalendarView = 'MONTH' | 'WEEK' | 'LIST_WEEK' | 'LIST_DAY';

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}
function dateFromIso(date: string) {
  return new Date(`${date}T00:00:00.000Z`);
}
function monthForDate(date: string) {
  return date.slice(0, 7);
}

function moveCalendarAnchor(date: string, view: CalendarView, direction: -1 | 1) {
  const current = dateFromIso(date);
  if (view === 'MONTH') {
    const targetMonth = current.getUTCMonth() + direction;
    const lastDay = new Date(Date.UTC(current.getUTCFullYear(), targetMonth + 1, 0)).getUTCDate();
    return isoDate(
      new Date(
        Date.UTC(current.getUTCFullYear(), targetMonth, Math.min(current.getUTCDate(), lastDay)),
      ),
    );
  }
  current.setUTCDate(current.getUTCDate() + (view === 'LIST_DAY' ? direction : direction * 7));
  return isoDate(current);
}

function calendarWeek(anchor: string) {
  const start = dateFromIso(anchor);
  start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + index);
    return isoDate(date);
  });
}

function calendarDays(month: string) {
  const [year, monthIndex] = month.split('-').map(Number);
  const first = new Date(Date.UTC(year, monthIndex - 1, 1));
  const weekdayOffset = (first.getUTCDay() + 6) % 7;
  const start = new Date(first);
  start.setUTCDate(first.getUTCDate() - weekdayOffset);
  return Array.from({ length: 35 }, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + index);
    return date.toISOString().slice(0, 10);
  });
}

function agendaMonthLabel(month: string) {
  const [year, monthIndex] = month.split('-').map(Number);
  return new Intl.DateTimeFormat('es-SV', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, monthIndex - 1, 1)));
}

function agendaDateLabel(date: string) {
  return new Intl.DateTimeFormat('es-SV', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(dateFromIso(date));
}

export default function AgendaPage() {
  const { addShift, nursingResources, patients, shifts } = useWorkspace();
  const { can } = useAuth();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [dates, setDates] = useState<string[]>([initialDate]);
  const [endDayOffset, setEndDayOffset] = useState<0 | 1>(0);
  const [patientQuery, setPatientQuery] = useState('');
  const [patientFilter, setPatientFilter] = useState('');
  const [calendarAnchor, setCalendarAnchor] = useState(initialDate);
  const [calendarView, setCalendarView] = useState<CalendarView>('MONTH');
  const [detailShift, setDetailShift] = useState<(typeof shifts)[number] | null>(null);
  const form = useForm<ShiftForm>({
    resolver: zodResolver(shiftSchema),
    defaultValues: {
      resourceId: nursingResources[0]?.id ?? '',
      patientId: patients[0]?.id,
      startTime: '08:00',
      endTime: '12:00',
      status: 'SCHEDULED',
      note: '',
    },
  });
  const selectedShiftPatientId = useWatch({ control: form.control, name: 'patientId' });
  const selectedShiftPatient = patients.find((patient) => patient.id === selectedShiftPatientId);
  function close() {
    setOpen(false);
    setDates([initialDate]);
    setEndDayOffset(0);
    form.reset();
  }
  function choosePreset(preset: ShiftPreset) {
    const date = dates.find(Boolean) ?? initialDate;
    const end = endForPreset(date, form.getValues('startTime'), preset);
    form.setValue('endTime', end.endTime);
    setEndDayOffset(end.endDayOffset);
  }
  function submit(values: ShiftForm) {
    try {
      const series = buildShiftSeries({
        ...values,
        dates,
        endDayOffset,
        existing: shifts,
        idFor: () => crypto.randomUUID(),
      });
      series.forEach(addShift);
      setMessage(
        `${series.length} turno${series.length === 1 ? '' : 's'} persistido${series.length === 1 ? '' : 's'} para las fechas seleccionadas.`,
      );
      close();
    } catch (error) {
      form.setError('startTime', {
        message: error instanceof Error ? error.message : 'No fue posible crear la serie.',
      });
    }
  }
  const matchingPatients = patients.filter((patient) =>
    `${patient.fullName} ${patient.documentId}`
      .toLocaleLowerCase('es')
      .includes(patientQuery.toLocaleLowerCase('es')),
  );
  const selectedPatient = patients.find((patient) => patient.id === patientFilter);
  const visibleShifts = shifts
    .filter((shift) => !patientFilter || shift.patientId === patientFilter)
    .slice()
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const detailPatient = patients.find((patient) => patient.id === detailShift?.patientId);
  const detailResource = nursingResources.find(
    (resource) => resource.id === detailShift?.resourceId,
  );
  const shiftsByDate = new Map<string, typeof visibleShifts>();
  visibleShifts.forEach((shift) => {
    const date = shift.startsAt.slice(0, 10);
    shiftsByDate.set(date, [...(shiftsByDate.get(date) ?? []), shift]);
  });
  const agendaMonth = monthForDate(calendarAnchor);
  const weekDates = calendarWeek(calendarAnchor);
  const calendarDates = calendarView === 'WEEK' ? weekDates : calendarDays(agendaMonth);
  const listedShifts =
    calendarView === 'LIST_WEEK'
      ? visibleShifts.filter(
          (shift) =>
            shift.startsAt.slice(0, 10) >= weekDates[0] &&
            shift.startsAt.slice(0, 10) <= weekDates[6],
        )
      : calendarView === 'LIST_DAY'
        ? visibleShifts.filter((shift) => shift.startsAt.slice(0, 10) === calendarAnchor)
        : visibleShifts;
  const calendarTitle =
    calendarView === 'MONTH'
      ? agendaMonthLabel(agendaMonth)
      : calendarView === 'WEEK'
        ? `Semana del ${agendaDateLabel(weekDates[0])} al ${agendaDateLabel(weekDates[6])}`
        : calendarView === 'LIST_WEEK'
          ? `Lista por semana: ${agendaDateLabel(weekDates[0])} al ${agendaDateLabel(weekDates[6])}`
          : `Lista por día: ${agendaDateLabel(calendarAnchor)}`;
  const eventCard = (shift: (typeof visibleShifts)[number]) => {
    const patient = patients.find((item) => item.id === shift.patientId);
    return (
      <div
        aria-label={`Turno ${patient?.fullName ?? 'sin paciente'} ${statusLabel[shift.status]}`}
        className={`agenda-event agenda-event-${shift.status.toLowerCase()}`}
        key={shift.id}
      >
        {new Date(shift.startsAt).toLocaleTimeString('es-SV', {
          hour: '2-digit',
          minute: '2-digit',
        })}{' '}
        · {patient?.fullName ?? 'Sin asignar'}
      </div>
    );
  };
  const shiftRows = (items: typeof visibleShifts) =>
    items.map((shift) => (
      <tr key={shift.id}>
        <td>{new Date(shift.startsAt).toLocaleString('es-SV')}</td>
        <td>{new Date(shift.endsAt).toLocaleString('es-SV')}</td>
        <td>
          {nursingResources.find((resource) => resource.id === shift.resourceId)?.displayName ??
            'No disponible'}
        </td>
        <td>
          {patients.find((patient) => patient.id === shift.patientId)?.fullName ?? 'Sin asignar'}
          <br />
          <Button
            className="button-secondary"
            data-action-id="AGENDA-SHIFT-DETAIL-OPEN"
            onClick={() => setDetailShift(shift)}
            type="button"
          >
            Ver detalle
          </Button>
        </td>
        <td>{statusLabel[shift.status]}</td>
        <td>{shift.note ?? '—'}</td>
      </tr>
    ));
  return (
    <div className="page-stack">
      <header className="page-header page-header-actions">
        <div>
          <p className="eyebrow">Operaciones</p>
          <h1>Agenda y turnos</h1>
          <p>Turnos sintéticos auditables; las horas se derivan de su intervalo programado.</p>
        </div>
        {can('agenda:write') ? (
          <Button
            data-action-id="AGENDA-SHIFT-CREATE"
            onClick={() => {
              setMessage(null);
              setOpen(true);
            }}
            type="button"
          >
            Crear turno
          </Button>
        ) : null}
      </header>
      {message ? (
        <p className="notice success" role="status">
          {message}
        </p>
      ) : null}
      <Panel>
        <div className="table-heading">
          <div>
            <h2>Agenda por paciente</h2>
            <p className="field-help">
              Filtra únicamente turnos ya registrados; no crea ni altera visitas.
            </p>
          </div>
          <StatusTag>{visibleShifts.length} registros</StatusTag>
        </div>
        <div className="agenda-filters">
          <label>
            Filtrar por
            <select aria-label="Filtrar por" disabled value="patient">
              <option value="patient">Paciente</option>
            </select>
          </label>
          <label>
            Buscar paciente
            <input
              data-action-id="AGENDA-PATIENT-SEARCH"
              onChange={(event) => setPatientQuery(event.target.value)}
              placeholder="Nombre o documento"
              type="search"
              value={patientQuery}
            />
          </label>
          <label>
            Paciente
            <select
              data-action-id="AGENDA-PATIENT-FILTER"
              onChange={(event) => setPatientFilter(event.target.value)}
              value={patientFilter}
            >
              <option value="">Todos los pacientes</option>
              {matchingPatients.map((patient) => (
                <option key={patient.id} value={patient.id}>
                  {patient.fullName} · {patient.documentId}
                </option>
              ))}
            </select>
          </label>
        </div>
        {selectedPatient ? (
          <p className="agenda-patient-summary" role="status">
            Paciente seleccionado: <strong>{selectedPatient.fullName}</strong> ·{' '}
            {selectedPatient.documentType} {selectedPatient.documentId}
          </p>
        ) : null}
        <section aria-label="Controles de calendario" className="agenda-calendar-controls">
          <div className="agenda-navigation" role="group" aria-label="Navegación del calendario">
            <Button
              aria-label="Periodo anterior"
              className="button-secondary"
              data-action-id="AGENDA-CALENDAR-PREV"
              onClick={() =>
                setCalendarAnchor((current) => moveCalendarAnchor(current, calendarView, -1))
              }
              type="button"
            >
              ‹
            </Button>
            <Button
              className="button-secondary"
              data-action-id="AGENDA-CALENDAR-TODAY"
              onClick={() => setCalendarAnchor(initialDate)}
              type="button"
            >
              Hoy
            </Button>
            <Button
              aria-label="Periodo siguiente"
              className="button-secondary"
              data-action-id="AGENDA-CALENDAR-NEXT"
              onClick={() =>
                setCalendarAnchor((current) => moveCalendarAnchor(current, calendarView, 1))
              }
              type="button"
            >
              ›
            </Button>
          </div>
          <p aria-live="polite" className="agenda-period-label">
            {calendarTitle}
          </p>
          <div className="agenda-view-tabs" role="group" aria-label="Vista de calendario">
            <Button
              aria-pressed={calendarView === 'MONTH'}
              className={calendarView === 'MONTH' ? '' : 'button-secondary'}
              data-action-id="AGENDA-CALENDAR-VIEW-MONTH"
              onClick={() => setCalendarView('MONTH')}
              type="button"
            >
              Mes
            </Button>
            <Button
              aria-pressed={calendarView === 'WEEK'}
              className={calendarView === 'WEEK' ? '' : 'button-secondary'}
              data-action-id="AGENDA-CALENDAR-VIEW-WEEK"
              onClick={() => setCalendarView('WEEK')}
              type="button"
            >
              Semana
            </Button>
            <Button
              aria-pressed={calendarView === 'LIST_WEEK'}
              className={calendarView === 'LIST_WEEK' ? '' : 'button-secondary'}
              data-action-id="AGENDA-CALENDAR-VIEW-LIST-WEEK"
              onClick={() => setCalendarView('LIST_WEEK')}
              type="button"
            >
              Lista por semana
            </Button>
            <Button
              aria-pressed={calendarView === 'LIST_DAY'}
              className={calendarView === 'LIST_DAY' ? '' : 'button-secondary'}
              data-action-id="AGENDA-CALENDAR-VIEW-LIST-DAY"
              onClick={() => setCalendarView('LIST_DAY')}
              type="button"
            >
              Lista por día
            </Button>
          </div>
          <div className="agenda-blocked-action">
            <Button
              aria-describedby="agenda-delete-visits-help"
              data-action-id="AGENDA-VISITS-DELETE"
              disabled
              type="button"
            >
              Eliminar visitas
            </Button>
            <span className="field-help" id="agenda-delete-visits-help">
              Requiere definición de selección, permisos, motivo y auditoría (CH11-Q004/Q006).
            </span>
          </div>
        </section>
        {calendarView === 'MONTH' || calendarView === 'WEEK' ? (
          <section aria-label={`Calendario de ${calendarTitle}`} className="agenda-calendar">
            <h3>{calendarTitle}</h3>
            <div aria-hidden="true" className="agenda-weekdays">
              <span>lun</span>
              <span>mar</span>
              <span>mié</span>
              <span>jue</span>
              <span>vie</span>
              <span>sáb</span>
              <span>dom</span>
            </div>
            <div className="agenda-calendar-grid">
              {calendarDates.map((date) => (
                <div
                  className={`agenda-day${date.startsWith(agendaMonth) ? '' : ' agenda-day-muted'}`}
                  key={date}
                >
                  <span>{Number(date.slice(-2))}</span>
                  {(shiftsByDate.get(date) ?? []).map(eventCard)}
                </div>
              ))}
            </div>
          </section>
        ) : (
          <section aria-label={calendarTitle} className="agenda-list-view">
            <h3>{calendarTitle}</h3>
            {listedShifts.length ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Inicio</th>
                      <th>Fin</th>
                      <th>Enfermera</th>
                      <th>Paciente</th>
                      <th>Estado</th>
                      <th>Notas</th>
                    </tr>
                  </thead>
                  <tbody>{shiftRows(listedShifts)}</tbody>
                </table>
              </div>
            ) : (
              <EmptyState
                detail="No hay turnos existentes en este periodo."
                title="Sin turnos coincidentes"
              />
            )}
          </section>
        )}
        {calendarView === 'MONTH' || calendarView === 'WEEK' ? (
          visibleShifts.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Inicio</th>
                    <th>Fin</th>
                    <th>Enfermera</th>
                    <th>Paciente</th>
                    <th>Estado</th>
                    <th>Notas</th>
                  </tr>
                </thead>
                <tbody>{shiftRows(visibleShifts)}</tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              detail="No hay turnos para el paciente seleccionado."
              title="Sin turnos coincidentes"
            />
          )
        ) : null}
      </Panel>
      {detailShift ? (
        <Dialog
          description="Vista factual de un turno sintético existente. No representa una visita finalizada ni permite actualizar información clínica, de disponibilidad o pagos."
          footer={
            <Button
              className="button-secondary"
              data-action-id="AGENDA-SHIFT-DETAIL-CLOSE"
              onClick={() => setDetailShift(null)}
              type="button"
            >
              Cerrar detalle
            </Button>
          }
          onClose={() => setDetailShift(null)}
          open
          title="Detalle del turno sintético"
        >
          <div className="page-stack">
            <div className="agenda-view-tabs" role="group" aria-label="Secciones del detalle">
              <span aria-current="page" className="button">
                Agenda
              </span>
              <Button
                aria-describedby="agenda-shift-detail-updates-help"
                data-action-id="AGENDA-SHIFT-DETAIL-UPDATES"
                disabled
                type="button"
              >
                Actualizaciones
              </Button>
            </div>
            <p className="field-help" id="agenda-shift-detail-updates-help">
              Las actualizaciones requieren definición clínica, estados, permisos y auditoría
              (CH11-Q002/Q006).
            </p>
            <Panel>
              <dl className="detail-list">
                <div>
                  <dt>Inicio</dt>
                  <dd>{new Date(detailShift.startsAt).toLocaleString('es-SV')}</dd>
                </div>
                <div>
                  <dt>Fin</dt>
                  <dd>{new Date(detailShift.endsAt).toLocaleString('es-SV')}</dd>
                </div>
                <div>
                  <dt>Paciente</dt>
                  <dd>{detailPatient?.fullName ?? 'Sin asignar'}</dd>
                </div>
                <div>
                  <dt>Recurso asignado</dt>
                  <dd>{detailResource?.displayName ?? 'No disponible'}</dd>
                </div>
                <div>
                  <dt>Estado registrado</dt>
                  <dd>{statusLabel[detailShift.status]}</dd>
                </div>
                <div>
                  <dt>Nota del turno sintético</dt>
                  <dd>{detailShift.note || 'Sin notas registradas.'}</dd>
                </div>
              </dl>
            </Panel>
          </div>
        </Dialog>
      ) : null}
      <Dialog
        description="Puede crear una serie de días sin duplicados ni colisiones del mismo recurso. Puntual sigue pendiente de definición del cliente."
        footer={
          <>
            <Button
              className="button-secondary"
              data-action-id="AGENDA-SHIFT-CLOSE"
              onClick={close}
              type="button"
            >
              Cerrar
            </Button>
            <Button data-action-id="AGENDA-SHIFT-SAVE" form="shift-form" type="submit">
              Guardar
            </Button>
          </>
        }
        onClose={close}
        open={open}
        title="Crear turno a paciente"
      >
        <form className="form-grid" id="shift-form" noValidate onSubmit={form.handleSubmit(submit)}>
          <label>
            Enfermera
            <select {...form.register('resourceId')}>
              {nursingResources.map((resource) => (
                <option key={resource.id} value={resource.id}>
                  {resource.displayName}
                </option>
              ))}
            </select>
          </label>
          <label>
            Paciente
            <select data-action-id="AGENDA-SHIFT-PATIENT-SELECT" {...form.register('patientId')}>
              <option value="">Sin asignar</option>
              {patients.map((patient) => (
                <option key={patient.id} value={patient.id}>
                  {patient.fullName}
                </option>
              ))}
            </select>
            <span className="field-help">
              Puede quedar sin asignar; no se crea una visita clínica.
            </span>
          </label>
          <label>
            Documento
            <input
              aria-label="Documento del paciente"
              readOnly
              value={
                selectedShiftPatient
                  ? `${selectedShiftPatient.documentType} ${selectedShiftPatient.documentId}`
                  : 'Sin paciente asignado'
              }
            />
          </label>
          <label>
            Empresa
            <input
              aria-label="Empresa del paciente"
              readOnly
              value={selectedShiftPatient?.company ?? 'Sin empresa registrada'}
            />
          </label>
          <div className="full">
            <div className="table-heading">
              <div>
                <h3>Fechas para agendar</h3>
                <p className="field-help">
                  Cada fecha crea un turno independiente con el mismo intervalo.
                </p>
              </div>
              <Button
                className="button-secondary"
                data-action-id="AGENDA-SHIFT-DATE-ADD"
                onClick={() => setDates((current) => [...current, ''])}
                type="button"
              >
                Agregar fecha
              </Button>
            </div>
            {dates.map((date, index) => (
              <div className="action-row" key={`${index}-${date}`}>
                <label>
                  Fecha {index + 1}
                  <input
                    data-action-id="AGENDA-SHIFT-DATE"
                    onChange={(event) =>
                      setDates((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index ? event.target.value : item,
                        ),
                      )
                    }
                    type="date"
                    value={date}
                  />
                </label>
                {dates.length > 1 ? (
                  <Button
                    aria-label={`Quitar fecha ${index + 1}`}
                    className="button-secondary"
                    data-action-id="AGENDA-SHIFT-DATE-REMOVE"
                    onClick={() =>
                      setDates((current) => current.filter((_, itemIndex) => itemIndex !== index))
                    }
                    type="button"
                  >
                    Quitar fecha
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
          <label>
            Inicio
            <input
              {...form.register('startTime', { onChange: () => setEndDayOffset(0) })}
              type="time"
            />
            {form.formState.errors.startTime ? (
              <span className="field-error" role="alert">
                {form.formState.errors.startTime.message}
              </span>
            ) : null}
          </label>
          <label>
            Fin
            <input
              {...form.register('endTime', { onChange: () => setEndDayOffset(0) })}
              type="time"
            />
            {endDayOffset ? <span className="field-help">Finaliza el día siguiente.</span> : null}
          </label>
          <div className="full action-row">
            <Button
              className="button-secondary"
              data-action-id="AGENDA-SHIFT-PRESET-6H"
              onClick={() => choosePreset('SIX_HOURS')}
              type="button"
            >
              Turno 6 horas
            </Button>
            <Button
              className="button-secondary"
              data-action-id="AGENDA-SHIFT-PRESET-8H"
              onClick={() => choosePreset('EIGHT_HOURS')}
              type="button"
            >
              Turno 8 horas
            </Button>
            <Button
              data-action-id="AGENDA-SHIFT-PRESET-PUNTUAL"
              disabled
              title="Requiere definición del cliente"
              type="button"
            >
              Puntual (pendiente de definición)
            </Button>
          </div>
          <section
            aria-labelledby="agenda-observed-classification-title"
            className="full"
            data-action-id="AGENDA-SHIFT-CLASSIFICATION-OBSERVED"
          >
            <h3 id="agenda-observed-classification-title">Clasificación observada</h3>
            <p>
              <strong>Puntual</strong> · <strong>Turno</strong>
            </p>
            <p className="field-help" id="agenda-observed-classification-help">
              Etiquetas visibles de CH11-E0026/E0027. No son seleccionables, no se guardan y no
              definen una visita, frecuencia, disponibilidad, descuento ni estado (CR-010;
              CH11-Q001/Q003/Q006/Q008).
            </p>
            <details data-action-id="AGENDA-SHIFT-TYPE-OBSERVED-CATALOG">
              <summary>Tipos observados (sin selección)</summary>
              <ul
                aria-describedby="agenda-observed-classification-help"
                aria-label="Tipos de visita observados"
              >
                <li>Cuidado de enfermería</li>
                <li>Visita Respiratoria General</li>
                <li>Cuidados Técnicos de Enfermería</li>
                <li>Laboratorio Especial</li>
                <li>Visita de Geriatría</li>
                <li>Laboratorio Tercerizado</li>
              </ul>
            </details>
          </section>
          <label>
            Estado
            <select {...form.register('status')}>
              <option value="SCHEDULED">Programado</option>
              <option value="CANCELLED">Cancelado</option>
              <option value="COMPLETED">Completado</option>
            </select>
          </label>
          <label>
            Notas
            <input {...form.register('note')} />
          </label>
        </form>
      </Dialog>
    </div>
  );
}
