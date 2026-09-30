'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Button, Dialog, Panel, StatusTag } from '@analiza/ui';
export type ChangeSummary = {
  id: string;
  source: string;
  module: string;
  trackingStatus: string;
  status: string;
  detail: string;
  conflict: boolean;
  referenceHref?: string;
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
  const completedCount = changes.filter((row) => row.trackingStatus === 'COMPLETED').length;
  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">Analiza en Casa</p>
          <h1>Cambios solicitados</h1>
          <p>Las {changes.length} solicitudes del Excel y su seguimiento administrativo.</p>
        </div>
        <StatusTag>{completedCount} completadas</StatusTag>
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
        El seguimiento de estas {completedCount} solicitudes se marcó como completado por indicación
        del administrador. Esto no certifica que todas las funciones estén implementadas o aprobadas
        clínicamente. La verificación técnica y los conflictos de fuente permanecen en «Ver
        detalle». Los reportes enviados por las enfermeras se gestionan por separado.
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
                    <StatusTag tone="neutral">
                      {row.trackingStatus === 'COMPLETED' ? 'Completado' : 'Pendiente'}
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
                    {row.referenceHref ? (
                      <Link className="change-reference-link" href={row.referenceHref}>
                        Ver imagen original
                      </Link>
                    ) : null}
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
            <h3>Verificación técnica</h3>
            <p>
              Seguimiento:{' '}
              <strong>
                {selected.trackingStatus === 'COMPLETED' ? 'Completado' : 'Pendiente'}
              </strong>{' '}
              · Implementación: {label(selected.status)}
              {selected.conflict ? ' · Conflicto de fuente' : ''}
            </p>
            <p>{selected.detail || 'Requiere verificación funcional y de integración.'}</p>
            {selected.referenceHref ? (
              <Link className="button button-secondary" href={selected.referenceHref}>
                Consultar imagen de esta escala
              </Link>
            ) : null}
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
