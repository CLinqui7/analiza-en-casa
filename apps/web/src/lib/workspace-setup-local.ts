import {
  emptyWorkspaceSetup,
  workspaceSetupSchema,
  type WorkspaceSetup,
} from '@/lib/workspace-setup';

const mockWorkspaceSetupKey = 'analiza.en.casa.mock-workspace-setup.v1';

function storageKey(userId: string) {
  return `${mockWorkspaceSetupKey}:${userId}`;
}

export function loadLocalWorkspaceSetup(storage: Storage, userId: string): WorkspaceSetup {
  try {
    const raw = storage.getItem(storageKey(userId));
    if (!raw) return emptyWorkspaceSetup();
    const parsed = workspaceSetupSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : emptyWorkspaceSetup();
  } catch {
    return emptyWorkspaceSetup();
  }
}

export function saveLocalWorkspaceSetup(
  storage: Storage,
  userId: string,
  input: WorkspaceSetup,
): WorkspaceSetup {
  const data = workspaceSetupSchema.parse(input);
  const current = loadLocalWorkspaceSetup(storage, userId);
  if (current.expectedVersion !== data.expectedVersion) {
    throw new Error('El cuestionario cambió en otra pestaña. Recarga los datos antes de guardar.');
  }
  const saved = { ...data, expectedVersion: data.expectedVersion + 1 };
  storage.setItem(storageKey(userId), JSON.stringify(saved));
  return saved;
}
