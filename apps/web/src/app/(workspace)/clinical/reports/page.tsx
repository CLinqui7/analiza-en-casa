'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { type VitalReading } from '@analiza/contracts';
import { measuredVitalMetrics } from '@analiza/domain';
import { Button, Dialog, EmptyState, Panel, StatusTag } from '@analiza/ui';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useWorkspace } from '@/components/providers';

const optionalPositiveNumber = z.preprocess(
  (value) => (value === '' || value === undefined ? undefined : Number(value)),
  z.number().positive('Use un valor positivo.').optional(),
);

const vitalFormSchema = z
  .object({
    patientId: z.string().min(1, 'Seleccione un paciente.'),
    measuredAt: z.string().min(1, 'Indique fecha y hora.'),
    source: z.enum(['clinical', 'patient']),
    systolic: optionalPositiveNumber,
    diastolic: optionalPositiveNumber,
    pulse: optionalPositiveNumber,
    temperature: optionalPositiveNumber,
    oxygenSaturation: optionalPositiveNumber,
    glucose: optionalPositiveNumber,
    note: z.string().trim(),
  })
  .superRefine((value, context) => {
    if (
      ![
        value.systolic,
        value.diastolic,
        value.pulse,
        value.temperature,
        value.oxygenSaturation,
        value.glucose,
      ].some((metric) => metric !== undefined)
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Registre al menos una medición individual.',
        path: ['systolic'],
      });
    }
  });

type VitalFormInput = z.input<typeof vitalFormSchema>;
type VitalForm = z.output<typeof vitalFormSchema>;

const tabs = [
  'Antecedentes y evaluaciones',
  'Signos vitales',
  'Perfiles clínicos',
  'Notas de evolución',
  'Interconsultas',
  'Notas de enfermería',
  'Bitácoras',
] as const;
type TabName = (typeof tabs)[number];

export default function HealthReportPage() {
  const { addVitalReading, auditEntries, patients, vitalReadings } = useWorkspace();
  const [activeTab, setActiveTab] = useState<TabName>('Antecedentes y evaluaciones');
  const [isVitalDialogOpen, setVitalDialogOpen] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const form = useForm<VitalFormInput, unknown, VitalForm>({
    resolver: zodResolver(vitalFormSchema),
    defaultValues: {
      patientId: patients[0]?.id ?? '',
      measuredAt: '',
      source: 'clinical',
      note: '',
    },
  });

  function closeVitalDialog() {
    setVitalDialogOpen(false);
    form.reset({ patientId: patients[0]?.id ?? '', measuredAt: '', source: 'clinical', note: '' });
  }

  function saveVitalReading(values: VitalForm) {
    const reading: VitalReading = {
      id: crypto.randomUUID(),
      patientId: values.patientId,
      measuredAt: new Date(values.measuredAt).toISOString(),
      source: values.source,
      systolic: values.systolic,
      diastolic: values.diastolic,
      pulse: values.pulse,
      temperature: values.temperature,
      oxygenSaturation: values.oxygenSaturation,
      glucose: values.glucose,
      note: values.note || undefined,
    };
    addVitalReading(reading);
    setActiveTab('Signos vitales');
    setResult('Medición individual registrada con evidencia de auditoría.');
    closeVitalDialog();
  }

  return (
    <div className="page-stack">
      <header className="page-header page-header-actions">
        <div>
          <p className="eyebrow">Clínico</p>
          <h1>Reporte de salud</h1>
          <p>Presentación trazable de datos sintéticos; no emite diagnóstico ni recomendaciones.</p>
        </div>
        <Button
          onClick={() => {
            setResult(null);
            setVitalDialogOpen(true);
          }}
          type="button"
        >
          Registrar medición individual
        </Button>
      </header>
      {result ? (
        <p className="notice success" role="status">
          {result}
        </p>
      ) : null}
      <div aria-label="Secciones del reporte de salud" className="tabs" role="tablist">
        {tabs.map((tab) => (
          <button
            aria-selected={activeTab === tab}
            className={activeTab === tab ? 'tab active' : 'tab'}
            key={tab}
            onClick={() => setActiveTab(tab)}
            role="tab"
            type="button"
          >
            {tab}
          </button>
        ))}
      </div>
      {activeTab === 'Antecedentes y evaluaciones' ? <BackgroundPanel /> : null}
      {activeTab === 'Signos vitales' ? (
        <VitalsPanel readings={vitalReadings} patients={patients} />
      ) : null}
      {activeTab === 'Perfiles clínicos' ? <ProfilesPanel /> : null}
      {activeTab === 'Notas de evolución' ? (
        <EmptyClinicalPanel
          title="Notas de evolución"
          detail="No hay notas sintéticas registradas en esta sesión."
        />
      ) : null}
      {activeTab === 'Interconsultas' ? (
        <EmptyClinicalPanel
          title="Interconsultas"
          detail="No hay interconsultas sintéticas registradas en esta sesión."
        />
      ) : null}
      {activeTab === 'Notas de enfermería' ? (
        <EmptyClinicalPanel
          title="Notas de enfermería"
          detail="Las notas se gestionan como registros auditados; esta sesión no contiene notas sintéticas."
        />
      ) : null}
      {activeTab === 'Bitácoras' ? <AuditPanel entries={auditEntries} /> : null}
      <Dialog
        description="Registre sólo valores sintéticos de QA. El sistema no interpreta ni calcula recomendaciones clínicas."
        footer={
          <>
            <Button className="button-secondary" onClick={closeVitalDialog} type="button">
              Cancelar
            </Button>
            <Button form="vital-form" type="submit">
              Guardar medición
            </Button>
          </>
        }
        onClose={closeVitalDialog}
        open={isVitalDialogOpen}
        title="Registrar signos vitales"
      >
        <form
          className="form-grid form-grid-compact"
          id="vital-form"
          noValidate
          onSubmit={form.handleSubmit(saveVitalReading)}
        >
          <label>
            Paciente
            <select {...form.register('patientId')}>
              {patients.map((patient) => (
                <option key={patient.id} value={patient.id}>
                  {patient.fullName}
                </option>
              ))}
            </select>
            {form.formState.errors.patientId ? (
              <span className="field-error">{form.formState.errors.patientId.message}</span>
            ) : null}
          </label>
          <label>
            Fecha y hora
            <input {...form.register('measuredAt')} type="datetime-local" />
            {form.formState.errors.measuredAt ? (
              <span className="field-error">{form.formState.errors.measuredAt.message}</span>
            ) : null}
          </label>
          <label>
            Fuente
            <select {...form.register('source')}>
              <option value="clinical">Registro clínico</option>
              <option value="patient">Reportado por paciente</option>
            </select>
          </label>
          <fieldset className="measurement-fieldset">
            <legend>Mediciones individuales</legend>
            <label>
              Sistólica (mmHg)
              <input {...form.register('systolic')} inputMode="decimal" type="number" />
            </label>
            <label>
              Diastólica (mmHg)
              <input {...form.register('diastolic')} inputMode="decimal" type="number" />
            </label>
            <label>
              Pulso (lpm)
              <input {...form.register('pulse')} inputMode="decimal" type="number" />
            </label>
            <label>
              Temperatura (°C)
              <input
                {...form.register('temperature')}
                inputMode="decimal"
                step="0.1"
                type="number"
              />
            </label>
            <label>
              Saturación O₂ (%)
              <input {...form.register('oxygenSaturation')} inputMode="decimal" type="number" />
            </label>
            <label>
              Glucosa (mg/dL)
              <input {...form.register('glucose')} inputMode="decimal" step="0.1" type="number" />
            </label>
          </fieldset>
          {form.formState.errors.systolic ? (
            <span className="field-error" role="alert">
              {form.formState.errors.systolic.message}
            </span>
          ) : null}
          <label>
            Nota de auditoría (opcional)
            <textarea {...form.register('note')} rows={3} />
          </label>
        </form>
      </Dialog>
    </div>
  );
}

