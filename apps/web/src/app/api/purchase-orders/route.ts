import { createHash, randomUUID } from 'node:crypto';
import { catalogItemSchema } from '@analiza/contracts';
import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import { can } from '@/lib/permissions';
import {
  purchaseOrderInputSchema,
  purchaseOrderLineTotal,
  purchaseOrderSchema,
} from '@/lib/purchase-order';
import { boundedJson, privateHeaders } from '@/server/auth-http';
import { csrfHeaderName, sessionCookieName } from '@/server/auth-service';
import { authorizationStatus } from '@/server/http-auth';
import { persistence } from '@/server/persistence';
import { postgresPool, transaction } from '@/server/persistence/postgres-pool';
import { MongoAccessError } from '@/server/validation/patients';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

class InvalidOrder extends Error {}
class OrderConflict extends Error {}

async function actorFor(request: NextRequest, write: boolean) {
  if (process.env.ANALIZA_DATA_MODE !== 'postgresql') throw new MongoAccessError();
  const backend = await persistence();
  const token = request.cookies.get(sessionCookieName)?.value;
  const actor = await backend.auth.requireSession(token);
  if (!can(actor.role, write ? 'purchases:write' : 'purchases:read')) throw new MongoAccessError();
  if (write)
    await backend.auth.requireCsrf(token, request.headers.get(csrfHeaderName) ?? undefined);
  return actor;
}

function failure(error: unknown) {
  const status =
    error instanceof InvalidOrder || error instanceof z.ZodError || error instanceof SyntaxError
      ? 400
      : error instanceof OrderConflict
        ? 409
        : authorizationStatus(error);
  return NextResponse.json(
    {
      error:
        status === 400
          ? 'Revise los datos de la orden y los artículos activos.'
          : status === 409
            ? 'El número de solicitud ya pertenece a otra orden.'
            : status === 401
              ? 'Inicie sesión para continuar.'
              : status === 403
                ? 'No tiene autorización.'
                : 'No fue posible procesar la orden.',
    },
    { status, headers: privateHeaders },
  );
}

export async function GET(request: NextRequest) {
  try {
    const actor = await actorFor(request, false);
    const orders = await transaction(postgresPool(), actor, async (client) =>
      (
        await client.query<{ body: unknown }>(
          'SELECT body FROM analiza.purchase_orders WHERE organization_id=$1 ORDER BY created_at DESC LIMIT 100',
          [actor.organizationId],
        )
      ).rows.map((row) => purchaseOrderSchema.parse(row.body)),
    );
    return NextResponse.json({ orders }, { headers: privateHeaders });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await actorFor(request, true);
    const input = purchaseOrderInputSchema.parse(await boundedJson(request, 65536));
    const fingerprint = createHash('sha256').update(JSON.stringify(input)).digest('hex');
    const result = await transaction(postgresPool(), actor, async (client) => {
      const previous = await client.query<{ body: unknown }>(
        'SELECT body FROM analiza.purchase_orders WHERE organization_id=$1 AND id=$2',
        [actor.organizationId, input.id],
      );
      if (previous.rows[0]) {
        const order = purchaseOrderSchema.parse(previous.rows[0].body);
        if (order.fingerprint !== fingerprint) throw new OrderConflict();
        return { order, created: false };
      }
      const ids = [
        ...new Set([input.supplierCatalogItemId, ...input.items.map((item) => item.catalogItemId)]),
      ];
      const catalog = await client.query<{ id: string; body: unknown }>(
        'SELECT id,body FROM analiza.catalog_items WHERE organization_id=$1 AND id=ANY($2::text[])',
        [actor.organizationId, ids],
      );
      const items = new Map(catalog.rows.map((row) => [row.id, catalogItemSchema.parse(row.body)]));
      const supplier = items.get(input.supplierCatalogItemId);
      if (supplier?.status !== 'ACTIVE' || supplier.category !== 'PROVIDERS')
        throw new InvalidOrder();
      const lines = input.items.map((item) => {
        const catalogItem = items.get(item.catalogItemId);
        if (
          catalogItem?.status !== 'ACTIVE' ||
          !['MEDICATIONS', 'SUPPLIES', 'EQUIPMENT'].includes(catalogItem.category ?? '')
        )
          throw new InvalidOrder();
        return {
          ...item,
          sku: catalogItem.sku,
          name: catalogItem.name,
          lineTotal: purchaseOrderLineTotal(item.quantity, item.referenceUnitPrice),
        };
      });
      const order = purchaseOrderSchema.parse({
        ...input,
        orderNumber: `OC-${input.id}`,
        issuedAt: new Date().toISOString(),
        supplierName: supplier.name,
        items: lines,
        total:
          Math.round(lines.reduce((sum, line) => sum + Math.round(line.lineTotal * 100), 0)) / 100,
        fingerprint,
      });
      const inserted = await client.query(
        'INSERT INTO analiza.purchase_orders (organization_id,id,created_by,body) VALUES($1,$2,$3,$4::jsonb) ON CONFLICT DO NOTHING',
        [actor.organizationId, order.id, actor.userId, JSON.stringify(order)],
      );
      if (!inserted.rowCount) {
        const existing = await client.query<{ body: unknown }>(
          'SELECT body FROM analiza.purchase_orders WHERE organization_id=$1 AND id=$2',
          [actor.organizationId, order.id],
        );
        const stored = purchaseOrderSchema.parse(existing.rows[0]?.body);
        if (stored.fingerprint !== fingerprint) throw new OrderConflict();
        return { order: stored, created: false };
      }
      await client.query(
        'INSERT INTO analiza.audit_events(organization_id,id,actor_user_id,action,resource_type,resource_id) VALUES($1,$2,$3,$4,$5,$6)',
        [
          actor.organizationId,
          randomUUID(),
          actor.userId,
          'purchase_order.issued',
          'purchase_orders',
          order.id,
        ],
      );
      return { order, created: true };
    });
    return NextResponse.json(result.order, {
      status: result.created ? 201 : 200,
      headers: privateHeaders,
    });
  } catch (error) {
    return failure(error);
  }
}
