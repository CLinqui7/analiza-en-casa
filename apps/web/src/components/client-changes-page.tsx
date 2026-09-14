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
export function ClientChangesPage({ changes }: { changes: ChangeSummary[] }) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<ChangeSummary | null>(null);
  const rows = changes.filter((row) =>
    `${row.id} ${row.source} ${row.module}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">Analiza en Casa</p>
          <h1>Cambios solicitados</h1>
          <p>
            Las 32 solicitudes del Excel, su texto original y el estado documentado de verificación.
          </p>
        </div>
        <StatusTag>{changes.length} solicitudes</StatusTag>
      </header>
      <Panel className="studio-toolbar">
        <input
          aria-label="Buscar cambio solicitado"
          placeholder="Buscar solicitud, módulo o número"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <span>{rows.length} resultados</span>
      </Panel>
      <p className="notice">
        La existencia de una pantalla no acredita una función completa. Los conflictos de escalas se
        conservan sin inventar puntuaciones.
      </p>
      <Panel>
        <div className="table-heading">
          <h2>Seguimiento de solicitudes</h2>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Módulo</th>
                <th>Solicitud del Excel</th>
                <th>Verificación registrada</th>
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
                    <StatusTag tone={row.conflict ? 'warning' : 'neutral'}>
                      {row.conflict ? 'Conflicto de fuente' : label(row.status)}
                    </StatusTag>
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
            <h3>Estado y evidencia pendiente</h3>
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
