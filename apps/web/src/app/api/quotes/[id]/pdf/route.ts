import { NextRequest, NextResponse } from 'next/server';
import { buildQuotePdf } from '@/lib/financial-pdf';
import { authorizationStatus } from '@/server/http-auth';
import { sessionCookieName } from '@/server/auth-service';
import { persistence } from '@/server/persistence';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const noStore = { 'Cache-Control': 'private, no-store' };

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const backend = await persistence();
    const actor = await backend.auth.requireSession(request.cookies.get(sessionCookieName)?.value);
    const quote = await backend.quotes.get(actor, (await context.params).id);
    if (!quote)
      return NextResponse.json(
        { error: 'Cotización no encontrada.' },
        { status: 404, headers: noStore },
      );
    if (quote.status !== 'SENT' || !quote.immutable)
      return NextResponse.json(
        { error: 'Sólo se exportan versiones enviadas e inmutables.' },
        { status: 409, headers: noStore },
      );
    const patient = await backend.patients.get(actor, quote.patientId).catch(() => null);
    const logoResponse = await fetch(new URL('/brand/analiza-en-casa-logo.png', request.url)).catch(
      () => null,
    );
    const logoBytes = logoResponse?.ok
      ? new Uint8Array(await logoResponse.arrayBuffer())
      : undefined;
    const bytes = await buildQuotePdf(quote, patient ?? undefined, logoBytes);
    const fileName = `cotizacion-${quote.id}-v${quote.version}.pdf`.replace(
      /[^a-zA-Z0-9._-]/g,
      '-',
    );
    return new Response(Buffer.from(bytes), {
      status: 200,
      headers: {
        ...noStore,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `${request.nextUrl.searchParams.get('inline') === '1' ? 'inline' : 'attachment'}; filename="${fileName}"`,
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    const status = authorizationStatus(error);
    return NextResponse.json(
      { error: status === 401 ? 'Inicie sesión para continuar.' : 'No tiene autorización.' },
      { status, headers: noStore },
    );
  }
}
