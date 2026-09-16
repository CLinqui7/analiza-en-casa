import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadSession, login, logout, register } from '@/lib/auth';
import { isRegistrationEnabled } from '@/lib/registration';

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

describe('browser-only demo registration', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_DATA_MODE = 'mock';
    process.env.NEXT_PUBLIC_RELEASE_PROFILE = 'demo';
    delete process.env.NEXT_PUBLIC_REGISTRATION_MODE;
    vi.stubGlobal('window', { localStorage: new MemoryStorage() });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.NEXT_PUBLIC_DATA_MODE;
    delete process.env.NEXT_PUBLIC_RELEASE_PROFILE;
    delete process.env.NEXT_PUBLIC_REGISTRATION_MODE;
  });

  it('enables registration automatically for the isolated public demo', () => {
    expect(isRegistrationEnabled()).toBe(true);
    process.env.NEXT_PUBLIC_REGISTRATION_MODE = 'disabled';
    expect(isRegistrationEnabled()).toBe(false);
  });

  it('registers, restores, logs out, and signs in without a backend', async () => {
    const input = {
      displayName: 'Visitante Demo',
      email: 'visitante@example.test',
      password: 'frase-demo-segura-123',
    };

    const registered = await register(input);
    expect(registered).toMatchObject({ mode: 'mock', role: 'ADMIN' });
    await expect(loadSession()).resolves.toEqual(registered);

    await logout(registered);
    await expect(loadSession()).resolves.toBeNull();
    await expect(login(input.email, input.password)).resolves.toEqual(registered);
  });

  it('rejects duplicate local accounts and incorrect passwords', async () => {
    const input = {
      displayName: 'Visitante Demo',
      email: 'visitante@example.test',
      password: 'frase-demo-segura-123',
    };

    await register(input);
    await expect(register(input)).rejects.toThrow('Ya existe un acceso demo');
    await expect(login(input.email, 'otra-frase-demo-456')).rejects.toThrow(
      'Credenciales no válidas',
    );
  });
});
