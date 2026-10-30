export function publicOrigin(
  env: Readonly<Record<string, string | undefined>> = process.env,
): string {
  const configured = env.ANALIZA_PUBLIC_ORIGIN?.trim();
  if (!configured) throw new Error('Falta configurar el origen público de los enlaces.');
  let url: URL;
  try {
    url = new URL(configured);
  } catch {
    throw new Error('El origen público de los enlaces no es válido.');
  }
  const localHttp =
    env.NODE_ENV !== 'production' &&
    url.protocol === 'http:' &&
    ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (
    (url.protocol !== 'https:' && !localHttp) ||
    !url.hostname ||
    ['0.0.0.0', '[::]'].includes(url.hostname) ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  )
    throw new Error('El origen público de los enlaces no es válido.');
  return url.origin;
}
