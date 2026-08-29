'use client';

import { Button, EmptyState, Panel, StatusTag } from '@analiza/ui';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAuth, useWorkspace } from '@/components/providers';

const labels = { ACTIVE: 'Activo', PENDING_CLOSE: 'Pendiente de cierre', CLOSED: 'Cerrado' } as const;

export default function HospitalizationDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { clinicalDocuments, hospitalizations, loading, patients, quotes, vitalReadings } = useWorkspace();
  const { can } = useAuth();
  const hospitalization = hospitalizations.find((item) => item.id === params.id);
  if (loading) return <main className="page-stack"><p role="status">Cargando hospitalización…</p></main>;
  if (!hospitalization) return <main className="page-stack"><EmptyState detail="El registro no existe o ya no está disponible en este espacio de trabajo." title="Hospitalización no encontrada" /><Link data-action-id="HOSPITALIZATION-BACK-TO-LIST" href="/hospitalizations">Volver al listado</Link></main>;
  const patient = patients.find((item) => item.id === hospitalization.patientId);
  const linkedQuotes = quotes.filter((item) => item.caseId === hospitalization.id);
  const linkedDocuments = clinicalDocuments.filter((item) => item.caseId === hospitalization.id);
  const linkedVitals = vitalReadings.filter((item) => item.caseId === hospitalization.id);
  const tone = hospitalization.status === 'ACTIVE' ? 'success' : hospitalization.status === 'PENDING_CLOSE' ? 'warning' : 'neutral';
  return <div className="page-stack">
    <header className="page-header page-header-actions"><div><p className="eyebrow">Hospitalización</p><h1>{hospitalization.id}</h1><p>{patient?.fullName ?? 'Paciente no disponible'} · {hospitalization.accountType} · {hospitalization.startDate}</p></div><div><Button className="button-secondary" data-action-id="HOSPITALIZATION-BACK-TO-LIST" onClick={() => router.push('/hospitalizations')} type="button">Volver al listado</Button>{can('cases:write') ? <Button data-action-id="HOSPITALIZATION-DETAIL-EDIT" onClick={() => router.push(`/hospitalizations?edit=${encodeURIComponent(hospitalization.id)}`)} type="button">Editar hospitalización</Button> : null}</div></header>
    <Panel><div className="table-heading"><h2>Resumen operativo</h2><StatusTag tone={tone}>{labels[hospitalization.status]}</StatusTag></div><dl className="detail-list"><div><dt>Paciente</dt><dd>{patient?.fullName ?? 'No disponible'}</dd></div><div><dt>Documento</dt><dd>{patient?.documentId ?? 'No disponible'}</dd></div><div><dt>Fecha de ingreso</dt><dd>{hospitalization.startDate}</dd></div><div><dt>Fecha de finalización</dt><dd>{hospitalization.endDate ?? 'Actual'}</dd></div><div><dt>Tipo de cuenta</dt><dd>{hospitalization.accountType}</dd></div><div><dt>Aseguradora registrada</dt><dd>{hospitalization.insurer ?? patient?.insurer ?? 'Sin aseguradora registrada'}</dd></div><div><dt>Prioridad</dt><dd>{hospitalization.priority === 'LOW' ? 'Baja' : hospitalization.priority === 'HIGH' ? 'Alta' : 'Media'}</dd></div><div><dt>Responsable administrativo</dt><dd>{hospitalization.manager ?? 'No asignado'}</dd></div><div className="full"><dt>Próxima acción</dt><dd>{hospitalization.nextAction ?? 'Sin acción documentada'}</dd></div><div className="full"><dt>Resumen diagnóstico</dt><dd>{hospitalization.diagnosisSummary ?? 'Sin resumen documentado'}</dd></div><div className="full"><dt>Dispositivos / accesos</dt><dd>{hospitalization.devices?.length ? hospitalization.devices.join(', ') : 'Ninguno documentado'}</dd></div></dl></Panel>
    <div className="dashboard-grid"><Panel><h2>Cotización y seguro</h2>{linkedQuotes.length ? <ul>{linkedQuotes.map((quote) => <li key={quote.id}><Link href={`/quotes/${quote.id}`}>{quote.id} · v{quote.version}</Link> · {quote.status === 'SENT' ? 'Enviada' : 'Borrador'}</li>)}</ul> : <EmptyState detail="No se ha creado una cotización para este caso." title="Sin cotización" />}</Panel><Panel><h2>Resumen clínico</h2><p>{linkedDocuments.length} documentos clínicos · {linkedVitals.length} registros de signos vitales</p></Panel></div>
  </div>;
}
