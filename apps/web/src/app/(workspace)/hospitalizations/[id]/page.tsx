'use client';
import { isServerDataMode } from '@/lib/data-mode';

import { Button, Dialog, EmptyState, Panel, StatusTag } from '@analiza/ui';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { useAuth, useWorkspace } from '@/components/providers';
import { AdministrativeProfilePanel } from '@/components/administrative-profile-panel';
import { isCoreRelease } from '@/lib/release-profile';

const labels = {
  ACTIVE: 'Activo',
  PENDING_CLOSE: 'Pendiente de cierre',
  CLOSED: 'Cerrado',
} as const;

export default function HospitalizationDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const {
    clinicalDocuments,
    catalogItems,
    doctors,
    hospitalizations,
    loading,
    patients,
    providerMode,
    quotes,
    updateHospitalization,
    vitalReadings,
  } = useWorkspace();
  const { can } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const hospitalization = hospitalizations.find((item) => item.id === params.id);

  if (loading)
    return (
      <main className="page-stack">
        <p role="status">Cargando hospitalización…</p>
      </main>
    );
  if (!hospitalization)
    return (
      <main className="page-stack">
        <EmptyState
          detail="El registro no existe o ya no está disponible en este espacio de trabajo."
          title="Hospitalización no encontrada"
        />
        <Link data-action-id="HOSPITALIZATION-BACK-TO-LIST" href="/hospitalizations">
          Volver al listado
        </Link>
      </main>
    );

  const patient = patients.find((item) => item.id === hospitalization.patientId);
  const patientInitials = (patient?.fullName ?? 'Paciente')
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toLocaleUpperCase('es');
  const linkedQuotes = quotes.filter((item) => item.caseId === hospitalization.id);
  const linkedDocuments = clinicalDocuments.filter((item) => item.caseId === hospitalization.id);
  const linkedVitals = vitalReadings.filter((item) => item.caseId === hospitalization.id);
  const primaryDoctor = doctors.find((item) => item.id === hospitalization.primaryDoctorId);
  const secondaryDoctor = doctors.find((item) => item.id === hospitalization.secondaryDoctorId);
  const tone =
    hospitalization.status === 'ACTIVE'
      ? 'success'
      : hospitalization.status === 'PENDING_CLOSE'
        ? 'warning'
        : 'neutral';
  const profile = hospitalization.administrativeProfile;
  const insurerOptions = catalogItems.filter(
    (item) => item.category === 'INSURERS' && item.status === 'ACTIVE',
  );
  const profileEditingEnabled = providerMode === 'mock' || isServerDataMode(providerMode);
  const closeProfile = () => setProfileOpen(false);
  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profileEditingEnabled) return;
    const values = new FormData(event.currentTarget);
    const value = (name: string) => String(values.get(name) ?? '').trim() || undefined;
    setProfileSaving(true);
    const saved = await updateHospitalization({
      ...hospitalization,
      administrativeProfile: {
        healthManager: value('healthManager'),
        referredBy: value('referredBy'),
        type: value('type'),
        startDate: value('startDate'),
        durationDays: value('durationDays'),
        paymentMethod: value('paymentMethod'),
        insurer: value('insurer'),
        originatingHospital: value('originatingHospital'),
        patientClass: value('patientClass'),
      },
    });
    setProfileSaving(false);
    if (saved) {
      setProfileMessage('Perfil de ejecución de cotización guardado.');
      closeProfile();
    }
  };

  return (
    <div className="page-stack hospitalization-detail-page">
      <header className="page-header page-header-actions">
        <div>
          <p className="eyebrow">Hospitalización</p>
          <h1>{hospitalization.id}</h1>
          <p>
            {patient?.fullName ?? 'Paciente no disponible'} · {hospitalization.accountType} ·{' '}
            {hospitalization.startDate}
          </p>
        </div>
        <div className="action-row">
          <Button
            className="button-secondary"
            data-action-id="HOSPITALIZATION-BACK-TO-LIST"
            onClick={() => router.push('/hospitalizations')}
            type="button"
          >
            Volver al listado
          </Button>
          {can('cases:write') ? (
            <Button
              data-action-id="HOSPITALIZATION-DETAIL-EDIT"
              onClick={() =>
                router.push(`/hospitalizations?edit=${encodeURIComponent(hospitalization.id)}`)
              }
              type="button"
            >
              Editar hospitalización
            </Button>
          ) : null}
        </div>
      </header>
      <Panel className="hospitalization-summary-panel">
        <div className="hospitalization-summary-layout">
          <section>
            <div className="hospitalization-profile-hero">
              <span className="hospitalization-avatar" aria-hidden="true">
                {patientInitials}
              </span>
              <div>
                <p className="eyebrow">Resumen operativo</p>
                <h2>{patient?.fullName ?? 'Paciente no disponible'}</h2>
                <p>{hospitalization.diagnosisSummary ?? 'Sin resumen diagnóstico documentado.'}</p>
                <div className="hospitalization-status-row">
                  <StatusTag tone={tone}>{labels[hospitalization.status]}</StatusTag>
                  <StatusTag>
                    Prioridad{' '}
                    {hospitalization.priority === 'LOW'
                      ? 'Baja'
                      : hospitalization.priority === 'HIGH'
                        ? 'Alta'
                        : 'Media'}
                  </StatusTag>
                </div>
              </div>
            </div>
            <dl className="hospitalization-detail-grid">
              <div>
                <dt>Documento</dt>
                <dd>{patient?.documentId ?? 'No disponible'}</dd>
              </div>
              <div>
                <dt>Ingreso</dt>
                <dd>{hospitalization.startDate}</dd>
              </div>
              <div>
                <dt>Finalización</dt>
                <dd>{hospitalization.endDate ?? 'En curso'}</dd>
              </div>
              <div>
                <dt>Cuenta</dt>
                <dd>{hospitalization.accountType}</dd>
              </div>
              <div>
                <dt>Aseguradora</dt>
                <dd>{hospitalization.insurer ?? patient?.insurer ?? 'Sin aseguradora'}</dd>
              </div>
              <div>
                <dt>Responsable</dt>
                <dd>{hospitalization.manager ?? 'No asignado'}</dd>
              </div>
              <div>
                <dt>Médico tratante principal</dt>
                <dd>{primaryDoctor?.fullName ?? 'No asignado'}</dd>
              </div>
              <div>
                <dt>Médico tratante secundario</dt>
                <dd>{secondaryDoctor?.fullName ?? 'No asignado'}</dd>
              </div>
              <div className="full">
                <dt>Dispositivos / accesos</dt>
                <dd>
                  {hospitalization.devices?.length
                    ? hospitalization.devices.join(', ')
                    : 'Ninguno documentado'}
                </dd>
              </div>
            </dl>
          </section>
          <aside className="hospitalization-next-action">
            <span className="hospitalization-next-action-icon" aria-hidden="true">
              ✓
            </span>
            <p className="eyebrow">Próxima acción</p>
            <h2>Seguimiento del caso</h2>
            <p>{hospitalization.nextAction ?? 'Sin acción documentada'}</p>
            {can('cases:write') ? (
              <Button
                className="button-secondary"
                onClick={() =>
                  router.push(`/hospitalizations?edit=${encodeURIComponent(hospitalization.id)}`)
                }
                type="button"
              >
                Editar caso
              </Button>
            ) : null}
          </aside>
        </div>
      </Panel>
      {!isCoreRelease && (
        <AdministrativeProfilePanel
          canWrite={can('cases:write')}
          hospitalization={hospitalization}
          onOpen={() => {
            setProfileMessage(null);
            setProfileOpen(true);
          }}
          providerMode={providerMode}
        />
      )}
      {profileMessage ? (
        <p className="notice success" role="status">
          {profileMessage}
        </p>
      ) : null}
      {!isCoreRelease && (
        <div className="dashboard-grid">
          <Panel>
            <h2>Cotización y seguro</h2>
            {linkedQuotes.length ? (
              <ul>
                {linkedQuotes.map((quote) => (
                  <li key={quote.id}>
                    <Link href={`/quotes/${quote.id}`}>
                      {quote.id} · v{quote.version}
                    </Link>{' '}
                    · {quote.status === 'SENT' ? 'Enviada' : 'Borrador'}
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                detail="No se ha creado una cotización para este caso."
                title="Sin cotización"
              />
            )}
          </Panel>
          <Panel>
            <h2>Resumen clínico</h2>
            <p>
              {linkedDocuments.length} documentos clínicos · {linkedVitals.length} registros de
              signos vitales
            </p>
          </Panel>
        </div>
      )}
      {!isCoreRelease && profileEditingEnabled ? (
        <Dialog
          description="Conserva campos administrativos observados. No aplica tarifas, cobertura, impuestos ni decisiones de aseguradora."
          footer={
            <>
              <Button
                className="button-secondary"
                data-action-id="HOSPITALIZATION-ADMIN-PROFILE-CANCEL"
                onClick={closeProfile}
                type="button"
              >
                Cancelar
              </Button>
              <Button
                data-action-id="HOSPITALIZATION-ADMIN-PROFILE-SAVE"
                disabled={profileSaving}
                form="administrative-profile-form"
                type="submit"
              >
                {profileSaving ? 'Guardando…' : 'Guardar'}
              </Button>
            </>
          }
          onClose={closeProfile}
          open={profileOpen}
          title={`Ejecución de cotización: ${hospitalization.id}`}
        >
          <form
            className="form-grid"
            id="administrative-profile-form"
            onSubmit={(event) => void saveProfile(event)}
          >
            <label>
              Visitador médico
              <input defaultValue={profile?.healthManager ?? ''} name="healthManager" />
            </label>
            <label>
              Referido por
              <select defaultValue={profile?.referredBy ?? ''} name="referredBy">
                <option value="">Sin médico referido</option>
                {doctors.map((doctor) => (
                  <option key={doctor.id} value={doctor.fullName}>
                    {doctor.fullName}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Tipo
              <input defaultValue={profile?.type ?? ''} name="type" />
            </label>
            <label>
              Fecha de inicio
              <input
                defaultValue={profile?.startDate ?? hospitalization.startDate}
                name="startDate"
                type="date"
              />
            </label>
            <label>
              Días de duración
              <input
                defaultValue={profile?.durationDays ?? ''}
                inputMode="numeric"
                min="0"
                name="durationDays"
                type="number"
              />
            </label>
            <label>
              Forma de pago
              <input defaultValue={profile?.paymentMethod ?? ''} name="paymentMethod" />
            </label>
            <label>
              Aseguradora
              <select
                defaultValue={profile?.insurer ?? hospitalization.insurer ?? ''}
                name="insurer"
              >
                <option value="">Particular / sin aseguradora</option>
                {insurerOptions.map((insurer) => (
                  <option key={insurer.id} value={insurer.name}>
                    {insurer.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Hospital de origen
              <input defaultValue={profile?.originatingHospital ?? ''} name="originatingHospital" />
            </label>
            <label>
              Clase de paciente
              <input defaultValue={profile?.patientClass ?? ''} name="patientClass" />
            </label>
          </form>
        </Dialog>
      ) : null}
    </div>
  );
}
