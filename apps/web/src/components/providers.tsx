'use client';

import type { InventoryMovement, NurseHourEntry, NursingResource, Patient, Shift, VitalReading } from '@analiza/contracts';
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
