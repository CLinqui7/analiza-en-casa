import { z } from 'zod';

export const surveyKindSchema = z.enum(['PATIENT', 'DOCTOR']);
export type SurveyKind = z.infer<typeof surveyKindSchema>;
export type SurveyQuestion = { text: string; options?: readonly string[] };

const quality = ['Excelente', 'Buena', 'Regular', 'Mala'] as const;
const professionalism = ['Siempre', 'Casi siempre', 'Algunas veces', 'Nunca'] as const;
const satisfaction = ['Muy satisfecho', 'Satisfecho', 'Poco satisfecho', 'Insatisfecho'] as const;
const rating = ['1', '2', '3', '4', '5'] as const;

export const surveyQuestions: Record<SurveyKind, readonly SurveyQuestion[]> = {
  PATIENT: [
    {
      text: '¿Cómo calificarías la atención recibida por nuestro personal de enfermería?',
      options: quality,
    },
    {
      text: '¿El personal demostró profesionalismo, amabilidad y empatía durante la atención?',
      options: professionalism,
    },
    {
      text: '¿Te sentiste seguro y tranquilo con los cuidados brindados en casa?',
      options: ['Totalmente', 'En gran medida', 'Poco', 'Nada'],
    },
    {
      text: '¿Cómo evaluarías la comunicación y el seguimiento de nuestro equipo?',
      options: quality,
    },
    {
      text: 'En general, ¿qué tan satisfecho estás con el servicio de Analiza en Casa?',
      options: satisfaction,
    },
    {
      text: 'En una escala del 1 al 5, ¿qué tan probable es que recomiendes Analiza en Casa a tus familiares o amigos?',
      options: rating,
    },
  ],
  DOCTOR: [
    {
      text: '¿Cómo calificaría la calidad de la atención brindada por nuestro personal de enfermería a sus pacientes?',
      options: quality,
    },
    {
      text: '¿Considera que nuestro personal de enfermería demuestra profesionalismo, competencias técnicas y compromiso con el cuidado del paciente?',
      options: professionalism,
    },
    {
      text: '¿Cómo evalúa la comunicación de nuestro equipo con usted respecto a la evolución y las novedades clínicas de sus pacientes?',
      options: quality,
    },
    {
      text: '¿Qué tan satisfecho está con el cumplimiento de sus indicaciones médicas y la continuidad del tratamiento en el domicilio?',
      options: satisfaction,
    },
    {
      text: '¿Qué tan satisfecho está con la coordinación y capacidad de respuesta de Analiza en Casa ante las necesidades de sus pacientes?',
      options: satisfaction,
    },
    {
      text: 'En una escala del 1 al 5, ¿qué tan probable es que recomiende Analiza en Casa a otros colegas médicos?',
      options: rating,
    },
    {
      text: '¿Qué aspectos considera que podríamos mejorar para fortalecer nuestro servicio y la atención de sus pacientes?',
    },
  ],
};

export const surveyInvitationInputSchema = z
  .object({
    kind: surveyKindSchema,
    targetId: z.string().trim().min(1).max(200).optional(),
    expiresAt: z.string().datetime(),
  })
  .strict();

export const surveyPublicInputSchema = z
  .object({
    organizationId: z.string().trim().min(1).max(200),
    token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  })
  .strict();

export const doctorRespondentNameSchema = z.string().trim().min(2).max(120);

export function validSurveyAnswers(kind: SurveyKind, answers: unknown): answers is string[] {
  if (!Array.isArray(answers) || answers.length !== surveyQuestions[kind].length) return false;
  return answers.every((answer, index) => {
    if (typeof answer !== 'string') return false;
    const options = surveyQuestions[kind][index].options;
    return options ? options.includes(answer) : answer.trim().length <= 1000;
  });
}

export function surveyCounts(kind: SurveyKind, responses: readonly string[][]) {
  return surveyQuestions[kind].map((question, index) => ({
    question: question.text,
    counts: question.options
      ? Object.fromEntries(
          question.options.map((option) => [
            option,
            responses.filter((answers) => answers[index] === option).length,
          ]),
        )
      : {},
  }));
}
