import { describe, expect, it } from 'vitest';
import { loadLocalWorkspaceSetup, saveLocalWorkspaceSetup } from '@/lib/workspace-setup-local';
import { emptyWorkspaceSetup } from '@/lib/workspace-setup';

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

describe('local demo workspace setup', () => {
  it('starts empty and persists a questionnaire for the current demo user', () => {
    const storage = new MemoryStorage();
    const setup = emptyWorkspaceSetup();
    setup.organization.name = 'Clínica Demo';

    expect(loadLocalWorkspaceSetup(storage, 'user-a')).toEqual(emptyWorkspaceSetup());
    const saved = saveLocalWorkspaceSetup(storage, 'user-a', setup);

    expect(saved.expectedVersion).toBe(1);
    expect(loadLocalWorkspaceSetup(storage, 'user-a')).toEqual(saved);
    expect(loadLocalWorkspaceSetup(storage, 'user-b')).toEqual(emptyWorkspaceSetup());
  });

  it('rejects stale updates from another browser tab', () => {
    const storage = new MemoryStorage();
    const setup = emptyWorkspaceSetup();
    setup.organization.name = 'Clínica Demo';
    saveLocalWorkspaceSetup(storage, 'user-a', setup);

    expect(() => saveLocalWorkspaceSetup(storage, 'user-a', setup)).toThrow(
      'El cuestionario cambió en otra pestaña',
    );
  });

  it('ignores malformed saved data instead of breaking the demo', () => {
    const storage = new MemoryStorage();
    storage.setItem('analiza.en.casa.mock-workspace-setup.v1:user-a', '{not-json');

    expect(loadLocalWorkspaceSetup(storage, 'user-a')).toEqual(emptyWorkspaceSetup());
  });
});
