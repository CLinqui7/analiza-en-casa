/** Commercial work is tenant-scoped by the repositories before this role mapping runs. */
export function commercialScopeForMember(role: unknown, email: unknown): 'REP' | 'MANAGER' | null {
  const normalized = typeof email === 'string' ? email.trim().toLowerCase() : '';
  if (['claudia.pinzon@labanaliza.com', 'claudia.pinzon@analizaencasa.com'].includes(normalized))
    return 'REP';
  if (['sissy.chavez@labanaliza.com', 'sissy.chavez@analizaencasa.com'].includes(normalized))
    return 'MANAGER';
  return role === 'ADMIN' || role === 'WEBMASTER' ? 'MANAGER' : null;
}
