import registry from '../../../../../../docs/qa/CLIENT_CHANGE_REQUESTS.json';
import workflow from '../../../../../../docs/qa/CLIENT_CHANGE_WORKFLOW.json';
import { ClientChangesPage, type ChangeSummary } from '@/components/client-changes-page';

type RegistryChange = (typeof registry.changes)[number];
const doneIds = new Set<string>(workflow.done_ids);

function verificationStages(row: RegistryChange): ChangeSummary['stages'] {
  const blocker = row.blocker_reason || 'Sin bloqueo registrado';

  return {
    implemented: `Estado técnico: ${row.technical_status}`,
    local: `Certificación: ${row.certification_status}`,
    preview: `Producción: ${row.production_status}`,
    integration:
      row.blocker_type === 'INTEGRATION' ? blocker : 'Sin bloqueo de integración registrado',
    definition: row.confirmation_required ? blocker : 'Sin confirmación adicional requerida',
  };
}

export default function Page() {
  return (
    <ClientChangesPage
      changes={registry.changes.map((row) => ({
        id: row.change_id,
        source: row.source_text,
        module: row.module,
        status: row.status,
        workflowStatus: doneIds.has(row.change_id) ? 'DONE' : 'OPEN',
        detail: row.blocker_reason || row.notes || '',
        conflict: row.source_conflict.detected,
        stages: verificationStages(row),
      }))}
    />
  );
}
