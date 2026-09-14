import registry from '../../../../../../docs/qa/CLIENT_CHANGE_REQUESTS.json';
import { ClientChangesPage } from '@/components/client-changes-page';
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
        stages: row.verification_stages,
      }))}
    />
  );
}
