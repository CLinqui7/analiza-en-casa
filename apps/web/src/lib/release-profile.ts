/** Release visibility is independent from authorization. Server ACLs still apply. */
export const isCoreRelease = process.env.NEXT_PUBLIC_RELEASE_PROFILE === 'core';

export const corePages = [
  '/dashboard',
  '/patients',
  '/hospitalizations',
  '/agenda',
  '/doctors',
  '/nursing-team',
  '/catalogs/operational',
  '/insurers',
  '/import',
  '/onboarding',
  '/feedback',
  '/tutorial',
] as const;
const coreApi = [
  '/api/auth',
  '/api/workspace',
  '/api/patients',
  '/api/hospitalizations',
  '/api/doctors',
  '/api/shifts',
  '/api/files',
  '/api/operations',
  '/api/health',
  '/api/onboarding',
  '/api/nurse-profile',
  '/api/feedback',
  '/api/information-import',
  '/api/admin/nurse-profiles',
];
const within = (path: string, base: string) => path === base || path.startsWith(`${base}/`);

export function isReleasedPath(path: string, core = isCoreRelease): boolean {
  if (!core) return true;
  const pathname = path.split(/[?#]/, 1)[0];
  if (pathname === '/' || pathname === '/login' || pathname === '/register') return true;
  return [...corePages, ...coreApi].some((base) => within(pathname, base));
}

export function isReleasedCommand(command: unknown, core = isCoreRelease): boolean {
  return (
    !core ||
    command === 'nurse.create' ||
    command === 'catalog.save' ||
    command === 'configuration.save' ||
    command === 'workspace.seed-demo'
  );
}
