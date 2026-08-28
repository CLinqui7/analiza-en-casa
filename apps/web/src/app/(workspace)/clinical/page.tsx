'use client';

import Link from 'next/link';
import { Panel, StatusTag } from '@analiza/ui';
import { useWorkspace } from '@/components/providers';

const modules = [
  { href: '/clinical/hospitalizations', label: 'Hospitalizaciones clínicas', description: 'Consulta hospitalizaciones sintéticas disponibles para documentación.' },
  { href: '/clinical/reports', label: 'Reportes de salud', description: 'Registros individuales de signos vitales y trazabilidad sin umbrales inferidos.' },
  { href: '/clinical/orders', label: 'Órdenes y acciones', description: 'Acciones operativas que no prescriben ni divulgan contenido clínico.' },
  { href: '/clinical/medication-cards', label: 'Tarjetas de medicamentos', description: 'Superficie pendiente de contrato clínico y reglas de administración.' },
  { href: '/clinical/care-plans', label: 'Planes de cuidado', description: 'Borradores, firma e historial de correcciones preservando versiones.' },
  { href: '/clinical/evolutions', label: 'Evoluciones', description: 'Seguimiento sintético con firma explícita y corrección auditada.' },
];

export default function ClinicalHomePage() {
  const { clinicalDocuments, vitalReadings } = useWorkspace();
  const signed = clinicalDocuments.filter((document) => document.status === 'SIGNED').length;
  return <div className="page-stack"><header className="page-header"><div><p className="eyebrow">Clínico</p><h1>Expediente clínico</h1><p>Acceso por módulos a información sintética y controles auditables. Las reglas clínicas, tratamientos y retención continúan sujetas a aprobación.</p></div><StatusTag tone="warning">{signed} documentos firmados</StatusTag></header><div className="metrics-grid"><Panel><p className="eyebrow">Documentos</p><h2>{clinicalDocuments.length}</h2><p>Versiones persistentes.</p></Panel><Panel><p className="eyebrow">Signos vitales</p><h2>{vitalReadings.length}</h2><p>Sin clasificación automática.</p></Panel><Panel><p className="eyebrow">Firmas</p><h2>{signed}</h2><p>Inmutables tras firmar.</p></Panel></div><div className="module-grid">{modules.map((module) => <Link className="module-card" href={module.href} key={module.href}><div><h2>{module.label}</h2><p>{module.description}</p></div><span aria-hidden="true">›</span></Link>)}</div></div>;
}
