'use client';

import { searchPatients } from '@analiza/domain';
import { EmptyState, Panel, StatusTag } from '@analiza/ui';
import { useState } from 'react';
import { useWorkspace } from '@/components/providers';

export default function InsurancePage() {
  const { patients } = useWorkspace();
  const [query, setQuery] = useState('');
  const visible = searchPatients(patients.filter((patient) => patient.insurer), query);
  return <div className="page-stack"><header className="page-header"><div><p className="eyebrow">Seguros</p><h1>Seguros y coberturas</h1><p>Consulta de referencias sintéticas. No calcula cobertura, tarifas ni autorizaciones sin reglas aprobadas.</p></div><StatusTag tone="warning">Reglas del cliente pendientes</StatusTag></header><Panel><label className="search-label" htmlFor="insurance-search">Buscar por paciente</label><input data-action-id="INSURANCE-SEARCH" id="insurance-search" onChange={(event) => setQuery(event.target.value)} placeholder="Nombre, documento o teléfono" type="search" value={query} /></Panel><Panel><div className="table-heading"><h2>Referencias de seguro</h2><StatusTag>{visible.length} resultados</StatusTag></div>{visible.length ? <div className="table-wrap"><table><thead><tr><th>Paciente</th><th>Documento</th><th>Teléfono</th><th>Aseguradora</th><th>Estado</th></tr></thead><tbody>{visible.map((patient) => <tr key={patient.id}><td>{patient.fullName}</td><td>{patient.documentId}</td><td>{patient.phone ?? 'Sin dato'}</td><td>{patient.insurer}</td><td>Referencia sin preautorización automatizada</td></tr>)}</tbody></table></div> : <EmptyState detail="Busque por nombre, documento o teléfono." title="Sin resultados" />}</Panel><section className="two-column"><Panel><h2>Guardas financieras</h2><p>Las versiones enviadas son inmutables; pagos y trabajos externos requieren claves de idempotencia y transacciones autorizadas.</p></Panel><Panel><h2>Configuración pendiente</h2><p>Elegibilidad, cobertura y conciliación requieren reglas aprobadas por organización antes de automatizarse.</p></Panel></section></div>;
}