function BackgroundPanel() {
  return (
    <section className="two-column">
      <Panel>
        <h2>Antecedentes documentados</h2>
        <p>
          No hay antecedentes sintéticos cargados para esta sesión. Este módulo presenta hechos
          registrados; no infiere información clínica.
        </p>
      </Panel>
      <Panel>
        <h2>Alergias y alertas</h2>
        <p>
          El catálogo y su política de fuentes requieren confirmación del cliente. No se muestran
          alertas no verificadas.
        </p>
        <StatusTag tone="warning">Configuración pendiente</StatusTag>
      </Panel>
    </section>
  );
}

function VitalsPanel({
  readings,
  patients,
}: {
  readings: VitalReading[];
  patients: { id: string; fullName: string }[];
}) {
  return (
    <Panel>
      <div className="table-heading">
        <div>
          <h2>Mediciones individuales</h2>
          <p>Valores mostrados por fuente y fecha, sin clasificación automática.</p>
        </div>
        <StatusTag>{readings.length} registros</StatusTag>
      </div>
      {readings.length ? (
        <div className="reading-list">
          {readings
            .slice()
            .reverse()
            .map((reading) => (
              <article className="reading-card" key={reading.id}>
                <header>
                  <strong>
                    {patients.find((patient) => patient.id === reading.patientId)?.fullName ??
                      'Paciente no disponible'}
                  </strong>
                  <span>
                    {new Date(reading.measuredAt).toLocaleString('es-SV')} ·{' '}
                    {reading.source === 'clinical' ? 'Registro clínico' : 'Reportado por paciente'}
                  </span>
                </header>
                <div className="metric-chip-list">
                  {measuredVitalMetrics(reading).map((metric) => (
                    <span className="metric-chip" key={metric.key}>
                      {metric.label}:{' '}
                      <strong>
                        {metric.value} {metric.unit}
                      </strong>
                    </span>
                  ))}
                </div>
                {reading.note ? <p>{reading.note}</p> : null}
              </article>
            ))}
        </div>
      ) : (
        <EmptyState
          detail="Use el botón para registrar una medición individual."
          title="Sin mediciones"
        />
      )}
    </Panel>
  );
}

function ProfilesPanel() {
  return (
    <Panel>
      <h2>Perfiles clínicos</h2>
      <p>
        Esta vista sólo agrupa registros documentados. Cualquier cálculo, diagnóstico o
        recomendación automatizada permanece fuera del alcance hasta contar con reglas aprobadas por
        el cliente.
      </p>
    </Panel>
  );
}

function EmptyClinicalPanel({ title, detail }: { title: string; detail: string }) {
  return (
    <Panel>
      <EmptyState detail={detail} title={title} />
    </Panel>
  );
}

function AuditPanel({
  entries,
}: {
  entries: { id: string; at: string; action: string; subject: string }[];
}) {
  return (
    <Panel>
      <h2>Bitácora</h2>
      <ul className="audit-list">
        {entries.map((entry) => (
          <li key={entry.id}>
            <strong>{entry.action}</strong>
            <span>
              {entry.subject} · {new Date(entry.at).toLocaleString('es-SV')}
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
