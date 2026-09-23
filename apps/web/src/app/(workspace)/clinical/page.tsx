'use client';

import Link from 'next/link';
import { useWorkspace } from '@/components/providers';

const primaryModules = [
  {
    href: '/clinical/hospitalizations',
    icon: '✚',
    eyebrow: 'Casos activos',
    label: 'Hospitalizaciones clínicas',
    description: 'Consulta cada hospitalización, abre el expediente y coordina la atención.',
    action: 'Ver hospitalizaciones',
  },
  {
    href: '/clinical/reports',
    icon: '⌁',
    eyebrow: 'Seguimiento',
    label: 'Reporte de salud',
    description: 'Revisa signos vitales, secciones clínicas y documentos del paciente.',
    action: 'Abrir reportes',
  },
  {
    href: '/clinical/orders',
    icon: '✓',
    eyebrow: 'Coordinación',
    label: 'Órdenes y acciones',
    description: 'Organiza las acciones operativas y el seguimiento pendiente de cada caso.',
    action: 'Revisar acciones',
  },
];

const clinicalTools = [
  {
    href: '/clinical/medication-cards',
    icon: 'Rx',
    label: 'Tarjetas de medicamentos',
    description: 'Consulta el registro organizado de medicamentos por paciente.',
  },
  {
    href: '/clinical/administrations',
    icon: '◉',
    label: 'Administración de medicamentos',
    description: 'Da seguimiento a las administraciones documentadas por el equipo.',
  },
  {
    href: '/clinical/care-plans',
    icon: '▤',
    label: 'Planes de cuidado',
    description: 'Crea borradores, consulta versiones y revisa documentos firmados.',
  },
  {
    href: '/clinical/evolutions',
    icon: '↗',
    label: 'Evoluciones',
    description: 'Registra y consulta el seguimiento clínico de cada paciente.',
  },
  {
    href: '/clinical/balance',
    icon: '≈',
    label: 'Balance hídrico',
    description: 'Visualiza ingresos, egresos y el balance documentado del paciente.',
  },
  {
    href: '/clinical/nursing',
    icon: 'N',
    label: 'Tablero de enfermería',
    description: 'Centraliza la operación diaria y las tareas del equipo de enfermería.',
  },
];

