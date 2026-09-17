'use client';

import Link from 'next/link';
import { Panel, StatusTag } from '@analiza/ui';
import { useAuth } from '@/components/providers';
import { isReleasedPath } from '@/lib/release-profile';
import type { Permission } from '@/lib/permissions';
import './tutorial.css';

const firstSteps = [
  {
    number: '1',
    title: 'Inicia sesión',
    detail:
      'Cada persona entra con su propia cuenta. Así los registros quedan asociados a quien los realizó.',
  },
  {
    number: '2',
    title: 'Completa tu perfil',
    detail:
      'La primera vez debes registrar tus funciones, experiencia, capacidad, conocimientos y horario.',
  },
  {
    number: '3',
    title: 'Guarda cada sección',
    detail:
      'Usa Guardar y continuar. Puedes corregir la información antes de finalizar el cuestionario.',
  },
  {
    number: '4',
    title: 'Entra al dashboard',
    detail:
      'Al finalizar llegarás al dashboard. El botón Tutorial y ayuda siempre te permite volver a esta guía.',
  },
] as const;

const modules: ReadonlyArray<{
  icon: string;
  title: string;
  purpose: string;
  use: string;
  href: string;
  label: string;
  permission: Permission;
}> = [
  {
    icon: '▤',
    title: 'Mi perfil de enfermería',
    purpose: 'Guarda quién eres, tu función, experiencia, capacidad de atención y disponibilidad.',
    use: 'Complétalo al entrar por primera vez y actualízalo si cambia tu horario o experiencia.',
    href: '/onboarding',
    label: 'Revisar mi perfil',
    permission: 'dashboard:read',
  },
  {
    icon: '▦',
    title: 'Dashboard',
    purpose:
      'Muestra un resumen del trabajo: pacientes, hospitalizaciones, turnos y actividad disponible.',
    use: 'Úsalo como punto de inicio y para abrir rápidamente las tareas del día.',
    href: '/dashboard',
    label: 'Abrir dashboard',
    permission: 'dashboard:read',
  },
  {
    icon: '♙',
    title: 'Pacientes',
    purpose: 'Contiene el directorio y la ficha de cada paciente autorizado.',
    use: 'Busca una persona, revisa su información o crea un registro si tienes permiso.',
    href: '/patients',
    label: 'Abrir pacientes',
    permission: 'patients:read',
  },
  {
    icon: '⊞',
    title: 'Hospitalización',
    purpose: 'Organiza los casos activos, responsables, fechas y seguimiento administrativo.',
    use: 'Abre el caso correspondiente antes de registrar o consultar su evolución.',
    href: '/hospitalizations',
    label: 'Abrir hospitalizaciones',
    permission: 'cases:read',
  },
  {
    icon: '▣',
    title: 'Agenda',
    purpose: 'Reúne turnos, fechas, horarios y asignaciones del personal.',
    use: 'Consulta tu jornada y verifica paciente, hora y responsable antes de una visita.',
    href: '/agenda',
    label: 'Abrir agenda',
    permission: 'agenda:read',
  },
  {
    icon: '$',
    title: 'Cotizaciones',
    purpose: 'Permite preparar, revisar y enviar propuestas económicas vinculadas a un caso.',
    use: 'El personal autorizado crea un borrador, revisa conceptos y guarda la versión correcta.',
    href: '/quotes',
    label: 'Abrir cotizaciones',
    permission: 'quotes:read',
  },
  {
    icon: '✓',
    title: 'Financiero y seguros',
    purpose: 'Agrupa cuentas por cobrar y pagar, pagos, preautorizaciones y reclamos.',
    use: 'Consulta estados y registra movimientos únicamente con información confirmada.',
    href: '/insurance',
    label: 'Abrir seguros',
    permission: 'insurance:read',
  },
  {
    icon: '∿',
    title: 'Área clínica',
    purpose:
      'Incluye planes de cuidado, evoluciones, órdenes, reportes y administración de medicamentos.',
    use: 'Selecciona primero al paciente y registra sólo observaciones verificadas durante la atención.',
    href: '/clinical',
    label: 'Abrir área clínica',
    permission: 'clinical:read',
  },
  {
    icon: '◇',
    title: 'Inventario y compras',
    purpose: 'Controla productos, existencias, entradas, salidas, kárdex y compras a proveedores.',
    use: 'Registra cada movimiento con cantidad, referencia y motivo para conservar el historial.',
    href: '/inventory',
    label: 'Abrir inventario',
    permission: 'inventory:read',
  },
  {
    icon: '⌘',
    title: 'Catálogos',
    purpose: 'Centraliza medicamentos, servicios, especialidades, dosis y opciones operativas.',
    use: 'Administración mantiene estas listas para que el equipo seleccione valores consistentes.',
    href: '/catalogs/operational',
    label: 'Abrir catálogos',
    permission: 'catalogs:read',
  },
  {
    icon: '↥',
    title: 'Importar información',
    purpose:
      'Carga servicios, proveedores, seguros, productos, tarifas, compras y personal desde Excel.',
    use: 'Descarga la plantilla, complétala sin cambiar encabezados, revísala y confirma la importación.',
    href: '/import',
    label: 'Abrir importador',
    permission: 'settings:write',
  },
  {
    icon: '▥',
    title: 'Reportes y auditoría',
    purpose: 'Resume horas, visitas, metas y acciones registradas en el sistema.',
    use: 'Sirve para revisar actividad documentada; no sustituye una evaluación clínica.',
    href: '/reports/nurse-hours',
    label: 'Abrir reportes',
    permission: 'reports:read',
  },
  {
    icon: '!',
    title: 'Preguntas o errores',
    purpose: 'Envía una pregunta, error, cambio o mejora al administrador.',
    use: 'Elige el módulo, explica qué ocurrió y adjunta una captura si ayuda a entenderlo.',
    href: '/feedback',
    label: 'Enviar un reporte',
    permission: 'dashboard:read',
  },
  {
    icon: '◎',
    title: 'Datos de prueba',
    purpose:
      'Agrega ejemplos identificados para conocer el funcionamiento sin inventar pacientes reales.',
    use: 'Úsalos sólo para practicar. Las cuentas nuevas comienzan sin registros.',
    href: '/dashboard#datos-prueba',
    label: 'Volver al dashboard',
    permission: 'dashboard:read',
  },
];

