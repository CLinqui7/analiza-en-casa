import { NextRequest, NextResponse } from 'next/server';
import { isReleasedPath } from './lib/release-profile';

/** Close unfinished routes too: hiding menu links alone is not a release gate. */
export function proxy(request: NextRequest) {
  if (isReleasedPath(request.nextUrl.pathname)) return NextResponse.next();
  if (request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.json(
      { error: 'Operación no disponible en esta edición.' },
      {
        status: 404,
        headers: { 'Cache-Control': 'no-store' },
      },
    );
  }
  return NextResponse.redirect(new URL('/dashboard', request.url));
}

export const config = {
  matcher: [
    '/((?!_next/|favicon.ico|manifest.webmanifest|robots.txt|icon.svg|sw.js|brand/|assets/|icons/|fonts/).*)',
  ],
};
