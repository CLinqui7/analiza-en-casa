'use client';

import type { CatalogItem, ClinicalDocument, Hospitalization, InsuranceEvent, InsuranceRequest, InsuranceRequestStatus, InventoryMovement, NurseHourEntry, NursingResource, Patient, Payment, Purchase, Quote, Shift, VitalReading } from '@analiza/contracts';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { appendInsuranceEvent, calculateQuoteTotals, canEditQuote, hasValidInsuranceRequestContext, isInsuranceRequestStatus } from '@analiza/domain';
import { loadSession, login as authenticate, logout as endSession, type AuthSession } from '@/lib/auth';
import { can, type Permission, type Role } from '@/lib/permissions';
import {
  createDataProvider,
  defaultSnapshot,
  type AuditEntry,
  type DataProvider,
  type WorkspaceSnapshot,
} from '@/lib/data-provider';

type AuthContextValue = {
  session: AuthSession | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  can: (permission: Permission) => boolean;
};

type WorkspaceContextValue = WorkspaceSnapshot & {
  loading: boolean;
  error: string | null;
  providerMode: DataProvider['mode'];
  addPatient: (patient: Patient) => void;
  addPatients: (patients: Patient[]) => void;
  updatePatient: (patient: Patient) => void;
  addVitalReading: (reading: VitalReading) => void;
  addNursingResource: (resource: NursingResource) => void;
  addNurseHour: (entry: NurseHourEntry) => void;
  addInventoryMovement: (movement: InventoryMovement) => void;
  addShift: (shift: Shift) => void;
  addHospitalization: (hospitalization: Hospitalization) => void;
  updateHospitalization: (hospitalization: Hospitalization) => void;
  addQuote: (quote: Quote) => void;
  updateQuote: (quote: Quote) => void;
  sendQuote: (quoteId: string) => void;
  addPayment: (payment: Payment) => void;
  voidPayment: (paymentId: string, reason: string) => void;
  addClinicalDocument: (document: ClinicalDocument) => void;
  signClinicalDocument: (documentId: string) => void;
  correctClinicalDocument: (documentId: string, reason: string, summary: string, author: string) => void;
  addCatalogItem: (item: CatalogItem) => void;
  addPurchase: (purchase: Purchase) => void;
  addInsuranceRequest: (request: InsuranceRequest) => boolean;
  addInsuranceEvent: (event: InsuranceEvent) => boolean;
  recordInsuranceObservation: (input: { quoteId: string; status: InsuranceRequestStatus; note: string; date: string }) => boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);
type DashboardWorkspace = Pick<WorkspaceContextValue, 'auditEntries' | 'clinicalDocuments' | 'error' | 'hospitalizations' | 'loading' | 'patients' | 'vitalReadings'>;
const DashboardWorkspaceContext = createContext<DashboardWorkspace | null>(null);

function audit(action: string, subject: string): AuditEntry {
  return { id: crypto.randomUUID(), at: new Date().toISOString(), action, subject };
}

function changedSlices(current: WorkspaceSnapshot, next: WorkspaceSnapshot): Partial<WorkspaceSnapshot> {
  const changes: Partial<WorkspaceSnapshot> = {};
  for (const key of Object.keys(current) as Array<keyof WorkspaceSnapshot>) {
    if (current[key] !== next[key]) changes[key] = next[key] as never;
  }
  return changes;
}

