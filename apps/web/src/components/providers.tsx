'use client';

import type {
  InventoryMovement,
  NurseHourEntry,
  NursingResource,
  Patient,
  VitalReading,
} from '@analiza/contracts';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createContext, useContext, useMemo, useState, type PropsWithChildren } from 'react';
import {
  demoInventoryMovements,
  demoNurseHours,
  demoNursingResources,
  demoPatients,
  demoVitalReadings,
} from '@/lib/demo-data';

type AuditEntry = { id: string; at: string; action: string; subject: string };

type WorkspaceContextValue = {
  patients: Patient[];
  vitalReadings: VitalReading[];
  nursingResources: NursingResource[];
  nurseHours: NurseHourEntry[];
  inventoryMovements: InventoryMovement[];
  auditEntries: AuditEntry[];
  addPatient: (patient: Patient) => void;
  addVitalReading: (reading: VitalReading) => void;
  addNursingResource: (resource: NursingResource) => void;
  addNurseHour: (entry: NurseHourEntry) => void;
  addInventoryMovement: (movement: InventoryMovement) => void;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

function audit(action: string, subject: string): AuditEntry {
  return { id: crypto.randomUUID(), at: new Date().toISOString(), action, subject };
}

function WorkspaceProvider({ children }: PropsWithChildren) {
  const [patients, setPatients] = useState(demoPatients);
  const [vitalReadings, setVitalReadings] = useState(demoVitalReadings);
  const [nursingResources, setNursingResources] = useState(demoNursingResources);
  const [nurseHours, setNurseHours] = useState(demoNurseHours);
  const [inventoryMovements, setInventoryMovements] = useState(demoInventoryMovements);
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([
    {
      id: 'audit-demo-001',
      at: '2026-08-28T08:00:00.000Z',
      action: 'Demo iniciado',
      subject: 'Aplicación React',
    },
  ]);

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      patients,
      vitalReadings,
      nursingResources,
      nurseHours,
      inventoryMovements,
      auditEntries,
      addPatient: (patient) => {
        setPatients((current) => [...current, patient]);
        setAuditEntries((current) => [audit('Paciente registrado', patient.id), ...current]);
      },
      addVitalReading: (reading) => {
        setVitalReadings((current) => [...current, reading]);
        setAuditEntries((current) => [audit('Signos vitales registrados', reading.id), ...current]);
      },
      addNursingResource: (resource) => {
        setNursingResources((current) => [...current, resource]);
        setAuditEntries((current) => [
          audit('Recurso de enfermería registrado', resource.id),
          ...current,
        ]);
      },
      addNurseHour: (entry) => {
        setNurseHours((current) => [...current, entry]);
        setAuditEntries((current) => [
          audit('Hora de enfermería registrada', entry.id),
          ...current,
        ]);
      },
      addInventoryMovement: (movement) => {
        setInventoryMovements((current) => [...current, movement]);
        setAuditEntries((current) => [
          audit('Movimiento de inventario registrado', movement.id),
          ...current,
        ]);
      },
    }),
    [auditEntries, inventoryMovements, nurseHours, nursingResources, patients, vitalReadings],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function AppProviders({ children }: PropsWithChildren) {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      <WorkspaceProvider>{children}</WorkspaceProvider>
    </QueryClientProvider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error('useWorkspace requiere AppProviders.');
  return context;
}
