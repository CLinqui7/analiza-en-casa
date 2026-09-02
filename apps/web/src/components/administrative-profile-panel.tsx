import { Button, Panel } from '@analiza/ui';
import type { Hospitalization } from '@analiza/contracts';
import type { DataProvider } from '@/lib/data-provider';

type Props = {
  hospitalization: Hospitalization;
  canWrite: boolean;
  onOpen: () => void;
  providerMode: DataProvider['mode'];
};

/**
 * The mock profile is deliberately isolated from the secured Supabase RPC.
 * Supabase must not receive an incomplete execution profile through the
 * generic hospitalizations table upsert.
 */
export function AdministrativeProfilePanel({ hospitalization, canWrite, onOpen, providerMode }: Props) {
  const profile = hospitalization.administrativeProfile;
  const mockProfileEnabled = providerMode === 'mock';
  return <Panel>
    <div className="table-heading"><div><h2>Perfil administrativo de ejecución · PIC</h2><p className="muted">Datos administrativos sintéticos; no establecen cobertura, facturación, impuestos ni reglas clínicas.</p></div>{canWrite && mockProfileEnabled ? <Button data-action-id="HOSPITALIZATION-ADMIN-PROFILE-OPEN" onClick={onOpen} type="button">Editar perfil administrativo</Button> : null}</div>
    {providerMode === 'supabase' ? <p className="notice" data-testid="administrative-profile-integration-blocked" role="status">La integración segura del perfil de ejecución está pendiente. Requiere la RPC auditada, cotización y versión vinculadas; no se guarda un perfil parcial.</p> : null}
    <dl className="detail-list"><div><dt>Health manager</dt><dd>{profile?.healthManager ?? 'Sin registrar'}</dd></div><div><dt>Referido por</dt><dd>{profile?.referredBy ?? 'Sin registrar'}</dd></div><div><dt>Tipo Revenue</dt><dd>{profile?.revenueType ?? 'Sin registrar'}</dd></div><div><dt>Tipo</dt><dd>{profile?.type ?? 'Sin registrar'}</dd></div><div><dt>Fecha de inicio</dt><dd>{profile?.startDate ?? 'Sin registrar'}</dd></div><div><dt>Días de duración</dt><dd>{profile?.durationDays ?? 'Sin registrar'}</dd></div><div><dt>Forma de pago</dt><dd>{profile?.paymentMethod ?? 'Sin registrar'}</dd></div><div><dt>Aseguradora</dt><dd>{profile?.insurer ?? 'Sin registrar'}</dd></div></dl>
  </Panel>;
}
