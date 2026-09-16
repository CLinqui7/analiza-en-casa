'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth, useWorkspace } from '@/components/providers';
import {
  emptyNurseProfile,
  loadLocalNurseProfile,
  nurseProfileSchema,
  saveLocalNurseProfile,
  type NurseProfile,
  type NurseWorkDay,
} from '@/lib/nurse-profile';
import { useOperations } from '@/lib/use-operations';

const steps = ['Sobre ti', 'Pacientes y medicamentos', 'Horario'];
const workDays: ReadonlyArray<[NurseWorkDay, string]> = [
  ['MON', 'Lunes'],
  ['TUE', 'Martes'],
  ['WED', 'Miércoles'],
  ['THU', 'Jueves'],
  ['FRI', 'Viernes'],
  ['SAT', 'Sábado'],
  ['SUN', 'Domingo'],
];

function TextField({
  label,
  value,
  onChange,
  type = 'text',
  required = false,
  multiline = false,
  maxLength = 240,
  help,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  multiline?: boolean;
  maxLength?: number;
  help?: string;
}) {
  return (
    <label>
      {label}
      {required ? ' *' : ''}
      {multiline ? (
        <textarea
          rows={4}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          required={required}
          maxLength={maxLength}
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          required={required}
          maxLength={maxLength}
        />
      )}
      {help ? <small>{help}</small> : null}
    </label>
  );
}

