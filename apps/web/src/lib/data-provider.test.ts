import { describe, expect, it, vi } from 'vitest';
import type { Hospitalization } from '@analiza/contracts';
import { hasAdministrativeProfilePayload, SupabaseDataProvider } from './data-provider';

const hospitalizationWithProfile: Hospitalization = {
  id: 'hosp-ch08-profile',
  patientId: 'patient-ch08-profile',
  startDate: '2026-08-28',
  status: 'ACTIVE',
  accountType: 'PRIVATE',
  administrativeProfile: { healthManager: 'Gestor sintÃ©tico' },
};

describe('CH08 secure administrative execution boundary', () => {
  it('recognizes an administrative execution profile payload', () => {
    expect(hasAdministrativeProfilePayload([hospitalizationWithProfile])).toBe(true);
    expect(
      hasAdministrativeProfilePayload([
        { ...hospitalizationWithProfile, administrativeProfile: undefined },
      ]),
    ).toBe(true);
    const hospitalizationWithoutProfile: Hospitalization = {
      id: 'hosp-ch08-without-profile',
      patientId: 'patient-ch08-without-profile',
      startDate: '2026-08-28',
      status: 'ACTIVE',
      accountType: 'PRIVATE',
    };
    expect(hasAdministrativeProfilePayload([hospitalizationWithoutProfile])).toBe(false);
  });

  // test-id: vitest:ch08-supabase-profile-guard
  it('never reaches a raw hospitalizations upsert for an administrative profile', async () => {
    const from = vi.fn();
    const provider = new SupabaseDataProvider(() => ({ from }) as never);

    await expect(
      provider.saveChanges({ hospitalizations: [hospitalizationWithProfile] }),
    ).rejects.toThrow('RPC segura');

    expect(from).not.toHaveBeenCalled();
  });
});
