'use client';

import Link from 'next/link';
import { EmptyState, Panel, StatusTag } from '@analiza/ui';
import { useState } from 'react';
import { searchPatients } from '@analiza/domain';
import { useWorkspace } from '@/components/providers';

export default function ClinicalHospitalizationsPage() {
  const { clinicalDocuments, hospitalizations, patients } = useWorkspace();
  const [query, setQuery] = useState('');
  const patientIds = new Set(searchPatients(patients, query).map((patient) => patient.id));
  const entries = hospitalizations.filter((hospitalization) => !query.trim() || patientIds.has(hospitalization.patientId) || hospitalization.id.toLocaleLowerCase('es').includes(query.trim().toLocaleLowerCase('es')));
  return <div className="page-stack"><header className="page-header"><div><p className="eyebrow">Clínico</p><h1>Hospitalizaciones clínicas</h1><p>Consulta de hospitalizaciones sintéticas; no infiere estado clínico, triage ni transiciones asistenciales.</p></div><StatusTag>{entries.length} registros</StatusTag></header><Panel><label className="search-label" htmlFor="clinical-case-search">Buscar hospitalización o paciente</label><input data-action-id="CLINICAL-HOSPITALIZATION-SEARCH" id="clinical-case-search" onChange={(event) => setQuery(event.target.value)} placeholder="Nombre, documento, teléfono u hospitalización" type="search" value={query} /></Panel><Panel>{entries.length ? <div className="table-wrap"><table><thead><tr><th>Hospitalización</th><th>Paciente</th><th>Inicio</th><th>Estado operativo</th><th>Documentos</th><th /></tr></thead><tbody>{entries.map((hospitalization) => { const documentCount = clinicalDocuments.filter((document) => document.caseId === hospitalization.id).length; return <tr key={hospitalization.id}><td><code>{hospitalization.id}</code></td><td>{patients.find((patient) => patient.id === hospitalization.patientId)?.fullName ?? 'No disponible'}</td><td>{hospitalization.startDate}</td><td>{hospitalization.status === 'ACTIVE' ? 'Activo' : 'Cerrado'}</td><td>{documentCount}</td><td><Link className="text-link" href="/clinical/evolutions">Ver evoluciones</Link></td></tr>; })}</tbody></table></div> : <EmptyState detail="Ajuste la búsqueda o cree una hospitalización operativa autorizada." title="Sin hospitalizaciones coincidentes" />}</Panel></div>;
}
