import { createHash, randomBytes, scryptSync } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  AccountError,
  AuthService,
  PasswordChangeRequiredError,
  type AuthStore,
  type StoredSession,
  type UserRecord,
} from './auth-service';

function temporaryHash(password: string) {
  const salt = randomBytes(16).toString('base64url');
  return `scrypt$${salt}$${scryptSync(password, salt, 64).toString('base64url')}`;
}

const temporaryPassword = 'Testpass12';

function fixture() {
  let user: UserRecord = {
    id: 'user-a',
    emailNormalized: 'sophia.gonzalez@analizaencasa',
    displayName: 'Sophia Gonzalez',
    passwordHash: temporaryHash(temporaryPassword),
    mustChangePassword: true,
  };
  const sessions = new Map<string, StoredSession>();
  const store: AuthStore = {
    hasAnyUser: async () => true,
    findUserByEmail: async (email) => (email === user.emailNormalized ? user : null),
    findUserById: async (id) => (id === user.id ? user : null),
    updateAccount: async (id, expected, displayName, newHash, currentHash, now) => {
      if (id !== user.id || expected !== user.passwordHash) return false;
      user = {
        ...user,
        displayName,
        passwordHash: newHash ?? user.passwordHash,
        mustChangePassword: newHash ? false : user.mustChangePassword,
      };
      if (newHash)
        for (const [key, value] of sessions)
          if (key !== currentHash) sessions.set(key, { ...value, revokedAt: now });
      return true;
    },
    createUser: async () => {},
    createMembership: async () => {},
    findActiveMemberships: async () => [
      { userId: user.id, organizationId: 'org-a', role: 'ADMIN', active: true },
    ],
    createSession: async (value) => {
      sessions.set(value.sessionHash, value);
    },
    findSession: async (key) => sessions.get(key) ?? null,
    updateSessionCsrf: async (key, csrfHash) => {
      const value = sessions.get(key);
      if (value) sessions.set(key, { ...value, csrfHash });
    },
    revokeSession: async () => {},
    consumeLoginAttempt: async () => true,
  };
  return { auth: new AuthService(store), getUser: () => user, sessions };
}

describe('operator-provisioned temporary ADMIN account', () => {
  it('requires a personal password before accessing application data', async () => {
    const { auth, getUser } = fixture();
    const login = await auth.login({
      email: 'sophia.gonzalez@analizaencasa',
      password: temporaryPassword,
    });
    expect(login.session.role).toBe('ADMIN');
    expect(login.session.mustChangePassword).toBe(true);
    await expect(auth.requireSession(login.sessionToken)).rejects.toBeInstanceOf(
      PasswordChangeRequiredError,
    );
    await expect(auth.rotateCsrf(login.sessionToken)).resolves.toBeTruthy();
    await expect(auth.account(login.sessionToken)).resolves.toMatchObject({
      displayName: 'Sophia Gonzalez',
      mustChangePassword: true,
    });
    await expect(
      auth.updateAccount(login.sessionToken, {
        displayName: 'Sophia Gonzalez',
        currentPassword: temporaryPassword,
      }),
    ).rejects.toBeInstanceOf(PasswordChangeRequiredError);
    await expect(
      auth.updateAccount(login.sessionToken, {
        displayName: 'Sophia Gonzalez',
        currentPassword: 'wrong',
        newPassword: 'PersonalPassword2026!',
      }),
    ).rejects.toBeInstanceOf(AccountError);
    await expect(
      auth.updateAccount(login.sessionToken, {
        displayName: 'Sophia Gonzalez',
        currentPassword: temporaryPassword,
        newPassword: 'short',
      }),
    ).rejects.toBeInstanceOf(AccountError);
    await expect(
      auth.updateAccount(login.sessionToken, {
        displayName: 'Sophia G.',
        currentPassword: temporaryPassword,
        newPassword: 'PersonalPassword2026!',
      }),
    ).resolves.toMatchObject({ displayName: 'Sophia G.', mustChangePassword: false });
    expect(getUser().passwordHash).not.toContain('PersonalPassword2026!');
    await expect(auth.requireSession(login.sessionToken)).resolves.toMatchObject({
      role: 'ADMIN',
      mustChangePassword: false,
    });
  });

  it('revokes other sessions after changing the password and permits name edits', async () => {
    const { auth, sessions } = fixture();
    const first = await auth.login({
      email: 'sophia.gonzalez@analizaencasa',
      password: temporaryPassword,
    });
    const second = await auth.login({
      email: 'sophia.gonzalez@analizaencasa',
      password: temporaryPassword,
    });
    await auth.updateAccount(second.sessionToken, {
      displayName: 'Sophia',
      currentPassword: temporaryPassword,
      newPassword: 'PersonalPassword2026!',
    });
    const firstHash = createHash('sha256').update(first.sessionToken).digest('hex');
    expect(sessions.get(firstHash)?.revokedAt).toBeInstanceOf(Date);
    await expect(auth.requireSession(first.sessionToken)).rejects.toThrow();
    await expect(
      auth.updateAccount(second.sessionToken, {
        displayName: 'Sophia Gonzalez',
        currentPassword: 'PersonalPassword2026!',
      }),
    ).resolves.toMatchObject({ displayName: 'Sophia Gonzalez' });
  });
});
