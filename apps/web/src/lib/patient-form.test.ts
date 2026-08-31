import { describe, expect, it } from 'vitest';
import {
  insuranceProviderOptions,
  normalizeCoverage,
  parseExplicitCoordinates,
  prefillPolicyHolder,
  searchOptions,
} from './patient-form';

describe('CH02 patient form domain helpers', () => {
  it('searches synthetic insurers without returning unrelated entities', () => {
    expect(searchOptions(insuranceProviderOptions, 'coBerTUra')).toEqual([
      { value: 'Cobertura sintética QA', label: 'Cobertura sintética QA' },
    ]);
    expect(searchOptions(insuranceProviderOptions, 'persona inexistente')).toEqual([]);
  });

  it('parses only explicit, valid coordinates without fetching a pasted URL', () => {
    expect(parseExplicitCoordinates('https://maps.example/?q=13.692900,-89.218200')).toMatchObject({
      normalized: '13.692900, -89.218200',
    });
    expect(parseExplicitCoordinates('https://maps.example/place/unknown')).toBeUndefined();
    expect(parseExplicitCoordinates('91.1, -89.2')).toBeUndefined();
  });

  it('prefills only the observed holder fields and normalizes a single coverage', () => {
    expect(
      prefillPolicyHolder({
        fullName: ' Paciente Demo ',
        documentId: ' 123 ',
        birthDate: '1990-01-01',
      }),
    ).toEqual({
      holderFullName: 'Paciente Demo',
      holderDocumentId: '123',
      holderBirthDate: '1990-01-01',
    });
    expect(
      normalizeCoverage({ status: 'INSURED', insurer: ' Cobertura ', policyNumber: ' P-1 ' }),
    ).toMatchObject({ insurer: 'Cobertura', policyNumber: 'P-1' });
  });
});
