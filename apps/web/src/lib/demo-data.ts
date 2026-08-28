import type {
  InventoryMovement,
  NurseHourEntry,
  NursingResource,
  Patient,
  VitalReading,
} from '@analiza/contracts';

export const demoPatients: Patient[] = [
  {
    id: 'patient-demo-001',
    fullName: 'Paciente Demo Aurora',
    documentType: 'DUI',
    documentId: '12345678-9',
    phone: '0000-0000',
    insurer: 'Aseguradora de demostración',
  },
  {
    id: 'patient-demo-002',
    fullName: 'Paciente Demo Brisa',
    documentType: 'OTHER',
    documentId: 'DEMO-002',
    insurer: 'Sin aseguradora registrada',
  },
];

export const demoVitalReadings: VitalReading[] = [
  {
    id: 'vital-demo-001',
    patientId: 'patient-demo-001',
    measuredAt: '2026-08-28T08:00:00.000Z',
    source: 'clinical',
    systolic: 118,
    diastolic: 76,
    pulse: 72,
    temperature: 36.8,
    oxygenSaturation: 98,
    note: 'Registro sintético de QA.',
  },
];

export const demoNursingResources: NursingResource[] = [
  {
    id: 'nurse-demo-001',
    displayName: 'Enfermería Demo Norte',
    territory: 'Zona demo norte',
    shift: 'MORNING',
    availability: 'AVAILABLE',
    capacity: 3,
  },
  {
    id: 'nurse-demo-002',
    displayName: 'Enfermería Demo Centro',
    territory: 'Zona demo centro',
    shift: 'AFTERNOON',
    availability: 'ASSIGNED',
    capacity: 1,
  },
];

export const demoNurseHours: NurseHourEntry[] = [
  {
    id: 'hours-demo-001',
    resourceId: 'nurse-demo-001',
    date: '2026-08-28',
    hours: 6,
    service: 'Visita demo',
  },
  {
    id: 'hours-demo-002',
    resourceId: 'nurse-demo-002',
    date: '2026-08-28',
    hours: 4,
    service: 'Cobertura demo',
  },
];

export const demoInventoryMovements: InventoryMovement[] = [
  {
    id: 'movement-demo-001',
    itemId: 'inventory-demo-kit',
    createdAt: '2026-08-27T08:00:00.000Z',
    kind: 'ENTRY',
    quantity: 12,
    reason: 'Carga inicial sintética',
  },
  {
    id: 'movement-demo-002',
    itemId: 'inventory-demo-kit',
    createdAt: '2026-08-28T08:00:00.000Z',
    kind: 'EXIT',
    quantity: 2,
    reason: 'Salida demo auditada',
  },
];