export default function ClinicalHomePage() {
  const { clinicalDocuments, hospitalizations, vitalReadings } = useWorkspace();
  const signed = clinicalDocuments.filter((document) => document.status === 'SIGNED').length;
  const openHospitalizations = hospitalizations.filter((item) => !item.endDate).length;
  const pendingDocuments = Math.max(clinicalDocuments.length - signed, 0);
  const signedPercentage = clinicalDocuments.length
    ? Math.round((signed / clinicalDocuments.length) * 100)
    : 0;

  return (
    <div className="page-stack clinical-hub-page">
      <header className="clinical-hub-hero">
        <div className="clinical-hub-hero-copy">
          <div className="clinical-hub-mark" aria-hidden="true">
            ✚
          </div>
          <div>
            <p className="eyebrow">Centro clínico</p>
            <h1>Expediente clínico</h1>
            <p>
              Toda la atención del paciente en un solo lugar: hospitalizaciones, seguimiento,
              medicamentos, planes y evolución clínica.
            </p>
          </div>
        </div>
        <div className="clinical-hub-hero-actions">
          <Link className="clinical-hub-secondary-action" href="/clinical/reports">
            Consultar reportes
          </Link>
          <Link className="clinical-hub-primary-action" href="/clinical/hospitalizations">
            Abrir hospitalizaciones <span aria-hidden="true">→</span>
          </Link>
        </div>
      </header>

      <section className="clinical-hub-metrics" aria-label="Resumen del expediente clínico">
        <article className="clinical-hub-metric">
          <span className="clinical-hub-metric-icon" aria-hidden="true">
            ✚
          </span>
          <div>
            <span>Hospitalizaciones abiertas</span>
            <strong>{openHospitalizations}</strong>
            <small>Casos que continúan en atención</small>
          </div>
        </article>
        <article className="clinical-hub-metric">
          <span className="clinical-hub-metric-icon" aria-hidden="true">
            ▤
          </span>
          <div>
            <span>Documentos clínicos</span>
            <strong>{clinicalDocuments.length}</strong>
            <small>Versiones registradas</small>
          </div>
        </article>
        <article className="clinical-hub-metric">
          <span className="clinical-hub-metric-icon" aria-hidden="true">
            ✓
          </span>
          <div>
            <span>Documentos firmados</span>
            <strong>{signed}</strong>
            <small>Registros finalizados</small>
          </div>
        </article>
        <article className="clinical-hub-metric">
          <span className="clinical-hub-metric-icon" aria-hidden="true">
            ⌁
          </span>
          <div>
            <span>Signos vitales</span>
            <strong>{vitalReadings.length}</strong>
            <small>Lecturas documentadas</small>
          </div>
        </article>
      </section>

      <section className="clinical-hub-section" aria-labelledby="clinical-main-heading">
        <div className="clinical-hub-section-heading">
          <div>
            <p className="eyebrow">Accesos principales</p>
            <h2 id="clinical-main-heading">¿Qué necesitas hacer?</h2>
            <p>Entra directamente al módulo clínico que necesitas consultar o actualizar.</p>
          </div>
          <span className="clinical-hub-section-count">3 accesos prioritarios</span>
        </div>
        <div className="clinical-hub-primary-grid">
          {primaryModules.map((module, index) => (
            <Link
              className={`clinical-hub-primary-card ${index === 0 ? 'is-featured' : ''}`}
              href={module.href}
              key={module.href}
            >
              <div className="clinical-hub-card-topline">
                <span className="clinical-hub-card-icon" aria-hidden="true">
                  {module.icon}
                </span>
                <span className="clinical-hub-card-eyebrow">{module.eyebrow}</span>
              </div>
              <div>
                <h3>{module.label}</h3>
                <p>{module.description}</p>
              </div>
              <span className="clinical-hub-card-action">
                {module.action} <span aria-hidden="true">→</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      <div className="clinical-hub-lower-grid">
        <section className="clinical-hub-section" aria-labelledby="clinical-tools-heading">
          <div className="clinical-hub-section-heading clinical-hub-section-heading-compact">
            <div>
              <p className="eyebrow">Herramientas clínicas</p>
              <h2 id="clinical-tools-heading">Más funciones del expediente</h2>
            </div>
          </div>
          <div className="clinical-hub-tools-grid">
            {clinicalTools.map((tool) => (
              <Link className="clinical-hub-tool-card" href={tool.href} key={tool.href}>
                <span className="clinical-hub-tool-icon" aria-hidden="true">
                  {tool.icon}
                </span>
                <div>
                  <h3>{tool.label}</h3>
                  <p>{tool.description}</p>
                </div>
                <span className="clinical-hub-tool-arrow" aria-hidden="true">
                  →
                </span>
              </Link>
            ))}
          </div>
        </section>

        <aside className="clinical-hub-status" aria-labelledby="clinical-status-heading">
          <div className="clinical-hub-status-header">
            <span className="clinical-hub-status-icon" aria-hidden="true">
              ✓
            </span>
            <div>
              <p className="eyebrow">Estado documental</p>
              <h2 id="clinical-status-heading">Avance del expediente</h2>
            </div>
          </div>
          <div className="clinical-hub-progress-copy">
            <strong>{signedPercentage}%</strong>
            <span>de documentos firmados</span>
          </div>
          <div
            aria-label={`${signedPercentage}% de documentos firmados`}
            aria-valuemax={100}
            aria-valuemin={0}
            aria-valuenow={signedPercentage}
            className="clinical-hub-progress"
            role="progressbar"
          >
            <span style={{ width: `${signedPercentage}%` }} />
          </div>
          <dl className="clinical-hub-status-list">
            <div>
              <dt>Firmados</dt>
              <dd>{signed}</dd>
            </div>
            <div>
              <dt>Pendientes</dt>
              <dd>{pendingDocuments}</dd>
            </div>
            <div>
              <dt>Total</dt>
              <dd>{clinicalDocuments.length}</dd>
            </div>
          </dl>
          <p className="clinical-hub-status-note">
            El resumen se actualiza con la información registrada en la base de datos.
          </p>
          <Link className="clinical-hub-status-link" href="/clinical/evolutions">
            Revisar evoluciones <span aria-hidden="true">→</span>
          </Link>
        </aside>
      </div>
    </div>
  );
}
