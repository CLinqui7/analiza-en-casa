import registry from '../../../../../../docs/qa/CLIENT_CHANGE_REQUESTS.json';
import { ClientChangesPage, type ChangeSummary } from '@/components/client-changes-page';

type RegistryChange = (typeof registry.changes)[number];
const scaleReferences = [
  'eva',
  'glasgow',
  'ramsay',
  'ecog',
  'esas',
  'karnofsky',
  'dowton-a',
  'dowton-b',
  'barthel',
  'braden',
];

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
        detail: row.blocker_reason || row.notes || '',
        conflict: row.source_conflict.detected,
        referenceHref: /^CR-0(2[1-9]|30)$/.test(row.change_id)
          ? `/clinical/scales#${scaleReferences[Number(row.change_id.slice(-2)) - 21]}`
          : undefined,
        stages: verificationStages(row),
      }))}
    />
  );
}
