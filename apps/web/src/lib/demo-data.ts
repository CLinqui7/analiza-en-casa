import type {
  InventoryMovement,
  NurseHourEntry,
  NursingResource,
  Doctor,
  Patient,
  VitalReading,
  Shift,
  Hospitalization,
  Quote,
  Payment,
  ClinicalDocument,
  CatalogItem,
  Purchase,
} from '@analiza/contracts';

export const demoPatients: Patient[] = [
  {
    id: 'patient-demo-001',
    fullName: 'Paciente Demo Aurora',
    documentType: 'DUI',
    documentId: '12345678-9',
    phone: '0000-0000',
    email: 'aurora.demo@example.test',
    insurer: 'Aseguradora de demostración',
    status: 'ACTIVE',
  },
  {
    id: 'patient-demo-002',
    fullName: 'Paciente Demo Brisa',
    documentType: 'OTHER',
    documentId: 'DEMO-002',
    insurer: 'Sin aseguradora registrada',
    status: 'INACTIVE',
  },
  {
    id: 'patient-demo-003',
    fullName: 'Paciente Demo Celeste',
    documentType: 'OTHER',
    documentId: 'DEMO-003',
    phone: '7000-0003',
    insurer: 'Aseguradora de demostración',
    status: 'ACTIVE',
  },
  {
    id: 'patient-demo-004',
    fullName: 'Paciente Demo Dalia',
    documentType: 'OTHER',
    documentId: 'DEMO-004',
    phone: '7000-0004',
    status: 'ACTIVE',
  },
  {
    id: 'patient-demo-005',
    fullName: 'Paciente Demo Estela',
    documentType: 'OTHER',
    documentId: 'DEMO-005',
    phone: '7000-0005',
    status: 'ACTIVE',
  },
  {
    id: 'patient-demo-006',
    fullName: 'Paciente Demo Fabián',
    documentType: 'OTHER',
    documentId: 'DEMO-006',
    phone: '7000-0006',
    status: 'ACTIVE',
  },
  {
    id: 'patient-demo-007',
    fullName: 'Paciente Demo Gloria',
    documentType: 'OTHER',
    documentId: 'DEMO-007',
    phone: '7000-0007',
    status: 'ACTIVE',
  },
  {
    id: 'patient-demo-008',
    fullName: 'Paciente Demo Héctor',
    documentType: 'OTHER',
    documentId: 'DEMO-008',
    phone: '7000-0008',
    status: 'ACTIVE',
  },
  {
    id: 'patient-demo-009',
    fullName: 'Paciente Demo Iris',
    documentType: 'OTHER',
    documentId: 'DEMO-009',
    phone: '7000-0009',
    status: 'ACTIVE',
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
    boardRegistrationNumber: 'REG-DEMO-001',
  },
  {
    id: 'nurse-demo-002',
    displayName: 'Enfermería Demo Centro',
    territory: 'Zona demo centro',
    shift: 'AFTERNOON',
    availability: 'ASSIGNED',
    capacity: 1,
    boardRegistrationNumber: 'REG-DEMO-002',
  },
];

export const demoDoctors: Doctor[] = [];

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

export const demoShifts: Shift[] = [
  {
    id: 'shift-demo-001',
    resourceId: 'nurse-demo-001',
    patientId: 'patient-demo-001',
    startsAt: '2026-08-28T08:00:00.000Z',
    endsAt: '2026-08-28T14:00:00.000Z',
    status: 'SCHEDULED',
    note: 'Turno sintético de QA.',
  },
  {
    id: 'shift-demo-002',
    resourceId: 'nurse-demo-002',
    patientId: 'patient-demo-002',
    startsAt: '2026-08-28T14:00:00.000Z',
    endsAt: '2026-08-28T18:00:00.000Z',
    status: 'CANCELLED',
    note: 'Cancelación sintética de QA.',
  },
];

export const demoHospitalizations: Hospitalization[] = [
  {
    id: 'case-demo-001',
    patientId: 'patient-demo-001',
    startDate: '2026-08-28',
    status: 'ACTIVE',
    accountType: 'Referencia sintética',
    nextAction: 'Validar coordinación demo',
  },
];

export const demoQuotes: Quote[] = [
  {
    id: 'quote-demo-001',
    caseId: 'case-demo-001',
    patientId: 'patient-demo-001',
    version: 1,
    status: 'DRAFT',
    summary: 'Cotización sintética de coordinación.',
    comments: 'Valores manuales de demostración; no representan tarifas oficiales.',
    items: [
      {
        id: 'quote-item-demo-001',
        category: 'SERVICES',
        name: 'Servicio sintético de demostración',
        quantity: 1,
        unitPrice: 100,
        discountAmount: 0,
      },
    ],
    subtotal: 100,
    discountAmount: 0,
    total: 100,
    insurerAmount: 0,
    patientAmount: 100,
    immutable: false,
    createdAt: '2026-08-28T08:00:00.000Z',
  },
];

export const demoPayments: Payment[] = [];

export const demoClinicalDocuments: ClinicalDocument[] = [];

export const demoCatalogItems: CatalogItem[] = [
  {
    id: 'catalog-demo-kit',
    sku: 'KIT-DEMO-001',
    name: 'Kit operativo demo',
    status: 'ACTIVE',
    createdAt: '2026-08-28T08:00:00.000Z',
  },
  {
    id: 'catalog-demo-supplies',
    sku: 'INS-DEMO-001',
    name: 'Insumos demo',
    status: 'ACTIVE',
    createdAt: '2026-08-28T08:00:00.000Z',
  },
];

export const demoPurchases: Purchase[] = [];

export const demoInventoryMovements: InventoryMovement[] = [
  {
    id: 'movement-demo-001',
    itemId: 'inventory-demo-kit',
    createdAt: '2026-08-27T08:00:00.000Z',
    kind: 'ENTRY',
    quantity: 12,
    reason: 'Carga inicial sintética',
    warehouseId: 'warehouse-demo-central',
    reference: 'INIT-001',
    user: 'Inventario Demo',
  },
  {
    id: 'movement-demo-002',
    itemId: 'inventory-demo-kit',
    createdAt: '2026-08-28T08:00:00.000Z',
    kind: 'EXIT',
    quantity: 2,
    reason: 'Salida demo auditada',
    warehouseId: 'warehouse-demo-central',
    reference: 'OUT-001',
    user: 'Inventario Demo',
  },
  {
    id: 'movement-demo-003',
    itemId: 'inventory-demo-supplies',
    createdAt: '2026-08-28T07:00:00.000Z',
    kind: 'ENTRY',
    quantity: 30,
    reason: 'Carga inicial de insumos sintéticos',
    warehouseId: 'warehouse-demo-north',
    reference: 'INIT-002',
    user: 'Inventario Demo',
  },
];
