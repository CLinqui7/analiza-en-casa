import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import { can } from '@/lib/permissions';
import {
  purchaseOrderInputSchema,
  orderActionSchema,
  purchaseOrderSchema,
} from '@/lib/purchase-order';
import { boundedJson, privateHeaders } from '@/server/auth-http';
import { csrfHeaderName, sessionCookieName } from '@/server/auth-service';
import { authorizationStatus } from '@/server/http-auth';
import { persistence } from '@/server/persistence';
import { postgresPool, transaction } from '@/server/persistence/postgres-pool';
import {
  changePurchaseOrder,
  snapshotPurchaseOrder,
} from '@/server/persistence/postgres-purchase-orders';
import {
  MongoAccessError,
  MongoInputError,
  MongoConflictError,
} from '@/server/validation/patients';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
    error instanceof MongoInputError || error instanceof z.ZodError || error instanceof SyntaxError
      ? 400
      : error instanceof OrderConflict ||
          error instanceof MongoConflictError ||
          (error instanceof Error && 'code' in error && error.code === '23505')
        ? 409
        : authorizationStatus(error);
  return NextResponse.json(
    {
      error:
        status === 400
          ? error instanceof MongoInputError
            ? error.message
            : 'Revise los datos de la orden y los artículos activos.'
          : status === 409
            ? 'La orden cambió o el documento o serie ya está registrado. Actualice el listado.'
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
          `SELECT CASE WHEN o.body->>'status' IS NULL AND EXISTS
              (SELECT 1 FROM analiza.purchases p WHERE p.organization_id=o.organization_id AND p.body ? 'purchaseOrderId' AND p.body->>'purchaseOrderId'=o.id::text)
              THEN o.body || '{"status":"LINKED"}'::jsonb ELSE o.body END AS body
              FROM analiza.purchase_orders o WHERE o.organization_id=$1 ORDER BY o.created_at DESC`,
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
      const snapshot = await snapshotPurchaseOrder(client, actor, input);
      const order = purchaseOrderSchema.parse({
        ...snapshot,
        orderNumber: `OC-${input.id}`,
        issuedAt: new Date().toISOString(),
        fingerprint,
        workflowVersion: 1,
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

export async function PATCH(request: NextRequest) {
  try {
    const actor = await actorFor(request, true);
    const id = z.string().uuid().parse(request.nextUrl.searchParams.get('id'));
    const input = orderActionSchema.parse(await boundedJson(request, 262144));
    if (input.action === 'receive' && !can(actor.role, 'inventory:write'))
      throw new MongoAccessError();
    const order = await transaction(postgresPool(), actor, (client) =>
      changePurchaseOrder(client, actor, id, input),
    );
    return NextResponse.json(order, { headers: privateHeaders });
  } catch (error) {
    return failure(error);
  }
}
