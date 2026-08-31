import type { Patient, PatientInsurance } from '@analiza/contracts';
import { normalizeText } from '@analiza/domain';

export type SearchableOption = { value: string; label: string };

// Deliberately synthetic administrative catalogues. They are not legal,
// insurance, or clinical reference data.
export const insuranceProviderOptions: SearchableOption[] = [
  'Aseguradora demo A',
  'Cobertura sintética QA',
  'Protección demo Norte',
  'Red administrativa demo',
  'Salud ejemplo Central',
  'Seguro sintético Uno',
].map((label) => ({ value: label, label }));

export const nationalityOptions: SearchableOption[] = [
  'Salvadoreña (demo)',
  'Guatemalteca (demo)',
  'Hondureña (demo)',
  'Nicaragüense (demo)',
  'Otra (demo)',
].map((label) => ({ value: label, label }));

export const companyOptions: SearchableOption[] = [
  'Empresa demo',
  'Organización sintética QA',
  'Sin empresa registrada',
].map((label) => ({ value: label, label }));

export function searchOptions(
  options: readonly SearchableOption[],
  query: string,
): SearchableOption[] {
  const needle = normalizeText(query);
  return needle
    ? options.filter((option) => normalizeText(option.label).includes(needle))
    : [...options];
}

export type ParsedLocation = { latitude: number; longitude: number; normalized: string };

function isLatitude(value: number) {
  return Number.isFinite(value) && value >= -90 && value <= 90;
}
function isLongitude(value: number) {
  return Number.isFinite(value) && value >= -180 && value <= 180;
}

/**
 * Accepts only coordinates explicitly embedded in an input. It never fetches
 * user-provided URLs, so pasted links cannot trigger SSRF or silent sharing.
 */
export function parseExplicitCoordinates(input: string): ParsedLocation | undefined {
  const value = input.trim();
  if (!value) return undefined;
  const pair = value.match(
    /(?:^|[?&#=,\s])(-?\d{1,2}(?:\.\d+)?)\s*[,;\s]\s*(-?\d{1,3}(?:\.\d+)?)(?:$|[?&#/,\s])/,
  );
  if (!pair) return undefined;
  const latitude = Number(pair[1]);
  const longitude = Number(pair[2]);
  if (!isLatitude(latitude) || !isLongitude(longitude)) return undefined;
  return { latitude, longitude, normalized: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}` };
}

export function prefillPolicyHolder(
  patient: Pick<Patient, 'birthDate' | 'documentId' | 'fullName'>,
): { holderBirthDate: string; holderDocumentId: string; holderFullName: string } {
  return {
    holderDocumentId: patient.documentId.trim(),
    holderFullName: patient.fullName.trim(),
    holderBirthDate: patient.birthDate ?? '',
  };
}

export function normalizeCoverage(coverage: PatientInsurance): PatientInsurance {
  return {
    ...coverage,
    insurer: coverage.insurer?.trim(),
    policyNumber: coverage.policyNumber?.trim(),
    certificateOrUnit: coverage.certificateOrUnit?.trim(),
    holderDocumentId: coverage.holderDocumentId?.trim(),
    holderFullName: coverage.holderFullName?.trim(),
  };
}
