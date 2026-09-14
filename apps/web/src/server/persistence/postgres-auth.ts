import type { Pool } from 'pg';
import { LOGIN_MAX_ATTEMPTS, LOGIN_WINDOW_MS, type AuthStore } from '../auth-service';

export function postgresAuthStore(pool: Pool): AuthStore {
  return {
    async hasAnyUser() {
      return Boolean((await pool.query('SELECT 1 FROM analiza.users LIMIT 1')).rowCount);
    },
    async findUserByEmail(email) {
      return (
        (
          await pool.query(
            'SELECT id,email_normalized AS "emailNormalized",password_hash AS "passwordHash",disabled_at AS "disabledAt" FROM analiza.users WHERE email_normalized=$1',
            [email],
          )
        ).rows[0] ?? null
      );
    },
    async createUser(u) {
      await pool.query(
        'INSERT INTO analiza.users(id,email_normalized,password_hash) VALUES($1,$2,$3)',
        [u.id, u.emailNormalized, u.passwordHash],
      );
    },
    async findActiveMemberships(id) {
      return (
        await pool.query(
          'SELECT m.user_id AS "userId", m.organization_id AS "organizationId",m.role,m.active FROM analiza.memberships m JOIN analiza.users u ON u.id=m.user_id WHERE m.user_id=$1 AND m.active AND u.disabled_at IS NULL',
          [id],
        )
      ).rows;
    },
    async createMembership(m) {
      await pool.query(
        'INSERT INTO analiza.memberships(user_id,organization_id,role,active) VALUES($1,$2,$3,$4)',
        [m.userId, m.organizationId, m.role, m.active],
      );
    },
    async createSession(s) {
      await pool.query(
        'INSERT INTO analiza.sessions(session_hash,csrf_hash,user_id,organization_id,expires_at) VALUES($1,$2,$3,$4,$5)',
        [s.sessionHash, s.csrfHash, s.userId, s.organizationId, s.expiresAt],
      );
    },
    async findSession(hash) {
      return (
        (
          await pool.query(
            'SELECT session_hash AS "sessionHash",csrf_hash AS "csrfHash",user_id AS "userId",organization_id AS "organizationId",expires_at AS "expiresAt",revoked_at AS "revokedAt" FROM analiza.sessions WHERE session_hash=$1',
            [hash],
          )
        ).rows[0] ?? null
      );
    },
    async updateSessionCsrf(hash, csrf) {
      await pool.query(
        'UPDATE analiza.sessions SET csrf_hash=$2 WHERE session_hash=$1 AND revoked_at IS NULL',
        [hash, csrf],
      );
    },
    async revokeSession(hash, now) {
      await pool.query(
        'UPDATE analiza.sessions SET revoked_at=$2 WHERE session_hash=$1 AND revoked_at IS NULL',
        [hash, now],
      );
    },
    async consumeLoginAttempt(key, now) {
      const result = await pool.query(
        `INSERT INTO analiza.auth_rate_limits(key,window_started_at,attempts) VALUES($1,$2,1)
      ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN analiza.auth_rate_limits.window_started_at<=$3 THEN 1 ELSE analiza.auth_rate_limits.attempts+1 END,
      window_started_at=CASE WHEN analiza.auth_rate_limits.window_started_at<=$3 THEN $2 ELSE analiza.auth_rate_limits.window_started_at END RETURNING attempts`,
        [key, now, new Date(now.getTime() - LOGIN_WINDOW_MS)],
      );
      return result.rows[0].attempts <= LOGIN_MAX_ATTEMPTS;
    },
  };
}
