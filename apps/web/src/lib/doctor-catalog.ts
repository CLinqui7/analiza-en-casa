import type { DoctorAttachment } from '@analiza/contracts';
import type { SearchableOption } from '@/lib/patient-form';

export const doctorSpecialtyOptions = [
  'Técnico(a) en enfermería',
  'Tecnólogo(a) en enfermería',
  'Licenciado(a) en enfermería',
  'Supervisor(a)',
  'Licenciado en Terapia respiratoria',
  'Licenciado en Terapia física',
  'Nutricionista',
  'Psicólogo(a)',
].map((label) => ({ value: label, label })) satisfies SearchableOption[];

type FileMetadataSource = Pick<File, 'name' | 'size' | 'type'>;

/** Metadata only: file bytes belong in a private, RLS-protected storage integration. */
export function toDoctorAttachmentMetadata(files: Iterable<FileMetadataSource>): DoctorAttachment[] {
  return Array.from(files, (file) => ({
    id: crypto.randomUUID(),
    name: file.name,
    mimeType: file.type || undefined,
    size: file.size,
  }));
}
