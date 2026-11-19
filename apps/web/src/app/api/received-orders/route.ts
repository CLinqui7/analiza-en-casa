import type { NextRequest } from 'next/server';
import { quoteFulfillmentHttp } from '@/server/quote-fulfillment-http';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const GET = (request: NextRequest) => quoteFulfillmentHttp(request, 'orders');
export const POST = (request: NextRequest) => quoteFulfillmentHttp(request, 'orders', true);
