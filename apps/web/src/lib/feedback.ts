import { z } from 'zod';

export const feedbackModules = [
  ['DASHBOARD', 'Dashboard'],
  ['PATIENTS', 'Pacientes'],
  ['AGENDA', 'Agenda'],
  ['HOSPITALIZATIONS', 'Hospitalización'],
  ['NURSING', 'Enfermería'],
  ['MEDICATIONS', 'Medicamentos'],
  ['INVENTORY', 'Inventario'],
  ['REPORTS', 'Reportes'],
  ['ACCESS', 'Inicio de sesión o registro'],
  ['OTHER', 'Otro módulo'],
] as const;

export const feedbackCategories = [
  ['ERROR', 'Encontré un error'],
  ['QUESTION', 'Tengo una pregunta'],
  ['IMPROVEMENT', 'Quiero proponer una mejora'],
] as const;

const moduleSchema = z.enum(feedbackModules.map(([value]) => value));
const categorySchema = z.enum(feedbackCategories.map(([value]) => value));

export const feedbackInputSchema = z
  .object({
    module: moduleSchema,
    category: categorySchema,
    description: z.string().trim().min(10).max(4000),
  })
  .strict();

export const feedbackReportSchema = feedbackInputSchema.extend({
  id: z.string().uuid(),
  imageName: z.string().trim().min(1).max(255).optional(),
  imageMime: z.string().trim().min(1).max(100).optional(),
  createdAt: z.string().datetime(),
  status: z.enum(['NEW', 'REVIEWING', 'RESOLVED']),
});

export const MAX_FEEDBACK_IMAGE_BYTES = 5 * 1024 * 1024;
export const feedbackImageTypes = ['image/jpeg', 'image/png', 'image/webp'] as const;

export type FeedbackInput = z.infer<typeof feedbackInputSchema>;
export type FeedbackReport = z.infer<typeof feedbackReportSchema>;
export type FeedbackImage = Readonly<{
  name: string;
  mimeType: string;
  bytes: Uint8Array;
}>;

export function feedbackLabel(options: ReadonlyArray<readonly [string, string]>, value: string) {
  return options.find(([candidate]) => candidate === value)?.[1] ?? value;
}
