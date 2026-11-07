import { z } from 'zod';

/** Client supplied forms: analizaencasa31oct_.pdf, pp. 1–12. No dose inference. */
export const clinicalSourceVersion = 'analizaencasa31oct-2026-v1';
export const scaleIds = [
  'EVA',
  'GLASGOW',
  'RAMSAY',
  'ECOG',
  'ESAS',
  'KARNOFSKY',
  'DOWNTON',
  'BRADEN',
  'NORTON',
  'BARTHEL',
] as const;
export type ScaleId = (typeof scaleIds)[number];
const id = z.string().trim().min(1).max(120);
const text = z.string().trim().min(1).max(12000);
const optionalText = z.string().trim().max(12000).default('');
export const scaleDefinitionSchema = z
  .object({
    id: z.enum(scaleIds),
    name: z.string().trim().min(1).max(120),
    version: z.string().trim().min(1).max(120),
    aggregation: z.enum(['SUM', 'SINGLE', 'PROFILE']),
    items: z
      .array(
        z
          .object({
            id,
            label: text,
            options: z
              .array(z.object({ label: text, score: z.number().finite().min(0).max(100) }).strict())
              .min(2)
              .max(101),
          })
          .strict(),
      )
      .min(1)
      .max(30),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (new Set(v.items.map((x) => x.id)).size !== v.items.length)
      ctx.addIssue({ code: 'custom', message: 'Los campos deben tener identificadores únicos.' });
    if (v.aggregation === 'SINGLE' && v.items.length !== 1)
      ctx.addIssue({ code: 'custom', message: 'Una escala de selección única requiere un campo.' });
    for (const item of v.items)
      if (new Set(item.options.map((x) => x.score)).size !== item.options.length)
        ctx.addIssue({
          code: 'custom',
          message: 'Cada respuesta debe tener una puntuación distinta.',
        });
  });
