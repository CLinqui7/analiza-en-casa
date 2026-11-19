import Link from 'next/link';
import { Panel } from '@analiza/ui';

const availableReports = [
  {
    title: 'Inventario',
    href: '/inventory/kardex',
    detail: 'Existencias y movimientos registrados.',
  },
  { title: 'Ventas', href: '/sales', detail: 'Ventas confirmadas en la organización.' },
] as const;

export default function OtherReportsPage() {
  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">Reportes</p>
          <h1>Otros reportes</h1>
          <p>Consulte las fuentes disponibles para inventario y ventas.</p>
        </div>
      </header>
      <Panel>
        <h2>Reportes disponibles</h2>
        <div className="action-row">
          {availableReports.map((report) => (
            <Link className="action-link-button" href={report.href} key={report.title}>
              {report.title}: {report.detail}
            </Link>
          ))}
        </div>
      </Panel>
      <Panel>
        <h2>Costos, gastos y márgenes</h2>
        <p>
          Pendientes de las fuentes de costos y gastos y de las reglas de cálculo aprobadas. No se
          presentan cifras ni márgenes estimados.
        </p>
      </Panel>
    </div>
  );
}
