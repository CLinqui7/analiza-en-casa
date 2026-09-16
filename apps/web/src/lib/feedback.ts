import { z } from 'zod';

export const feedbackModules = [
  ['DASHBOARD', 'Dashboard'],
  ['PATIENTS', 'Pacientes'],
  ['AGENDA', 'Agenda'],
  ['HOSPITALIZATIONS', 'Hospitalizaciones'],
  ['QUOTES', 'Cotizaciones'],
  ['RECEIVABLES', 'Cuentas por cobrar'],
  ['PAYABLES', 'Cuentas por pagar'],
  ['PAYMENTS', 'Pagos'],
  ['INSURANCE', 'Preautorizaciones y reclamos'],
  ['CLINICAL', 'Expediente clínico'],
  ['NURSING', 'Enfermería'],
  ['MEDICATIONS', 'Medicamentos'],
  ['DOCTORS', 'Médicos y recursos'],
  ['INVENTORY', 'Inventario'],
  ['PURCHASES', 'Compras'],
  ['CATALOGS', 'Catálogos'],
  ['REPORTS', 'Reportes'],
  ['FILES', 'Archivos y adjuntos'],
  ['ACCESS', 'Inicio de sesión o registro'],
  ['NAVIGATION', 'Menú o navegación'],
  ['OTHER', 'Otra función'],
] as const;

export const feedbackCategories = [
  ['ERROR', 'Reportar un error'],
  ['QUESTION', 'Hacer una pregunta'],
  ['NEW_FEATURE', 'Pedir una función nueva'],
  ['CHANGE', 'Solicitar una modificación'],
  ['IMPROVEMENT', 'Proponer una mejora'],
] as const;

export const feedbackCategoryHelp: Record<(typeof feedbackCategories)[number][0], string> = {
  ERROR: 'Algo no funciona o muestra información incorrecta.',
  QUESTION: 'Necesitas ayuda para entender o usar una función.',
  NEW_FEATURE: 'Quieres añadir una herramienta que todavía no existe.',
  CHANGE: 'Quieres cambiar una función o pantalla existente.',
  IMPROVEMENT: 'Tienes una idea para hacer el trabajo más claro o rápido.',
};

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
  submittedBy: z.string().trim().min(1).max(254).optional(),
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
