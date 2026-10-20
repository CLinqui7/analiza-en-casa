import { describe, expect, it } from 'vitest';
import {
  doctorRespondentNameSchema,
  surveyCounts,
  surveyInvitationInputSchema,
  surveyQuestions,
  validSurveyAnswers,
} from './satisfaction-surveys';

describe('satisfaction questionnaires', () => {
  it('keeps both attached questionnaires distinct and accepts only their allowed answers', () => {
    expect(surveyQuestions.PATIENT).toHaveLength(6);
    expect(surveyQuestions.DOCTOR).toHaveLength(7);
    const patient = ['Excelente', 'Siempre', 'Totalmente', 'Buena', 'Satisfecho', '5'];
    expect(validSurveyAnswers('PATIENT', patient)).toBe(true);
    expect(validSurveyAnswers('PATIENT', [...patient.slice(0, 5), '6'])).toBe(false);
    expect(validSurveyAnswers('DOCTOR', patient)).toBe(false);
  });
  it('aggregates choices without returning respondent identifiers', () => {
    const responses = [
      ['Excelente', 'Siempre', 'Totalmente', 'Buena', 'Satisfecho', '5'],
      ['Buena', 'Casi siempre', 'Poco', 'Regular', 'Poco satisfecho', '3'],
    ];
    const counts = surveyCounts('PATIENT', responses);
    expect(counts[0].counts).toMatchObject({ Excelente: 1, Buena: 1 });
    expect(counts[5].counts).toMatchObject({ '5': 1, '3': 1 });
  });
  it('allows manual one-person links without a directory record and validates the doctor name', () => {
    expect(
      surveyInvitationInputSchema.safeParse({
        kind: 'DOCTOR',
        expiresAt: '2026-12-01T00:00:00.000Z',
      }).success,
    ).toBe(true);
    expect(doctorRespondentNameSchema.parse('  Doctora Ejemplo  ')).toBe('Doctora Ejemplo');
    expect(doctorRespondentNameSchema.safeParse(' ').success).toBe(false);
    expect(doctorRespondentNameSchema.safeParse('A'.repeat(121)).success).toBe(false);
  });
});
