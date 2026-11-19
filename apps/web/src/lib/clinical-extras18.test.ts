import { describe, expect, it } from 'vitest';
import {
  clinicalPayloadSchema,
  clinicalQuoteContext,
  isMedicationCardItem,
  quoteSchema,
} from '@analiza/contracts';
import { buildClinicalPdf } from './clinical-pdf';
import { PDFDocument } from 'pdf-lib';
import { landingPath } from './auth';

describe('extras18 clinical corrections', () => {
  it('requires a separate description for every selected care type and reads legacy summaries', () => {
    const payload = {
      kind: 'CARE_PLAN',
      plans: ['DIET', 'NURSING'],
      summary: '',
      descriptions: { DIET: 'Dieta sintética', NURSING: 'Cuidados sintéticos' },
    };
    expect(clinicalPayloadSchema.parse(payload)).toMatchObject(payload);
    expect(
      clinicalPayloadSchema.safeParse({ ...payload, descriptions: { DIET: 'Dieta' } }).success,
    ).toBe(false);
    expect(
      clinicalPayloadSchema.safeParse({
        ...payload,
        descriptions: { DIET: '  ', NURSING: 'Cuidados' },
      }).success,
    ).toBe(false);
    expect(
      clinicalPayloadSchema.safeParse({
        kind: 'CARE_PLAN',
        plan: 'NURSING',
        summary: 'Texto histórico',
      }).success,
    ).toBe(true);
    expect(
      clinicalPayloadSchema.safeParse({
        kind: 'CARE_PLAN',
        plans: ['LABORATORY'],
        summary: '',
        descriptions: {},
      }).success,
    ).toBe(true);
  });
  it('includes medication and named solutions once without matching unrelated words', () => {
    for (const name of [
      'Solución sintética',
      'SOLUCIONES de QA',
      'solucion de prueba',
      'Solución de QA',
    ])
      expect(isMedicationCardItem({ category: 'SUPPLIES', name })).toBe(true);
    expect(isMedicationCardItem({ category: 'MEDICATIONS', name: 'Soluciones QA' })).toBe(true);
    for (const name of ['Resolución', 'Sin soluciónfoo', 'Insumo normal'])
      expect(isMedicationCardItem({ category: 'SUPPLIES', name })).toBe(false);
  });
  it('projects clinical quote context without commercial data and routes Doctor into clinical admissions', () => {
    const quote = quoteSchema.parse({
      id: 'quote-qa',
      patientId: 'p-qa',
      version: 1,
      status: 'DRAFT',
      summary: 'QA',
      items: [{ id: 'i', category: 'SUPPLIES', name: 'Solución QA', quantity: 1, unitPrice: 99 }],
      createdAt: '2026-11-18T12:00:00Z',
    });
    const projected = clinicalQuoteContext(quote);
    expect(projected.items[0].name).toBe('Solución QA');
    for (const key of ['total', 'insurerAmount', 'comments', 'discount'])
      expect(projected).not.toHaveProperty(key);
    expect(projected.items[0]).not.toHaveProperty('unitPrice');
    expect(landingPath({ userId: 'doctor', role: 'DOCTOR', mode: 'mock' }, '/quotes')).toBe(
      '/clinical/hospitalizations',
    );
  });
  it('generates a real paginated PDF for long selected content including accents and symbols', async () => {
    const bytes = await buildClinicalPdf([
      { text: 'Antecedentes personales · José', heading: 2 },
      ...Array.from({ length: 90 }, (_, i) => ({
        text: `Registro sintético ${i} · Descripción de cuidados. μg ${'texto '.repeat(24)}`,
      })),
      { text: 'A'.repeat(450) },
    ]);
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');
    expect((await PDFDocument.load(bytes)).getPageCount()).toBeGreaterThan(1);
    await expect(buildClinicalPdf([])).rejects.toThrow();
  });
});
