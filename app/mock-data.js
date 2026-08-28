export const seedData = {
  "meta": {
    "schemaVersion": 1,
    "seedVersion": "2026.08.26",
    "generatedAt": "2026-08-26T00:00:00Z",
    "dataClassification": "SYNTHETIC_DEMO"
  },
  "organization": {
    "id": "ORG-001",
    "name": "Analiza en Casa",
    "slug": "analiza-en-casa-demo",
    "currency": "USD",
    "timezone": "America/El_Salvador"
  },
  "session": {
    "authenticated": false,
    "userId": "USR-001",
    "role": "ADMIN"
  },
  "users": [
    {
      "id": "USR-001",
      "name": "Mariana Torres",
      "email": "admin@analiza.demo",
      "role": "ADMIN",
      "status": "ACTIVE"
    },
    {
      "id": "USR-002",
      "name": "Dra. Valeria Núñez",
      "email": "medico@analiza.demo",
      "role": "DOCTOR",
      "status": "ACTIVE"
    },
    {
      "id": "USR-003",
      "name": "Lic. Sofía Duarte",
      "email": "enfermeria@analiza.demo",
      "role": "NURSE",
      "status": "ACTIVE"
    },
    {
      "id": "USR-004",
      "name": "Lic. Mateo Salazar",
      "email": "enfermeria2@analiza.demo",
      "role": "NURSE",
      "status": "ACTIVE"
    },
    {
      "id": "USR-005",
      "name": "Diego Ramírez",
      "email": "inventario@analiza.demo",
      "role": "INVENTORY",
      "status": "ACTIVE"
    },
    {
      "id": "USR-006",
      "name": "Paola Méndez",
      "email": "finanzas@analiza.demo",
      "role": "FINANCE",
      "status": "ACTIVE"
    },
    {
      "id": "USR-007",
      "name": "Auditor Demo",
      "email": "auditoria@analiza.demo",
      "role": "AUDITOR",
      "status": "ACTIVE"
    }
  ],
  "insurers": [
    {
      "id": "INS-001",
      "name": "Aseguradora Horizonte",
      "contactName": "Laura Campos",
      "phone": "+503 2200-1000",
      "email": "preautorizaciones@horizonte.demo",
      "status": "ACTIVE"
    },
    {
      "id": "INS-002",
      "name": "Seguros Vida Integral",
      "contactName": "Mario Rivas",
      "phone": "+503 2200-2000",
      "email": "salud@vidaintegral.demo",
      "status": "ACTIVE"
    },
    {
      "id": "INS-003",
      "name": "Protección Médica Regional",
      "contactName": "Sonia Aguilar",
      "phone": "+503 2200-3000",
      "email": "autorizaciones@pmr.demo",
      "status": "ACTIVE"
    }
  ],
  "insurancePlans": [
    {
      "id": "PLAN-001",
      "insurerId": "INS-001",
      "name": "Hogar Plus",
      "coverageNote": "Cobertura registrada manualmente según carta de aprobación.",
      "status": "ACTIVE"
    },
    {
      "id": "PLAN-002",
      "insurerId": "INS-001",
      "name": "Hogar Senior",
      "coverageNote": "Requiere preautorización y resumen clínico.",
      "status": "ACTIVE"
    },
    {
      "id": "PLAN-003",
      "insurerId": "INS-002",
      "name": "Integral Familiar",
      "coverageNote": "Cobertura por evento; validar deducible.",
      "status": "ACTIVE"
    },
    {
      "id": "PLAN-004",
      "insurerId": "INS-003",
      "name": "Regional Oro",
      "coverageNote": "Cobertura regional con carta de garantía.",
      "status": "ACTIVE"
    },
    {
      "id": "PLAN-005",
      "insurerId": "INS-003",
      "name": "Regional Plata",
      "coverageNote": "Copago variable registrado manualmente.",
      "status": "ACTIVE"
    }
  ],
  "patients": [
    {
      "id": "PAT-001",
      "documentType": "DUI",
      "document": "00000000-1",
      "firstName": "Elena",
      "lastName": "Morales",
      "fullName": "Elena Morales",
      "birthDate": "1958-04-12",
      "sex": "F",
      "bloodType": "O+",
      "nationality": "Salvadoreña",
      "phone": "+503 7000-1001",
      "email": "elena.demo@example.com",
      "address": "Colonia Escalón, San Salvador",
      "geo": "13.7012,-89.2308",
      "triage": "ALTA",
      "status": "ACTIVE",
      "insurerId": "INS-001",
      "planId": "PLAN-001",
      "policy": "POL-DEMO-1488",
      "policyValidUntil": "2027-03-31",
      "contactName": "Daniel Morales",
      "contactPhone": "+503 7000-2001",
      "notifyWhatsApp": true,
      "notifySms": false,
      "notifyEmail": true
    },
    {
      "id": "PAT-002",
      "documentType": "DUI",
      "document": "00000000-2",
      "firstName": "Roberto",
      "lastName": "Cáceres",
      "fullName": "Roberto Cáceres",
      "birthDate": "1972-09-27",
      "sex": "M",
      "bloodType": "A+",
      "nationality": "Salvadoreña",
      "phone": "+503 7000-1002",
      "email": "roberto.demo@example.com",
      "address": "Santa Tecla, La Libertad",
      "geo": "13.6731,-89.2899",
      "triage": "MEDIA",
      "status": "ACTIVE",
      "insurerId": "INS-002",
      "planId": "PLAN-003",
      "policy": "POL-DEMO-2184",
      "policyValidUntil": "2026-12-31",
      "contactName": "Marina Cáceres",
      "contactPhone": "+503 7000-2002",
      "notifyWhatsApp": true,
      "notifySms": true,
      "notifyEmail": false
    },
    {
      "id": "PAT-003",
      "documentType": "Pasaporte",
      "document": "P-DEMO-003",
      "firstName": "Claudia",
      "lastName": "Valdés",
      "fullName": "Claudia Valdés",
      "birthDate": "1985-01-18",
      "sex": "F",
      "bloodType": "B+",
      "nationality": "Guatemalteca",
      "phone": "+503 7000-1003",
      "email": "claudia.demo@example.com",
      "address": "Antiguo Cuscatlán, La Libertad",
      "geo": "13.6649,-89.2537",
      "triage": "BAJA",
      "status": "ACTIVE",
      "insurerId": "INS-003",
      "planId": "PLAN-004",
      "policy": "POL-DEMO-3021",
      "policyValidUntil": "2027-01-15",
      "contactName": "Sofía Valdés",
      "contactPhone": "+503 7000-2003",
      "notifyWhatsApp": true,
      "notifySms": false,
      "notifyEmail": true
    },
    {
      "id": "PAT-004",
      "documentType": "DUI",
      "document": "00000000-4",
      "firstName": "Jorge",
      "lastName": "Mena",
      "fullName": "Jorge Mena",
      "birthDate": "1949-11-05",
      "sex": "M",
      "bloodType": "AB+",
      "nationality": "Salvadoreña",
      "phone": "+503 7000-1004",
      "email": "jorge.demo@example.com",
      "address": "Soyapango, San Salvador",
      "geo": "13.7102,-89.1411",
      "triage": "ALTA",
      "status": "ACTIVE",
      "insurerId": "INS-001",
      "planId": "PLAN-002",
      "policy": "POL-DEMO-4010",
      "policyValidUntil": "2026-10-31",
      "contactName": "Carolina Mena",
      "contactPhone": "+503 7000-2004",
      "notifyWhatsApp": true,
      "notifySms": true,
      "notifyEmail": false
    },
    {
      "id": "PAT-005",
      "documentType": "DUI",
      "document": "00000000-5",
      "firstName": "María",
      "lastName": "Figueroa",
      "fullName": "María Figueroa",
      "birthDate": "1966-06-22",
      "sex": "F",
      "bloodType": "O-",
      "nationality": "Salvadoreña",
      "phone": "+503 7000-1005",
      "email": "maria.demo@example.com",
      "address": "San Benito, San Salvador",
      "geo": "13.6900,-89.2417",
      "triage": "MEDIA",
      "status": "ACTIVE",
      "insurerId": null,
      "planId": null,
      "policy": "",
      "policyValidUntil": "",
      "contactName": "Luis Figueroa",
      "contactPhone": "+503 7000-2005",
      "notifyWhatsApp": true,
      "notifySms": false,
      "notifyEmail": true
    },
    {
      "id": "PAT-006",
      "documentType": "DUI",
      "document": "00000000-6",
      "firstName": "Óscar",
      "lastName": "Pineda",
      "fullName": "Óscar Pineda",
      "birthDate": "1991-03-09",
      "sex": "M",
      "bloodType": "A-",
      "nationality": "Salvadoreña",
      "phone": "+503 7000-1006",
      "email": "oscar.demo@example.com",
      "address": "Mejicanos, San Salvador",
      "geo": "13.7401,-89.2132",
      "triage": "BAJA",
      "status": "INACTIVE",
      "insurerId": "INS-002",
      "planId": "PLAN-003",
      "policy": "POL-DEMO-6092",
      "policyValidUntil": "2026-09-30",
      "contactName": "Ana Pineda",
      "contactPhone": "+503 7000-2006",
      "notifyWhatsApp": false,
      "notifySms": false,
      "notifyEmail": true
    },
    {
      "id": "PAT-007",
      "documentType": "DUI",
      "document": "00000000-7",
      "firstName": "Patricia",
      "lastName": "Reyes",
      "fullName": "Patricia Reyes",
      "birthDate": "1978-12-30",
      "sex": "F",
      "bloodType": "B-",
      "nationality": "Salvadoreña",
      "phone": "+503 7000-1007",
      "email": "patricia.demo@example.com",
      "address": "Nuevo Cuscatlán, La Libertad",
      "geo": "13.6467,-89.2640",
      "triage": "MEDIA",
      "status": "ACTIVE",
      "insurerId": "INS-003",
      "planId": "PLAN-005",
      "policy": "POL-DEMO-7711",
      "policyValidUntil": "2027-05-31",
      "contactName": "René Reyes",
      "contactPhone": "+503 7000-2007",
      "notifyWhatsApp": true,
      "notifySms": true,
      "notifyEmail": true
    },
    {
      "id": "PAT-008",
      "documentType": "DUI",
      "document": "00000000-8",
      "firstName": "Fernando",
      "lastName": "López",
      "fullName": "Fernando López",
      "birthDate": "1954-08-17",
      "sex": "M",
      "bloodType": "O+",
      "nationality": "Salvadoreña",
      "phone": "+503 7000-1008",
      "email": "fernando.demo@example.com",
      "address": "San Marcos, San Salvador",
      "geo": "13.6582,-89.1831",
      "triage": "ALTA",
      "status": "ACTIVE",
      "insurerId": "INS-001",
      "planId": "PLAN-001",
      "policy": "POL-DEMO-8099",
      "policyValidUntil": "2027-02-28",
      "contactName": "Lucía López",
      "contactPhone": "+503 7000-2008",
      "notifyWhatsApp": true,
      "notifySms": false,
      "notifyEmail": true
    }
  ],
  "cases": [
    {
      "id": "HOS-2026-0190",
      "patientId": "PAT-001",
      "accountType": "SEGURO",
      "insurerId": "INS-001",
      "manager": "Andrea Mejía",
      "startDate": "2026-08-18",
      "endDate": "",
      "status": "ACTIVE",
      "priority": "ALTA",
      "diagnosisSummary": "Recuperación posoperatoria con atención domiciliar.",
      "contractingDoctorId": "DOC-001",
      "nextAction": "Adjuntar carta de aprobación y programar enfermería.",
      "supervisors": [
        "USR-003"
      ],
      "devices": [
        "Catéter venoso periférico"
      ],
      "createdAt": "2026-08-18T14:20:00Z"
    },
    {
      "id": "HOS-2026-0191",
      "patientId": "PAT-002",
      "accountType": "SEGURO",
      "insurerId": "INS-002",
      "manager": "Andrea Mejía",
      "startDate": "2026-08-20",
      "endDate": "",
      "status": "ACTIVE",
      "priority": "MEDIA",
      "diagnosisSummary": "Terapia intravenosa y seguimiento médico.",
      "contractingDoctorId": "DOC-002",
      "nextAction": "Esperar respuesta de aseguradora.",
      "supervisors": [
        "USR-003"
      ],
      "devices": [
        "Bomba de infusión"
      ],
      "createdAt": "2026-08-20T09:10:00Z"
    },
    {
      "id": "HOS-2026-0192",
      "patientId": "PAT-003",
      "accountType": "PRIVADO",
      "insurerId": null,
      "manager": "Carlos Sandoval",
      "startDate": "2026-08-21",
      "endDate": "",
      "status": "ACTIVE",
      "priority": "BAJA",
      "diagnosisSummary": "Curaciones y control de herida.",
      "contractingDoctorId": "DOC-003",
      "nextAction": "Confirmar primer turno.",
      "supervisors": [
        "USR-004"
      ],
      "devices": [],
      "createdAt": "2026-08-21T11:45:00Z"
    },
    {
      "id": "HOS-2026-0193",
      "patientId": "PAT-004",
      "accountType": "SEGURO",
      "insurerId": "INS-001",
      "manager": "Carlos Sandoval",
      "startDate": "2026-08-14",
      "endDate": "",
      "status": "ACTIVE",
      "priority": "ALTA",
      "diagnosisSummary": "Cuidados paliativos y control de síntomas.",
      "contractingDoctorId": "DOC-001",
      "nextAction": "Registrar cierre parcial de inventario.",
      "supervisors": [
        "USR-003",
        "USR-004"
      ],
      "devices": [
        "Concentrador de oxígeno",
        "Sonda Foley"
      ],
      "createdAt": "2026-08-14T17:00:00Z"
    },
    {
      "id": "HOS-2026-0194",
      "patientId": "PAT-005",
      "accountType": "PRIVADO",
      "insurerId": null,
      "manager": "Andrea Mejía",
      "startDate": "2026-08-10",
      "endDate": "2026-08-23",
      "status": "PENDING_CLOSE",
      "priority": "MEDIA",
      "diagnosisSummary": "Antibioticoterapia domiciliar finalizada.",
      "contractingDoctorId": "DOC-002",
      "nextAction": "Revisar consumos y aprobar cierre total.",
      "supervisors": [
        "USR-003"
      ],
      "devices": [],
      "createdAt": "2026-08-10T10:00:00Z"
    },
    {
      "id": "HOS-2026-0195",
      "patientId": "PAT-007",
      "accountType": "SEGURO",
      "insurerId": "INS-003",
      "manager": "Carlos Sandoval",
      "startDate": "2026-08-24",
      "endDate": "",
      "status": "ACTIVE",
      "priority": "MEDIA",
      "diagnosisSummary": "Monitoreo y rehabilitación en domicilio.",
      "contractingDoctorId": "DOC-004",
      "nextAction": "Completar documentos solicitados por seguro.",
      "supervisors": [
        "USR-004"
      ],
      "devices": [
        "Monitor multiparámetro"
      ],
      "createdAt": "2026-08-24T08:30:00Z"
    }
  ],
  "catalogItems": [
    {
      "id": "CAT-SRV-001",
      "sku": "SRV-ENF-12",
      "category": "SERVICES",
      "name": "Enfermería domiciliar 12 horas",
      "unit": "turno",
      "price": 180.0,
      "cost": 125.0,
      "taxable": false,
      "requiresLot": false,
      "active": true
    },
    {
      "id": "CAT-SRV-002",
      "sku": "SRV-ENF-24",
      "category": "SERVICES",
      "name": "Enfermería domiciliar 24 horas",
      "unit": "día",
      "price": 330.0,
      "cost": 240.0,
      "taxable": false,
      "requiresLot": false,
      "active": true
    },
    {
      "id": "CAT-SRV-003",
      "sku": "SRV-CUR-01",
      "category": "SERVICES",
      "name": "Curación especializada",
      "unit": "visita",
      "price": 68.0,
      "cost": 38.0,
      "taxable": false,
      "requiresLot": false,
      "active": true
    },
    {
      "id": "CAT-EST-001",
      "sku": "EST-LAB-01",
      "category": "STUDIES",
      "name": "Hemograma completo",
      "unit": "estudio",
      "price": 28.5,
      "cost": 16.0,
      "taxable": false,
      "requiresLot": false,
      "active": true
    },
    {
      "id": "CAT-EST-002",
      "sku": "EST-RX-01",
      "category": "STUDIES",
      "name": "Radiografía portátil",
      "unit": "estudio",
      "price": 145.0,
      "cost": 98.0,
      "taxable": false,
      "requiresLot": false,
      "active": true
    },
    {
      "id": "CAT-MED-001",
      "sku": "MED-CEF-1G",
      "category": "MEDICATIONS",
      "name": "Ceftriaxona 1 g vial",
      "unit": "vial",
      "manufacturer": "Laboratorio sintético",
      "price": 14.8,
      "cost": 9.2,
      "taxable": true,
      "requiresLot": true,
      "active": true
    },
    {
      "id": "CAT-MED-002",
      "sku": "MED-ACET-500",
      "category": "MEDICATIONS",
      "name": "Acetaminofén 500 mg",
      "unit": "tableta",
      "manufacturer": "Laboratorio sintético",
      "price": 0.38,
      "cost": 0.16,
      "taxable": true,
      "requiresLot": true,
      "active": true
    },
    {
      "id": "CAT-MED-003",
      "sku": "MED-OND-4",
      "category": "MEDICATIONS",
      "name": "Ondansetrón 4 mg/2 ml",
      "unit": "ampolla",
      "manufacturer": "Laboratorio sintético",
      "price": 6.9,
      "cost": 4.1,
      "taxable": true,
      "requiresLot": true,
      "active": true
    },
    {
      "id": "CAT-INS-001",
      "sku": "INS-CAN-01",
      "category": "SUPPLIES",
      "name": "Kit de canalización",
      "unit": "kit",
      "manufacturer": "Fabricante sintético",
      "price": 29.0,
      "cost": 17.3,
      "taxable": true,
      "requiresLot": true,
      "active": true
    },
    {
      "id": "CAT-INS-002",
      "sku": "INS-GAS-10",
      "category": "SUPPLIES",
      "name": "Gasa estéril 10 x 10",
      "unit": "paquete",
      "manufacturer": "Fabricante sintético",
      "price": 3.2,
      "cost": 1.55,
      "taxable": true,
      "requiresLot": true,
      "active": true
    },
    {
      "id": "CAT-INS-003",
      "sku": "INS-GUA-M",
      "category": "SUPPLIES",
      "name": "Guante de examen talla M",
      "unit": "caja",
      "manufacturer": "Fabricante sintético",
      "price": 12.5,
      "cost": 7.9,
      "taxable": true,
      "requiresLot": true,
      "active": true
    },
    {
      "id": "CAT-EQP-001",
      "sku": "EQP-BOM-01",
      "category": "EQUIPMENT",
      "name": "Bomba de infusión",
      "unit": "día",
      "price": 42.0,
      "cost": 18.0,
      "taxable": true,
      "requiresLot": false,
      "active": true
    },
    {
      "id": "CAT-EQP-002",
      "sku": "EQP-OXI-01",
      "category": "EQUIPMENT",
      "name": "Concentrador de oxígeno",
      "unit": "día",
      "price": 35.0,
      "cost": 14.0,
      "taxable": true,
      "requiresLot": false,
      "active": true
    },
    {
      "id": "CAT-FEE-001",
      "sku": "HON-MED-01",
      "category": "FEES",
      "name": "Visita médica domiciliar",
      "professional": "Dra. Valeria Núñez",
      "unit": "visita",
      "price": 95.0,
      "cost": 75.0,
      "taxable": false,
      "requiresLot": false,
      "active": true
    },
    {
      "id": "CAT-FEE-002",
      "sku": "HON-SUP-01",
      "category": "FEES",
      "name": "Supervisión de enfermería",
      "professional": "Dr. Mauricio Peña",
      "unit": "visita",
      "price": 55.0,
      "cost": 36.0,
      "taxable": false,
      "requiresLot": false,
      "active": true
    },
    {
      "id": "CAT-EXT-001",
      "sku": "EXT-TRAS-01",
      "category": "EXTRAS",
      "name": "Traslado logístico zona metropolitana",
      "unit": "evento",
      "price": 22.0,
      "cost": 13.0,
      "taxable": true,
      "requiresLot": false,
      "active": true
    }
  ],
  "discountRules": [
    {
      "id": "DISC-001",
      "name": "Convenio Empresa Azul",
      "type": "PROFILE",
      "description": "Perfil sintético por categorías con aprobación configurada.",
      "calculationType": "CATEGORY_PERCENTAGES",
      "fixedAmount": 0,
      "categories": {
        "SERVICES": 15,
        "STUDIES": 10,
        "MEDICATIONS": 0,
        "SUPPLIES": 5,
        "EQUIPMENT": 10,
        "FEES": 0,
        "EXTRAS": 0
      },
      "requiresReason": true,
      "requiresApproval": true,
      "approverId": "USR-006",
      "eligibility": { "patientId": "", "insurerId": "", "companyName": "", "retireeOnly": false },
      "exclusions": ["MEDICATIONS", "FEES", "EXTRAS"],
      "maxAmount": null,
      "combinable": false,
      "active": true
    },
    {
      "id": "DISC-002",
      "name": "Paciente frecuente",
      "type": "PROFILE",
      "description": "Perfil sintético disponible para pruebas de cotización.",
      "calculationType": "CATEGORY_PERCENTAGES",
      "fixedAmount": 0,
      "categories": {
        "SERVICES": 10,
        "STUDIES": 5,
        "MEDICATIONS": 0,
        "SUPPLIES": 0,
        "EQUIPMENT": 0,
        "FEES": 0,
        "EXTRAS": 0
      },
      "requiresReason": true,
      "requiresApproval": false,
      "approverId": null,
      "eligibility": { "patientId": "", "insurerId": "", "companyName": "", "retireeOnly": false },
      "exclusions": ["MEDICATIONS", "SUPPLIES", "EQUIPMENT", "FEES", "EXTRAS"],
      "maxAmount": null,
      "combinable": false,
      "active": true
    },
    {
      "id": "DISC-003",
      "name": "Cortesía autorizada",
      "type": "MANUAL",
      "description": "Perfil sintético que exige solicitud y aprobación explícitas.",
      "calculationType": "CATEGORY_PERCENTAGES",
      "fixedAmount": 0,
      "categories": {
        "SERVICES": 20,
        "STUDIES": 20,
        "MEDICATIONS": 0,
        "SUPPLIES": 15,
        "EQUIPMENT": 15,
        "FEES": 10,
        "EXTRAS": 10
      },
      "requiresReason": true,
      "requiresApproval": true,
      "approverId": "USR-006",
      "eligibility": { "patientId": "", "insurerId": "", "companyName": "", "retireeOnly": false },
      "exclusions": ["MEDICATIONS"],
      "maxAmount": null,
      "combinable": false,
      "active": true
    }
  ],
  "quotes": [
    {
      "id": "QT-2026-0148",
      "caseId": "HOS-2026-0190",
      "patientId": "PAT-001",
      "status": "PARTIALLY_APPROVED",
      "version": 3,
      "currency": "USD",
      "items": [
        {
          "id": "QTI-148-1",
          "catalogItemId": "CAT-SRV-001",
          "category": "SERVICES",
          "name": "Enfermería domiciliar 12 horas",
          "quantity": 5,
          "unitPrice": 180,
          "discountAmount": 0
        },
        {
          "id": "QTI-148-2",
          "catalogItemId": "CAT-MED-001",
          "category": "MEDICATIONS",
          "name": "Ceftriaxona 1 g vial",
          "quantity": 10,
          "unitPrice": 14.8,
          "discountAmount": 0
        },
        {
          "id": "QTI-148-3",
          "catalogItemId": "CAT-INS-001",
          "category": "SUPPLIES",
          "name": "Kit de canalización",
          "quantity": 3,
          "unitPrice": 29,
          "discountAmount": 0
        },
        {
          "id": "QTI-148-4",
          "catalogItemId": "CAT-FEE-001",
          "category": "FEES",
          "name": "Visita médica domiciliar",
          "quantity": 2,
          "unitPrice": 95,
          "discountAmount": 0
        }
      ],
      "discount": {
        "type": "PERCENT",
        "value": 5,
        "reason": "Perfil autorizado"
      },
      "subtotal": 1325.0,
      "discountAmount": 66.25,
      "total": 1258.75,
      "insurerAmount": 900,
      "patientAmount": 358.75,
      "comments": "Datos ficticios para validación del flujo.",
      "createdAt": "2026-08-24T15:30:00Z",
      "sentAt": "2026-08-24T16:00:00Z",
      "portalToken": "demo-qt-2026-0148",
      "expiresAt": "2026-09-30T23:59:59Z"
    },
    {
      "id": "QT-2026-0147",
      "caseId": "HOS-2026-0191",
      "patientId": "PAT-002",
      "status": "INSURER_REVIEW",
      "version": 2,
      "currency": "USD",
      "items": [
        {
          "id": "QTI-147-1",
          "catalogItemId": "CAT-SRV-002",
          "category": "SERVICES",
          "name": "Enfermería domiciliar 24 horas",
          "quantity": 3,
          "unitPrice": 330,
          "discountAmount": 0
        },
        {
          "id": "QTI-147-2",
          "catalogItemId": "CAT-EQP-001",
          "category": "EQUIPMENT",
          "name": "Bomba de infusión",
          "quantity": 3,
          "unitPrice": 42,
          "discountAmount": 0
        },
        {
          "id": "QTI-147-3",
          "catalogItemId": "CAT-EST-001",
          "category": "STUDIES",
          "name": "Hemograma completo",
          "quantity": 2,
          "unitPrice": 28.5,
          "discountAmount": 0
        }
      ],
      "discount": {
        "type": "PERCENT",
        "value": 0,
        "reason": ""
      },
      "subtotal": 1173.0,
      "discountAmount": 0.0,
      "total": 1173.0,
      "insurerAmount": 0,
      "patientAmount": 1173.0,
      "comments": "Datos ficticios para validación del flujo.",
      "createdAt": "2026-08-24T15:30:00Z",
      "sentAt": "2026-08-24T16:00:00Z",
      "portalToken": "demo-qt-2026-0147",
      "expiresAt": "2026-09-30T23:59:59Z"
    },
    {
      "id": "QT-2026-0146",
      "caseId": "HOS-2026-0192",
      "patientId": "PAT-003",
      "status": "PATIENT_PAYMENT",
      "version": 1,
      "currency": "USD",
      "items": [
        {
          "id": "QTI-146-1",
          "catalogItemId": "CAT-SRV-003",
          "category": "SERVICES",
          "name": "Curación especializada",
          "quantity": 6,
          "unitPrice": 68,
          "discountAmount": 0
        },
        {
          "id": "QTI-146-2",
          "catalogItemId": "CAT-INS-002",
          "category": "SUPPLIES",
          "name": "Gasa estéril 10 x 10",
          "quantity": 12,
          "unitPrice": 3.2,
          "discountAmount": 0
        },
        {
          "id": "QTI-146-3",
          "catalogItemId": "CAT-EXT-001",
          "category": "EXTRAS",
          "name": "Traslado logístico zona metropolitana",
          "quantity": 2,
          "unitPrice": 22,
          "discountAmount": 0
        }
      ],
      "discount": {
        "type": "PERCENT",
        "value": 10,
        "reason": "Perfil autorizado"
      },
      "subtotal": 490.4,
      "discountAmount": 49.04,
      "total": 441.36,
      "insurerAmount": 0,
      "patientAmount": 441.36,
      "comments": "Datos ficticios para validación del flujo.",
      "createdAt": "2026-08-24T15:30:00Z",
      "sentAt": "2026-08-24T16:00:00Z",
      "portalToken": "demo-qt-2026-0146",
      "expiresAt": "2026-09-30T23:59:59Z"
    },
    {
      "id": "QT-2026-0145",
      "caseId": "HOS-2026-0193",
      "patientId": "PAT-004",
      "status": "APPROVED",
      "version": 4,
      "currency": "USD",
      "items": [
        {
          "id": "QTI-145-1",
          "catalogItemId": "CAT-SRV-002",
          "category": "SERVICES",
          "name": "Enfermería domiciliar 24 horas",
          "quantity": 7,
          "unitPrice": 330,
          "discountAmount": 0
        },
        {
          "id": "QTI-145-2",
          "catalogItemId": "CAT-EQP-002",
          "category": "EQUIPMENT",
          "name": "Concentrador de oxígeno",
          "quantity": 7,
          "unitPrice": 35,
          "discountAmount": 0
        },
        {
          "id": "QTI-145-3",
          "catalogItemId": "CAT-FEE-001",
          "category": "FEES",
          "name": "Visita médica domiciliar",
          "quantity": 3,
          "unitPrice": 95,
          "discountAmount": 0
        }
      ],
      "discount": {
        "type": "PERCENT",
        "value": 0,
        "reason": ""
      },
      "subtotal": 2840,
      "discountAmount": 0.0,
      "total": 2840.0,
      "insurerAmount": 2500,
      "patientAmount": 340.0,
      "comments": "Datos ficticios para validación del flujo.",
      "createdAt": "2026-08-24T15:30:00Z",
      "sentAt": "2026-08-24T16:00:00Z",
      "portalToken": "demo-qt-2026-0145",
      "expiresAt": "2026-09-30T23:59:59Z"
    },
    {
      "id": "QT-2026-0144",
      "caseId": "HOS-2026-0194",
      "patientId": "PAT-005",
      "status": "CLOSED",
      "version": 2,
      "currency": "USD",
      "items": [
        {
          "id": "QTI-144-1",
          "catalogItemId": "CAT-SRV-001",
          "category": "SERVICES",
          "name": "Enfermería domiciliar 12 horas",
          "quantity": 6,
          "unitPrice": 180,
          "discountAmount": 0
        },
        {
          "id": "QTI-144-2",
          "catalogItemId": "CAT-MED-001",
          "category": "MEDICATIONS",
          "name": "Ceftriaxona 1 g vial",
          "quantity": 14,
          "unitPrice": 14.8,
          "discountAmount": 0
        },
        {
          "id": "QTI-144-3",
          "catalogItemId": "CAT-INS-001",
          "category": "SUPPLIES",
          "name": "Kit de canalización",
          "quantity": 4,
          "unitPrice": 29,
          "discountAmount": 0
        }
      ],
      "discount": {
        "type": "PERCENT",
        "value": 0,
        "reason": ""
      },
      "subtotal": 1403.2,
      "discountAmount": 0.0,
      "total": 1403.2,
      "insurerAmount": 0,
      "patientAmount": 1403.2,
      "comments": "Datos ficticios para validación del flujo.",
      "createdAt": "2026-08-24T15:30:00Z",
      "sentAt": "2026-08-24T16:00:00Z",
      "portalToken": "demo-qt-2026-0144",
      "expiresAt": "2026-09-30T23:59:59Z"
    },
    {
      "id": "QT-2026-0149",
      "caseId": "HOS-2026-0195",
      "patientId": "PAT-007",
      "status": "INFO_REQUIRED",
      "version": 1,
      "currency": "USD",
      "items": [
        {
          "id": "QTI-149-1",
          "catalogItemId": "CAT-SRV-001",
          "category": "SERVICES",
          "name": "Enfermería domiciliar 12 horas",
          "quantity": 4,
          "unitPrice": 180,
          "discountAmount": 0
        },
        {
          "id": "QTI-149-2",
          "catalogItemId": "CAT-EQP-001",
          "category": "EQUIPMENT",
          "name": "Bomba de infusión",
          "quantity": 4,
          "unitPrice": 42,
          "discountAmount": 0
        },
        {
          "id": "QTI-149-3",
          "catalogItemId": "CAT-FEE-002",
          "category": "FEES",
          "name": "Supervisión de enfermería",
          "quantity": 2,
          "unitPrice": 55,
          "discountAmount": 0
        }
      ],
      "discount": {
        "type": "PERCENT",
        "value": 0,
        "reason": ""
      },
      "subtotal": 998,
      "discountAmount": 0.0,
      "total": 998.0,
      "insurerAmount": 0,
      "patientAmount": 998.0,
      "comments": "Datos ficticios para validación del flujo.",
      "createdAt": "2026-08-24T15:30:00Z",
      "sentAt": "2026-08-24T16:00:00Z",
      "portalToken": "demo-qt-2026-0149",
      "expiresAt": "2026-09-30T23:59:59Z"
    }
  ],
  "insuranceRequests": [
    {
      "id": "PRE-001",
      "quoteId": "QT-2026-0148",
      "insurerId": "INS-001",
      "status": "PARTIALLY_APPROVED",
      "submittedAt": "2026-08-19T13:10:00Z",
      "approvedAmount": 900,
      "requestedDocuments": [],
      "claimNumber": "HZN-2026-8801",
      "lastNote": "Aprobación parcial; deducible y copago aplicados.",
      "events": [
        {
          "date": "2026-08-19T13:10:00Z",
          "status": "SENT_TO_INSURER",
          "note": "Cotización y resumen clínico enviados."
        },
        {
          "date": "2026-08-20T10:40:00Z",
          "status": "INSURER_REVIEW",
          "note": "Aseguradora confirmó recepción."
        },
        {
          "date": "2026-08-22T17:15:00Z",
          "status": "PARTIALLY_APPROVED",
          "note": "Carta de aprobación parcial recibida."
        }
      ]
    },
    {
      "id": "PRE-002",
      "quoteId": "QT-2026-0147",
      "insurerId": "INS-002",
      "status": "INSURER_REVIEW",
      "submittedAt": "2026-08-22T09:30:00Z",
      "approvedAmount": 0,
      "requestedDocuments": [],
      "claimNumber": "SVI-2026-1102",
      "lastNote": "En revisión por auditor médico.",
      "events": [
        {
          "date": "2026-08-22T09:30:00Z",
          "status": "SENT_TO_INSURER",
          "note": "Solicitud enviada."
        },
        {
          "date": "2026-08-23T14:05:00Z",
          "status": "INSURER_REVIEW",
          "note": "Asignada a auditor médico."
        }
      ]
    },
    {
      "id": "PRE-003",
      "quoteId": "QT-2026-0145",
      "insurerId": "INS-001",
      "status": "APPROVED",
      "submittedAt": "2026-08-15T11:00:00Z",
      "approvedAmount": 2500,
      "requestedDocuments": [],
      "claimNumber": "HZN-2026-8702",
      "lastNote": "Aprobación emitida.",
      "events": [
        {
          "date": "2026-08-15T11:00:00Z",
          "status": "SENT_TO_INSURER",
          "note": "Solicitud enviada."
        },
        {
          "date": "2026-08-16T12:00:00Z",
          "status": "APPROVED",
          "note": "Carta de garantía adjunta."
        }
      ]
    },
    {
      "id": "PRE-004",
      "quoteId": "QT-2026-0149",
      "insurerId": "INS-003",
      "status": "INFO_REQUIRED",
      "submittedAt": "2026-08-24T15:50:00Z",
      "approvedAmount": 0,
      "requestedDocuments": [
        "Informe médico actualizado",
        "Resultados de laboratorio"
      ],
      "claimNumber": "PMR-2026-4509",
      "lastNote": "La aseguradora solicitó documentos adicionales.",
      "events": [
        {
          "date": "2026-08-24T15:50:00Z",
          "status": "SENT_TO_INSURER",
          "note": "Solicitud enviada."
        },
        {
          "date": "2026-08-25T10:15:00Z",
          "status": "INFO_REQUIRED",
          "note": "Documentos adicionales requeridos."
        }
      ]
    }
  ],
  "payments": [
    {
      "id": "PAY-001",
      "quoteId": "QT-2026-0148",
      "patientId": "PAT-001",
      "date": "2026-08-23T12:20:00Z",
      "method": "TRANSFER",
      "payer": "Daniel Morales",
      "reference": "TRX-DEMO-7781",
      "amount": 250,
      "status": "APPLIED",
      "receipt": "REC-001"
    },
    {
      "id": "PAY-002",
      "quoteId": "QT-2026-0146",
      "patientId": "PAT-003",
      "date": "2026-08-24T09:05:00Z",
      "method": "CARD",
      "payer": "Claudia Valdés",
      "reference": "POS-DEMO-0182",
      "amount": 220,
      "status": "APPLIED",
      "receipt": "REC-002"
    },
    {
      "id": "PAY-003",
      "quoteId": "QT-2026-0144",
      "patientId": "PAT-005",
      "date": "2026-08-17T14:30:00Z",
      "method": "TRANSFER",
      "payer": "Luis Figueroa",
      "reference": "TRX-DEMO-6611",
      "amount": 1403.2,
      "status": "APPLIED",
      "receipt": "REC-003"
    }
  ],
  "clinicalDocuments": [
    {
      "id": "DOC-001",
      "caseId": "HOS-2026-0190",
      "patientId": "PAT-001",
      "type": "HEALTH_REPORT",
      "title": "Reporte de salud inicial",
      "status": "SIGNED",
      "authorId": "USR-002",
      "authorName": "Dra. Valeria Núñez",
      "createdAt": "2026-08-18T18:00:00Z",
      "signedAt": "2026-08-18T18:25:00Z",
      "version": 1,
      "summary": "Paciente estable, dolor controlado, herida limpia y seca.",
      "content": {
        "diagnosis": "Recuperación posoperatoria",
        "background": [
          "Hipertensión arterial"
        ],
        "allergies": [
          "Penicilina"
        ],
        "devices": [
          "Catéter venoso periférico"
        ],
        "plan": "Vigilancia de signos vitales, analgesia y curación diaria."
      }
    },
    {
      "id": "DOC-002",
      "caseId": "HOS-2026-0190",
      "patientId": "PAT-001",
      "type": "MEDICAL_ORDER",
      "title": "Orden médica de ingreso",
      "status": "SIGNED",
      "authorId": "USR-002",
      "authorName": "Dra. Valeria Núñez",
      "createdAt": "2026-08-18T17:40:00Z",
      "signedAt": "2026-08-18T17:50:00Z",
      "version": 1,
      "summary": "Ceftriaxona, analgesia y curación.",
      "content": {
        "indications": "Administrar ceftriaxona 1 g IV cada 24 horas por 5 días. Curación diaria. Control de signos vitales cada 6 horas."
      }
    },
    {
      "id": "DOC-003",
      "caseId": "HOS-2026-0191",
      "patientId": "PAT-002",
      "type": "CARE_PLAN",
      "title": "Plan de cuidados de enfermería",
      "status": "DRAFT",
      "authorId": "USR-003",
      "authorName": "Lic. Sofía Duarte",
      "createdAt": "2026-08-20T12:00:00Z",
      "signedAt": null,
      "version": 1,
      "summary": "Plan de hidratación, vigilancia y educación familiar.",
      "content": {
        "objectives": [
          "Mantener hidratación adecuada",
          "Prevenir complicaciones del acceso venoso"
        ],
        "interventions": [
          "Control de signos vitales",
          "Vigilancia del sitio de acceso",
          "Educación al cuidador"
        ],
        "frequency": "Cada turno"
      }
    },
    {
      "id": "DOC-004",
      "caseId": "HOS-2026-0193",
      "patientId": "PAT-004",
      "type": "HEALTH_REPORT",
      "title": "Reporte de salud diario",
      "status": "SIGNED",
      "authorId": "USR-003",
      "authorName": "Lic. Sofía Duarte",
      "createdAt": "2026-08-24T19:00:00Z",
      "signedAt": "2026-08-24T19:15:00Z",
      "version": 3,
      "summary": "Paciente somnoliento, sin signos de dificultad respiratoria.",
      "content": {
        "diagnosis": "Cuidados paliativos",
        "background": [
          "Diabetes mellitus tipo 2",
          "Hipertensión arterial"
        ],
        "allergies": [
          "Ninguna conocida"
        ],
        "devices": [
          "Concentrador de oxígeno",
          "Sonda Foley"
        ],
        "plan": "Continuar manejo de confort y notificar cambios."
      }
    }
  ],
  "vitalSigns": [
    {
      "id": "VS-001",
      "caseId": "HOS-2026-0190",
      "patientId": "PAT-001",
      "recordedAt": "2026-08-25T06:00:00Z",
      "temperature": 36.7,
      "heartRate": 78,
      "respiratoryRate": 17,
      "systolic": 122,
      "diastolic": 76,
      "spo2": 97,
      "pain": 2,
      "authorName": "Lic. Sofía Duarte"
    },
    {
      "id": "VS-002",
      "caseId": "HOS-2026-0190",
      "patientId": "PAT-001",
      "recordedAt": "2026-08-25T12:00:00Z",
      "temperature": 36.8,
      "heartRate": 82,
      "respiratoryRate": 18,
      "systolic": 126,
      "diastolic": 78,
      "spo2": 96,
      "pain": 2,
      "authorName": "Lic. Sofía Duarte"
    },
    {
      "id": "VS-003",
      "caseId": "HOS-2026-0193",
      "patientId": "PAT-004",
      "recordedAt": "2026-08-25T08:00:00Z",
      "temperature": 36.4,
      "heartRate": 88,
      "respiratoryRate": 20,
      "systolic": 110,
      "diastolic": 68,
      "spo2": 94,
      "pain": 1,
      "authorName": "Lic. Mateo Salazar"
    }
  ],
  "medicationCards": [
    {
      "id": "MC-001",
      "caseId": "HOS-2026-0190",
      "patientId": "PAT-001",
      "status": "ACTIVE",
      "createdAt": "2026-08-18T18:10:00Z",
      "items": [
        {
          "id": "MCI-001",
          "medication": "Ceftriaxona 1 g",
          "dose": "1 g",
          "route": "IV",
          "frequency": "Cada 24 horas",
          "schedule": [
            "08:00"
          ],
          "startDate": "2026-08-19",
          "endDate": "2026-08-23",
          "lastAdministration": "2026-08-23T08:03:00Z",
          "administrationStatus": "COMPLETED"
        },
        {
          "id": "MCI-002",
          "medication": "Acetaminofén 500 mg",
          "dose": "1 tableta",
          "route": "VO",
          "frequency": "Cada 8 horas PRN",
          "schedule": [
            "06:00",
            "14:00",
            "22:00"
          ],
          "startDate": "2026-08-18",
          "endDate": "2026-08-28",
          "lastAdministration": "2026-08-25T14:05:00Z",
          "administrationStatus": "ADMINISTERED"
        }
      ]
    },
    {
      "id": "MC-002",
      "caseId": "HOS-2026-0193",
      "patientId": "PAT-004",
      "status": "ACTIVE",
      "createdAt": "2026-08-14T18:00:00Z",
      "items": [
        {
          "id": "MCI-003",
          "medication": "Morfina solución oral",
          "dose": "5 mg",
          "route": "VO",
          "frequency": "Cada 4 horas PRN",
          "schedule": [
            "PRN"
          ],
          "startDate": "2026-08-14",
          "endDate": "",
          "lastAdministration": "2026-08-25T10:20:00Z",
          "administrationStatus": "ADMINISTERED"
        }
      ]
    }
  ],
  "nursingNotes": [
    {
      "id": "NOTE-001",
      "caseId": "HOS-2026-0190",
      "patientId": "PAT-001",
      "createdAt": "2026-08-25T12:20:00Z",
      "authorId": "USR-003",
      "authorName": "Lic. Sofía Duarte",
      "status": "SIGNED",
      "text": "Paciente consciente y orientada. Toleró alimentación. Herida quirúrgica sin secreción. Se administró medicación indicada.",
      "shareStatus": "SHARED_WITH_DOCTOR",
      "sharedAt": "2026-08-25T12:30:00Z"
    },
    {
      "id": "NOTE-002",
      "caseId": "HOS-2026-0193",
      "patientId": "PAT-004",
      "createdAt": "2026-08-25T10:30:00Z",
      "authorId": "USR-004",
      "authorName": "Lic. Mateo Salazar",
      "status": "SIGNED",
      "text": "Paciente somnoliento, responde al llamado. Oxígeno a 2 L/min. Se realiza higiene y cambios de posición.",
      "shareStatus": "NOT_SHARED",
      "sharedAt": null
    }
  ],
  "shifts": [
    {
      "id": "SHIFT-001",
      "caseId": "HOS-2026-0190",
      "patientId": "PAT-001",
      "resourceId": "USR-003",
      "resourceName": "Lic. Sofía Duarte",
      "start": "2026-08-26T06:00:00-06:00",
      "end": "2026-08-26T18:00:00-06:00",
      "type": "ENFERMERIA_12H",
      "status": "CONFIRMED"
    },
    {
      "id": "SHIFT-002",
      "caseId": "HOS-2026-0193",
      "patientId": "PAT-004",
      "resourceId": "USR-004",
      "resourceName": "Lic. Mateo Salazar",
      "start": "2026-08-26T18:00:00-06:00",
      "end": "2026-08-27T06:00:00-06:00",
      "type": "ENFERMERIA_12H",
      "status": "CONFIRMED"
    },
    {
      "id": "SHIFT-003",
      "caseId": "HOS-2026-0191",
      "patientId": "PAT-002",
      "resourceId": "DOC-002",
      "resourceName": "Dr. Mauricio Peña",
      "start": "2026-08-27T10:00:00-06:00",
      "end": "2026-08-27T11:00:00-06:00",
      "type": "VISITA_MEDICA",
      "status": "PENDING"
    }
  ],
  "suppliers": [
    {
      "id": "SUP-001",
      "name": "Distribuidora Clínica Centroamericana",
      "taxId": "0614-DEMO-001",
      "phone": "+503 2300-1000",
      "email": "ventas@dcc.demo",
      "status": "ACTIVE"
    },
    {
      "id": "SUP-002",
      "name": "Equipos Médicos del Pacífico",
      "taxId": "0614-DEMO-002",
      "phone": "+503 2300-2000",
      "email": "cotizaciones@emp.demo",
      "status": "ACTIVE"
    },
    {
      "id": "SUP-003",
      "name": "Laboratorio Móvil Integral",
      "taxId": "0614-DEMO-003",
      "phone": "+503 2300-3000",
      "email": "servicios@lmi.demo",
      "status": "ACTIVE"
    }
  ],
  "purchases": [
    {
      "id": "PUR-2026-0081",
      "supplierId": "SUP-001",
      "date": "2026-08-22",
      "invoiceNumber": "FAC-DEMO-8891",
      "status": "RECEIVED",
      "paymentType": "CREDIT",
      "invoiceFile": "factura-demo-8891.pdf",
      "subtotal": 725.0,
      "tax": 94.25,
      "discount": 0,
      "total": 819.25,
      "items": [
        {
          "catalogItemId": "CAT-MED-001",
          "name": "Ceftriaxona 1 g vial",
          "quantity": 50,
          "unitCost": 9.2,
          "taxRate": 13
        },
        {
          "catalogItemId": "CAT-INS-001",
          "name": "Kit de canalización",
          "quantity": 15,
          "unitCost": 17.3,
          "taxRate": 13
        }
      ]
    },
    {
      "id": "PUR-2026-0082",
      "supplierId": "SUP-002",
      "date": "2026-08-24",
      "invoiceNumber": "FAC-DEMO-4102",
      "status": "PENDING_APPROVAL",
      "paymentType": "CASH",
      "invoiceFile": "",
      "subtotal": 180.0,
      "tax": 23.4,
      "discount": 10,
      "total": 193.4,
      "items": [
        {
          "catalogItemId": "CAT-EQP-001",
          "name": "Mantenimiento de bomba de infusión",
          "quantity": 2,
          "unitCost": 90,
          "taxRate": 13
        }
      ]
    }
  ],
  "warehouses": [
    {
      "id": "WH-001",
      "name": "Bodega central",
      "location": "San Salvador",
      "status": "ACTIVE"
    },
    {
      "id": "WH-002",
      "name": "Equipos clínicos",
      "location": "San Salvador",
      "status": "ACTIVE"
    },
    {
      "id": "WH-003",
      "name": "Supervisión móvil",
      "location": "Unidad móvil",
      "status": "ACTIVE"
    }
  ],
  "inventoryItems": [
    {
      "id": "INV-001",
      "catalogItemId": "CAT-MED-001",
      "sku": "MED-CEF-1G",
      "name": "Ceftriaxona 1 g vial",
      "category": "MEDICATIONS",
      "warehouseId": "WH-001",
      "stock": 74,
      "committed": 18,
      "minimum": 20,
      "unit": "vial"
    },
    {
      "id": "INV-002",
      "catalogItemId": "CAT-MED-002",
      "sku": "MED-ACET-500",
      "name": "Acetaminofén 500 mg",
      "category": "MEDICATIONS",
      "warehouseId": "WH-001",
      "stock": 280,
      "committed": 48,
      "minimum": 80,
      "unit": "tableta"
    },
    {
      "id": "INV-003",
      "catalogItemId": "CAT-MED-003",
      "sku": "MED-OND-4",
      "name": "Ondansetrón 4 mg/2 ml",
      "category": "MEDICATIONS",
      "warehouseId": "WH-001",
      "stock": 8,
      "committed": 5,
      "minimum": 10,
      "unit": "ampolla"
    },
    {
      "id": "INV-004",
      "catalogItemId": "CAT-INS-001",
      "sku": "INS-CAN-01",
      "name": "Kit de canalización",
      "category": "SUPPLIES",
      "warehouseId": "WH-001",
      "stock": 22,
      "committed": 9,
      "minimum": 8,
      "unit": "kit"
    },
    {
      "id": "INV-005",
      "catalogItemId": "CAT-INS-002",
      "sku": "INS-GAS-10",
      "name": "Gasa estéril 10 x 10",
      "category": "SUPPLIES",
      "warehouseId": "WH-001",
      "stock": 95,
      "committed": 36,
      "minimum": 30,
      "unit": "paquete"
    },
    {
      "id": "INV-006",
      "catalogItemId": "CAT-INS-003",
      "sku": "INS-GUA-M",
      "name": "Guante de examen talla M",
      "category": "SUPPLIES",
      "warehouseId": "WH-003",
      "stock": 12,
      "committed": 4,
      "minimum": 10,
      "unit": "caja"
    },
    {
      "id": "INV-007",
      "catalogItemId": "CAT-EQP-001",
      "sku": "EQP-BOM-01",
      "name": "Bomba de infusión",
      "category": "EQUIPMENT",
      "warehouseId": "WH-002",
      "stock": 7,
      "committed": 4,
      "minimum": 2,
      "unit": "equipo"
    },
    {
      "id": "INV-008",
      "catalogItemId": "CAT-EQP-002",
      "sku": "EQP-OXI-01",
      "name": "Concentrador de oxígeno",
      "category": "EQUIPMENT",
      "warehouseId": "WH-002",
      "stock": 5,
      "committed": 3,
      "minimum": 2,
      "unit": "equipo"
    }
  ],
  "inventoryLots": [
    {
      "id": "LOT-001",
      "inventoryItemId": "INV-001",
      "lotNumber": "CEF-DEMO-A26",
      "serialNumber": "",
      "expiresAt": "2027-05-31",
      "quantity": 40,
      "status": "AVAILABLE"
    },
    {
      "id": "LOT-002",
      "inventoryItemId": "INV-001",
      "lotNumber": "CEF-DEMO-B26",
      "serialNumber": "",
      "expiresAt": "2027-10-31",
      "quantity": 34,
      "status": "AVAILABLE"
    },
    {
      "id": "LOT-003",
      "inventoryItemId": "INV-003",
      "lotNumber": "OND-DEMO-01",
      "serialNumber": "",
      "expiresAt": "2026-10-15",
      "quantity": 8,
      "status": "EXPIRING_SOON"
    },
    {
      "id": "LOT-004",
      "inventoryItemId": "INV-007",
      "lotNumber": "",
      "serialNumber": "BOM-DEMO-1007",
      "expiresAt": "",
      "quantity": 1,
      "status": "ASSIGNED"
    },
    {
      "id": "LOT-005",
      "inventoryItemId": "INV-008",
      "lotNumber": "",
      "serialNumber": "OXI-DEMO-2003",
      "expiresAt": "",
      "quantity": 1,
      "status": "ASSIGNED"
    }
  ],
  "inventoryMovements": [
    {
      "id": "MOV-001",
      "inventoryItemId": "INV-001",
      "caseId": "",
      "type": "PURCHASE_ENTRY",
      "quantity": 50,
      "date": "2026-08-22T16:00:00Z",
      "warehouseFrom": "",
      "warehouseTo": "WH-001",
      "reference": "PUR-2026-0081",
      "authorName": "Diego Ramírez",
      "note": "Ingreso por compra."
    },
    {
      "id": "MOV-002",
      "inventoryItemId": "INV-001",
      "caseId": "HOS-2026-0190",
      "type": "PATIENT_COMMITMENT",
      "quantity": 10,
      "date": "2026-08-19T07:30:00Z",
      "warehouseFrom": "WH-001",
      "warehouseTo": "",
      "reference": "ACK-001",
      "authorName": "Diego Ramírez",
      "note": "Comprometido para paciente."
    },
    {
      "id": "MOV-003",
      "inventoryItemId": "INV-004",
      "caseId": "HOS-2026-0190",
      "type": "PATIENT_COMMITMENT",
      "quantity": 3,
      "date": "2026-08-19T07:32:00Z",
      "warehouseFrom": "WH-001",
      "warehouseTo": "",
      "reference": "ACK-001",
      "authorName": "Diego Ramírez",
      "note": "Kit entregado al domicilio."
    },
    {
      "id": "MOV-004",
      "inventoryItemId": "INV-006",
      "caseId": "",
      "type": "TRANSFER",
      "quantity": 4,
      "date": "2026-08-24T12:00:00Z",
      "warehouseFrom": "WH-001",
      "warehouseTo": "WH-003",
      "reference": "TRF-101",
      "authorName": "Diego Ramírez",
      "note": "Traslado a supervisión móvil."
    }
  ],
  "inventoryReservations": [
    {
      "id": "RES-001",
      "caseId": "HOS-2026-0190",
      "inventoryItemId": "INV-001",
      "quantity": 8,
      "delivered": 10,
      "consumed": 7,
      "returned": 1,
      "status": "OPEN"
    },
    {
      "id": "RES-002",
      "caseId": "HOS-2026-0190",
      "inventoryItemId": "INV-004",
      "quantity": 3,
      "delivered": 3,
      "consumed": 2,
      "returned": 0,
      "status": "OPEN"
    },
    {
      "id": "RES-003",
      "caseId": "HOS-2026-0193",
      "inventoryItemId": "INV-008",
      "quantity": 1,
      "delivered": 1,
      "consumed": 0,
      "returned": 0,
      "status": "OPEN"
    }
  ],
  "inventoryClosures": [
    {
      "id": "CLOSE-001",
      "caseId": "HOS-2026-0194",
      "type": "PARTIAL",
      "status": "PENDING_REVIEW",
      "createdAt": "2026-08-23T18:00:00Z",
      "createdBy": "Lic. Sofía Duarte",
      "note": "Conteo preliminar al finalizar antibioticoterapia.",
      "items": [
        {
          "inventoryItemId": "INV-001",
          "delivered": 14,
          "consumed": 14,
          "returned": 0,
          "difference": 0
        },
        {
          "inventoryItemId": "INV-004",
          "delivered": 4,
          "consumed": 3,
          "returned": 1,
          "difference": 0
        }
      ]
    },
    {
      "id": "CLOSE-002",
      "caseId": "HOS-2026-0188",
      "type": "TOTAL",
      "status": "APPROVED",
      "createdAt": "2026-08-19T18:00:00Z",
      "createdBy": "Lic. Mateo Salazar",
      "note": "Cierre total auditado.",
      "items": []
    }
  ],
  "kits": [
    {
      "id": "KIT-001",
      "name": "Kit de canalización periférica",
      "code": "KIT-CAN-01",
      "active": true,
      "items": [
        {
          "catalogItemId": "CAT-INS-001",
          "name": "Kit de canalización",
          "quantity": 1
        },
        {
          "catalogItemId": "CAT-INS-002",
          "name": "Gasa estéril 10 x 10",
          "quantity": 2
        },
        {
          "catalogItemId": "CAT-INS-003",
          "name": "Guante de examen talla M",
          "quantity": 0.1
        }
      ]
    },
    {
      "id": "KIT-002",
      "name": "Kit de curación avanzada",
      "code": "KIT-CUR-02",
      "active": true,
      "items": [
        {
          "catalogItemId": "CAT-INS-002",
          "name": "Gasa estéril 10 x 10",
          "quantity": 4
        },
        {
          "catalogItemId": "CAT-INS-003",
          "name": "Guante de examen talla M",
          "quantity": 0.1
        }
      ]
    }
  ],
  "doctors": [
    {
      "id": "DOC-001",
      "name": "Dra. Valeria Núñez",
      "specialty": "Medicina interna",
      "phone": "+503 7100-1001",
      "email": "valeria.nunez@demo.example",
      "rateType": "PER_VISIT",
      "status": "ACTIVE"
    },
    {
      "id": "DOC-002",
      "name": "Dr. Mauricio Peña",
      "specialty": "Medicina familiar",
      "phone": "+503 7100-1002",
      "email": "mauricio.pena@demo.example",
      "rateType": "PER_VISIT",
      "status": "ACTIVE"
    },
    {
      "id": "DOC-003",
      "name": "Dra. Irene Salgado",
      "specialty": "Cirugía general",
      "phone": "+503 7100-1003",
      "email": "irene.salgado@demo.example",
      "rateType": "PER_PROCEDURE",
      "status": "ACTIVE"
    },
    {
      "id": "DOC-004",
      "name": "Dr. Ricardo Molina",
      "specialty": "Rehabilitación",
      "phone": "+503 7100-1004",
      "email": "ricardo.molina@demo.example",
      "rateType": "PER_VISIT",
      "status": "ACTIVE"
    }
  ],
  "doctorServices": [
    {
      "id": "DS-001",
      "doctorId": "DOC-001",
      "caseId": "HOS-2026-0190",
      "patientId": "PAT-001",
      "date": "2026-08-19",
      "service": "Visita médica domiciliar",
      "quantity": 1,
      "rate": 75,
      "status": "APPROVED"
    },
    {
      "id": "DS-002",
      "doctorId": "DOC-001",
      "caseId": "HOS-2026-0193",
      "patientId": "PAT-004",
      "date": "2026-08-21",
      "service": "Visita médica domiciliar",
      "quantity": 2,
      "rate": 75,
      "status": "APPROVED"
    },
    {
      "id": "DS-003",
      "doctorId": "DOC-002",
      "caseId": "HOS-2026-0191",
      "patientId": "PAT-002",
      "date": "2026-08-23",
      "service": "Visita médica domiciliar",
      "quantity": 1,
      "rate": 70,
      "status": "PENDING"
    },
    {
      "id": "DS-004",
      "doctorId": "DOC-003",
      "caseId": "HOS-2026-0192",
      "patientId": "PAT-003",
      "date": "2026-08-22",
      "service": "Evaluación de herida",
      "quantity": 1,
      "rate": 85,
      "status": "APPROVED"
    },
    {
      "id": "DS-005",
      "doctorId": "DOC-004",
      "caseId": "HOS-2026-0195",
      "patientId": "PAT-007",
      "date": "2026-08-25",
      "service": "Evaluación de rehabilitación",
      "quantity": 1,
      "rate": 80,
      "status": "APPROVED"
    }
  ],
  "doctorStatements": [
    {
      "id": "STM-2026-08-001",
      "doctorId": "DOC-001",
      "periodStart": "2026-08-01",
      "periodEnd": "2026-08-31",
      "gross": 225,
      "adjustments": 0,
      "withholdings": 22.5,
      "paid": 0,
      "status": "READY_TO_SEND",
      "sentAt": null,
      "items": [
        "DS-001",
        "DS-002"
      ]
    },
    {
      "id": "STM-2026-08-002",
      "doctorId": "DOC-002",
      "periodStart": "2026-08-01",
      "periodEnd": "2026-08-31",
      "gross": 70,
      "adjustments": 0,
      "withholdings": 7,
      "paid": 0,
      "status": "DRAFT",
      "sentAt": null,
      "items": [
        "DS-003"
      ]
    },
    {
      "id": "STM-2026-08-003",
      "doctorId": "DOC-003",
      "periodStart": "2026-08-01",
      "periodEnd": "2026-08-31",
      "gross": 85,
      "adjustments": -5,
      "withholdings": 8.5,
      "paid": 0,
      "status": "SENT",
      "sentAt": "2026-08-25T16:00:00Z",
      "items": [
        "DS-004"
      ]
    },
    {
      "id": "STM-2026-08-004",
      "doctorId": "DOC-004",
      "periodStart": "2026-08-01",
      "periodEnd": "2026-08-31",
      "gross": 80,
      "adjustments": 0,
      "withholdings": 8,
      "paid": 0,
      "status": "DRAFT",
      "sentAt": null,
      "items": [
        "DS-005"
      ]
    }
  ],
  "notifications": [
    {
      "id": "NOT-001",
      "date": "2026-08-25T10:20:00Z",
      "channel": "WHATSAPP",
      "target": "•••• 1001",
      "subject": "Actualización QT-2026-0148",
      "status": "DELIVERED",
      "safePreview": "Su solicitud tiene una actualización. Consulte el portal seguro."
    },
    {
      "id": "NOT-002",
      "date": "2026-08-25T09:05:00Z",
      "channel": "EMAIL",
      "target": "v••••••@demo.example",
      "subject": "Estado de cuenta agosto",
      "status": "SENT",
      "safePreview": "Estado de cuenta disponible para revisión."
    },
    {
      "id": "NOT-003",
      "date": "2026-08-24T16:00:00Z",
      "channel": "SMS",
      "target": "•••• 1007",
      "subject": "Documentos solicitados",
      "status": "DELIVERED",
      "safePreview": "Hay documentos pendientes en su trámite."
    }
  ],
  "auditLogs": [
    {
      "id": "AUD-001",
      "date": "2026-08-25T12:30:00Z",
      "user": "Lic. Sofía Duarte",
      "role": "NURSE",
      "action": "SHARE_NURSING_NOTE",
      "entity": "NOTE-001",
      "summary": "Nota compartida con médico contratante.",
      "ip": "10.0.0.24"
    },
    {
      "id": "AUD-002",
      "date": "2026-08-25T10:15:00Z",
      "user": "Andrea Mejía",
      "role": "ADMIN",
      "action": "INSURANCE_STATUS_CHANGE",
      "entity": "PRE-004",
      "summary": "Estado actualizado a información requerida.",
      "ip": "10.0.0.12"
    },
    {
      "id": "AUD-003",
      "date": "2026-08-24T19:15:00Z",
      "user": "Lic. Sofía Duarte",
      "role": "NURSE",
      "action": "SIGN_CLINICAL_DOCUMENT",
      "entity": "DOC-004",
      "summary": "Reporte de salud firmado. Edición bloqueada para enfermería.",
      "ip": "10.0.0.24"
    },
    {
      "id": "AUD-004",
      "date": "2026-08-24T12:00:00Z",
      "user": "Diego Ramírez",
      "role": "INVENTORY",
      "action": "INVENTORY_TRANSFER",
      "entity": "MOV-004",
      "summary": "Traslado a supervisión móvil.",
      "ip": "10.0.0.31"
    },
    {
      "id": "AUD-005",
      "date": "2026-08-23T12:20:00Z",
      "user": "Paola Méndez",
      "role": "FINANCE",
      "action": "PAYMENT_APPLIED",
      "entity": "PAY-001",
      "summary": "Pago aplicado a QT-2026-0148.",
      "ip": "10.0.0.18"
    }
  ],
  "templates": [
    {
      "id": "TPL-001",
      "type": "QUOTE",
      "name": "Cotización estándar",
      "version": 1,
      "status": "PROVISIONAL"
    },
    {
      "id": "TPL-002",
      "type": "HEALTH_REPORT",
      "name": "Reporte de salud",
      "version": 1,
      "status": "PROVISIONAL"
    },
    {
      "id": "TPL-003",
      "type": "MEDICAL_ORDER",
      "name": "Orden médica",
      "version": 1,
      "status": "PROVISIONAL"
    },
    {
      "id": "TPL-004",
      "type": "MEDICATION_CARD",
      "name": "Tarjeta de medicamentos",
      "version": 1,
      "status": "PROVISIONAL"
    },
    {
      "id": "TPL-005",
      "type": "CARE_PLAN",
      "name": "Plan de cuidados",
      "version": 1,
      "status": "PROVISIONAL"
    },
    {
      "id": "TPL-006",
      "type": "DOCTOR_STATEMENT",
      "name": "Estado de cuenta médico",
      "version": 1,
      "status": "PROVISIONAL"
    },
    {
      "id": "TPL-007",
      "type": "INVENTORY_ACK",
      "name": "Acuse de inventario",
      "version": 1,
      "status": "PROVISIONAL"
    }
  ],
  "qaCoverage": [
    {
      "chapter": "CH01",
      "title": "Acceso, dashboard y pacientes",
      "features": 12,
      "implemented": 12,
      "partial": 0,
      "missing": 0,
      "status": "PASS"
    },
    {
      "chapter": "CH02",
      "title": "Alta y edición de pacientes",
      "features": 24,
      "implemented": 22,
      "partial": 2,
      "missing": 0,
      "status": "PASS_WITH_NOTES"
    },
    {
      "chapter": "CH03",
      "title": "Hospitalización y preautorizaciones",
      "features": 14,
      "implemented": 14,
      "partial": 0,
      "missing": 0,
      "status": "PASS"
    },
    {
      "chapter": "CH04",
      "title": "Cotización: datos generales",
      "features": 12,
      "implemented": 12,
      "partial": 0,
      "missing": 0,
      "status": "PASS"
    },
    {
      "chapter": "CH05",
      "title": "Cotización: servicios, estudios y medicamentos",
      "features": 18,
      "implemented": 17,
      "partial": 1,
      "missing": 0,
      "status": "PASS_WITH_NOTES"
    },
    {
      "chapter": "CH06",
      "title": "Insumos, equipos, honorarios, extras y totales",
      "features": 19,
      "implemented": 18,
      "partial": 1,
      "missing": 0,
      "status": "PASS_WITH_NOTES"
    },
    {
      "chapter": "CH07",
      "title": "Seguro y reclamo",
      "features": 13,
      "implemented": 12,
      "partial": 1,
      "missing": 0,
      "status": "PASS_WITH_NOTES"
    },
    {
      "chapter": "CH08",
      "title": "Cuentas por cobrar y pagos",
      "features": 20,
      "implemented": 19,
      "partial": 1,
      "missing": 0,
      "status": "PASS_WITH_NOTES"
    },
    {
      "chapter": "CH09",
      "title": "Hospitalización clínica y reporte de salud",
      "features": 23,
      "implemented": 21,
      "partial": 2,
      "missing": 0,
      "status": "PASS_WITH_NOTES"
    },
    {
      "chapter": "CH10",
      "title": "Orden médica y tarjeta de medicamentos",
      "features": 21,
      "implemented": 20,
      "partial": 1,
      "missing": 0,
      "status": "PASS_WITH_NOTES"
    },
    {
      "chapter": "CH11",
      "title": "Agenda y turnos",
      "features": 13,
      "implemented": 13,
      "partial": 0,
      "missing": 0,
      "status": "PASS"
    },
    {
      "chapter": "CH12",
      "title": "Cuentas por pagar y pagos de servicios",
      "features": 16,
      "implemented": 15,
      "partial": 1,
      "missing": 0,
      "status": "PASS_WITH_NOTES"
    },
    {
      "chapter": "CH13",
      "title": "Compras",
      "features": 18,
      "implemented": 17,
      "partial": 1,
      "missing": 0,
      "status": "PASS_WITH_NOTES"
    },
    {
      "chapter": "CH14",
      "title": "Inventario, cierres, bodegas y kits",
      "features": 27,
      "implemented": 25,
      "partial": 2,
      "missing": 0,
      "status": "PASS_WITH_NOTES"
    },
    {
      "chapter": "CH15",
      "title": "Acuse y catálogos",
      "features": 20,
      "implemented": 18,
      "partial": 2,
      "missing": 0,
      "status": "PASS_WITH_NOTES"
    },
    {
      "chapter": "CH16",
      "title": "Descuentos por categoría",
      "features": 11,
      "implemented": 11,
      "partial": 0,
      "missing": 0,
      "status": "PASS"
    },
    {
      "chapter": "CH17",
      "title": "Reporte clínico detallado e impresión",
      "features": 22,
      "implemented": 19,
      "partial": 3,
      "missing": 0,
      "status": "PASS_WITH_NOTES"
    }
  ]
};