export function NurseSetupForm() {
  const { session, loading: sessionLoading } = useAuth();
  const workspace = useWorkspace();
  const operations = useOperations();
  const sessionUserId = session?.userId;
  const [data, setData] = useState<NurseProfile>(emptyNurseProfile);
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const activePatients = workspace.patients.filter(
    (patient) => patient.status === 'ACTIVE' && !patient.retired,
  ).length;
  const medicationOptions = operations.configuration.filter(
    (entry) => entry.active && entry.category === 'MEDICATION' && entry.inventoryItemId,
  );

  useEffect(() => {
    if (sessionLoading) return;
    let active = true;
    void Promise.resolve().then(() => {
      try {
        if (!sessionUserId) throw new Error('Inicia sesión para cargar tu perfil.');
        if (!active) return;
        setData(loadLocalNurseProfile(window.localStorage, sessionUserId));
        setLoaded(true);
      } catch (cause) {
        if (active)
          setError(cause instanceof Error ? cause.message : 'No pudimos cargar tu perfil.');
      } finally {
        if (active) setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [sessionLoading, sessionUserId]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  function change(update: (current: NurseProfile) => NurseProfile) {
    setData(update);
    setDirty(true);
    setError(null);
    setNotice(null);
  }

  function toggleMedication(id: string) {
    change((current) => ({
      ...current,
      workload: {
        ...current.workload,
        knownMedicationIds: current.workload.knownMedicationIds.includes(id)
          ? current.workload.knownMedicationIds.filter((candidate) => candidate !== id)
          : [...current.workload.knownMedicationIds, id],
      },
    }));
  }

  function toggleDay(day: NurseWorkDay) {
    change((current) => ({
      ...current,
      schedule: {
        ...current.schedule,
        days: current.schedule.days.includes(day)
          ? current.schedule.days.filter((candidate) => candidate !== day)
          : [...current.schedule.days, day],
      },
    }));
  }

  function save(nextStep?: number) {
    setError(null);
    setNotice(null);
    const parsed = nurseProfileSchema.safeParse(data);
    if (!parsed.success) {
      const section = parsed.error.issues[0]?.path[0];
      const invalidStep = section === 'workload' ? 1 : section === 'schedule' ? 2 : 0;
      setStep(invalidStep);
      setError(
        invalidStep === 0
          ? 'Escribe tu nombre y describe tus funciones principales.'
          : invalidStep === 1
            ? 'Indica cuántos pacientes puedes atender.'
            : 'Selecciona al menos un día y revisa las horas de trabajo.',
      );
      return;
    }
    setSaving(true);
    try {
      if (!session) throw new Error('Inicia sesión para guardar tu perfil.');
      const saved = saveLocalNurseProfile(window.localStorage, session.userId, parsed.data);
      setData(saved);
      setDirty(false);
      setNotice('Perfil guardado en la base de datos demo de este navegador.');
      if (nextStep !== undefined) setStep(nextStep);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No pudimos guardar tu perfil.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="setup-page">
      <header className="setup-heading nurse-heading">
        <div>
          <p className="eyebrow">Perfil de enfermería</p>
          <h1>Cuéntanos sobre tu trabajo</h1>
          <p>
            Completa tu perfil, experiencia, capacidad de atención y horario para organizar mejor el
            trabajo de enfermería.
          </p>
        </div>
        <span className="database-badge">● Base demo conectada</span>
      </header>

      <div className="nurse-metrics" aria-label="Datos actuales del sistema">
        <article>
          <span>Pacientes activos</span>
          <strong>{workspace.loading ? '—' : activePatients}</strong>
          <small>Registrados actualmente</small>
        </article>
        <article>
          <span>Medicamentos</span>
          <strong>{medicationOptions.length}</strong>
          <small>Configurados en inventario</small>
        </article>
        <article>
          <span>Tu perfil</span>
          <strong>{data.expectedVersion > 0 ? 'Guardado' : 'Nuevo'}</strong>
          <small>Solo para esta cuenta demo</small>
        </article>
      </div>

      <p className="setup-callout">
        Usa datos ficticios durante la prueba. No escribas nombres de pacientes, diagnósticos, dosis
        ni otra información clínica real.
      </p>

      <nav aria-label="Secciones del perfil de enfermería" className="setup-steps">
        {steps.map((name, index) => (
          <button
            key={name}
            type="button"
            disabled={saving || !loaded}
            aria-current={step === index ? 'step' : undefined}
            onClick={() => setStep(index)}
          >
            <span>{index + 1}</span>
            {name}
          </button>
        ))}
      </nav>

      {loading ? <p role="status">Cargando tu perfil…</p> : null}
      {error ? (
        <p className="notice setup-error" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="notice success" role="status">
          {notice}
        </p>
      ) : null}

      <fieldset className="setup-fields" disabled={!loaded || saving} aria-busy={saving}>
        {step === 0 ? (
          <section className="setup-panel">
            <h2>¿Quién eres y qué haces?</h2>
            <p>Estos datos ayudan a identificar tu experiencia y tus responsabilidades.</p>
            <div className="setup-grid">
              <TextField
                label="Nombre completo"
                required
                value={data.profile.fullName}
                onChange={(fullName) =>
                  change((current) => ({
                    ...current,
                    profile: { ...current.profile, fullName },
                  }))
                }
              />
              <label>
                Puesto o función *
                <select
                  value={data.profile.role}
                  onChange={(event) =>
                    change((current) => ({
                      ...current,
                      profile: {
                        ...current.profile,
                        role: event.target.value as NurseProfile['profile']['role'],
                      },
                    }))
                  }
                >
                  <option value="GENERAL_NURSE">Enfermera general</option>
                  <option value="NURSING_ASSISTANT">Auxiliar de enfermería</option>
                  <option value="HEAD_NURSE">Jefa de enfermería</option>
                  <option value="CAREGIVER">Cuidadora</option>
                  <option value="OTHER">Otra función</option>
                </select>
              </label>
              <TextField
                label="Cédula o registro profesional"
                value={data.profile.professionalId}
                onChange={(professionalId) =>
                  change((current) => ({
                    ...current,
                    profile: { ...current.profile, professionalId },
                  }))
                }
                help="Opcional para esta demostración."
              />
              <label>
                Años de experiencia
                <input
                  type="number"
                  min={0}
                  max={70}
                  value={data.profile.yearsExperience}
                  onChange={(event) =>
                    change((current) => ({
                      ...current,
                      profile: {
                        ...current.profile,
                        yearsExperience: Number(event.target.value),
                      },
                    }))
                  }
                />
              </label>
              <TextField
                label="Correo"
                type="email"
                value={data.profile.email}
                onChange={(email) =>
                  change((current) => ({ ...current, profile: { ...current.profile, email } }))
                }
              />
              <TextField
                label="Teléfono"
                type="tel"
                value={data.profile.phone}
                onChange={(phone) =>
                  change((current) => ({ ...current, profile: { ...current.profile, phone } }))
                }
              />
              <div className="setup-full">
                <TextField
                  label="¿Qué haces en tu trabajo?"
                  required
                  multiline
                  maxLength={2000}
                  value={data.profile.mainFunctions}
                  onChange={(mainFunctions) =>
                    change((current) => ({
                      ...current,
                      profile: { ...current.profile, mainFunctions },
                    }))
                  }
                  help="Ejemplo: seguimiento domiciliario, toma de signos y coordinación de turnos."
                />
              </div>
            </div>
          </section>
        ) : null}

        {step === 1 ? (
          <section className="setup-panel">
            <h2>Pacientes y conocimientos</h2>
            <p>
              El sistema ya tiene <strong>{activePatients} pacientes activos</strong>. Indica tu
              capacidad y los recursos del inventario que conoces.
            </p>
            <div className="setup-grid">
              <label>
                ¿Cuántos pacientes puedes atender a la vez? *
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={data.workload.maxPatients}
                  onChange={(event) =>
                    change((current) => ({
                      ...current,
                      workload: { ...current.workload, maxPatients: Number(event.target.value) },
                    }))
                  }
                />
              </label>
              <TextField
                label="Tipos de cuidado que conoces"
                multiline
                maxLength={2000}
                value={data.workload.careExperience}
                onChange={(careExperience) =>
                  change((current) => ({
                    ...current,
                    workload: { ...current.workload, careExperience },
                  }))
                }
                help="Sin nombres ni información de pacientes."
              />
              <div className="setup-full medication-selector">
                <h3>Medicamentos del inventario que conoces</h3>
                {medicationOptions.length ? (
                  medicationOptions.map((medication) => (
                    <label className="setup-checkbox" key={medication.id}>
                      <input
                        type="checkbox"
                        checked={data.workload.knownMedicationIds.includes(medication.id)}
                        onChange={() => toggleMedication(medication.id)}
                      />
                      {medication.label}
                    </label>
                  ))
                ) : (
                  <p className="setup-empty">No hay medicamentos configurados todavía.</p>
                )}
                <p className="field-help">
                  Marcar un elemento solo registra familiaridad; no autoriza administración ni
                  reemplaza una validación clínica.
                </p>
              </div>
              <div className="setup-full">
                <TextField
                  label="Otros medicamentos o insumos que conoces"
                  multiline
                  maxLength={2000}
                  value={data.workload.otherMedications}
                  onChange={(otherMedications) =>
                    change((current) => ({
                      ...current,
                      workload: { ...current.workload, otherMedications },
                    }))
                  }
                  help="Escribe solo nombres, uno por línea. No incluyas dosis ni indicaciones."
                />
              </div>
            </div>
          </section>
        ) : null}

        {step === 2 ? (
          <section className="setup-panel">
            <h2>Horario y disponibilidad</h2>
            <p>Define los días y el horario habitual en que puedes trabajar.</p>
            <div className="setup-full">
              <h3>Días disponibles *</h3>
              <div className="day-selector">
                {workDays.map(([day, label]) => (
                  <label key={day} className={data.schedule.days.includes(day) ? 'selected' : ''}>
                    <input
                      type="checkbox"
                      checked={data.schedule.days.includes(day)}
                      onChange={() => toggleDay(day)}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>
            <div className="setup-grid schedule-grid">
              <label>
                Hora de entrada *
                <input
                  type="time"
                  value={data.schedule.startTime}
                  onChange={(event) =>
                    change((current) => ({
                      ...current,
                      schedule: { ...current.schedule, startTime: event.target.value },
                    }))
                  }
                />
              </label>
              <label>
                Hora de salida *
                <input
                  type="time"
                  value={data.schedule.endTime}
                  onChange={(event) =>
                    change((current) => ({
                      ...current,
                      schedule: { ...current.schedule, endTime: event.target.value },
                    }))
                  }
                />
              </label>
              <label>
                Horas por semana *
                <input
                  type="number"
                  min={1}
                  max={168}
                  step="0.5"
                  value={data.schedule.weeklyHours}
                  onChange={(event) =>
                    change((current) => ({
                      ...current,
                      schedule: { ...current.schedule, weeklyHours: Number(event.target.value) },
                    }))
                  }
                />
              </label>
              <label>
                Turno preferido
                <select
                  value={data.schedule.preferredShift}
                  onChange={(event) =>
                    change((current) => ({
                      ...current,
                      schedule: {
                        ...current.schedule,
                        preferredShift: event.target
                          .value as NurseProfile['schedule']['preferredShift'],
                      },
                    }))
                  }
                >
                  <option value="MORNING">Mañana</option>
                  <option value="AFTERNOON">Tarde</option>
                  <option value="NIGHT">Noche</option>
                  <option value="MIXED">Mixto</option>
                </select>
              </label>
              <div className="setup-full">
                <label className="setup-checkbox">
                  <input
                    type="checkbox"
                    checked={data.schedule.emergencyAvailability}
                    onChange={(event) =>
                      change((current) => ({
                        ...current,
                        schedule: {
                          ...current.schedule,
                          emergencyAvailability: event.target.checked,
                        },
                      }))
                    }
                  />
                  Disponible para cubrir emergencias o cambios de turno
                </label>
              </div>
              <div className="setup-full">
                <TextField
                  label="Notas de disponibilidad"
                  multiline
                  maxLength={1000}
                  value={data.schedule.notes}
                  onChange={(notes) =>
                    change((current) => ({
                      ...current,
                      schedule: { ...current.schedule, notes },
                    }))
                  }
                />
              </div>
            </div>
          </section>
        ) : null}

        <div className="setup-actions">
          {step > 0 ? (
            <button
              className="button button-secondary"
              type="button"
              onClick={() => setStep(step - 1)}
            >
              Anterior
            </button>
          ) : null}
          <button className="button button-secondary" type="button" onClick={() => save()}>
            {saving ? 'Guardando…' : 'Guardar avances'}
          </button>
          {step < steps.length - 1 ? (
            <button className="button" type="button" onClick={() => save(step + 1)}>
              Guardar y continuar
            </button>
          ) : (
            <button className="button" type="button" onClick={() => save()}>
              Guardar perfil
            </button>
          )}
          <span className="field-help">
            {dirty
              ? 'Tienes cambios sin guardar.'
              : data.expectedVersion > 0
                ? 'Perfil guardado.'
                : 'Completa tu perfil para comenzar.'}
          </span>
        </div>
      </fieldset>

      {loaded && !dirty ? (
        <p>
          <Link href="/dashboard">Ir al dashboard</Link>
        </p>
      ) : null}
    </section>
  );
}
