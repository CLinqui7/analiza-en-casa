import assert from 'node:assert/strict';
import { Pool } from 'pg';
import { PostgresLoginAnalyticsRepository } from '../../apps/web/src/server/login-analytics';

const connectionString = process.env.DATABASE_URL_UNPOOLED;
assert.ok(connectionString && new URL(connectionString).hostname.endsWith('.neon.tech'));
assert.equal(process.env.ANALIZA_MANAGED_POSTGRES, 'neon');

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: true },
  max: 1,
  connectionTimeoutMillis: 5000,
  statement_timeout: 5000,
});

try {
  const snapshot = await new PostgresLoginAnalyticsRepository(pool).snapshot({
    userId: 'operator-verification',
    organizationId: 'analiza-main',
    role: 'WEBMASTER',
  });
  assert.equal(snapshot.dailyLogins.length, 14);
  assert.ok(snapshot.dailyLogins.every(({ count }) => Number.isInteger(count) && count >= 0));
  assert.ok(
    snapshot.dailyLogins.every((item, index, days) => !index || days[index - 1].day < item.day),
  );
  console.log(
    JSON.stringify({
      operation: 'READ_ONLY_VERIFIED',
      users: snapshot.users.length,
      dailyDays: snapshot.dailyLogins.length,
      recentEvents: snapshot.recentLogins.length,
      lastDay: snapshot.dailyLogins.at(-1)?.day,
    }),
  );
} finally {
  await pool.end();
}
