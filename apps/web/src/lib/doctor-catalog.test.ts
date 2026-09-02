import { describe, expect, it } from 'vitest';
import { doctorSpecialtyOptions, toDoctorAttachmentMetadata } from './doctor-catalog';

// test-id: vitest:cr007-professional-specialties
// test-id: vitest:cr006-doctor-attachment-metadata
describe('doctor catalog', () => {
  it('keeps every requested professional specialty available in the selector', () => {
    expect(doctorSpecialtyOptions.map((option) => option.label)).toEqual([
      'Técnico(a) en enfermería',
      'Tecnólogo(a) en enfermería',
      'Licenciado(a) en enfermería',
      'Supervisor(a)',
      'Licenciado en Terapia respiratoria',
      'Licenciado en Terapia física',
      'Nutricionista',
      'Psicólogo(a)',
    ]);
  });

  it('retains attachment metadata without retaining file content in browser storage', () => {
    const [attachment] = toDoctorAttachmentMetadata([
      { name: 'credencial-demo.pdf', size: 128, type: 'application/pdf' } as File,
    ]);
    expect(attachment).toMatchObject({
      name: 'credencial-demo.pdf',
      size: 128,
      mimeType: 'application/pdf',
    });
    expect(attachment).not.toHaveProperty('content');
  });
});
