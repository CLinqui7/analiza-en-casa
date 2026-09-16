'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { isDemoAuthMode, mongoMutationHeaders } from '@/lib/auth';
import { NurseSetupForm } from '@/components/nurse-setup-form';
import {
  emptyWorkspaceSetup,
  workspaceSetupSchema,
  type WorkspaceSetup,
  type StaffProfile,
  type ServiceProfile,
} from '@/lib/workspace-setup';
import './workspace-setup.css';

function Field({
  label,
  value,
  onChange,
  multiline = false,
  type = 'text',
  required = false,
  maxLength = 240,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  type?: string;
  required?: boolean;
  maxLength?: number;
}) {
  return (
    <label>
      {label}
      {required ? ' *' : ''}
      {multiline ? (
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          maxLength={maxLength}
          rows={3}
          required={required}
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          maxLength={maxLength}
          required={required}
        />
      )}
    </label>
  );
}

export function WorkspaceSetupForm() {
  return isDemoAuthMode() ? <NurseSetupForm /> : <OrganizationWorkspaceSetupForm />;
}

function OrganizationWorkspaceSetupForm() {
  const [data, setData] = useState<WorkspaceSetup>(emptyWorkspaceSetup);
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const steps = ['Organización', 'Personal', 'Servicios'];

  useEffect(() => {
    const controller = new AbortController();
    void fetch('/api/onboarding', {
      credentials: 'same-origin',
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok)
          throw new Error('No pudimos cargar tu cuestionario. Intenta recargar la página.');
        const payload = (await response.json()) as WorkspaceSetup;
        if (controller.signal.aborted) return;
        setData(payload);
        setLoaded(true);
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted)
          setError(cause instanceof Error ? cause.message : 'No pudimos cargar tus datos.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  function change(update: (current: WorkspaceSetup) => WorkspaceSetup) {
    setData(update);
    setDirty(true);
    setNotice(null);
    setError(null);
  }
  function staffChange(index: number, patch: Partial<StaffProfile>) {
    change((current) => ({
      ...current,
      staff: current.staff.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    }));
  }
  function serviceChange(index: number, patch: Partial<ServiceProfile>) {
    change((current) => ({
      ...current,
      services: current.services.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    }));
  }
  async function save(nextStep?: number) {
    setError(null);
    setNotice(null);
    const parsed = workspaceSetupSchema.safeParse(data);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const section = issue.path[0] === 'staff' ? 1 : issue.path[0] === 'services' ? 2 : 0;
      setStep(section);
      setError(
        section === 0
          ? 'Escribe el nombre de tu organización y revisa el correo de contacto.'
          : section === 1
            ? 'Cada persona necesita nombre y función. Revisa los correos y los campos del personal.'
            : 'Cada servicio necesita un nombre. Si indicas una tarifa, incluye su moneda de tres letras.',
      );
      return;
    }
    setSaving(true);
    try {
      const response = await fetch('/api/onboarding', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', ...mongoMutationHeaders() },
        body: JSON.stringify(parsed.data),
      });
      const result = (await response.json()) as WorkspaceSetup & { error?: string };
      if (!response.ok) throw new Error(result.error ?? 'No se pudieron guardar los datos.');
      setData(result);
      setDirty(false);
      setNotice('Tus datos quedaron guardados en tu espacio.');
      if (nextStep !== undefined) setStep(nextStep);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudieron guardar los datos.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="setup-page">
      <header className="setup-heading">
        <p className="eyebrow">Tu espacio de trabajo</p>
        <h1>Cuéntanos cómo trabajan</h1>
        <p>
          Completa la información de tu organización, el personal y los servicios. Puedes volver
          aquí para actualizarla.
        </p>
        <p className="field-help">
          Los campos con * son obligatorios. Durante esta prueba usa datos ficticios en las fichas
          de personal y pacientes.
        </p>
      </header>
      <nav aria-label="Secciones del cuestionario" className="setup-steps">
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
      {loading ? <p role="status">Cargando tu espacio…</p> : null}
      {error ? (
        <p className="notice setup-error" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="notice" role="status">
          {notice}
        </p>
      ) : null}
      {!loading && !loaded ? (
        <button className="button" onClick={() => window.location.reload()}>
          Volver a intentar
        </button>
      ) : null}
      <fieldset className="setup-fields" disabled={!loaded || saving} aria-busy={saving}>
        {step === 0 ? (
          <section className="setup-panel">
            <h2>¿Cómo se llama tu organización?</h2>
            <div className="setup-grid">
              {(
                [
                  ['name', 'Nombre de la organización', true],
                  ['contactName', 'Persona de contacto', false],
                  ['email', 'Correo de contacto', false],
                  ['phone', 'Teléfono de contacto', false],
                  ['city', 'Ciudad', false],
                  ['country', 'País', false],
                ] as const
              ).map(([key, label, required]) => (
                <Field
                  key={key}
                  label={label}
                  required={required}
                  type={key === 'email' ? 'email' : key === 'phone' ? 'tel' : 'text'}
                  maxLength={key === 'phone' ? 40 : key === 'email' ? 254 : 240}
                  value={data.organization[key]}
                  onChange={(value) =>
                    change((current) => ({
                      ...current,
                      organization: { ...current.organization, [key]: value },
                    }))
                  }
                />
              ))}
              <Field
                label="Dirección"
                multiline
                maxLength={500}
                value={data.organization.address}
                onChange={(address) =>
                  change((current) => ({
                    ...current,
                    organization: { ...current.organization, address },
                  }))
                }
              />
              <Field
                label="¿Qué zonas atienden?"
                multiline
                maxLength={1000}
                value={data.organization.coverage}
                onChange={(coverage) =>
                  change((current) => ({
                    ...current,
                    organization: { ...current.organization, coverage },
                  }))
                }
              />
            </div>
          </section>
        ) : null}
        {step === 1 ? (
          <section className="setup-panel">
            <h2>¿Quiénes forman parte de tu equipo?</h2>
            <p>
              Registra el directorio de personal. Estas fichas no crean cuentas ni comparten acceso
              a tu espacio.
            </p>
            {!data.staff.length ? (
              <p className="setup-empty">
                Todavía no agregaste personal. Puedes comenzar con una persona o completar esta
                sección después.
              </p>
            ) : null}
            {data.staff.map((person, index) => (
              <article className="setup-entry" key={person.id} aria-label={`Persona ${index + 1}`}>
                <h3>Persona {index + 1}</h3>
                <div className="setup-grid">
                  {(
                    [
                      ['name', 'Nombre completo', true],
                      ['position', 'Función o cargo', true],
                      ['specialty', 'Especialidad, si aplica', false],
                      ['registrationNumber', 'Registro profesional, si aplica', false],
                      ['email', 'Correo del personal', false],
                      ['phone', 'Teléfono del personal', false],
                    ] as const
                  ).map(([key, label, required]) => (
                    <Field
                      key={key}
                      label={label}
                      required={required}
                      value={person[key]}
                      type={key === 'email' ? 'email' : key === 'phone' ? 'tel' : 'text'}
                      maxLength={key === 'phone' ? 40 : key === 'email' ? 254 : 240}
                      onChange={(value) => staffChange(index, { [key]: value })}
                    />
                  ))}
                </div>
                <label className="setup-checkbox">
                  <input
                    type="checkbox"
                    checked={person.active}
                    onChange={(event) => staffChange(index, { active: event.target.checked })}
                  />
                  Personal activo
                </label>
              </article>
            ))}
            <button
              className="button button-secondary"
              type="button"
              disabled={data.staff.length >= 50}
              onClick={() =>
                change((current) => ({
                  ...current,
                  staff: [
                    ...current.staff,
                    {
                      id: crypto.randomUUID(),
                      name: '',
                      position: '',
                      specialty: '',
                      registrationNumber: '',
                      email: '',
                      phone: '',
                      active: true,
                    },
                  ],
                }))
              }
            >
              Agregar persona
            </button>
          </section>
        ) : null}
        {step === 2 ? (
          <section className="setup-panel">
            <h2>¿Qué servicios ofrecen?</h2>
            <p>
              Describe sus servicios. La duración y la tarifa son opcionales: completa únicamente lo
              que tengan definido.
            </p>
            {!data.services.length ? (
              <p className="setup-empty">
                Todavía no agregaste servicios. Puedes registrarlos ahora o volver después.
              </p>
            ) : null}
            {data.services.map((service, index) => (
              <article
                className="setup-entry"
                key={service.id}
                aria-label={`Servicio ${index + 1}`}
              >
                <h3>Servicio {index + 1}</h3>
                <div className="setup-grid">
                  <Field
                    label="Nombre del servicio"
                    required
                    value={service.name}
                    onChange={(name) => serviceChange(index, { name })}
                  />
                  <label>
                    Modalidad
                    <select
                      value={service.modality}
                      onChange={(event) =>
                        serviceChange(index, {
                          modality: event.target.value as ServiceProfile['modality'],
                        })
                      }
                    >
                      <option value="HOME">A domicilio</option>
                      <option value="ONSITE">En instalaciones</option>
                      <option value="REMOTE">A distancia</option>
                      <option value="OTHER">Otra / por definir</option>
                    </select>
                  </label>
                  <Field
                    label="Descripción del servicio"
                    multiline
                    maxLength={2000}
                    value={service.description}
                    onChange={(description) => serviceChange(index, { description })}
                  />
                  <label>
                    Duración en minutos, si está definida
                    <input
                      type="number"
                      min={1}
                      max={100000}
                      step={1}
                      value={service.durationMinutes ?? ''}
                      onChange={(event) =>
                        serviceChange(index, {
                          durationMinutes:
                            event.target.value === '' ? undefined : Number(event.target.value),
                        })
                      }
                    />
                  </label>
                  <label>
                    Tarifa, si está definida
                    <input
                      type="number"
                      min={0}
                      max={100000000}
                      step="0.01"
                      value={service.price ?? ''}
                      onChange={(event) =>
                        serviceChange(index, {
                          price: event.target.value === '' ? undefined : Number(event.target.value),
                        })
                      }
                    />
                  </label>
                  <Field
                    label="Moneda de tres letras, si indicas tarifa"
                    maxLength={3}
                    value={service.currency}
                    onChange={(currency) =>
                      serviceChange(index, { currency: currency.toUpperCase() })
                    }
                  />
                </div>
                <label className="setup-checkbox">
                  <input
                    type="checkbox"
                    checked={service.active}
                    onChange={(event) => serviceChange(index, { active: event.target.checked })}
                  />
                  Servicio activo
                </label>
              </article>
            ))}
            <button
              className="button button-secondary"
              type="button"
              disabled={data.services.length >= 50}
              onClick={() =>
                change((current) => ({
                  ...current,
                  services: [
                    ...current.services,
                    {
                      id: crypto.randomUUID(),
                      name: '',
                      description: '',
                      modality: 'OTHER',
                      currency: '',
                      active: true,
                    },
                  ],
                }))
              }
            >
              Agregar servicio
            </button>
          </section>
        ) : null}
        <div className="setup-actions">
          {step > 0 ? (
            <button
              type="button"
              className="button button-secondary"
              onClick={() => setStep(step - 1)}
            >
              Anterior
            </button>
          ) : null}
          <button type="button" className="button button-secondary" onClick={() => void save()}>
            {saving ? 'Guardando…' : 'Guardar avances'}
          </button>
          {step < 2 ? (
            <button type="button" className="button" onClick={() => void save(step + 1)}>
              Guardar y continuar
            </button>
          ) : (
            <button type="button" className="button" onClick={() => void save()}>
              Guardar cuestionario
            </button>
          )}
          <span className="field-help">
            {dirty
              ? 'Tienes cambios sin guardar.'
              : data.expectedVersion > 0
                ? 'Datos guardados.'
                : 'Tu espacio está listo para completar.'}
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
