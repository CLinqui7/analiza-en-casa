import type { WorkspaceSnapshot } from './data-provider';

/** Shared data-only default. Safe in Route Handlers; never imports a client runtime. */
export const emptyServerWorkspace = (): WorkspaceSnapshot => ({
  patients: [],
  vitalReadings: [],
  nursingResources: [],
  doctors: [],
  nurseHours: [],
  inventoryMovements: [],
  shifts: [],
  hospitalizations: [],
  quotes: [],
  payments: [],
  clinicalDocuments: [],
  catalogItems: [],
  purchases: [],
  insuranceRequests: [],
  insuranceEvents: [],
  auditEntries: [],
});