export type ScaleDefinition = z.infer<typeof scaleDefinitionSchema>;
function item(label: string, labels: string[], scores?: number[]) {
  return {
    id: label,
    label,
    options: labels.map((label, i) => ({ label, score: scores?.[i] ?? i })),
  };
}
function definition(
  id: ScaleId,
  name: string,
  aggregation: ScaleDefinition['aggregation'],
  items: ScaleDefinition['items'],
): ScaleDefinition {
  return { id, name, aggregation, items, version: clinicalSourceVersion };
}
const range = Array.from({ length: 11 }, (_, i) => String(i));
export const clinicalScales: ScaleDefinition[] = [
  definition('EVA', 'EVA', 'SINGLE', [
    item('Dolor', [
      '0 · Ninguno',
      '1 · Molestias',
      '2 · Molestias',
      '3 · Molestias',
      '4 · Muy poco, ligero dolor',
      '5 · Muy poco, ligero dolor',
      '6 · Moderado',
      '7 · Moderado',
      '8 · Mucho, intenso, fuerte',
      '9 · Mucho, intenso, fuerte',
      '10 · Insoportable',
    ]),
  ]),
  definition('GLASGOW', 'Glasgow', 'SUM', [
    item(
      'Apertura ocular',
      ['Espontánea', 'A estímulos verbales', 'A estímulo doloroso', 'Ninguno'],
      [4, 3, 2, 1],
    ),
    item(
      'Respuesta verbal',
      ['Orientado', 'Confuso', 'Inapropiado', 'Incomprensible', 'Ninguno'],
      [5, 4, 3, 2, 1],
    ),
    item(
      'Respuesta motora',
      [
        'Obedece',
        'Localiza el dolor',
        'Retirada al dolor',
        'Flexión anormal',
        'Extensión anormal',
        'Ninguna',
      ],
      [6, 5, 4, 3, 2, 1],
    ),
  ]),
  definition('RAMSAY', 'Ramsay', 'SINGLE', [
    item(
      'Nivel',
      [
        'Paciente ansioso, agitado o inquieto',
        'Paciente cooperador, orientado y tranquilo',
        'Paciente dormido, responde órdenes',
        'Paciente dormido, respuesta rápida a estímulos',
        'Paciente dormido, respuesta lenta a estímulos',
        'Paciente dormido. Ausencia de respuestas.',
      ],
      [1, 2, 3, 4, 5, 6],
    ),
  ]),
  definition('ECOG', 'ECOG', 'SINGLE', [
    item('Actividad', [
      'Actividad normal, sin restricción ni ayuda',
      'Actividad restringida. Deambula',
      'Incapacidad para realizar trabajos. En cama menos del 50% del día',
      'Capacidad restringida para cuidado y aseo personal. En cama más del 50% del día',
      'Incapacidad total. Requiere ayuda para todas las actividades. En cama el 100% del tiempo',
    ]),
  ]),
  definition(
    'ESAS',
    'ESAS',
    'PROFILE',
    [
      'Dolor',
      'Cansancio',
      'Náusea',
      'Depresión',
      'Ansiedad',
      'Somnolencia',
      'Pérdida de apetito',
      'Malestar',
      'Falta de aire',
      'Dificultad para dormir',
    ].map((label) => item(label, range)),
  ),
  definition('KARNOFSKY', 'Karnofsky', 'SINGLE', [
    item(
      'Actividad y asistencia',
      [
        'Actividad normal. Asintomático, sin evidencia de enfermedad',
        'Actividad normal; signos y síntomas leves de enfermedad',
        'Actividad normal con esfuerzo. Algunos signos y síntomas de enfermedad',
        'Cuida de sí mismo, pero es incapaz de llevar a cabo una actividad o trabajo normal',
        'Necesita ayuda ocasional de otros, pero es capaz de cuidar de sí mismo para la mayor parte de sus necesidades',
        'Requiere ayuda considerable de otros y cuidados especiales frecuentes',
        'Incapacitado. Requiere cuidados y asistencia especiales',
        'Severamente incapacitado. Indicación de hospitalización aunque no hay indicios de muerte inminente',
        'Gravemente enfermo. Indicación de hospitalización. Necesita tratamiento de soporte activo',
        'Moribundo',
        'Fallecido',
      ],
      [100, 90, 80, 70, 60, 50, 40, 30, 20, 10, 0],
    ),
  ]),
  definition('DOWNTON', 'Downton', 'SUM', [
    item('Caídas previas', ['No', 'Sí']),
    item('Medicamentos', [
      'Ninguno',
      'Tranquilizantes, sedantes, diuréticos, antidepresivos, otros',
    ]),
    item('Déficits sensoriales', ['Ninguno', 'Alteraciones visuales, auditivas']),
    item('Estado mental', ['Orientado', 'Confuso']),
    item('Deambulación', ['Normal', 'Segura con ayuda, insegura']),
  ]),
  definition('BRADEN', 'Braden', 'SUM', [
    item(
      'Percepción sensorial',
      ['Completamente limitada', 'Muy limitada', 'Ligeramente limitada', 'Sin limitaciones'],
      [1, 2, 3, 4],
    ),
    item(
      'Exposición a la humedad',
      [
        'Constantemente húmeda',
        'Húmeda con frecuencia',
        'Ocasionalmente húmeda',
        'Raramente húmeda',
      ],
      [1, 2, 3, 4],
    ),
    item(
      'Actividad',
      ['Encamado', 'En silla', 'Deambula ocasionalmente', 'Deambula frecuentemente'],
      [1, 2, 3, 4],
    ),
    item(
      'Movilidad',
      ['Completamente inmóvil', 'Muy limitada', 'Ligeramente limitada', 'Sin limitaciones'],
      [1, 2, 3, 4],
    ),
    item(
      'Nutrición',
      ['Muy pobre', 'Probablemente adecuada', 'Adecuada', 'Excelente'],
      [1, 2, 3, 4],
    ),
    item(
      'Riesgo de lesiones cutáneas',
      ['Problema', 'Problema potencial', 'No existe problema aparente'],
      [1, 2, 3],
    ),
  ]),
  definition('NORTON', 'Norton', 'SUM', [
    item('Estado físico general', ['Bueno', 'Mediano', 'Regular', 'Muy malo'], [4, 3, 2, 1]),
    item('Estado mental', ['Alerta', 'Apático', 'Confuso', 'Esporoso o comatoso'], [4, 3, 2, 1]),
    item('Actividad', ['Ambulante', 'Disminuida', 'Muy limitada', 'Inmóvil'], [4, 3, 2, 1]),
    item('Movilidad', ['Total', 'Camina con ayuda', 'Sentado', 'Encamado'], [4, 3, 2, 1]),
    item(
      'Incontinencia',
      ['Ninguna', 'Ocasional', 'Urinaria o fecal', 'Urinaria y fecal'],
      [4, 3, 2, 1],
    ),
  ]),
  definition('BARTHEL', 'Barthel', 'SUM', [
    item(
      'Comer',
      [
        'Dependiente',
        'Necesita ayuda para cortar, extender mantequilla, usar condimentos, etc.',
        'Independiente (capaz de usar cualquier instrumento)',
      ],
      [0, 5, 10],
    ),
    item(
      'Trasladarse entre la silla y la cama',
      [
        'Dependiente, no se mantiene sentado',
        'Necesita ayuda importante (1 persona entrenada o 2 personas), puede estar sentado',
        'Necesita algo de ayuda (una pequeña ayuda física o ayuda verbal)',
        'Independiente',
      ],
      [0, 5, 10, 15],
    ),
    item(
      'Aseo personal',
      [
        'Dependiente',
        'Independiente para lavarse la cara, las manos y los dientes, peinarse y afeitarse',
      ],
      [0, 5],
    ),
    item(
      'Uso del retrete',
      [
        'Dependiente',
        'Necesita alguna ayuda, pero puede hacer algo solo',
        'Independiente (entrar y salir, limpiarse y vestirse)',
      ],
      [0, 5, 10],
    ),
    item('Bañarse o ducharse', ['Dependiente', 'Independiente para bañarse o ducharse'], [0, 5]),
    item(
      'Desplazarse',
      [
        'Inmóvil',
        'Independiente en silla de ruedas en 50 m',
        'Anda con pequeña ayuda de una persona (física o verbal)',
        'Independiente al menos 50 m, con cualquier tipo de muleta, excepto andador',
      ],
      [0, 5, 10, 15],
    ),
    item(
      'Subir y bajar escaleras',
      [
        'Dependiente',
        'Necesita ayuda física o verbal, puede llevar cualquier tipo de muleta',
        'Independiente para subir y bajar',
      ],
      [0, 5, 10],
    ),
    item(
      'Vestirse y desvestirse',
      [
        'Dependiente',
        'Necesita ayuda, pero puede hacer la mitad aproximadamente, sin ayuda',
        'Independiente, incluyendo botones, cremalleras, cordones, etc.',
      ],
      [0, 5, 10],
    ),
    item(
      'Control de heces',
      [
        'Incontinente (o necesita que le suministren enema)',
        'Accidente excepcional (uno/semana)',
        'Continente',
      ],
      [0, 5, 10],
    ),
    item(
      'Control de orina',
      [
        'Incontinente, o sondado incapaz de cambiarse la bolsa',
        'Accidente excepcional (máximo uno/24 horas)',
        'Continente, durante al menos 7 días',
      ],
      [0, 5, 10],
    ),
  ]),
];
export function scoreScale(definition: ScaleDefinition, values: Record<string, number>) {
  if (
    Object.keys(values).length !== definition.items.length ||
    definition.items.some(
      (item) => !item.options.some((option) => option.score === values[item.id]),
    )
  )
    throw new Error('Complete todas las respuestas con una puntuación válida.');
  return definition.aggregation === 'PROFILE'
    ? null
    : definition.items.reduce((sum, item) => sum + values[item.id], 0);
}
export const initialDiagnoses = [
  'Resfriado común / nasofaringitis aguda',
  'Faringitis aguda',
  'Gastroenteritis',
  'Cistitis / infección urinaria',
  'COVID-19',
  'Hipertensión esencial',
  'Diabetes mellitus tipo 2',
  'Dislipidemia (hiperlipoproteinemia)',
  'Obesidad',
  'Anemia por deficiencia de hierro',
  'Hipotiroidismo',
  'Cardiopatía isquémica',
  'Asma',
  'EPOC',
  'Rinitis alérgica',
  'Reflujo gastroesofágico',
  'Lumbalgia',
  'Cefalea tensional',
  'Migraña',
  'Artrosis de rodilla',
  'Episodio depresivo único / recurrente',
  'Trastorno de ansiedad generalizada',
];
export const clinicalKinds = [
  'INDICATION',
  'EVOLUTION',
  'HISTORY',
  'BACKGROUND',
  'MEDICATION_CARD',
  'FLUID_BALANCE',
  'CARE_PLAN',
  'ADMINISTRATION',
  'VITALS',
  'NURSING_NOTE',
  'SCALE',
] as const;
export type ClinicalKind = (typeof clinicalKinds)[number];
export const clinicalLabels: Record<ClinicalKind, string> = {
  INDICATION: 'Indicación médica',
  EVOLUTION: 'Evolución clínica',
  HISTORY: 'Historia clínica',
  BACKGROUND: 'Antecedentes clínicos',
  MEDICATION_CARD: 'Tarjeta de medicamentos',
  FLUID_BALANCE: 'Balance hídrico',
  CARE_PLAN: 'Plan de cuidado',
  ADMINISTRATION: 'Administración de medicamentos',
  VITALS: 'Signos vitales',
  NURSING_NOTE: 'Nota de enfermería',
  SCALE: 'Escala',
};
export const fluidColumns = [
  'Enteral',
  'Parenteral',
  'Transfusión',
  'Oral',
  'Orina',
  'Deposición',
  'Vómito',
  'Drenos',
  'Otros',
] as const;
const volume = z.number().finite().min(0).max(100000);
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const fluidRow = z.object({ time: id, values: z.array(volume).length(9) }).strict();
export const medicationPresentations = [
  'Tableta',
  'Cápsula',
  'Sobre',
  'Supositorio',
  'Óvulo',
  'Crema',
  'Pomada',
  'Gel',
  'Pasta',
  'Solución',
  'Jarabe',
  'Elixir',
  'Frasco',
  'Ampolla',
  'Vial',
  'Jeringa precargada',
] as const;
export const medicationRoutes = [
  'Oral',
  'Sublingual',
  'Rectal',
  'Vaginal',
  'Intravenosa',
  'Intramuscular',
  'Subcutánea',
  'Intradérmica',
  'Cutánea / transdérmica',
  'Oftálmica',
  'Ótica',
  'Nasal',
  'Inhalatoria',
  'SNG',
  'Gastrostomía',
] as const;
export const clinicalPayloadSchema = z.discriminatedUnion('kind', [
  z
    .object({ kind: z.enum(['INDICATION', 'EVOLUTION', 'HISTORY', 'BACKGROUND']), summary: text })
    .strict(),
  z
    .object({
      kind: z.literal('MEDICATION_CARD'),
      chronic: optionalText,
      instructions: optionalText,
      schedule: z
        .array(
          z
            .object({
              medicationId: id,
              times: z
                .array(time)
                .max(48)
                .refine((v) => new Set(v).size === v.length, 'No repita horas de aplicación.'),
              dilution: optionalText,
            })
            .strict(),
        )
        .max(200)
        .refine(
          (v) => new Set(v.map((s) => s.medicationId)).size === v.length,
          'No repita medicamentos en el horario.',
        )
        .optional(),
      stock: z
        .array(
          z
            .object({
              quoteItemId: id,
              inventoryItemId: id,
              warehouseId: id,
              unitsPerApplication: z.number().int().positive().max(100000),
            })
            .strict(),
        )
        .max(200),
    })
    .strict(),
  z
    .object({
      kind: z.literal('FLUID_BALANCE'),
      diagnosis: optionalText,
      weight: z.string().trim().max(100),
      rows: z.array(fluidRow).length(6),
      endogenous: volume,
      insensible: volume,
      hours: z.number().positive().max(24),
      notes: optionalText,
    })
    .strict(),
  z
    .object({
      kind: z.literal('CARE_PLAN'),
      plan: z.enum(['DIET', 'NURSING', 'LABORATORY']).optional(),
      plans: z
        .array(z.enum(['DIET', 'NURSING', 'LABORATORY']))
        .min(1)
        .max(3)
        .optional(),
      summary: optionalText,
    })
    .strict()
    .refine((v) => !!v.plan || !!v.plans?.length, 'Seleccione al menos un tipo de cuidado.')
    .refine(
      (v) => !v.plans || new Set(v.plans).size === v.plans.length,
      'No repita tipos de cuidado.',
    )
    .refine((v) => !v.plan || !v.plans || v.plans.includes(v.plan), 'Revise los tipos de cuidado.')
    .refine(
      (v) => !(v.plans ?? [v.plan]).some((p) => p !== 'LABORATORY') || !!v.summary,
      'Describa el plan de cuidado.',
    ),
  z
    .object({
      kind: z.literal('ADMINISTRATION'),
      cardId: id,
      time,
      dose: text,
      presentation: z.enum(medicationPresentations),
      route: z.enum(medicationRoutes),
      stock: z
        .array(
          z
            .object({
              quoteItemId: id,
              inventoryItemId: id,
              warehouseId: id,
              unitsPerApplication: z.number().int().positive().max(100000),
            })
            .strict(),
        )
        .max(200)
        .optional(),
      items: z
        .array(
          z
            .object({
              medicationId: id,
              scheduledTime: time.optional(),
              applied: z.boolean(),
              reason: optionalText,
            })
            .strict()
            .refine((v) => v.applied || !!v.reason, 'Indique por qué no se aplicó.'),
        )
        .min(1)
        .max(9600)
        .refine(
          (items) => new Set(items.map(medicationApplicationKey)).size === items.length,
          'No repita una aplicación del mismo medicamento y horario.',
        ),
    })
    .strict(),
  z
    .object({
      kind: z.literal('VITALS'),
      rows: z
        .array(
          z
            .object({
              time,
              heartRate: optionalText,
              respiratoryRate: optionalText,
              oxygen: optionalText,
              temperature: optionalText,
              pressure: optionalText,
              hgt: optionalText,
            })
            .strict(),
        )
        .min(1)
        .max(100),
    })
    .strict(),
  z
    .object({
      kind: z.literal('NURSING_NOTE'),
      rows: z
        .array(z.object({ time, note: text }).strict())
        .min(1)
        .max(100),
    })
    .strict(),
  z
    .object({
      kind: z.literal('SCALE'),
      scaleId: z.enum(scaleIds),
      definitionVersion: id.optional(),
      values: z.record(z.string(), z.number().finite()),
      notes: optionalText,
    })
    .strict(),
]);
export type ClinicalPayload = z.infer<typeof clinicalPayloadSchema>;
export const clinicalRecordInputSchema = z
  .object({
    id,
    patientId: id,
    caseId: id,
    date: z.iso.date(),
    payload: clinicalPayloadSchema,
    correctionOf: id.optional(),
    correctionReason: text.optional(),
  })
  .strict()
  .refine((v) => !v.correctionOf || !!v.correctionReason, 'Indique el motivo de corrección.');
