import { describe, expect, it } from 'vitest';
import {
  feedbackImageTypes,
  feedbackInputSchema,
  feedbackReportSchema,
  MAX_FEEDBACK_IMAGE_BYTES,
} from '@/lib/feedback';

describe('nurse feedback', () => {
  it('accepts a structured question, error, or improvement', () => {
    expect(
      feedbackInputSchema.safeParse({
        module: 'MEDICATIONS',
        category: 'IMPROVEMENT',
        description: 'Me gustaría encontrar los medicamentos con una búsqueda más rápida.',
      }).success,
    ).toBe(true);
  });

  it('rejects unknown modules and descriptions without enough detail', () => {
    expect(
      feedbackInputSchema.safeParse({
        module: 'FORGED',
        category: 'ERROR',
        description: 'Falla',
      }).success,
    ).toBe(false);
  });

  it('exposes only supported image types and bounded report metadata', () => {
    expect(feedbackImageTypes).toEqual(['image/jpeg', 'image/png', 'image/webp']);
    expect(MAX_FEEDBACK_IMAGE_BYTES).toBe(5 * 1024 * 1024);
    expect(
      feedbackReportSchema.safeParse({
        id: crypto.randomUUID(),
        module: 'AGENDA',
        category: 'ERROR',
        description: 'El botón del horario no respondió al primer intento.',
        imageName: 'captura.png',
        imageMime: 'image/png',
        createdAt: new Date().toISOString(),
        status: 'NEW',
      }).success,
    ).toBe(true);
  });
});
