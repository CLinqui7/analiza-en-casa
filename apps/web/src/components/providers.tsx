'use client';
import { isServerDataMode } from '@/lib/data-mode';

import type {
  CatalogItem,
  ClinicalDocument,
  Doctor,
  Hospitalization,
  InsuranceEvent,
  InsuranceRequest,
  InsuranceRequestStatus,
  InventoryMovement,
  NurseHourEntry,
  NursingResource,
  Patient,
  Payment,
  Purchase,
  Quote,
  Shift,
  VitalReading,
} from '@analiza/contracts';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import {
  appendInsuranceEvent,
  calculateQuoteTotals,
  canEditQuote,
  hasValidInsuranceRequestContext,
  isInsuranceRequestStatus,
} from '@analiza/domain';
import {
  loadSession,
  login as authenticate,
  logout as endSession,
  type AuthSession,
} from '@/lib/auth';
import { can, type Permission, type Role } from '@/lib/permissions';
import {
  createDataProvider,
  defaultSnapshot,
  emptySnapshot,
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
  addPatient: (patient: Patient) => Promise<boolean>;
  addPatients: (patients: Patient[]) => void;
  updatePatient: (patient: Patient) => Promise<boolean>;
  refreshPatients: () => Promise<boolean>;
  addVitalReading: (reading: VitalReading) => void;
  addNursingResource: (resource: NursingResource) => void;
  addDoctor: (doctor: Doctor) => Promise<boolean>;
  updateDoctor: (doctor: Doctor) => Promise<boolean>;
  addNurseHour: (entry: NurseHourEntry) => void;
  addInventoryMovement: (movement: InventoryMovement) => Promise<boolean>;
  addShift: (shift: Shift) => void;
  addShiftSeries: (shifts: Shift[], idempotencyKey: string) => Promise<boolean>;
  addHospitalization: (hospitalization: Hospitalization) => Promise<boolean>;
  updateHospitalization: (hospitalization: Hospitalization) => Promise<boolean>;
  addQuote: (quote: Quote) => Promise<boolean>;
  updateQuote: (quote: Quote) => Promise<boolean>;
  sendQuote: (quoteId: string) => Promise<boolean>;
  addPayment: (payment: Payment) => Promise<boolean>;
  voidPayment: (paymentId: string, reason: string) => Promise<boolean>;
  addClinicalDocument: (document: ClinicalDocument) => Promise<boolean>;
  signClinicalDocument: (documentId: string) => Promise<boolean>;
  correctClinicalDocument: (
    documentId: string,
    reason: string,
    summary: string,
    author: string,
  ) => Promise<boolean>;
  addCatalogItem: (item: CatalogItem) => Promise<boolean>;
  addPurchase: (purchase: Purchase) => Promise<boolean>;
  addInsuranceRequest: (request: InsuranceRequest) => boolean;
  addInsuranceEvent: (event: InsuranceEvent) => boolean;
  recordInsuranceObservation: (input: {
    quoteId: string;
    status: InsuranceRequestStatus;
    note: string;
    date: string;
  }) => Promise<boolean>;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);
type DashboardWorkspace = Pick<
  WorkspaceContextValue,
  | 'auditEntries'
  | 'catalogItems'
  | 'clinicalDocuments'
  | 'error'
  | 'hospitalizations'
  | 'insuranceRequests'
  | 'inventoryMovements'
  | 'loading'
  | 'nursingResources'
  | 'patients'
  | 'payments'
  | 'quotes'
  | 'shifts'
  | 'vitalReadings'
>;
const DashboardWorkspaceContext = createContext<DashboardWorkspace | null>(null);

function audit(action: string, subject: string): AuditEntry {
  return { id: crypto.randomUUID(), at: new Date().toISOString(), action, subject };
}