function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadSession()
      .then(setSession)
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Error de sesión.'))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setError(null);
    const next = await authenticate(email, password);
    setSession(next);
  }, []);
  const logout = useCallback(async () => {
    setError(null);
    setSession(null);
    await endSession(session);
  }, [session]);
  const value = useMemo<AuthContextValue>(
    () => ({ session, loading, error, login, logout, can: (permission) => can(session?.role, permission) }),
    [error, loading, login, logout, session],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function WorkspaceProvider({ children }: PropsWithChildren) {
  const { can } = useAuth();
  const [provider] = useState<DataProvider>(() => createDataProvider());
  const [snapshot, setSnapshot] = useState<WorkspaceSnapshot>(defaultSnapshot);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void provider
      .load()
      .then(setSnapshot)
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Error de persistencia.'))
      .finally(() => setLoading(false));
  }, [provider]);

  const commit = useCallback(
    (change: (current: WorkspaceSnapshot) => WorkspaceSnapshot) => {
      setSnapshot((current) => {
        const next = change(current);
        const changes = changedSlices(current, next);
        if (Object.keys(changes).length) void provider.saveChanges(changes).catch((cause: unknown) =>
          setError(cause instanceof Error ? cause.message : 'Error de persistencia.'),
        );
        return next;
      });
    },
    [provider],
  );
  const value = useMemo<WorkspaceContextValue>(
    () => ({
      ...snapshot,
      loading,
      error,
      providerMode: provider.mode,
      addPatient: (patient) => commit((current) => ({
        ...current,
        patients: [...current.patients, patient],
        auditEntries: [audit('Paciente registrado', patient.id), ...current.auditEntries],
      })),
      addPatients: (patients) => commit((current) => ({
        ...current,
        patients: [...current.patients, ...patients],
        auditEntries: [audit('Pacientes importados', `${patients.length} registros`), ...current.auditEntries],
      })),
      updatePatient: (patient) => commit((current) => ({
        ...current,
        patients: current.patients.map((item) => (item.id === patient.id ? patient : item)),
        auditEntries: [audit('Paciente actualizado', patient.id), ...current.auditEntries],
      })),
      addVitalReading: (reading) => commit((current) => ({
        ...current,
        vitalReadings: [...current.vitalReadings, reading],
        auditEntries: [audit('Signos vitales registrados', reading.id), ...current.auditEntries],
      })),
      addNursingResource: (resource) => commit((current) => ({
        ...current,
        nursingResources: [...current.nursingResources, resource],
        auditEntries: [audit('Recurso de enfermería registrado', resource.id), ...current.auditEntries],
      })),
      addNurseHour: (entry) => commit((current) => ({
        ...current,
        nurseHours: [...current.nurseHours, entry],
        auditEntries: [audit('Hora de enfermería registrada', entry.id), ...current.auditEntries],
      })),
      addInventoryMovement: (movement) => commit((current) => ({
        ...current,
        inventoryMovements: [...current.inventoryMovements, movement],
        auditEntries: [audit('Movimiento de inventario registrado', movement.id), ...current.auditEntries],
      })),
      addShift: (shift) => commit((current) => ({
        ...current,
        shifts: [...current.shifts, shift],
        auditEntries: [audit('Turno registrado', shift.id), ...current.auditEntries],
      })),
      addHospitalization: (hospitalization) => {
        if (!can('cases:write')) return;
        commit((current) => ({
          ...current,
          hospitalizations: [...current.hospitalizations, hospitalization],
          auditEntries: [audit('Hospitalización registrada', hospitalization.id), ...current.auditEntries],
        }));
      },
      updateHospitalization: (hospitalization) => {
        if (!can('cases:write')) return;
        commit((current) => {
          if (!current.hospitalizations.some((candidate) => candidate.id === hospitalization.id)) return current;
          return {
            ...current,
            hospitalizations: current.hospitalizations.map((candidate) => candidate.id === hospitalization.id ? hospitalization : candidate),
            auditEntries: [audit('Hospitalización actualizada', hospitalization.id), ...current.auditEntries],
          };
        });
      },
      addQuote: (quote) => {
        if (!can('quotes:write')) return;
        commit((current) => {
          const hospitalization = current.hospitalizations.find((candidate) => candidate.id === quote.caseId);
          if (!hospitalization || hospitalization.patientId !== quote.patientId || current.quotes.some((candidate) => candidate.id === quote.id)) return current;
          try {
            const totals = calculateQuoteTotals(quote.items, quote.discount, quote.insurerAmount);
            const normalized: Quote = { ...quote, ...totals, immutable: false, status: 'DRAFT', sentAt: undefined };
            return {
              ...current,
              quotes: [...current.quotes, normalized],
              auditEntries: [audit(quote.version > 1 ? 'Revisión de cotización creada' : 'Cotización creada', quote.id), ...current.auditEntries],
            };
          } catch {
            return current;
          }
        });
      },
      updateQuote: (quote) => {
        if (!can('quotes:write')) return;
        commit((current) => {
          const original = current.quotes.find((candidate) => candidate.id === quote.id);
          const hospitalization = current.hospitalizations.find((candidate) => candidate.id === quote.caseId);
          if (!original || !canEditQuote(original) || !hospitalization || hospitalization.patientId !== quote.patientId) return current;
          try {
            const totals = calculateQuoteTotals(quote.items, quote.discount, quote.insurerAmount);
            const updated: Quote = { ...original, ...quote, ...totals, immutable: false, status: 'DRAFT', sentAt: undefined };
            return {
              ...current,
              quotes: current.quotes.map((candidate) => candidate.id === quote.id ? updated : candidate),
              auditEntries: [audit('Borrador de cotización actualizado', quote.id), ...current.auditEntries],
            };
          } catch {
            return current;
          }
        });
      },
      sendQuote: (quoteId) => commit((current) => {
        const quote = current.quotes.find((candidate) => candidate.id === quoteId);
        if (!can('quotes:write') || !quote || !canEditQuote(quote)) return current;
        return {
          ...current,
          quotes: current.quotes.map((candidate) => candidate.id === quoteId ? { ...candidate, status: 'SENT', immutable: true, sentAt: new Date().toISOString() } : candidate),
          auditEntries: [audit('Cotización marcada como enviada e inmutable', quoteId), ...current.auditEntries],
        };
      }),
      addPayment: (payment) => commit((current) => {
        if (current.payments.some((candidate) => candidate.idempotencyKey === payment.idempotencyKey)) return current;
        return {
          ...current,
          payments: [...current.payments, payment],
          auditEntries: [audit('Pago aplicado', payment.id), ...current.auditEntries],
        };
      }),
      voidPayment: (paymentId, reason) => commit((current) => {
        const voidReason = reason.trim();
        const payment = current.payments.find((candidate) => candidate.id === paymentId);
        if (!voidReason || payment?.status !== 'APPLIED') return current;
        return {
          ...current,
          payments: current.payments.map((candidate) => candidate.id === paymentId ? { ...candidate, status: 'VOIDED', voidReason } : candidate),
          auditEntries: [audit('Pago reversado', paymentId), ...current.auditEntries],
        };
      }),
      addClinicalDocument: (document) => commit((current) => ({
        ...current,
        clinicalDocuments: [...current.clinicalDocuments, document],
        auditEntries: [audit('Documento clínico creado', document.id), ...current.auditEntries],
      })),
      signClinicalDocument: (documentId) => commit((current) => {
        const document = current.clinicalDocuments.find((candidate) => candidate.id === documentId);
        if (!document || document.status !== 'DRAFT') return current;
        return {
          ...current,
          clinicalDocuments: current.clinicalDocuments.map((candidate) => candidate.id === documentId ? { ...candidate, status: 'SIGNED', signedAt: new Date().toISOString() } : candidate),
          auditEntries: [audit('Documento clínico firmado', documentId), ...current.auditEntries],
        };
      }),
      correctClinicalDocument: (documentId, reason, summary, author) => commit((current) => {
        const original = current.clinicalDocuments.find((candidate) => candidate.id === documentId);
        const correctionReason = reason.trim();
        if (!original || original.status !== 'SIGNED' || !correctionReason || !summary.trim() || !author.trim()) return current;
        const nextVersion = Math.max(...current.clinicalDocuments.filter((candidate) => candidate.id === original.id || candidate.correctionOf === original.id).map((candidate) => candidate.version), original.version) + 1;
        const correction: ClinicalDocument = { ...original, id: crypto.randomUUID(), summary: summary.trim(), author: author.trim(), status: 'DRAFT', version: nextVersion, createdAt: new Date().toISOString(), signedAt: undefined, correctionOf: original.id, correctionReason };
        return {
          ...current,
          clinicalDocuments: [...current.clinicalDocuments, correction],
          auditEntries: [audit('Corrección clínica creada', correction.id), ...current.auditEntries],
        };
      }),
      addCatalogItem: (item) => commit((current) => {
        if (current.catalogItems.some((candidate) => candidate.sku.toLocaleUpperCase('es') === item.sku.toLocaleUpperCase('es'))) return current;
        return {
          ...current,
          catalogItems: [...current.catalogItems, item],
          auditEntries: [audit('Ítem de catálogo creado', item.id), ...current.auditEntries],
        };
      }),
      addPurchase: (purchase) => commit((current) => ({
        ...current,
        purchases: [...current.purchases, purchase],
        auditEntries: [audit('Compra en borrador creada', purchase.id), ...current.auditEntries],
      })),
      addInsuranceRequest: (request) => {
        // Existing Supabase policies deliberately deny browser writes to this
        // ledger. Until an approved append-only RPC exists, only the mock
        // provider can persist an observation; never bypass RLS with upsert.
        if (provider.mode !== 'mock' || !can('insurance:write') || !isInsuranceRequestStatus(request.status) || !request.lastNote.trim()) return false;
        if (!hasValidInsuranceRequestContext(request, snapshot.quotes, snapshot.patients) || snapshot.insuranceRequests.some((candidate) => candidate.quoteId === request.quoteId)) return false;
        commit((current) => ({
          ...current,
          insuranceRequests: [...current.insuranceRequests, request],
          auditEntries: [audit('Preautorización registrada', request.id), ...current.auditEntries],
        }));
        return true;
      },
      addInsuranceEvent: (event) => {
        if (provider.mode !== 'mock' || !can('insurance:write') || !isInsuranceRequestStatus(event.status) || !event.note.trim()) return false;
        const request = snapshot.insuranceRequests.find((candidate) => candidate.id === event.requestId);
        const quote = request && snapshot.quotes.find((candidate) => candidate.id === request.quoteId);
        if (!request || !quote || quote.patientId !== request.patientId || snapshot.insuranceEvents.some((candidate) => candidate.id === event.id)) return false;
        try {
          const appended = appendInsuranceEvent(request, snapshot.insuranceEvents.filter((candidate) => candidate.requestId === request.id), event);
          commit((current) => ({
            ...current,
            insuranceRequests: current.insuranceRequests.map((candidate) => candidate.id === request.id ? appended.request : candidate),
            insuranceEvents: [...current.insuranceEvents, event],
            auditEntries: [audit('Actualización de seguro registrada', event.id), ...current.auditEntries],
          }));
          return true;
        } catch { return false; }
      },
      recordInsuranceObservation: (input) => {
        if (provider.mode !== 'mock' || !can('insurance:write') || !isInsuranceRequestStatus(input.status) || !input.note.trim()) return false;
        const quote = snapshot.quotes.find((candidate) => candidate.id === input.quoteId);
        const patient = quote && snapshot.patients.find((candidate) => candidate.id === quote.patientId);
        const insurer = patient?.insurer ?? patient?.insurance?.insurer;
        if (!quote || !patient || !insurer) return false;
        const existing = snapshot.insuranceRequests.find((candidate) => candidate.quoteId === quote.id);
        const request: InsuranceRequest = existing ?? {
          id: crypto.randomUUID(), quoteId: quote.id, patientId: patient.id, insurer,
          status: input.status, createdAt: input.date, updatedAt: input.date, lastNote: input.note.trim(),
        };
        const event: InsuranceEvent = { id: crypto.randomUUID(), requestId: request.id, status: input.status, date: input.date, note: input.note.trim() };
        try {
          const appended = appendInsuranceEvent(request, snapshot.insuranceEvents.filter((candidate) => candidate.requestId === request.id), event);
          commit((current) => ({
            ...current,
            insuranceRequests: existing
              ? current.insuranceRequests.map((candidate) => candidate.id === request.id ? appended.request : candidate)
              : [...current.insuranceRequests, appended.request],
            insuranceEvents: [...current.insuranceEvents, event],
            auditEntries: [audit(existing ? 'Actualización de seguro registrada' : 'Preautorización registrada', existing ? event.id : request.id), ...current.auditEntries],
          }));
          return true;
        } catch { return false; }
      },
    }),
    [can, commit, error, loading, provider.mode, snapshot],
  );
  const dashboardValue = useMemo<DashboardWorkspace>(() => ({
    auditEntries: value.auditEntries, clinicalDocuments: value.clinicalDocuments, error: value.error,
    hospitalizations: value.hospitalizations, loading: value.loading, patients: value.patients, vitalReadings: value.vitalReadings,
  }), [value.auditEntries, value.clinicalDocuments, value.error, value.hospitalizations, value.loading, value.patients, value.vitalReadings]);
  return <WorkspaceContext.Provider value={value}><DashboardWorkspaceContext.Provider value={dashboardValue}>{children}</DashboardWorkspaceContext.Provider></WorkspaceContext.Provider>;
}

export function AppProviders({ children }: PropsWithChildren) {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <WorkspaceProvider>{children}</WorkspaceProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth requiere AppProviders.');
  return context;
}

export function useRole(): Role | undefined {
  return useAuth().session?.role;
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error('useWorkspace requiere AppProviders.');
  return context;
}

/** Narrow dashboard subscription: unrelated workspace commits retain the
 * dashboard context identity and do not schedule its consumers. */
export function useDashboardWorkspace() {
  const context = useContext(DashboardWorkspaceContext);
  if (!context) throw new Error('useDashboardWorkspace requiere AppProviders.');
  return context;
}