export default function TutorialPage() {
  const { can } = useAuth();
  return (
    <div className="page-stack tutorial-page">
      <header className="page-header page-header-actions tutorial-hero">
        <div>
          <p className="eyebrow">Guía paso a paso</p>
          <h1>Tutorial de Analiza en Casa</h1>
          <p>
            Aprende qué hace cada sección, cuándo usarla y dónde encontrarla. Las funciones visibles
            dependen de los permisos de tu cuenta.
          </p>
        </div>
        <StatusTag tone="success">Base en línea</StatusTag>
      </header>

      <Panel className="tutorial-start">
        <div className="tutorial-section-heading">
          <div>
            <p className="eyebrow">Primera vez</p>
            <h2>Qué debes hacer cuando entras</h2>
          </div>
          <Link className="button" href="/onboarding">
            Completar o revisar mi perfil
          </Link>
        </div>
        <ol className="tutorial-step-grid">
          {firstSteps.map((step) => (
            <li key={step.number}>
              <span>{step.number}</span>
              <div>
                <strong>{step.title}</strong>
                <p>{step.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      </Panel>

      <section aria-labelledby="tutorial-modules-title" className="tutorial-modules">
        <div className="tutorial-section-heading">
          <div>
            <p className="eyebrow">Funciones del sistema</p>
            <h2 id="tutorial-modules-title">Para qué sirve cada apartado</h2>
          </div>
          <Link className="button button-secondary" href="/dashboard">
            Volver al dashboard
          </Link>
        </div>
        <div className="tutorial-module-grid">
          {modules.map((module) => {
            const available = can(module.permission) && isReleasedPath(module.href);
            return (
              <Panel className="tutorial-module-card" key={module.title}>
                <div className="tutorial-module-title">
                  <span aria-hidden="true">{module.icon}</span>
                  <h3>{module.title}</h3>
                </div>
                <div>
                  <strong>¿Para qué sirve?</strong>
                  <p>{module.purpose}</p>
                </div>
                <div>
                  <strong>¿Cómo se usa?</strong>
                  <p>{module.use}</p>
                </div>
                {available ? (
                  <Link className="text-link" href={module.href}>
                    {module.label} →
                  </Link>
                ) : (
                  <span className="tutorial-permission">
                    Disponible cuando tu cuenta tenga permiso.
                  </span>
                )}
              </Panel>
            );
          })}
        </div>
      </section>

      <Panel className="tutorial-safety">
        <div>
          <p className="eyebrow">Importante</p>
          <h2>Antes de guardar información</h2>
        </div>
        <ul>
          <li>Confirma que seleccionaste al paciente correcto.</li>
          <li>No compartas tu contraseña ni uses la cuenta de otra persona.</li>
          <li>Revisa nombres, fechas, cantidades y horarios antes de guardar.</li>
          <li>Si algo falla, usa Preguntas o errores y adjunta una captura.</li>
        </ul>
      </Panel>
    </div>
  );
}
