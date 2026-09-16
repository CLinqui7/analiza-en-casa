'use client';

import Link from 'next/link';
import { Panel, StatusTag } from '@analiza/ui';

const sections = [
  {
    title: '1. Completa tu perfil de enfermería',
    detail:
      'La primera vez registra tu nombre, función, experiencia, pacientes que puedes atender, medicamentos que conoces y horario. Esta información queda guardada en la base en línea para que administración pueda organizar el trabajo.',
    href: '/onboarding',
    label: 'Abrir mi perfil',
  },
  {
    title: '2. Dashboard',
    detail:
      'Resume pacientes, turnos, hospitalizaciones, cotizaciones y actividad reciente. Los números se actualizan con los registros guardados por el equipo.',
    href: '/dashboard',
    label: 'Abrir dashboard',
  },
  {
    title: '3. Pacientes y hospitalizaciones',
    detail:
      'Pacientes contiene el directorio y sus fichas. Hospitalizaciones reúne casos activos, responsables, diagnósticos administrativos y seguimiento.',
    href: '/patients',
    label: 'Abrir pacientes',
  },
  {
    title: '4. Agenda y turnos',
    detail:
      'Usa la agenda para consultar fechas, asignaciones y horarios. Cada turno guardado permanece disponible para el equipo autorizado.',
    href: '/agenda',
    label: 'Abrir agenda',
  },
  {
    title: '5. Cotizaciones y financiero',
    detail:
      'El administrador puede preparar cotizaciones y consultar pagos, cuentas por cobrar, cuentas por pagar y seguimiento de seguros.',
    href: '/quotes',
    label: 'Abrir cotizaciones',
  },
  {
    title: '6. Área clínica y medicamentos',
    detail:
      'Agrupa expediente clínico, planes de cuidado, evoluciones, órdenes, tarjetas y administración de medicamentos. Registra únicamente información verificada.',
    href: '/clinical',
    label: 'Abrir área clínica',
  },
  {
    title: '7. Preguntas, errores o mejoras',
    detail:
      'Selecciona la función relacionada, explica lo ocurrido y adjunta una captura. El administrador recibe el reporte junto con el nombre de quien lo envió.',
    href: '/feedback',
    label: 'Enviar un reporte',
  },
  {
    title: '8. Datos reales y datos de prueba',
    detail:
      'Las cuentas nuevas comienzan vacías. Usa Datos de prueba sólo para aprender; los registros de ejemplo se identifican claramente como demostración y nunca deben confundirse con pacientes reales.',
    href: '/dashboard#datos-prueba',
    label: 'Volver al dashboard',
  },
] as const;

export default function TutorialPage() {
  return (
    <div className="page-stack">
      <header className="page-header page-header-actions">
        <div>
          <p className="eyebrow">Guía rápida</p>
          <h1>Tutorial de Analiza en Casa</h1>
          <p>Recorre cada sección en orden o abre directamente la función que necesitas.</p>
        </div>
        <StatusTag tone="success">Base en línea</StatusTag>
      </header>
      <Panel>
        <h2>Antes de comenzar</h2>
        <p>
          Todo lo que guardes desde la versión conectada permanece en la base de datos aunque esta
          computadora esté apagada. No compartas contraseñas ni uses datos ficticios como si fueran
          expedientes reales.
        </p>
      </Panel>
      <section className="card-grid" aria-label="Pasos del tutorial">
        {sections.map((section) => (
          <Panel key={section.title}>
            <h2>{section.title}</h2>
            <p>{section.detail}</p>
            <Link className="button button-secondary" href={section.href}>
              {section.label}
            </Link>
          </Panel>
        ))}
      </section>
    </div>
  );
}
