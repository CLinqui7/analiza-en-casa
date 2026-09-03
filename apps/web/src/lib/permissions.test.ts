import { describe, expect, it } from 'vitest';
import { can, permissionForPath, roles } from './permissions';

// test-id: vitest:b2-doctors-admin-only

describe('doctor administration authorization', () => {
  it('requires settings write permission for the doctors route', () => {
    expect(permissionForPath('/doctors')).toBe('settings:write');
    expect(permissionForPath('/doctors/doctor-1')).toBe('settings:write');
  });

  it('allows only ADMIN to access doctors administration', () => {
    expect(can('ADMIN', 'settings:write')).toBe(true);
    for (const role of roles.filter((role) => role !== 'ADMIN')) {
      expect(can(role, 'settings:write')).toBe(false);
    }
  });
});
