'use client';

import type { Hospitalization, InventoryMovement, NurseHourEntry, NursingResource, Patient, Quote, Shift, VitalReading } from '@analiza/contracts';
import { getSupabaseBrowserClient } from '@/lib/supabase';
import {
  demoInventoryMovements,
  demoHospitalizations,
  demoQuotes,
  demoNurseHours,
  demoNursingResources,
  demoPatients,
  demoShifts,
  demoVitalReadings,
} from '@/lib/demo-data';

export type AuditEntry = { id: string; at: string; action: string; subject: string };
export type WorkspaceSnapshot = {
  patients: Patient[];
  vitalReadings: VitalReading[];
  nursingResources: NursingResource[];
  nurseHours: NurseHourEntry[];
  inventoryMovements: InventoryMovement[];
  shifts: Shift[];
  hospitalizations: Hospitalization[];
  quotes: Quote[];
  auditEntries: AuditEntry[];
};

export const defaultSnapshot = (): WorkspaceSnapshot => ({
  patients: demoPatients,
  vitalReadings: demoVitalReadings,
  nursingResources: demoNursingResources,
  nurseHours: demoNurseHours,
  inventoryMovements: demoInventoryMovements,
  shifts: demoShifts,
  hospitalizations: demoHospitalizations,
  quotes: demoQuotes,
  auditEntries: [{ id: 'audit-demo-001', at: '2026-08-28T08:00:00.000Z', action: 'Demo iniciado', subject: 'Aplicación React' }],
});

export interface DataProvider {
  readonly mode: 'mock' | 'supabase';
  load(): Promise<WorkspaceSnapshot>;
  save(snapshot: WorkspaceSnapshot): Promise<void>;
}

const storageKey = 'analiza.en.casa.workspace.v2';

export class MockDataProvider implements DataProvider {
  readonly mode = 'mock' as const;
  async load(): Promise<WorkspaceSnapshot> {
    if (typeof window === 'undefined') return defaultSnapshot();
    try {
      const saved = window.localStorage.getItem(storageKey);
      if (!saved) return defaultSnapshot();
      const parsed = JSON.parse(saved) as WorkspaceSnapshot;
      if (!Array.isArray(parsed.patients) || !Array.isArray(parsed.auditEntries) || !Array.isArray(parsed.shifts) || !Array.isArray(parsed.hospitalizations) || !Array.isArray(parsed.quotes)) throw new Error('invalid');
      return parsed;
    } catch {
      window.localStorage.removeItem(storageKey);
      return defaultSnapshot();
    }
  }
  async save(snapshot: WorkspaceSnapshot): Promise<void> {
    window.localStorage.setItem(storageKey, JSON.stringify(snapshot));
  }
}

export class SupabaseDataProvider implements DataProvider {
  readonly mode = 'supabase' as const;
  private client() {
    const client = getSupabaseBrowserClient();
    if (!client) throw new Error('Supabase no está configurado; no se permite usar datos mock como reemplazo.');
    return client;
  }
  async load(): Promise<WorkspaceSnapshot> {
    const client = this.client();
    const [patients, vitalReadings, nursingResources, nurseHours, inventoryMovements, shifts, hospitalizations, quotes, auditEntries] = await Promise.all([
      client.from('patients').select('*'), client.from('vital_readings').select('*'),
      client.from('nursing_resources').select('*'), client.from('nurse_hour_entries').select('*'),
      client.from('inventory_movements').select('*'), client.from('shifts').select('*'), client.from('hospitalizations').select('*'), client.from('quotes').select('*'),
      client.from('audit_log').select('*'),
    ]);
    const failed = [patients, vitalReadings, nursingResources, nurseHours, inventoryMovements, shifts, hospitalizations, quotes, auditEntries]
      .find((result) => result.error);
    if (failed?.error) throw new Error(`No fue posible cargar datos de Supabase: ${failed.error.message}`);
    return {
      patients: (patients.data ?? []) as Patient[], vitalReadings: (vitalReadings.data ?? []) as VitalReading[],
      nursingResources: (nursingResources.data ?? []) as NursingResource[], nurseHours: (nurseHours.data ?? []) as NurseHourEntry[],
      inventoryMovements: (inventoryMovements.data ?? []) as InventoryMovement[], auditEntries: (auditEntries.data ?? []) as AuditEntry[],
      shifts: (shifts.data ?? []) as Shift[],
      hospitalizations: (hospitalizations.data ?? []) as Hospitalization[],
      quotes: (quotes.data ?? []) as Quote[],
    };
  }
  async save(snapshot: WorkspaceSnapshot): Promise<void> {
    const client = this.client();
    const results = await Promise.all([
      client.from('patients').upsert(snapshot.patients), client.from('vital_readings').upsert(snapshot.vitalReadings),
      client.from('nursing_resources').upsert(snapshot.nursingResources), client.from('nurse_hour_entries').upsert(snapshot.nurseHours),
      client.from('inventory_movements').upsert(snapshot.inventoryMovements), client.from('shifts').upsert(snapshot.shifts), client.from('hospitalizations').upsert(snapshot.hospitalizations), client.from('quotes').upsert(snapshot.quotes), client.from('audit_log').upsert(snapshot.auditEntries),
    ]);
    const failed = results.find((result) => result.error);
    if (failed?.error) throw new Error(`No fue posible persistir datos en Supabase: ${failed.error.message}`);
  }
}

export function createDataProvider(): DataProvider {
  return getSupabaseBrowserClient() ? new SupabaseDataProvider() : new MockDataProvider();
}
