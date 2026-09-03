'use client';

import type {
  CatalogItem,
  ClinicalDocument,
  Doctor,
  Hospitalization,
  InsuranceEvent,
  InsuranceRequest,
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
import { calculateQuoteTotals, normalizeQuoteInvoiceMetadata } from '@analiza/domain';
import { getSupabaseBrowserClient } from '@/lib/supabase';
import {
  demoInventoryMovements,
  demoHospitalizations,
  demoQuotes,
  demoPayments,
  demoClinicalDocuments,
  demoDoctors,
  demoCatalogItems,
  demoPurchases,
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
  doctors: Doctor[];
  nurseHours: NurseHourEntry[];
  inventoryMovements: InventoryMovement[];
  shifts: Shift[];
  hospitalizations: Hospitalization[];
  quotes: Quote[];
  payments: Payment[];
  clinicalDocuments: ClinicalDocument[];
  catalogItems: CatalogItem[];
  purchases: Purchase[];
  insuranceRequests: InsuranceRequest[];
  insuranceEvents: InsuranceEvent[];
  auditEntries: AuditEntry[];
};

export const defaultSnapshot = (): WorkspaceSnapshot => ({
  patients: demoPatients,
  vitalReadings: demoVitalReadings,
  nursingResources: demoNursingResources,
  doctors: demoDoctors,
  nurseHours: demoNurseHours,
  inventoryMovements: demoInventoryMovements,
  shifts: demoShifts,
  hospitalizations: demoHospitalizations,
  quotes: demoQuotes,
  payments: demoPayments,
  clinicalDocuments: demoClinicalDocuments,
  catalogItems: demoCatalogItems,
  purchases: demoPurchases,
  insuranceRequests: [],
  insuranceEvents: [],
  auditEntries: [
    {
      id: 'audit-demo-001',
      at: '2026-08-28T08:00:00.000Z',
      action: 'Demo iniciado',
      subject: 'Aplicación React',
    },
  ],
});

/** Migrates locally persisted quote records from the earlier, minimal React
 * contract. This keeps mock reloads backward compatible while calculation
 * fields remain derived rather than trusted from browser storage. */
export function normalizeQuote(quote: Quote): Quote {
  const items = Array.isArray(quote.items) ? quote.items : [];
  const insurerAmount = quote.insurerAmount ?? 0;
  try {
    const totals = calculateQuoteTotals(items, quote.discount, insurerAmount);
    return {
      ...quote,
      ...normalizeQuoteInvoiceMetadata(quote),
      comments: quote.comments ?? undefined,
      items,
      ...totals,
      immutable: quote.immutable ?? quote.status === 'SENT',
      rootQuoteId: quote.rootQuoteId ?? quote.originalQuoteId ?? quote.id,
      originalQuoteId: quote.originalQuoteId ?? quote.rootQuoteId ?? quote.id,
    };
  } catch {
    return {
      ...quote,
      ...normalizeQuoteInvoiceMetadata(quote),
      comments: quote.comments ?? undefined,
      items: [],
      subtotal: 0,
      discountAmount: 0,
      total: 0,
      insurerAmount: 0,
      patientAmount: 0,
      immutable: quote.immutable ?? quote.status === 'SENT',
      rootQuoteId: quote.rootQuoteId ?? quote.originalQuoteId ?? quote.id,
      originalQuoteId: quote.originalQuoteId ?? quote.rootQuoteId ?? quote.id,
    };
  }
}

export interface DataProvider {
  readonly mode: 'mock' | 'supabase';
  load(): Promise<WorkspaceSnapshot>;
  saveChanges(changes: Partial<WorkspaceSnapshot>): Promise<void>;
}

/**
 * Execution profiles use the audited `start_administrative_execution` RPC,
 * not a JSON field on `public.hospitalizations`.  Keeping this guard at the
 * provider boundary prevents a future caller from accidentally turning a
 * mock-only profile into an optimistic, unsupported table upsert.
 */
export function hasAdministrativeProfilePayload(
  hospitalizations: readonly Hospitalization[],
): boolean {
  return hospitalizations.some((hospitalization) =>
    Object.hasOwn(hospitalization, 'administrativeProfile'),
  );
}

const storageKey = 'analiza.en.casa.workspace.v2';
const storagePrefix = 'analiza.en.casa.workspace.v3.';
const workspaceKeys = [
  'patients',
  'vitalReadings',
  'nursingResources',
  'doctors',
  'nurseHours',
  'inventoryMovements',
  'shifts',
  'hospitalizations',
  'quotes',
  'payments',
  'clinicalDocuments',
  'catalogItems',
  'purchases',
  'insuranceRequests',
  'insuranceEvents',
  'auditEntries',
] as const satisfies ReadonlyArray<keyof WorkspaceSnapshot>;

export class MockDataProvider implements DataProvider {
  readonly mode = 'mock' as const;
  private queue: Promise<void> = Promise.resolve();
  async load(): Promise<WorkspaceSnapshot> {
    if (typeof window === 'undefined') return defaultSnapshot();
    try {
      const segmented = workspaceKeys.map((key) =>
        window.localStorage.getItem(`${storagePrefix}${key}`),
      );
      if (segmented.some(Boolean)) {
        const fallback = defaultSnapshot();
        const next = { ...fallback } as WorkspaceSnapshot;
        workspaceKeys.forEach((key, index) => {
          if (segmented[index]) next[key] = JSON.parse(segmented[index]);
        });
        return {
          ...next,
          doctors: Array.isArray(next.doctors) ? next.doctors : [],
          patients: next.patients.map((patient) => ({
            ...patient,
            status: patient.status ?? 'ACTIVE',
            retired: patient.retired ?? false,
            contacts: patient.contacts ?? [],
          })),
          quotes: next.quotes.map(normalizeQuote),
        };
      }
      const saved = window.localStorage.getItem(storageKey);
      if (!saved) return defaultSnapshot();
      const parsed = JSON.parse(saved) as WorkspaceSnapshot;
      if (
        !Array.isArray(parsed.patients) ||
        !Array.isArray(parsed.auditEntries) ||
        !Array.isArray(parsed.shifts) ||
        !Array.isArray(parsed.hospitalizations) ||
        !Array.isArray(parsed.quotes) ||
        !Array.isArray(parsed.payments) ||
        !Array.isArray(parsed.clinicalDocuments) ||
        !Array.isArray(parsed.catalogItems) ||
        !Array.isArray(parsed.purchases)
      )
        throw new Error('invalid');
      const migrated = {
        ...parsed,
        patients: parsed.patients.map((patient) => ({
          ...patient,
          status: patient.status ?? 'ACTIVE',
          retired: patient.retired ?? false,
          contacts: patient.contacts ?? [],
        })),
        quotes: parsed.quotes.map(normalizeQuote),
        doctors: Array.isArray(parsed.doctors) ? parsed.doctors : [],
        insuranceRequests: Array.isArray(parsed.insuranceRequests) ? parsed.insuranceRequests : [],
        insuranceEvents: Array.isArray(parsed.insuranceEvents) ? parsed.insuranceEvents : [],
      };
      await this.saveChanges(migrated);
      window.localStorage.removeItem(storageKey);
      return migrated;
    } catch {
      return defaultSnapshot();
    }
  }
  async saveChanges(changes: Partial<WorkspaceSnapshot>): Promise<void> {
    const task = this.queue.then(() => {
      for (const key of workspaceKeys) {
        const value = changes[key];
        if (value !== undefined)
          window.localStorage.setItem(`${storagePrefix}${key}`, JSON.stringify(value));
      }
    });
    this.queue = task.catch(() => undefined);
    return task;
  }
}

export class SupabaseDataProvider implements DataProvider {
  readonly mode = 'supabase' as const;
  constructor(
    private readonly clientFactory: typeof getSupabaseBrowserClient = getSupabaseBrowserClient,
  ) {}
  private client() {
    const client = this.clientFactory();
    if (!client)
      throw new Error(
        'Supabase no está configurado; no se permite usar datos mock como reemplazo.',
      );
    return client;
  }
  async load(): Promise<WorkspaceSnapshot> {
    const client = this.client();
    const [
      patients,
      vitalReadings,
      nursingResources,
      nurseHours,
      inventoryMovements,
      shifts,
      hospitalizations,
      quotes,
      payments,
      clinicalDocuments,
      catalogItems,
      purchases,
      insuranceRequests,
      insuranceEvents,
      auditEntries,
    ] = await Promise.all([
      client.from('patients').select('*'),
      client.from('vital_readings').select('*'),
      client.from('nursing_resources').select('*'),
      client.from('nurse_hour_entries').select('*'),
      client.from('inventory_movements').select('*'),
      client.from('shifts').select('*'),
      client.from('hospitalizations').select('*'),
      client.from('quotes').select('*'),
      client.from('payments').select('*'),
      client.from('clinical_documents').select('*'),
      client.from('catalog_items').select('*'),
      client.from('purchases').select('*'),
      client.from('insurance_requests').select('*'),
      client.from('insurance_request_events').select('*'),
      client.from('audit_log').select('*'),
    ]);
    const failed = [
      patients,
      vitalReadings,
      nursingResources,
      nurseHours,
      inventoryMovements,
      shifts,
      hospitalizations,
      quotes,
      payments,
      clinicalDocuments,
      catalogItems,
      purchases,
      insuranceRequests,
      insuranceEvents,
      auditEntries,
    ].find((result) => result.error);
    if (failed?.error)
      throw new Error(`No fue posible cargar datos de Supabase: ${failed.error.message}`);
    return {
      patients: (patients.data ?? []) as Patient[],
      vitalReadings: (vitalReadings.data ?? []) as VitalReading[],
      nursingResources: (nursingResources.data ?? []) as NursingResource[],
      nurseHours: (nurseHours.data ?? []) as NurseHourEntry[],
      doctors: [],
      inventoryMovements: (inventoryMovements.data ?? []) as InventoryMovement[],
      auditEntries: (auditEntries.data ?? []) as AuditEntry[],
      shifts: (shifts.data ?? []) as Shift[],
      hospitalizations: (hospitalizations.data ?? []) as Hospitalization[],
      quotes: ((quotes.data ?? []) as Quote[]).map(normalizeQuote),
      payments: (payments.data ?? []) as Payment[],
      clinicalDocuments: (clinicalDocuments.data ?? []) as ClinicalDocument[],
      catalogItems: (catalogItems.data ?? []) as CatalogItem[],
      purchases: (purchases.data ?? []) as Purchase[],
      insuranceRequests: (insuranceRequests.data ?? []) as InsuranceRequest[],
      insuranceEvents: (insuranceEvents.data ?? []) as InsuranceEvent[],
    };
  }
  async saveChanges(changes: Partial<WorkspaceSnapshot>): Promise<void> {
    if (changes.hospitalizations && hasAdministrativeProfilePayload(changes.hospitalizations)) {
      throw new Error(
        'El perfil administrativo de ejecuciÃ³n requiere la RPC segura y no se envÃ­a mediante hospitalizations.',
      );
    }
    const client = this.client();
    const writes = [];
    if (changes.patients) writes.push(client.from('patients').upsert(changes.patients));
    if (changes.vitalReadings)
      writes.push(client.from('vital_readings').upsert(changes.vitalReadings));
    if (changes.nursingResources)
      writes.push(client.from('nursing_resources').upsert(changes.nursingResources));
    if (changes.doctors)
      throw new Error(
        'El registro de médicos requiere la integración segura de Supabase pendiente.',
      );
    if (changes.nurseHours)
      writes.push(client.from('nurse_hour_entries').upsert(changes.nurseHours));
    if (changes.inventoryMovements)
      writes.push(client.from('inventory_movements').upsert(changes.inventoryMovements));
    if (changes.shifts) writes.push(client.from('shifts').upsert(changes.shifts));
    if (changes.hospitalizations)
      writes.push(client.from('hospitalizations').upsert(changes.hospitalizations));
    if (changes.quotes) writes.push(client.from('quotes').upsert(changes.quotes));
    if (changes.payments) writes.push(client.from('payments').upsert(changes.payments));
    if (changes.clinicalDocuments)
      writes.push(client.from('clinical_documents').upsert(changes.clinicalDocuments));
    if (changes.catalogItems)
      writes.push(client.from('catalog_items').upsert(changes.catalogItems));
    if (changes.purchases) writes.push(client.from('purchases').upsert(changes.purchases));
    if (changes.auditEntries) writes.push(client.from('audit_log').upsert(changes.auditEntries));
    const results = await Promise.all(writes);
    const failed = results.find((result) => result.error);
    if (failed?.error)
      throw new Error(`No fue posible persistir datos en Supabase: ${failed.error.message}`);
  }
}

export function createDataProvider(): DataProvider {
  return getSupabaseBrowserClient() ? new SupabaseDataProvider() : new MockDataProvider();
}
