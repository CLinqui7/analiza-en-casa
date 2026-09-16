import { z } from 'zod';

const trimmedText = (maximum: number) => z.string().trim().max(maximum);
const email = z.union([z.literal(''), z.string().trim().toLowerCase().pipe(z.email().max(254))]);
const daySchema = z.enum(['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']);

const profileDraftSchema = z
  .object({
    fullName: trimmedText(160),
    role: z.enum(['GENERAL_NURSE', 'NURSING_ASSISTANT', 'HEAD_NURSE', 'CAREGIVER', 'OTHER']),
    professionalId: trimmedText(80),
    email,
    phone: trimmedText(40),
    yearsExperience: z.number().int().min(0).max(70),
    mainFunctions: trimmedText(2000),
  })
  .strict();

export const nurseProfileDraftSchema = z
  .object({
    expectedVersion: z.number().int().nonnegative(),
    completedAt: z.string().datetime().optional(),
    profile: profileDraftSchema,
    workload: z
      .object({
        maxPatients: z.number().int().min(1).max(100),
        careExperience: trimmedText(2000),
        knownMedicationIds: z.array(z.string().trim().min(1).max(160)).max(100),
        otherMedications: trimmedText(2000),
      })
      .strict(),
    schedule: z
      .object({
        days: z.array(daySchema).min(1),
        startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
        endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
        weeklyHours: z.number().min(1).max(168),
        preferredShift: z.enum(['MORNING', 'AFTERNOON', 'NIGHT', 'MIXED']),
        emergencyAvailability: z.boolean(),
        notes: trimmedText(1000),
      })
      .strict(),
  })
  .strict();

export const nurseProfileSchema = nurseProfileDraftSchema.extend({
  profile: profileDraftSchema.extend({
    fullName: trimmedText(160).min(2, 'Escribe tu nombre completo.'),
    mainFunctions: trimmedText(2000).min(10, 'Describe brevemente tus funciones principales.'),
  }),
});

export type NurseProfile = z.infer<typeof nurseProfileDraftSchema>;
export type NurseWorkDay = z.infer<typeof daySchema>;

export function emptyNurseProfile(): NurseProfile {
  return {
    expectedVersion: 0,
    profile: {
      fullName: '',
      role: 'GENERAL_NURSE',
      professionalId: '',
      email: '',
      phone: '',
      yearsExperience: 0,
      mainFunctions: '',
    },
    workload: {
      maxPatients: 1,
      careExperience: '',
      knownMedicationIds: [],
      otherMedications: '',
    },
    schedule: {
      days: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
      startTime: '08:00',
      endTime: '16:00',
      weeklyHours: 40,
      preferredShift: 'MORNING',
      emergencyAvailability: false,
      notes: '',
    },
  };
}

const storagePrefix = 'analiza.en.casa.nurse-profile.v1';

function storageKey(userId: string) {
  return `${storagePrefix}:${userId}`;
}

export function loadLocalNurseProfile(storage: Storage, userId: string): NurseProfile {
  try {
    const raw = storage.getItem(storageKey(userId));
    if (!raw) return emptyNurseProfile();
    const parsed = nurseProfileDraftSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : emptyNurseProfile();
  } catch {
    return emptyNurseProfile();
  }
}

export function saveLocalNurseProfile(
  storage: Storage,
  userId: string,
  input: NurseProfile,
): NurseProfile {
  const data = nurseProfileSchema.parse(input);
  const current = loadLocalNurseProfile(storage, userId);
  if (current.expectedVersion !== data.expectedVersion) {
    throw new Error('El perfil cambió en otra pestaña. Recarga la página antes de guardar.');
  }
  const saved = { ...data, expectedVersion: data.expectedVersion + 1 };
  storage.setItem(storageKey(userId), JSON.stringify(saved));
  return saved;
}
