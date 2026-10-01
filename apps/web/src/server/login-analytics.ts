import type { Db } from 'mongodb';
import type { Pool } from 'pg';
import { z } from 'zod';
import { can } from '@/lib/permissions';
import type { ServerActor } from './validation/patients';
import { transaction } from './persistence/postgres-pool';
import { MongoAccessError } from './validation/patients';

const loginAnalyticsUserSchema = z.object({
  userId: z.string(),
  email: z.email(),
  displayName: z.string(),
  role: z.string(),
  active: z.boolean(),
  totalLogins: z.number().int().nonnegative(),
  loginsLast7Days: z.number().int().nonnegative(),
  loginsLast30Days: z.number().int().nonnegative(),
  activeDaysLast30Days: z.number().int().nonnegative(),
  firstLoginAt: z.string().nullable(),
  lastLoginAt: z.string().nullable(),
});

const recentLoginSchema = z.object({
  id: z.string(),
  userId: z.string(),
  email: z.email(),
  displayName: z.string(),
  occurredAt: z.string(),
});

export const loginAnalyticsSnapshotSchema = z.object({
  generatedAt: z.string(),
  trackingSince: z.string().nullable(),
  users: z.array(loginAnalyticsUserSchema),
  recentLogins: z.array(recentLoginSchema),
});
export type LoginAnalyticsSnapshot = z.infer<typeof loginAnalyticsSnapshotSchema>;

function authorize(actor: ServerActor) {
  if (!can(actor.role, 'login-analytics:read')) throw new MongoAccessError();
}

function iso(value: Date | string | null | undefined) {
  return value ? new Date(value).toISOString() : null;
}

export class PostgresLoginAnalyticsRepository {
  constructor(private readonly pool: Pool) {}

  async snapshot(actor: ServerActor): Promise<LoginAnalyticsSnapshot> {
    authorize(actor);
    return transaction(this.pool, actor, async (client) => {
      const users = await client.query<{
        userId: string;
        email: string;
        displayName: string;
        role: string;
        active: boolean;
        totalLogins: number;
        loginsLast7Days: number;
        loginsLast30Days: number;
        activeDaysLast30Days: number;
        firstLoginAt: Date | null;
        lastLoginAt: Date | null;
      }>(
        `SELECT u.id AS "userId",u.email_normalized AS email,u.display_name AS "displayName",
                  m.role,m.active,count(e.id)::int AS "totalLogins",
                  count(e.id) FILTER (WHERE e.occurred_at >= now()-interval '7 days')::int AS "loginsLast7Days",
                  count(e.id) FILTER (WHERE e.occurred_at >= now()-interval '30 days')::int AS "loginsLast30Days",
                  count(DISTINCT (e.occurred_at AT TIME ZONE 'America/El_Salvador')::date)
                    FILTER (WHERE e.occurred_at >= now()-interval '30 days')::int AS "activeDaysLast30Days",
                  min(e.occurred_at) AS "firstLoginAt",max(e.occurred_at) AS "lastLoginAt"
             FROM analiza.memberships m
             JOIN analiza.users u ON u.id=m.user_id
             LEFT JOIN analiza.login_events e
               ON e.organization_id=m.organization_id AND e.user_id=m.user_id
            WHERE m.organization_id=$1 AND m.role<>'ANALYTICS'
            GROUP BY u.id,u.email_normalized,u.display_name,m.role,m.active
            ORDER BY max(e.occurred_at) DESC NULLS LAST,u.email_normalized`,
        [actor.organizationId],
      );
      const recent = await client.query<{
        id: string;
        userId: string;
        email: string;
        displayName: string;
        occurredAt: Date;
      }>(
        `SELECT e.id::text,u.id AS "userId",u.email_normalized AS email,
                  u.display_name AS "displayName",e.occurred_at AS "occurredAt"
             FROM analiza.login_events e
             JOIN analiza.users u ON u.id=e.user_id
             JOIN analiza.memberships m
               ON m.organization_id=e.organization_id AND m.user_id=e.user_id
            WHERE e.organization_id=$1 AND m.role<>'ANALYTICS'
            ORDER BY e.occurred_at DESC,e.id DESC
            LIMIT 100`,
        [actor.organizationId],
      );
      const tracking = await client.query<{ trackingSince: Date | null }>(
        `SELECT min(e.occurred_at) AS "trackingSince"
             FROM analiza.login_events e
             JOIN analiza.memberships m
               ON m.organization_id=e.organization_id AND m.user_id=e.user_id
            WHERE e.organization_id=$1 AND m.role<>'ANALYTICS'`,
        [actor.organizationId],
      );
      return loginAnalyticsSnapshotSchema.parse({
        generatedAt: new Date().toISOString(),
        trackingSince: iso(tracking.rows[0]?.trackingSince),
        users: users.rows.map((row) => ({
          ...row,
          displayName: row.displayName || row.email,
          firstLoginAt: iso(row.firstLoginAt),
          lastLoginAt: iso(row.lastLoginAt),
        })),
        recentLogins: recent.rows.map((row) => ({
          ...row,
          displayName: row.displayName || row.email,
          occurredAt: row.occurredAt.toISOString(),
        })),
      });
    });
  }
}

