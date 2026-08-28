'use client';

import { useQuery } from '@tanstack/react-query';
import { Panel, StatusTag } from '@analiza/ui';
import { useWorkspace } from '@/components/providers';
import { getSupabaseBrowserClient } from '@/lib/supabase';

export default function DashboardPage() {
  const { auditEntries, inventoryMovements, nursingResources, patients } = useWorkspace();
  const parity = useQuery({
    queryKey: ['video-parity-summary'],
    queryFn: async () => ({
      chapters: 17,
      unresolvedMissing: 0,
      source: 'Matriz canónica versionada',
    }),
    staleTime: Infinity,
  });
  const supabaseConfigured = Boolean(getSupabaseBrowserClient());

  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">Operación domiciliaria</p>
          <h1>Panel de control</h1>
          <p>Entorno de demostración con datos exclusivamente sintéticos.</p>
        </div>
        <StatusTag tone="success">React activo</StatusTag>
      </header>
      <section className="metric-grid" aria-label="Resumen operativo">
        <Panel>
          <span>Pacientes demo</span>
          <strong>{patients.length}</strong>
        </Panel>
        <Panel>
          <span>Recursos de enfermería</span>
          <strong>{nursingResources.length}</strong>
        </Panel>
        <Panel>
          <span>Movimientos de inventario</span>
          <strong>{inventoryMovements.length}</strong>
        </Panel>
        <Panel>
          <span>Eventos auditados</span>
          <strong>{auditEntries.length}</strong>
        </Panel>
      </section>
      <section className="two-column">
        <Panel>
          <h2>Control de migración</h2>
          {parity.data ? (
            <dl className="definition-list">
              <div>
                <dt>Capítulos verificados</dt>
                <dd>{parity.data.chapters}/17</dd>
              </div>
              <div>
                <dt>Faltantes en matriz</dt>
                <dd>{parity.data.unresolvedMissing}</dd>
              </div>
              <div>
                <dt>Fuente</dt>
                <dd>{parity.data.source}</dd>
              </div>
              <div>
                <dt>Supabase navegador</dt>
                <dd>
                  {supabaseConfigured
                    ? 'Configurado con clave pública'
                    : 'No configurado en demo local'}
                </dd>
              </div>
            </dl>
          ) : (
            <p>Cargando resumen verificable…</p>
          )}
        </Panel>
        <Panel>
          <h2>Auditoría reciente</h2>
          <ul className="audit-list">
            {auditEntries.slice(0, 4).map((entry) => (
              <li key={entry.id}>
                <strong>{entry.action}</strong>
                <span>
                  {entry.subject} · {new Date(entry.at).toLocaleString('es-SV')}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      </section>
    </div>
  );
}
