import { describe, expect, it } from 'vitest';
import type { Doctor } from '@analiza/contracts';
import { doctorSelectionLabels, searchDoctors } from './doctor-search';

const doctors: Doctor[] = [
  { id: 'a', fullName: 'Ángela Núñez', specialty: 'Cardiología', jvpm: '000145', attachments: [] },
  {
    id: 'b',
    fullName: 'Óscar Pérez',
    specialty: 'Medicina',
    conadem: 'CN-0045',
    attachments: [],
    practiceLocations: [{ id: 'location-b', clinicName: 'Clínica Corazón', city: 'Santa Tecla' }],
  },
];
describe('doctor search across the historical directory', () => {
  it('matches accents, reordered name tokens, identifiers, specialty and additional clinics', () => {
    for (const query of ['  NUNEZ   angela ', '000145', 'cardiologia'])
      expect(searchDoctors(doctors, query).map((d) => d.id)).toEqual(['a']);
    for (const query of ['oscar', 'CN 0045', 'clinica corazon', 'tecla'])
      expect(searchDoctors(doctors, query).map((d) => d.id)).toEqual(['b']);
    expect(searchDoctors(doctors, 'No existe')).toEqual([]);
  });
  it('keeps both explicit selections during filtering without duplicating or altering them', () => {
    expect(searchDoctors(doctors, 'ninguno', ['b', 'a', 'a']).map((d) => d.id)).toEqual(['a', 'b']);
    expect(doctors[0].fullName).toBe('Ángela Núñez');
    expect(searchDoctors(doctors, 'b', ['missing']).some((d) => d.id === 'missing')).toBe(false);
  });
  it('does not merge homonyms and makes separate source records distinguishable', () => {
    const entries = [
      ...doctors,
      { ...doctors[0], id: 'c', jvpm: '000146' },
      { ...doctors[0], id: 'd' },
    ];
    const labels = doctorSelectionLabels(entries);
    expect(searchDoctors(entries, 'angela')).toHaveLength(3);
    expect(labels.get('c')).toContain('000146');
    expect(labels.get('a')).not.toBe(labels.get('d'));
    expect(labels.get('b')).toBe('Óscar Pérez');
    expect(doctorSelectionLabels([...entries].reverse())).toEqual(labels);
  });
  it('searches the final record of a 700-profile directory without requiring pending fields', () => {
    const volume = Array.from({ length: 700 }, (_, i) => ({
      ...doctors[0],
      id: `profile-${i}`,
      fullName: `Profesional ${i}`,
      jvpm: `JVPM-${i}`,
    }));
    expect(searchDoctors(volume, 'JVPM 699').map((d) => d.id)).toEqual(['profile-699']);
  });
});