function changedSlices(
  current: WorkspaceSnapshot,
  next: WorkspaceSnapshot,
): Partial<WorkspaceSnapshot> {
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
      .catch((cause: unknown) =>
        setError(cause instanceof Error ? cause.message : 'Error de sesión.'),
      )
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
    () => ({
      session,
      loading,
      error,
      login,
      logout,
      can: (permission) => can(session?.role, permission),
    }),
    [error, loading, login, logout, session],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function WorkspaceProvider({ children }: PropsWithChildren) {
  const { can, session } = useAuth();
  const [provider] = useState<DataProvider>(() => createDataProvider());
  const [snapshot, setSnapshot] = useState<WorkspaceSnapshot>(() =>
    isServerDataMode(provider.mode) ? emptySnapshot() : defaultSnapshot(),
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isServerDataMode(provider.mode) && !session) return;
    let cancelled = false;
    void provider
      .load()
      .then((value) => {
        if (!cancelled) {
          setSnapshot(value);
          setError(null);
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Error de persistencia.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [provider, session]);

  const commit = useCallback(
    (change: (current: WorkspaceSnapshot) => WorkspaceSnapshot) => {
      if (isServerDataMode(provider.mode)) {
        setError(
          'La persistencia de servidor no está disponible hasta configurar identidad y comandos versionados; no se guardó ningún cambio.',
        );
        return;
      }
      setSnapshot((current) => {
        const next = change(current);
        const changes = changedSlices(current, next);
        if (Object.keys(changes).length)
          void provider
            .saveChanges(changes)
            .catch((cause: unknown) =>
              setError(cause instanceof Error ? cause.message : 'Error de persistencia.'),
            );
        return next;
      });
    },
    [provider],
  );
  const persistMockChange = useCallback(
    async (change: (current: WorkspaceSnapshot) => WorkspaceSnapshot): Promise<boolean> => {
      if (isServerDataMode(provider.mode)) {
        setError('El cambio local no es válido en modo servidor; no se guardó ningún cambio.');
        return false;
      }
      try {
        const next = change(snapshot);
        const changes = changedSlices(snapshot, next);
        if (Object.keys(changes).length) await provider.saveChanges(changes);
        setSnapshot(next);
        setError(null);
        return true;
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Error de persistencia.');
        return false;
      }
    },
    [provider, snapshot],
  );
  const savePatient = useCallback(
    async (patient: Patient, operation: 'create' | 'replace'): Promise<boolean> => {
      if (isServerDataMode(provider.mode)) {
        const command = operation === 'create' ? provider.createPatient : provider.replacePatient;
        if (!command) {
          setError(
            'El comando seguro de pacientes no está disponible; no se guardó ningún cambio.',
          );
          return false;
        }
        try {
          const saved = await command.call(provider, patient);
          setSnapshot((current) => ({
            ...current,
            patients:
              operation === 'create'
                ? [...current.patients, saved]
                : current.patients.map((candidate) =>
                    candidate.id === saved.id ? saved : candidate,
                  ),
          }));
          setError(null);
          return true;
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : 'No fue posible guardar el paciente.');
          return false;
        }
      }
      return persistMockChange((current) => ({
        ...current,
        patients:
          operation === 'create'
            ? [...current.patients, patient]
            : current.patients.map((candidate) =>
                candidate.id === patient.id ? patient : candidate,
              ),
        auditEntries: [
          audit(
            operation === 'create' ? 'Paciente registrado' : 'Paciente actualizado',
            patient.id,
          ),
          ...current.auditEntries,
        ],
      }));
    },
    [persistMockChange, provider],
  );
  const refreshPatients = useCallback(async (): Promise<boolean> => {
    try {
      const loaded = await provider.load();
      setSnapshot((current) =>
        isServerDataMode(provider.mode) ? loaded : { ...current, patients: loaded.patients },
      );
      setError(null);
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible actualizar pacientes.');
      return false;
    }
  }, [provider]);
  const saveDoctor = useCallback(
    async (doctor: Doctor, operation: 'create' | 'replace'): Promise<boolean> => {
      if (!can('settings:write')) return false;
      if (isServerDataMode(provider.mode)) {
        const command = operation === 'create' ? provider.createDoctor : provider.replaceDoctor;
        if (!command) {
          setError('El comando seguro de médicos no está disponible; no se guardó ningún cambio.');
          return false;
        }
        try {
          const saved = await command.call(provider, doctor);
          setSnapshot((current) => ({
            ...current,
            doctors:
              operation === 'create'
                ? [...current.doctors, saved]
                : current.doctors.map((candidate) =>
                    candidate.id === saved.id ? saved : candidate,
                  ),
          }));
          setError(null);
          return true;
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : 'No fue posible guardar el médico.');
          return false;
        }
      }
      return persistMockChange((current) => ({
        ...current,
        doctors:
          operation === 'create'
            ? [...current.doctors, doctor]
            : current.doctors.map((candidate) => (candidate.id === doctor.id ? doctor : candidate)),
        auditEntries: [
          audit(operation === 'create' ? 'Médico registrado' : 'Médico actualizado', doctor.id),
          ...current.auditEntries,
        ],
      }));
    },
    [can, persistMockChange, provider],
  );
  const saveHospitalization = useCallback(
    async (hospitalization: Hospitalization, operation: 'create' | 'replace'): Promise<boolean> => {
      if (!can('cases:write')) return false;
      if (isServerDataMode(provider.mode)) {
        const command =
          operation === 'create' ? provider.createHospitalization : provider.replaceHospitalization;
        if (!command) {
          setError(
            'El comando seguro de hospitalizaciones no está disponible; no se guardó ningún cambio.',
          );
          return false;
        }
        try {
          const saved = await command.call(provider, hospitalization);
          setSnapshot((current) => ({
            ...current,
            hospitalizations:
              operation === 'create'
                ? [...current.hospitalizations, saved]
                : current.hospitalizations.map((candidate) =>
                    candidate.id === saved.id ? saved : candidate,
                  ),
          }));
          setError(null);
          return true;
        } catch (cause) {
          setError(
            cause instanceof Error ? cause.message : 'No fue posible guardar la hospitalización.',
          );
          return false;
        }
      }
      return persistMockChange((current) => ({
        ...current,
        hospitalizations:
          operation === 'create'
            ? [...current.hospitalizations, hospitalization]
            : current.hospitalizations.map((candidate) =>
                candidate.id === hospitalization.id ? hospitalization : candidate,
              ),
        auditEntries: [
          audit(
            operation === 'create' ? 'Hospitalización registrada' : 'Hospitalización actualizada',
            hospitalization.id,
          ),
          ...current.auditEntries,
        ],
      }));
    },
    [can, persistMockChange, provider],
  );
  const saveShiftSeries = useCallback(
    async (shifts: Shift[], idempotencyKey: string): Promise<boolean> => {
      if (!can('agenda:write')) return false;
      if (isServerDataMode(provider.mode)) {
        if (!provider.createShiftSeries) {
          setError('El comando seguro de Agenda no está disponible; no se guardó ningún turno.');
          return false;
        }
        try {
          const saved = await provider.createShiftSeries(shifts, idempotencyKey);
          setSnapshot((current) => ({
            ...current,
            shifts: [
              ...current.shifts.filter(
                (currentShift) => !saved.some((shift) => shift.id === currentShift.id),
              ),
              ...saved,
            ],
          }));
          setError(null);
          return true;
        } catch (cause) {
          setError(
            cause instanceof Error ? cause.message : 'No fue posible guardar la serie de turnos.',
          );
          return false;
        }
      }
      return persistMockChange((current) => ({
        ...current,
        shifts: [...current.shifts, ...shifts],
        auditEntries: [
          audit('Serie de turnos registrada', idempotencyKey),
          ...current.auditEntries,
        ],
      }));
    },
    [can, persistMockChange, provider],
  );
  const saveQuote = useCallback(
    async (quote: Quote, operation: 'create' | 'replace'): Promise<boolean> => {
      if (!can('quotes:write')) return false;
      if (isServerDataMode(provider.mode)) {
        const command = operation === 'create' ? provider.createQuote : provider.replaceQuote;
        if (!command) {
          setError('El comando seguro de cotizaciones no está disponible; no se guardó nada.');
          return false;
        }
        try {
          const saved = await command.call(provider, quote);
          setSnapshot((current) => ({
            ...current,
            quotes:
              operation === 'create'
                ? [...current.quotes, saved]
                : current.quotes.map((candidate) =>
                    candidate.id === saved.id ? saved : candidate,
                  ),
          }));
          setError(null);
          return true;
        } catch (cause) {
          setError(
            cause instanceof Error ? cause.message : 'No fue posible guardar la cotización.',
          );
          return false;
        }
      }
      const hospitalization = snapshot.hospitalizations.find(
        (candidate) => candidate.id === quote.caseId,
      );
      if (!hospitalization || hospitalization.patientId !== quote.patientId) return false;
      if (operation === 'create' && snapshot.quotes.some((candidate) => candidate.id === quote.id))
        return false;
      const original =
        operation === 'replace'
          ? snapshot.quotes.find((candidate) => candidate.id === quote.id)
          : undefined;
      if (operation === 'replace' && (!original || !canEditQuote(original))) return false;
      try {
        const totals = calculateQuoteTotals(quote.items, quote.discount, quote.insurerAmount);
        const normalized: Quote = {
          ...quote,
          ...totals,
          immutable: false,
          status: 'DRAFT',
          sentAt: undefined,
        };
        return persistMockChange((current) => ({
          ...current,
          quotes:
            operation === 'create'
              ? [...current.quotes, normalized]
              : current.quotes.map((candidate) =>
                  candidate.id === normalized.id ? normalized : candidate,
                ),
          auditEntries: [
            audit(
              operation === 'create'
                ? quote.version > 1
                  ? 'Revisión de cotización creada'
                  : 'Cotización creada'
                : 'Borrador de cotización actualizado',
              quote.id,
            ),
            ...current.auditEntries,
          ],
        }));
      } catch {
        return false;
      }
    },
    [can, persistMockChange, provider, snapshot.hospitalizations, snapshot.quotes],
  );
  const sendStoredQuote = useCallback(
    async (quoteId: string): Promise<boolean> => {
      if (!can('quotes:write')) return false;
      const currentQuote = snapshot.quotes.find((candidate) => candidate.id === quoteId);
      if (!currentQuote || !canEditQuote(currentQuote)) return false;
      if (isServerDataMode(provider.mode)) {
        if (!provider.sendQuote) {
          setError('El comando seguro de envío no está disponible; no se guardó nada.');
          return false;
        }
        try {
          const saved = await provider.sendQuote(quoteId);
          setSnapshot((current) => ({
            ...current,
            quotes: current.quotes.map((candidate) =>
              candidate.id === saved.id ? saved : candidate,
            ),
          }));
          setError(null);
          return true;
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : 'No fue posible enviar la cotización.');
          return false;
        }
      }
      return persistMockChange((current) => ({
        ...current,
        quotes: current.quotes.map((candidate) =>
          candidate.id === quoteId
            ? { ...candidate, status: 'SENT', immutable: true, sentAt: new Date().toISOString() }
            : candidate,
        ),
        auditEntries: [
          audit('Cotización marcada como enviada e inmutable', quoteId),
          ...current.auditEntries,
        ],
      }));
    },
    [can, persistMockChange, provider, snapshot.quotes],
  );
  const saveInsuranceObservation = useCallback(
    async (input: {
      quoteId: string;
      status: InsuranceRequestStatus;
      note: string;
      date: string;
    }): Promise<boolean> => {
      if (!can('insurance:write') || !isInsuranceRequestStatus(input.status) || !input.note.trim())
        return false;
      if (isServerDataMode(provider.mode)) {
        if (!provider.recordInsuranceObservation) {
          setError('El comando seguro de seguros no está disponible; no se guardó nada.');
          return false;
        }
        try {
          const saved = await provider.recordInsuranceObservation(input);
          setSnapshot((current) => ({
            ...current,
            insuranceRequests: current.insuranceRequests.some(
              (candidate) => candidate.id === saved.request.id,
            )
              ? current.insuranceRequests.map((candidate) =>
                  candidate.id === saved.request.id ? saved.request : candidate,
                )
              : [...current.insuranceRequests, saved.request],
            insuranceEvents: current.insuranceEvents.some(
              (candidate) => candidate.id === saved.event.id,
            )
              ? current.insuranceEvents
              : [...current.insuranceEvents, saved.event],
          }));
          setError(null);
          return true;
        } catch (cause) {
          setError(
            cause instanceof Error
              ? cause.message
              : 'No fue posible registrar la actualización del seguro.',
          );
          return false;
        }
      }
      const quote = snapshot.quotes.find((candidate) => candidate.id === input.quoteId);
      const patient =
        quote && snapshot.patients.find((candidate) => candidate.id === quote.patientId);
      const insurer = patient?.insurer ?? patient?.insurance?.insurer;
      if (provider.mode !== 'mock' || !quote || !patient || !insurer) return false;
      const existing = snapshot.insuranceRequests.find(
        (candidate) => candidate.quoteId === quote.id,
      );
      const request: InsuranceRequest = existing ?? {
        id: crypto.randomUUID(),
        quoteId: quote.id,
        patientId: patient.id,
        insurer,
        status: input.status,
        createdAt: input.date,
        updatedAt: input.date,
        lastNote: input.note.trim(),
      };
      const event: InsuranceEvent = {
        id: crypto.randomUUID(),
        requestId: request.id,
        status: input.status,
        date: input.date,
        note: input.note.trim(),
      };
      try {
        const appended = appendInsuranceEvent(
          request,
          snapshot.insuranceEvents.filter((candidate) => candidate.requestId === request.id),
          event,
        );
        return persistMockChange((current) => ({
          ...current,
          insuranceRequests: existing
            ? current.insuranceRequests.map((candidate) =>
                candidate.id === request.id ? appended.request : candidate,
              )
            : [...current.insuranceRequests, appended.request],
          insuranceEvents: [...current.insuranceEvents, event],
          auditEntries: [
            audit(
              existing ? 'Actualización de seguro registrada' : 'Preautorización registrada',
              existing ? event.id : request.id,
            ),
            ...current.auditEntries,
          ],
        }));
      } catch {
        return false;
      }
    },
    [
      can,
      persistMockChange,
      provider,
      snapshot.insuranceEvents,
      snapshot.insuranceRequests,
      snapshot.patients,
      snapshot.quotes,
    ],
  );
  const saveCommand = useCallback(
    async (
      command: unknown,
      mockChange: (current: WorkspaceSnapshot) => WorkspaceSnapshot,
    ): Promise<boolean> => {
      if (!isServerDataMode(provider.mode)) {
        return persistMockChange(mockChange);
      }
      try {
        if (!provider.executeCommand) throw new Error('El comando seguro no está disponible.');
        await provider.executeCommand(command);
        setSnapshot(await provider.load());
        setError(null);
        return true;
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'No se guardó el registro.');
        return false;
      }
    },
    [persistMockChange, provider],
  );
  const value = useMemo<WorkspaceContextValue>(
    () => ({
      ...snapshot,
      loading,
      error,
      providerMode: provider.mode,
      addPatient: (patient) => savePatient(patient, 'create'),
      addPatients: (patients) =>
        commit((current) => ({
          ...current,
          patients: [...current.patients, ...patients],
          auditEntries: [
            audit('Pacientes importados', `${patients.length} registros`),
            ...current.auditEntries,
          ],
        })),
      updatePatient: (patient) => savePatient(patient, 'replace'),
      refreshPatients,
      addVitalReading: (reading) =>
        commit((current) => ({
          ...current,
          vitalReadings: [...current.vitalReadings, reading],
          auditEntries: [audit('Signos vitales registrados', reading.id), ...current.auditEntries],
        })),
      addNursingResource: (resource) =>
        commit((current) => ({
          ...current,
          nursingResources: [...current.nursingResources, resource],
          auditEntries: [
            audit('Recurso de enfermería registrado', resource.id),
            ...current.auditEntries,
          ],
        })),
      addDoctor: (doctor) => saveDoctor(doctor, 'create'),
      updateDoctor: (doctor) => saveDoctor(doctor, 'replace'),
      addNurseHour: (entry) =>
        commit((current) => ({
          ...current,
          nurseHours: [...current.nurseHours, entry],
          auditEntries: [audit('Hora de enfermería registrada', entry.id), ...current.auditEntries],
        })),
      addInventoryMovement: (movement) =>
        saveCommand(
          { command: 'inventory.record', movement, idempotencyKey: movement.id },
          (current) => ({
            ...current,
            inventoryMovements: [...current.inventoryMovements, movement],
            auditEntries: [
              audit('Movimiento de inventario registrado', movement.id),
              ...current.auditEntries,
            ],
          }),
        ),
      addShift: (shift) => {
        if (!can('agenda:write')) return;
        commit((current) => ({
          ...current,
          shifts: [...current.shifts, shift],
          auditEntries: [audit('Turno registrado', shift.id), ...current.auditEntries],
        }));
      },
      addShiftSeries: saveShiftSeries,
      addHospitalization: (hospitalization) => saveHospitalization(hospitalization, 'create'),
      updateHospitalization: (hospitalization) => saveHospitalization(hospitalization, 'replace'),
      addQuote: (quote) => saveQuote(quote, 'create'),
      updateQuote: (quote) => saveQuote(quote, 'replace'),
      sendQuote: sendStoredQuote,
      addPayment: (payment) =>
        saveCommand({ command: 'payment.apply', payment }, (current) => {
          if (
            current.payments.some(
              (candidate) => candidate.idempotencyKey === payment.idempotencyKey,
            )
          )
            return current;
          return {
            ...current,
            payments: [...current.payments, payment],
            auditEntries: [audit('Pago aplicado', payment.id), ...current.auditEntries],
          };
        }),
      voidPayment: (paymentId, reason) =>
        saveCommand({ command: 'payment.void', paymentId, reason }, (current) => {
          const voidReason = reason.trim();
          const payment = current.payments.find((candidate) => candidate.id === paymentId);
          if (!voidReason || payment?.status !== 'APPLIED') return current;
          return {
            ...current,
            payments: current.payments.map((candidate) =>
              candidate.id === paymentId
                ? { ...candidate, status: 'VOIDED', voidReason }
                : candidate,
            ),
            auditEntries: [audit('Pago reversado', paymentId), ...current.auditEntries],
          };
        }),
      addClinicalDocument: (document) =>
        saveCommand({ command: 'clinical.create', document }, (current) => ({
          ...current,
          clinicalDocuments: [...current.clinicalDocuments, document],
          auditEntries: [audit('Documento clínico creado', document.id), ...current.auditEntries],
        })),
      signClinicalDocument: (documentId) =>
        saveCommand({ command: 'clinical.sign', documentId }, (current) => {
          const document = current.clinicalDocuments.find(
            (candidate) => candidate.id === documentId,
          );
          if (!document || document.status !== 'DRAFT') return current;
          return {
            ...current,
            clinicalDocuments: current.clinicalDocuments.map((candidate) =>
              candidate.id === documentId
                ? { ...candidate, status: 'SIGNED', signedAt: new Date().toISOString() }
                : candidate,
            ),
            auditEntries: [audit('Documento clínico firmado', documentId), ...current.auditEntries],
          };
        }),
      correctClinicalDocument: (documentId, reason, summary, author) => {
        const correctionId = crypto.randomUUID();
        return saveCommand(
          { command: 'clinical.correct', documentId, correctionId, reason, summary, author },
          (current) => {
            const original = current.clinicalDocuments.find(
              (candidate) => candidate.id === documentId,
            );
            const correctionReason = reason.trim();
            if (
              !original ||
              original.status !== 'SIGNED' ||
              !correctionReason ||
              !summary.trim() ||
              !author.trim()
            )
              return current;
            const nextVersion =
              Math.max(
                ...current.clinicalDocuments
                  .filter(
                    (candidate) =>
                      candidate.id === original.id || candidate.correctionOf === original.id,
                  )
                  .map((candidate) => candidate.version),
                original.version,
              ) + 1;
            const correction: ClinicalDocument = {
              ...original,
              id: correctionId,
              summary: summary.trim(),
              author: author.trim(),
              status: 'DRAFT',
              version: nextVersion,
              createdAt: new Date().toISOString(),
              signedAt: undefined,
              correctionOf: original.id,
              correctionReason,
            };
            return {
              ...current,
              clinicalDocuments: [...current.clinicalDocuments, correction],
              auditEntries: [
                audit('Corrección clínica creada', correction.id),
                ...current.auditEntries,
              ],
            };
          },
        );
      },
      addCatalogItem: (item) =>
        saveCommand({ command: 'catalog.create', item }, (current) => {
          if (
            current.catalogItems.some(
              (candidate) =>
                candidate.sku.toLocaleUpperCase('es') === item.sku.toLocaleUpperCase('es'),
            )
          )
            return current;
          return {
            ...current,
            catalogItems: [...current.catalogItems, item],
            auditEntries: [audit('Ítem de catálogo creado', item.id), ...current.auditEntries],
          };
        }),
      addPurchase: (purchase) =>
        saveCommand({ command: 'purchase.create', purchase }, (current) => ({
          ...current,
          purchases: [...current.purchases, purchase],
          auditEntries: [audit('Compra en borrador creada', purchase.id), ...current.auditEntries],
        })),
      addInsuranceRequest: (request) => {
        // Existing Supabase policies deliberately deny browser writes to this
        // ledger. Until an approved append-only RPC exists, only the mock
        // provider can persist an observation; never bypass RLS with upsert.
        if (
          provider.mode !== 'mock' ||
          !can('insurance:write') ||
          !isInsuranceRequestStatus(request.status) ||
          !request.lastNote.trim()
        )
          return false;
        if (
          !hasValidInsuranceRequestContext(request, snapshot.quotes, snapshot.patients) ||
          snapshot.insuranceRequests.some((candidate) => candidate.quoteId === request.quoteId)
        )
          return false;
        commit((current) => ({
          ...current,
          insuranceRequests: [...current.insuranceRequests, request],
          auditEntries: [audit('Preautorización registrada', request.id), ...current.auditEntries],
        }));
        return true;
      },
      addInsuranceEvent: (event) => {
        if (
          provider.mode !== 'mock' ||
          !can('insurance:write') ||
          !isInsuranceRequestStatus(event.status) ||
          !event.note.trim()
        )
          return false;
        const request = snapshot.insuranceRequests.find(
          (candidate) => candidate.id === event.requestId,
        );
        const quote =
          request && snapshot.quotes.find((candidate) => candidate.id === request.quoteId);
        if (
          !request ||
          !quote ||
          quote.patientId !== request.patientId ||
          snapshot.insuranceEvents.some((candidate) => candidate.id === event.id)
        )
          return false;
        try {
          const appended = appendInsuranceEvent(
            request,
            snapshot.insuranceEvents.filter((candidate) => candidate.requestId === request.id),
            event,
          );
          commit((current) => ({
            ...current,
            insuranceRequests: current.insuranceRequests.map((candidate) =>
              candidate.id === request.id ? appended.request : candidate,
            ),
            insuranceEvents: [...current.insuranceEvents, event],
            auditEntries: [
              audit('Actualización de seguro registrada', event.id),
              ...current.auditEntries,
            ],
          }));
          return true;
        } catch {
          return false;
        }
      },
      recordInsuranceObservation: saveInsuranceObservation,
    }),
    [
      can,
      commit,
      error,
      loading,
      provider.mode,
      refreshPatients,
      saveDoctor,
      saveCommand,
      saveHospitalization,
      saveInsuranceObservation,
      savePatient,
      saveQuote,
      saveShiftSeries,
      sendStoredQuote,
      snapshot,
    ],
  );
  const dashboardValue = useMemo<DashboardWorkspace>(
    () => ({
      auditEntries: value.auditEntries,
      catalogItems: value.catalogItems,
      clinicalDocuments: value.clinicalDocuments,
      error: value.error,
      hospitalizations: value.hospitalizations,
      insuranceRequests: value.insuranceRequests,
      inventoryMovements: value.inventoryMovements,
      loading: value.loading,
      nursingResources: value.nursingResources,
      patients: value.patients,
      payments: value.payments,
      quotes: value.quotes,
      shifts: value.shifts,
      vitalReadings: value.vitalReadings,
    }),
    [
      value.auditEntries,
      value.catalogItems,
      value.clinicalDocuments,
      value.error,
      value.hospitalizations,
      value.insuranceRequests,
      value.inventoryMovements,
      value.loading,
      value.nursingResources,
      value.patients,
      value.payments,
      value.quotes,
      value.shifts,
      value.vitalReadings,
    ],
  );
  return (
    <WorkspaceContext.Provider value={value}>
      <DashboardWorkspaceContext.Provider value={dashboardValue}>
        {children}
      </DashboardWorkspaceContext.Provider>
    </WorkspaceContext.Provider>
  );
}

function SessionWorkspace({ children }: PropsWithChildren) {
  const { session } = useAuth();
  return (
    <WorkspaceProvider key={`${session?.mode}:${session?.userId}:${session?.role}`}>
      {children}
    </WorkspaceProvider>
  );
}

export function AppProviders({ children }: PropsWithChildren) {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SessionWorkspace>{children}</SessionWorkspace>
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
