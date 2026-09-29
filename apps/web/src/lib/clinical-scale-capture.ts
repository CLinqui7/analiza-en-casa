import { z } from 'zod';
import { clinicalScaleReferences } from './clinical-scale-references';

export const clinicalScaleSourceVersion = 'studio-html-2026-09-29';

const baseInput = z
  .object({
    scaleId: z.string().min(1).max(40),
    caseId: z.string().min(1).max(120).optional(),
    observedAt: z.string().datetime({ offset: true }),
    values: z.record(z.string(), z.number().int()),
    notes: z.string().trim().max(2000).default(''),
  })
  .strict();

export type ClinicalScaleInput = z.infer<typeof baseInput>;
export type ClinicalScaleCapture = ClinicalScaleInput & {
  id: string;
  patientId: string;
  sourceRow: number;
  sourceVersion: string;
  clinicalValidated: false;
  createdBy: string;
  authorName: string;
  createdAt: string;
};

/** Validates the exact fields and visible values in the supplied HTML; never infers a score. */
export function parseClinicalScaleInput(raw: unknown): ClinicalScaleInput {
  const input = baseInput.parse(raw);
  const reference = clinicalScaleReferences.find((item) => item.id === input.scaleId);
  if (!reference) throw new Error('La escala seleccionada no está disponible.');
  const expected = new Set(reference.fields.map((field) => field.key));
  if (Object.keys(input.values).length !== expected.size) {
    throw new Error('Completa todos los campos de la captura antes de guardar.');
  }
  for (const field of reference.fields) {
    if (!field.options.includes(input.values[field.key])) {
      throw new Error(`Revisa el valor de ${field.label}.`);
    }
  }
  if (Object.keys(input.values).some((key) => !expected.has(key))) {
    throw new Error('La captura contiene campos no reconocidos.');
  }
  return input;
}
