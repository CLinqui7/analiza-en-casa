import { describe, expect, it, vi } from 'vitest';
import type { Db } from 'mongodb';
import type { PoolClient } from 'pg';
import { commercialScopeForMember } from './commercial-access';
import { commercialScope as mongoCommercialScope } from './mongo-operations';
import { commercialScope as postgresCommercialScope } from './persistence/postgres-field-operations';

const actor = { userId: 'user-qa', organizationId: 'org-qa', role: 'ADMIN' as const };

describe('commercial page access for administrators', () => {
  // test-id: vitest:admin-commercial-page-access
  it.each([
    ['ADMIN', 'nancy.vasquez@analizaencasa.com', 'MANAGER'],
    ['ADMIN', 'karla@analizaencasa.com', 'MANAGER'],
    ['ADMIN', 'abigailsv92@analizaencasa.com', 'MANAGER'],
    ['ADMIN', 'analiza@analizaencasa.com', 'MANAGER'],
    ['ADMIN', 'nelly.viscarra@analizaencasa.com', 'MANAGER'],
    ['ADMIN', 'olaya.deras@analizaencasa.com', 'MANAGER'],
    ['ADMIN', 'claudia.pinzon@analizaencasa.com', 'REP'],
    ['ADMIN', 'sissy.chavez@analizaencasa.com', 'MANAGER'],
    ['WEBMASTER', 'webmaster@analizaencasa.com', 'MANAGER'],
    ['NURSE', 'other@analizaencasa.com', null],
  ])('maps active %s member %s to %s', (role, email, expected) => {
    expect(commercialScopeForMember(role, email)).toBe(expected);
  });

  it('checks active tenant membership and enabled user in PostgreSQL', async () => {
    const query = vi.fn(async (sql: string, parameters: unknown[]) => {
      expect(sql).toContain('membership.organization_id=$1');
      expect(sql).toContain('membership.user_id=$2');
      expect(sql).toContain('membership.active');
      expect(sql).toContain('users.disabled_at IS NULL');
      expect(parameters).toEqual(['org-qa', 'user-qa']);
      return { rows: [{ role: 'ADMIN', email: 'nancy.vasquez@analizaencasa.com' }] };
    });
    expect(await postgresCommercialScope({ query } as unknown as PoolClient, actor)).toBe(
      'MANAGER',
    );
    expect(query).toHaveBeenCalledOnce();
  });

  it('denies missing, inactive or disabled membership in MongoDB', async () => {
    const scope = (membership: unknown, user: unknown) => {
      const database = {
        collection: vi.fn((name: string) => ({
          findOne: vi.fn(async (filter: Record<string, unknown>) => {
            if (name === 'memberships') {
              expect(filter).toMatchObject({
                organizationId: 'org-qa',
                userId: 'user-qa',
                active: true,
              });
              return membership;
            }
            if (name === 'users') return user;
            throw new Error(`Unexpected collection: ${name}`);
          }),
        })),
      } as unknown as Db;
      return mongoCommercialScope(database, actor);
    };
    await expect(scope(null, null)).resolves.toBeNull();
    await expect(scope({ role: 'ADMIN' }, null)).resolves.toBeNull();
    await expect(
      scope(
        { role: 'ADMIN' },
        { emailNormalized: 'nancy.vasquez@analizaencasa.com', disabledAt: new Date() },
      ),
    ).resolves.toBeNull();
    await expect(
      scope({ role: 'ADMIN' }, { emailNormalized: 'nancy.vasquez@analizaencasa.com' }),
    ).resolves.toBe('MANAGER');
  });
});
