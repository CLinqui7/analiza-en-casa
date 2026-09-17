export const roles = [
  'ADMIN',
  'DOCTOR',
  'NURSE',
  'NURSE_MANAGER',
  'INVENTORY',
  'FINANCE',
  'AUDITOR',
] as const;
export type Role = (typeof roles)[number];

export type Permission =
  | 'dashboard:read'
  | 'patients:read'
  | 'patients:write'
  | 'cases:read'
  | 'cases:write'
  | 'quotes:read'
  | 'quotes:write'
  | 'insurance:read'
  | 'insurance:write'
  | 'payments:read'
  | 'payments:write'
  | 'clinical:read'
  | 'clinical:write'
  | 'clinical:sign'
  | 'nursing:write'
  | 'nurses:manage'
  | 'medical-orders:write'
  | 'agenda:read'
  | 'agenda:write'
  | 'inventory:read'
  | 'inventory:write'
  | 'purchases:read'
  | 'purchases:write'
  | 'catalogs:read'
  | 'catalogs:write'
  | 'reports:read'
  | 'audit:read'
  | 'settings:read'
  | 'settings:write';

const allRead: Permission[] = [
  'dashboard:read',
  'patients:read',
  'cases:read',
  'quotes:read',
  'insurance:read',
  'payments:read',
  'clinical:read',
  'agenda:read',
  'inventory:read',
  'purchases:read',
  'catalogs:read',
  'reports:read',
  'audit:read',
  'settings:read',
];
const allWrite: Permission[] = [
  'patients:write',
  'cases:write',
  'quotes:write',
  'insurance:write',
  'payments:write',
  'clinical:write',
  'clinical:sign',
  'nursing:write',
  'nurses:manage',
  'medical-orders:write',
  'agenda:write',
  'inventory:write',
  'purchases:write',
  'catalogs:write',
  'settings:write',
];

const permissions: Record<Role, readonly Permission[]> = {
  ADMIN: [...allRead, ...allWrite],
  NURSE_MANAGER: [
    'dashboard:read',
    'patients:read',
    'patients:write',
    'cases:read',
    'cases:write',
    'clinical:read',
    'clinical:write',
    'nursing:write',
    'nurses:manage',
    'agenda:read',
    'agenda:write',
    'catalogs:read',
    'catalogs:write',
    'reports:read',
    'inventory:read',
  ],
  DOCTOR: [
    'dashboard:read',
    'patients:read',
    'patients:write',
    'cases:read',
    'cases:write',
    'quotes:read',
    'quotes:write',
    'insurance:read',
    'clinical:read',
    'clinical:write',
    'clinical:sign',
    'medical-orders:write',
    'agenda:read',
    'reports:read',
  ],
  NURSE: [
    'dashboard:read',
    'patients:read',
    'patients:write',
    'cases:read',
    'clinical:read',
    'clinical:write',
    'nursing:write',
    'agenda:read',
    'agenda:write',
    'reports:read',
  ],
  INVENTORY: [
    'dashboard:read',
    'inventory:read',
    'inventory:write',
    'purchases:read',
    'purchases:write',
    'catalogs:read',
    'catalogs:write',
    'reports:read',
  ],
  FINANCE: [
    'dashboard:read',
    'patients:read',
    'cases:read',
    'quotes:read',
    'quotes:write',
    'insurance:read',
    'insurance:write',
    'payments:read',
    'payments:write',
    'purchases:read',
    'reports:read',
  ],
  AUDITOR: allRead,
};

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && roles.includes(value as Role);
}

export function can(role: Role | undefined, permission: Permission): boolean {
  return Boolean(role && permissions[role].includes(permission));
}

const routePermissions: Array<{ prefix: string; permission: Permission }> = [
  { prefix: '/nursing-team', permission: 'nurses:manage' },
  { prefix: '/changes', permission: 'dashboard:read' },
  { prefix: '/feedback', permission: 'dashboard:read' },
  { prefix: '/tutorial', permission: 'dashboard:read' },
  { prefix: '/patients', permission: 'patients:read' },
  { prefix: '/hospitalizations', permission: 'cases:read' },
  { prefix: '/quotes', permission: 'quotes:read' },
  { prefix: '/insurance', permission: 'insurance:read' },
  { prefix: '/receivables', permission: 'payments:read' },
  { prefix: '/payments', permission: 'payments:read' },
  { prefix: '/payables', permission: 'payments:read' },
  { prefix: '/clinical', permission: 'clinical:read' },
  { prefix: '/agenda', permission: 'agenda:read' },
  { prefix: '/inventory', permission: 'inventory:read' },
  { prefix: '/purchases', permission: 'purchases:read' },
  { prefix: '/catalogs', permission: 'catalogs:read' },
  { prefix: '/reports', permission: 'reports:read' },
  { prefix: '/audit', permission: 'audit:read' },
  { prefix: '/settings', permission: 'settings:read' },
  { prefix: '/onboarding', permission: 'dashboard:read' },
  { prefix: '/doctors', permission: 'settings:write' },
  { prefix: '/import', permission: 'settings:write' },
  { prefix: '/dashboard', permission: 'dashboard:read' },
];

export function permissionForPath(pathname: string): Permission | undefined {
  return routePermissions.find(({ prefix }) => pathname.startsWith(prefix))?.permission;
}