export class MongoLoginAnalyticsRepository {
  constructor(private readonly database: Db) {}

  async snapshot(actor: ServerActor): Promise<LoginAnalyticsSnapshot> {
    authorize(actor);
    const memberships = await this.database
      .collection('memberships')
      .find({ organizationId: actor.organizationId, role: { $ne: 'ANALYTICS' } })
      .toArray();
    const userIds = memberships.map((membership) => membership.userId);
    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
    const eventMatch = { organizationId: actor.organizationId, userId: { $in: userIds } };
    const [users, aggregates, recentEvents, firstEvent] = await Promise.all([
      this.database
        .collection('users')
        .find(
          { id: { $in: userIds } },
          { projection: { id: 1, emailNormalized: 1, displayName: 1 } },
        )
        .toArray(),
      this.database
        .collection('loginEvents')
        .aggregate([
          { $match: eventMatch },
          {
            $group: {
              _id: '$userId',
              totalLogins: { $sum: 1 },
              loginsLast7Days: {
                $sum: { $cond: [{ $gte: ['$occurredAt', new Date(sevenDaysAgo)] }, 1, 0] },
              },
              loginsLast30Days: {
                $sum: { $cond: [{ $gte: ['$occurredAt', new Date(thirtyDaysAgo)] }, 1, 0] },
              },
              activeDaysLast30Days: {
                $addToSet: {
                  $cond: [
                    { $gte: ['$occurredAt', new Date(thirtyDaysAgo)] },
                    {
                      $dateToString: {
                        date: '$occurredAt',
                        format: '%Y-%m-%d',
                        timezone: 'America/El_Salvador',
                      },
                    },
                    '$$REMOVE',
                  ],
                },
              },
              firstLoginAt: { $min: '$occurredAt' },
              lastLoginAt: { $max: '$occurredAt' },
            },
          },
        ])
        .toArray(),
      this.database
        .collection('loginEvents')
        .find(eventMatch)
        .sort({ occurredAt: -1, id: -1 })
        .limit(100)
        .toArray(),
      this.database
        .collection('loginEvents')
        .find(eventMatch)
        .sort({ occurredAt: 1 })
        .limit(1)
        .next(),
    ]);
    const userRows = memberships.map((membership) => {
      const user = users.find((candidate) => candidate.id === membership.userId);
      const aggregate = aggregates.find((candidate) => candidate._id === membership.userId);
      return {
        userId: String(membership.userId),
        email: String(user?.emailNormalized ?? ''),
        displayName: String(user?.displayName || user?.emailNormalized || ''),
        role: String(membership.role),
        active: Boolean(membership.active),
        totalLogins: Number(aggregate?.totalLogins ?? 0),
        loginsLast7Days: Number(aggregate?.loginsLast7Days ?? 0),
        loginsLast30Days: Number(aggregate?.loginsLast30Days ?? 0),
        activeDaysLast30Days: Array.isArray(aggregate?.activeDaysLast30Days)
          ? aggregate.activeDaysLast30Days.length
          : 0,
        firstLoginAt: iso(aggregate?.firstLoginAt),
        lastLoginAt: iso(aggregate?.lastLoginAt),
      };
    });
    return loginAnalyticsSnapshotSchema.parse({
      generatedAt: new Date().toISOString(),
      trackingSince: iso(firstEvent?.occurredAt),
      users: userRows.sort(
        (left, right) =>
          (right.lastLoginAt ?? '').localeCompare(left.lastLoginAt ?? '') ||
          left.email.localeCompare(right.email),
      ),
      recentLogins: recentEvents.map((event) => {
        const user = users.find((candidate) => candidate.id === event.userId);
        return {
          id: String(event.id),
          userId: String(event.userId),
          email: String(user?.emailNormalized ?? ''),
          displayName: String(user?.displayName || user?.emailNormalized || ''),
          occurredAt: new Date(event.occurredAt).toISOString(),
        };
      }),
    });
  }
}
