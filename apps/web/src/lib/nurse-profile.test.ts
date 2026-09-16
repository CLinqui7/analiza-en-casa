import { describe, expect, it } from 'vitest';
import {
  emptyNurseProfile,
  loadLocalNurseProfile,
  nurseProfileSchema,
  saveLocalNurseProfile,
} from '@/lib/nurse-profile';

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();
  get length() {
    return this.values.size;
  }
  clear() {
    this.values.clear();
  }
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  key(index: number) {
    return Array.from(this.values.keys())[index] ?? null;
  }
  removeItem(key: string) {
    this.values.delete(key);
  }
  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

function completedProfile() {
  const profile = emptyNurseProfile();
  profile.profile.fullName = 'Enfermera Demo';
  profile.profile.mainFunctions = 'Cuidados generales y seguimiento domiciliario.';
  return profile;
}

describe('nurse onboarding profile', () => {
  it('validates the nurse, workload, medications, and schedule sections', () => {
    const profile = completedProfile();
    profile.workload.knownMedicationIds = ['configuration-demo-medication-qa'];
    expect(nurseProfileSchema.safeParse(profile).success).toBe(true);
    expect(
      nurseProfileSchema.safeParse({ ...profile, schedule: { ...profile.schedule, days: [] } })
        .success,
    ).toBe(false);
  });

  it('stores each nurse profile independently and versions updates', () => {
    const storage = new MemoryStorage();
    const saved = saveLocalNurseProfile(storage, 'nurse-a', completedProfile());
    expect(saved.expectedVersion).toBe(1);
    expect(loadLocalNurseProfile(storage, 'nurse-a')).toEqual(saved);
    expect(loadLocalNurseProfile(storage, 'nurse-b')).toEqual(emptyNurseProfile());
  });

  it('rejects stale updates and safely ignores malformed local data', () => {
    const storage = new MemoryStorage();
    const profile = completedProfile();
    saveLocalNurseProfile(storage, 'nurse-a', profile);
    expect(() => saveLocalNurseProfile(storage, 'nurse-a', profile)).toThrow(
      'El perfil cambió en otra pestaña',
    );
    storage.setItem('analiza.en.casa.nurse-profile.v1:nurse-b', '{bad-json');
    expect(loadLocalNurseProfile(storage, 'nurse-b')).toEqual(emptyNurseProfile());
  });
});
