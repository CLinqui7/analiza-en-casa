import { describe, expect, it } from 'vitest';
import { can, isAdministrator, permissionForPath, roleAllowsPath, roles } from './permissions';

// test-id: vitest:b2-doctors-admin-only

describe('doctor administration authorization', () => {
  it('limits Doctor to the four clinical screens and own profile, with no financial commands', () => {
    for (const route of [
      '/clinical',
      '/clinical/orders',
      '/clinical/hospitalizations',
      '/agenda',
      '/profile',
    ])
      expect(roleAllowsPath('DOCTOR', route)).toBe(true);
    for (const route of [
      '/patients',
      '/quotes',
      '/receivables',
      '/catalogs/clinical',
      '/clinical/prequotes',
      '/settings',
      '/nursing-team',
      '/reports',
      '/dashboard',
    ])
      expect(roleAllowsPath('DOCTOR', route)).toBe(false);
    for (const permission of [
      'quotes:read',
      'quotes:write',
      'payments:read',
      'payments:write',
      'insurance:read',
      'reports:read',
      'clinical-config:write',
      'nurses:manage',
      'settings:write',
    ] as const)
      expect(can('DOCTOR', permission)).toBe(false);
    for (const permission of [
      'clinical:read',
      'clinical:write',
      'clinical:sign',
      'cases:read',
      'agenda:read',
      'agenda:write',
    ] as const)
      expect(can('DOCTOR', permission)).toBe(true);
  });
  it('allows quote authors to read selectable doctors without granting directory edits', () => {
    for (const role of roles) {
      expect(can(role, 'doctors:read')).toBe(role === 'DOCTOR' || can(role, 'quotes:write'));
    }
    expect(can(undefined, 'doctors:read')).toBe(false);
    for (const role of ['FINANCE', 'DOCTOR', 'MANAGER'] as const) {
      expect(can(role, 'doctors:read')).toBe(true);
      expect(can(role, 'settings:write')).toBe(false);
    }
  });
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
