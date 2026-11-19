import type { Doctor } from '@analiza/contracts';

export const normalizeDoctorSearch = (value: string) =>
  value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** Search source fields without changing their spelling or merging identities. */
export function searchDoctors(
  doctors: readonly Doctor[],
  query: string,
  keepIds: readonly (string | undefined)[] = [],
) {
  const tokens = normalizeDoctorSearch(query).split(' ').filter(Boolean);
  const keep = new Set(keepIds.filter(Boolean));
  return doctors
    .filter((doctor) => {
      if (keep.has(doctor.id) || !tokens.length) return true;
      const fields = [
        doctor.fullName,
        doctor.documentId,
        doctor.jvpm,
        doctor.conadem,
        doctor.specialty,
        doctor.clinicName,
        doctor.zone,
        ...(doctor.practiceLocations ?? []).flatMap((location) => [
          location.clinicName,
          location.specialty,
          location.city,
          location.department,
        ]),
      ];
      const text = normalizeDoctorSearch(fields.filter(Boolean).join(' '));
      return tokens.every((token) => text.includes(token));
    })
    .sort(
      (a, b) =>
        a.fullName.localeCompare(b.fullName, 'es', { sensitivity: 'base' }) ||
        a.id.localeCompare(b.id),
    );
}

/** Homonyms remain separate and display distinguishing source identifiers. */
export function doctorSelectionLabels(doctors: readonly Doctor[]): Map<string, string> {
  const names = new Map<string, number>();
  for (const doctor of doctors) {
    const key = normalizeDoctorSearch(doctor.fullName);
    names.set(key, (names.get(key) ?? 0) + 1);
  }
  const labels = doctors.map((doctor) => ({
    doctor,
    label:
      (names.get(normalizeDoctorSearch(doctor.fullName)) ?? 0) > 1
        ? [
            doctor.fullName,
            doctor.jvpm
              ? `JVPM ${doctor.jvpm}`
              : doctor.conadem
                ? `CONADEM ${doctor.conadem}`
                : doctor.documentId
                  ? `DUI ${doctor.documentId}`
                  : '',
            doctor.specialty,
          ]
            .filter(Boolean)
            .join(' · ')
        : doctor.fullName,
  }));
  const counts = new Map<string, number>();
  for (const { label } of labels) counts.set(label, (counts.get(label) ?? 0) + 1);
  const positions = new Map<string, number>();
  return new Map(
    labels
      .sort((a, b) => a.doctor.id.localeCompare(b.doctor.id))
      .map(({ doctor, label }) => {
        const position = (positions.get(label) ?? 0) + 1;
        positions.set(label, position);
        return [doctor.id, (counts.get(label) ?? 0) > 1 ? `${label} · ficha ${position}` : label];
      }),
  );
}