export type ClinicalRecordInput = z.infer<typeof clinicalRecordInputSchema>;
export type MedicationSnapshot = {
  id: string;
  name: string;
  chronic: boolean;
  quoteId?: string;
  quoteItemId?: string;
  inventoryItemId?: string;
  applicationTimes?: string[];
  dilution?: string;
};
export type ClinicalRecord = ClinicalRecordInput & {
  createdAt: string;
  createdBy: string;
  author: string;
  version: number;
  rootId: string;
  jvpe?: string;
  medications?: MedicationSnapshot[];
  laboratories?: string[];
  scaleDefinition?: ScaleDefinition;
  score?: number | null;
  stockMovementIds?: string[];
  stockByMedication?: Record<string, string[]>;
  stockByApplication?: Record<string, string[]>;
};
/** Historical, unscheduled applications keep their original identity. */
export function medicationApplicationKey(item: { medicationId: string; scheduledTime?: string }) {
  return item.scheduledTime
    ? JSON.stringify([item.medicationId, item.scheduledTime])
    : item.medicationId;
}
export function medicationApplications(card?: ClinicalRecord) {
  return (card?.medications ?? []).flatMap((medication) =>
    (medication.applicationTimes?.length ? medication.applicationTimes : [undefined]).map(
      (scheduledTime) => ({
        medication,
        medicationId: medication.id,
        ...(scheduledTime ? { scheduledTime } : {}),
      }),
    ),
  );
}
export const carePlanLabels = {
  DIET: 'Dieta',
  NURSING: 'Cuidado de enfermería',
  LABORATORY: 'Laboratorio',
} as const;
export function carePlanTypes(payload: Extract<ClinicalPayload, { kind: 'CARE_PLAN' }>) {
  return payload.plans ?? (payload.plan ? [payload.plan] : []);
}
export function fluidTotals(payload: Extract<ClinicalPayload, { kind: 'FLUID_BALANCE' }>) {
  const intake = payload.rows.reduce(
    (sum, row) => sum + row.values.slice(0, 4).reduce((a, b) => a + b, 0),
    payload.endogenous,
  );
  const output = payload.rows.reduce(
    (sum, row) => sum + row.values.slice(4).reduce((a, b) => a + b, 0),
    payload.insensible,
  );
  return { intake, output, balance: Math.round((intake - output) * 100) / 100 };
}
export function currentClinicalRecords(records: ClinicalRecord[]) {
  const replaced = new Set(records.map((record) => record.correctionOf));
  return records.filter((record) => !replaced.has(record.id));
}
