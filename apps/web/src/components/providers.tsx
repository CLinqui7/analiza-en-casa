'use client';

import type { CatalogItem, ClinicalDocument, Hospitalization, InventoryMovement, NurseHourEntry, NursingResource, Patient, Payment, Quote, Shift, VitalReading } from '@analiza/contracts';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
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
  updatePatient: (patient: Patient) => void;
  addVitalReading: (reading: VitalReading) => void;
  addNursingResource: (resource: NursingResource) => void;
  addNurseHour: (entry: NurseHourEntry) => void;
  addInventoryMovement: (movement: InventoryMovement) => void;
  addShift: (shift: Shift) => void;
  addHospitalization: (hospitalization: Hospitalization) => void;
  addQuote: (quote: Quote) => void;
  sendQuote: (quoteId: string) => void;
  addPayment: (payment: Payment) => void;
  voidPayment: (paymentId: string, reason: string) => void;
  addClinicalDocument: (document: ClinicalDocument) => void;
  signClinicalDocument: (documentId: string) => void;
  correctClinicalDocument: (documentId: string, reason: string, summary: string, author: string) => void;
  addCatalogItem: (item: CatalogItem) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

function audit(action: string, subject: string): AuditEntry {
  return { id: crypto.randomUUID(), at: new Date().toISOString(), action, subject };
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
    await endSession(session);
    setSession(null);
  }, [session]);
  const value = useMemo<AuthContextValue>(
    () => ({ session, loading, error, login, logout, can: (permission) => can(session?.role, permission) }),
    [error, loading, login, logout, session],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function WorkspaceProvider({ children }: PropsWithChildren) {
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
        void provider.save(next).catch((cause: unknown) =>
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
      addHospitalization: (hospitalization) => commit((current) => ({
        ...current,
        hospitalizations: [...current.hospitalizations, hospitalization],
        auditEntries: [audit('Hospitalización registrada', hospitalization.id), ...current.auditEntries],
      })),
      addQuote: (quote) => commit((current) => ({
        ...current,
        quotes: [...current.quotes, quote],
        auditEntries: [audit('Cotización creada', quote.id), ...current.auditEntries],
      })),
      sendQuote: (quoteId) => commit((current) => {
        const quote = current.quotes.find((candidate) => candidate.id === quoteId);
        if (!quote || quote.status === 'SENT') return current;
        return {
          ...current,
          quotes: current.quotes.map((candidate) => candidate.id === quoteId ? { ...candidate, status: 'SENT', sentAt: new Date().toISOString() } : candidate),
          auditEntries: [audit('Cotización enviada como enlace seguro', quoteId), ...current.auditEntries],
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
    }),
    [commit, error, loading, provider.mode, snapshot],
  );
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
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
