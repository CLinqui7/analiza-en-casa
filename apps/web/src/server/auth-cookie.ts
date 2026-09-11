/** TLS terminates at the cloud ingress; production cookies stay Secure behind a proxy. */
export function authCookieOptions(protocol: string) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production' || protocol === 'https:',
    path: '/',
  };
}
