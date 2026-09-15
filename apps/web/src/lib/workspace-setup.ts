import { z } from 'zod';

const text = z.string().trim().max(240);
const email = z.union([z.literal(''), z.string().trim().toLowerCase().pipe(z.email().max(254))]);
export const organizationProfileSchema = z
  .object({
    name: text.min(2),
    contactName: text,
    email,
    phone: z.string().trim().max(40),
    address: z.string().trim().max(500),
    city: text,
    country: text,
    coverage: z.string().trim().max(1000),
  })
  .strict();
export const staffProfileSchema = z
  .object({
    id: z.uuid(),
    name: text.min(2),
    position: text.min(2),
    specialty: text,
    registrationNumber: text,
    email,
    phone: z.string().trim().max(40),
    active: z.boolean(),
  })
  .strict();
export const serviceProfileSchema = z
  .object({
    id: z.uuid(),
    name: text.min(2),
    description: z.string().trim().max(2000),
    modality: z.enum(['HOME', 'ONSITE', 'REMOTE', 'OTHER']),
    durationMinutes: z.number().int().positive().max(100000).optional(),
    price: z.number().finite().nonnegative().max(100000000).optional(),
    currency: z.string().trim().max(3),
    active: z.boolean(),
  })
  .strict()
  .refine((service) => service.price === undefined || /^[A-Z]{3}$/.test(service.currency), {
    message: 'Indica la moneda de tres letras cuando escribas una tarifa.',
    path: ['currency'],
  });
export const workspaceSetupSchema = z
  .object({
    expectedVersion: z.number().int().nonnegative(),
    organization: organizationProfileSchema,
    staff: z.array(staffProfileSchema).max(50),
    services: z.array(serviceProfileSchema).max(50),
  })
  .strict()
  .refine(
    (value) =>
      new Set(value.staff.map((item) => item.id)).size === value.staff.length &&
      new Set(value.services.map((item) => item.id)).size === value.services.length,
    { message: 'Hay filas duplicadas en el cuestionario.' },
  );

export type OrganizationProfile = z.infer<typeof organizationProfileSchema>;
export type StaffProfile = z.infer<typeof staffProfileSchema>;
export type ServiceProfile = z.infer<typeof serviceProfileSchema>;
export type WorkspaceSetup = z.infer<typeof workspaceSetupSchema>;

export function emptyWorkspaceSetup(): WorkspaceSetup {
  return {
    expectedVersion: 0,
    organization: {
      name: '',
      contactName: '',
      email: '',
      phone: '',
      address: '',
      city: '',
      country: '',
      coverage: '',
    },
    staff: [],
    services: [],
  };
}
