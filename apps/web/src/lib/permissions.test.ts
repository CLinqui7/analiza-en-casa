import { describe, expect, it } from 'vitest';
import { can, isAdministrator, permissionForPath, roles } from './permissions';

// test-id: vitest:b2-doctors-admin-only

describe('doctor administration authorization', () => {
  it('isolates login analytics in its dedicated role', () => {
    expect(permissionForPath('/analytics/logins')).toBe('login-analytics:read');
    expect(can('ANALYTICS', 'login-analytics:read')).toBe(true);
    for (const role of roles.filter((role) => !['ANALYTICS', 'WEBMASTER'].includes(role))) {
      expect(can(role, 'login-analytics:read')).toBe(false);
    }
    expect(can('ANALYTICS', 'patients:read')).toBe(false);
    expect(can('ANALYTICS', 'audit:read')).toBe(false);
  });

  it('requires settings write permission for the doctors route', () => {
    expect(permissionForPath('/doctors')).toBe('settings:write');
    expect(permissionForPath('/doctors/doctor-1')).toBe('settings:write');
  });

  it('keeps information imports restricted to administrative roles', () => {
    expect(permissionForPath('/import')).toBe('settings:write');
    expect(can('ADMIN', 'settings:write')).toBe(true);
    expect(can('WEBMASTER', 'settings:write')).toBe(true);
    for (const role of roles.filter((role) => !isAdministrator(role))) {
      expect(can(role, 'settings:write')).toBe(false);
    }
  });

  it('gives WEBMASTER all ADMIN permissions plus private analytics', () => {
    expect(can('ADMIN', 'settings:write')).toBe(true);
    expect(isAdministrator('ADMIN')).toBe(true);
    expect(isAdministrator('WEBMASTER')).toBe(true);
    expect(can('WEBMASTER', 'login-analytics:read')).toBe(true);
    for (const permission of [
      'dashboard:read',
      'patients:write',
      'clinical:sign',
      'inventory:write',
      'settings:write',
    ] as const) {
      expect(can('WEBMASTER', permission)).toBe(can('ADMIN', permission));
    }
    for (const role of roles.filter((role) => !isAdministrator(role))) {
      expect(can(role, 'settings:write')).toBe(false);
    }
  });
});
