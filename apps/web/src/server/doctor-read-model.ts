import type { Doctor } from '@analiza/contracts';
import { can, type Role } from '@/lib/permissions';

/** Quote authors need a selectable professional, not the administrative personnel file. */
export function doctorForReader(doctor: Doctor, role: Role): Doctor {
  if (can(role, 'settings:write')) return doctor;
  return {
    id: doctor.id,
    fullName: doctor.fullName,
    specialty: doctor.specialty,
    jvpm: doctor.jvpm,
    conadem: doctor.conadem,
    clinicName: doctor.clinicName,
    practiceLocations: doctor.practiceLocations?.map(
      ({ id, specialty, clinicName, city, department }) => ({
        id,
        specialty,
        clinicName,
        city,
        department,
      }),
    ),
    attachments: [],
  };
}
