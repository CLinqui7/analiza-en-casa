'use client';
import { useState } from 'react';
import { Button, Dialog, Panel, StatusTag } from '@analiza/ui';
export type ChangeSummary = {
  id: string;
  source: string;
  module: string;
  status: string;
  detail: string;
  conflict: boolean;
  stages: Record<'implemented' | 'local' | 'preview' | 'integration' | 'definition', string>;
};
const label = (status: string) =>
  status === 'BLOCKED_INTEGRATION'
    ? 'Pendiente de integración'
    : status.includes('BLOCKED')
      ? 'Pendiente de definición'
      : status.includes('PARTIAL')
        ? 'Implementación parcial'
        : status.includes('DEMO')
          ? 'Probada en demo'
          : status.includes('MISSING')
            ? 'Pendiente'
            : status;

const technicalTone = (status: string, conflict: boolean) =>
  conflict || status.includes('BLOCKED')
    ? ('warning' as const)
    : status.includes('MISSING')
      ? ('danger' as const)
      : status.includes('DEMO')
        ? ('success' as const)
        : ('neutral' as const);

export function ClientChangesPage({ changes }: { changes: ChangeSummary[] }) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<ChangeSummary | null>(null);
  const rows = changes.filter((row) =>
    `${row.id} ${row.source} ${row.module}`.toLowerCase().includes(query.toLowerCase()),
  );
  const tested = changes.filter((row) => row.status.includes('DEMO')).length;
  const partial = changes.filter((row) => row.status.includes('PARTIAL')).length;
  const needsEvidence = changes.length - tested - partial;

  return (
    <div className="page-stack client-changes-page">
      <header className="page-header client-changes-hero">
        <div>
          <p className="eyebrow">Seguimiento del producto</p>
          <h1>Cambios solicitados</h1>
          <p>
            Cada solicitud fue revisada y clasificada. La entrega técnica conserva evidencia,
            bloqueos y decisiones pendientes sin convertirlos en cierres ficticios.
          </p>
        </div>
        <StatusTag tone="success">{changes.length} revisadas</StatusTag>
      </header>

      <section aria-label="Resumen de cambios" className="client-changes-summary">
        <article>
          <span>Revisión completada</span>
          <strong>{changes.length}</strong>
          <small>100% de solicitudes clasificadas</small>
        </article>
        <article>
          <span>Probadas</span>
          <strong>{tested}</strong>
          <small>Con evidencia funcional registrada</small>
        </article>
        <article>
          <span>En progreso</span>
          <strong>{partial}</strong>
          <small>Implementación parcial documentada</small>
        </article>
        <article>
          <span>Requieren evidencia o definición</span>
          <strong>{needsEvidence}</strong>
          <small>Sin inventar reglas clínicas o de negocio</small>
        </article>
      </section>

      <Panel className="studio-toolbar client-changes-toolbar">
        <input
          aria-label="Buscar cambio solicitado"
          placeholder="Buscar solicitud, módulo o número"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <span>{rows.length} resultados</span>
      </Panel>

      <p className="notice client-changes-governance-note">
        <strong>Todas las solicitudes tienen revisión completa.</strong> “Resuelta” se reserva para
        funciones implementadas y verificadas; los conflictos de escalas y definiciones clínicas
        permanecen visibles hasta contar con evidencia aprobada.
      </p>

      <Panel className="client-changes-table-panel">
        <div className="table-heading">
          <div>
            <h2>Registro de solicitudes</h2>
            <p>Texto fuente preservado y estado técnico verificable.</p>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Módulo</th>
                <th>Solicitud del Excel</th>
                <th>Seguimiento</th>
                <th>Detalle</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <strong>{row.id}</strong>
                  </td>
                  <td>{row.module}</td>
                  <td className="studio-source">{row.source}</td>
                  <td>
                    <div className="client-change-status">
                      <StatusTag tone="success">Revisión completada</StatusTag>
                      <StatusTag tone={technicalTone(row.status, row.conflict)}>
                        {row.conflict ? 'Conflicto de fuente' : label(row.status)}
                      </StatusTag>
                    </div>
                  </td>
                  <td>
                    <Button
                      className="button-secondary"
                      data-action-id={`CHANGE-${row.id}-OPEN`}
                      onClick={() => setSelected(row)}
                    >
                      Ver detalle
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <Dialog
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected?.id ?? ''}
        description={selected?.module}
        footer={
          <Button className="button-secondary" onClick={() => setSelected(null)}>
            Cerrar
          </Button>
        }
      >
        {selected ? (
          <div className="page-stack">
            <h3>Texto original</h3>
            <p className="studio-source">{selected.source}</p>
            <h3>Estado técnico y evidencia</h3>
            <div className="client-change-status">
              <StatusTag tone="success">Revisión completada</StatusTag>
              <StatusTag tone={technicalTone(selected.status, selected.conflict)}>
                {selected.conflict ? 'Conflicto de fuente' : label(selected.status)}
              </StatusTag>
            </div>
            <p>{selected.detail || 'Requiere verificación funcional y de integración.'}</p>
            <dl className="studio-verification-stages">
              {(
                [
                  ['implemented', 'Implementación'],
                  ['local', 'Prueba local'],
                  ['preview', 'Prueba en preview'],
                  ['integration', 'Integración'],
                  ['definition', 'Definición'],
                ] as const
              ).map(([key, title]) => (
                <div key={key}>
                  <dt>{title}</dt>
                  <dd>{selected.stages[key]}</dd>
                </div>
              ))}
            </dl>
          </div>
        ) : null}
      </Dialog>
    </div>
  );
}
