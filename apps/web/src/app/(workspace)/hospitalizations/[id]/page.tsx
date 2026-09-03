'use client';

import { Button, Dialog, EmptyState, Panel, StatusTag } from '@analiza/ui';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { useAuth, useWorkspace } from '@/components/providers';
import { AdministrativeProfilePanel } from '@/components/administrative-profile-panel';

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
  const linkedQuotes = quotes.filter((item) => item.caseId === hospitalization.id);
  const linkedDocuments = clinicalDocuments.filter((item) => item.caseId === hospitalization.id);
  const linkedVitals = vitalReadings.filter((item) => item.caseId === hospitalization.id);
  const tone =
    hospitalization.status === 'ACTIVE'
      ? 'success'
      : hospitalization.status === 'PENDING_CLOSE'
        ? 'warning'
        : 'neutral';
  const profile = hospitalization.administrativeProfile;
  const mockProfileEnabled = providerMode === 'mock';
  const closeProfile = () => setProfileOpen(false);
  const saveProfile = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!mockProfileEnabled) return;
    const values = new FormData(event.currentTarget);
    const value = (name: string) => String(values.get(name) ?? '').trim() || undefined;
    updateHospitalization({
      ...hospitalization,
      administrativeProfile: {
        healthManager: value('healthManager'),
        referredBy: value('referredBy'),
        revenueType: value('revenueType'),
        type: value('type'),
        startDate: value('startDate'),
        durationDays: value('durationDays'),
        paymentMethod: value('paymentMethod'),
        insurer: value('insurer'),
        requestType: value('requestType'),
        majorCategory: value('majorCategory'),
        subcategory: value('subcategory'),
        originatingHospital: value('originatingHospital'),
        patientClass: value('patientClass'),
      },
    });
    setProfileMessage('Perfil administrativo de ejecución guardado.');
    closeProfile();
  };

  return (
    <div className="page-stack">
      <header className="page-header page-header-actions">
        <div>
          <p className="eyebrow">Hospitalización</p>
          <h1>{hospitalization.id}</h1>
          <p>
            {patient?.fullName ?? 'Paciente no disponible'} · {hospitalization.accountType} ·{' '}
            {hospitalization.startDate}
          </p>
        </div>
        <div>
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
      <Panel>
        <div className="table-heading">
          <h2>Resumen operativo</h2>
          <StatusTag tone={tone}>{labels[hospitalization.status]}</StatusTag>
        </div>
        <dl className="detail-list">
          <div>
            <dt>Paciente</dt>
            <dd>{patient?.fullName ?? 'No disponible'}</dd>
          </div>
          <div>
            <dt>Documento</dt>
            <dd>{patient?.documentId ?? 'No disponible'}</dd>
          </div>
          <div>
            <dt>Fecha de ingreso</dt>
            <dd>{hospitalization.startDate}</dd>
          </div>
          <div>
            <dt>Fecha de finalización</dt>
            <dd>{hospitalization.endDate ?? 'Actual'}</dd>
          </div>
          <div>
            <dt>Tipo de cuenta</dt>
            <dd>{hospitalization.accountType}</dd>
          </div>
          <div>
            <dt>Aseguradora registrada</dt>
            <dd>{hospitalization.insurer ?? patient?.insurer ?? 'Sin aseguradora registrada'}</dd>
          </div>
          <div>
            <dt>Prioridad</dt>
            <dd>
              {hospitalization.priority === 'LOW'
                ? 'Baja'
                : hospitalization.priority === 'HIGH'
                  ? 'Alta'
                  : 'Media'}
            </dd>
          </div>
          <div>
            <dt>Responsable administrativo</dt>
            <dd>{hospitalization.manager ?? 'No asignado'}</dd>
          </div>
          <div className="full">
            <dt>Próxima acción</dt>
            <dd>{hospitalization.nextAction ?? 'Sin acción documentada'}</dd>
          </div>
          <div className="full">
            <dt>Resumen diagnóstico</dt>
            <dd>{hospitalization.diagnosisSummary ?? 'Sin resumen documentado'}</dd>
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
      </Panel>
      <AdministrativeProfilePanel
        canWrite={can('cases:write')}
        hospitalization={hospitalization}
        onOpen={() => {
          setProfileMessage(null);
          setProfileOpen(true);
        }}
        providerMode={providerMode}
      />
      {profileMessage ? (
        <p className="notice success" role="status">
          {profileMessage}
        </p>
      ) : null}
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
            {linkedDocuments.length} documentos clínicos · {linkedVitals.length} registros de signos
            vitales
          </p>
        </Panel>
      </div>
      {mockProfileEnabled ? (
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
                form="administrative-profile-form"
                type="submit"
              >
                Guardar
              </Button>
            </>
          }
          onClose={closeProfile}
          open={profileOpen}
          title={`Perfil administrativo de ejecución: ${hospitalization.id}`}
        >
          <form className="form-grid" id="administrative-profile-form" onSubmit={saveProfile}>
            <label>
              Health manager
              <input defaultValue={profile?.healthManager ?? ''} name="healthManager" />
            </label>
            <label>
              Referido por
              <input defaultValue={profile?.referredBy ?? ''} name="referredBy" />
            </label>
            <label>
              Tipo Revenue
              <input defaultValue={profile?.revenueType ?? ''} name="revenueType" />
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
              <input
                defaultValue={profile?.insurer ?? hospitalization.insurer ?? ''}
                name="insurer"
              />
            </label>
            <label>
              Tipo de solicitud
              <input defaultValue={profile?.requestType ?? ''} name="requestType" />
            </label>
            <label>
              Categoría mayor
              <input defaultValue={profile?.majorCategory ?? ''} name="majorCategory" />
            </label>
            <label>
              Subcategoría
              <input defaultValue={profile?.subcategory ?? ''} name="subcategory" />
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
