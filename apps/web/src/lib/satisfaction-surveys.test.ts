import { describe, expect, it } from 'vitest';
import { surveyCounts, surveyQuestions, validSurveyAnswers } from './satisfaction-surveys';

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
});
