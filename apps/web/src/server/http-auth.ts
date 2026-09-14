import { CsrfError, SessionError } from '@/server/auth-service';
import { MongoAccessError } from '@/server/validation/patients';

/** Maps only expected authorization failures. All other server errors stay fail-closed as 503. */
export function authorizationStatus(error: unknown): 401 | 403 | 503 {
  if (error instanceof SessionError) return 401;
  if (error instanceof CsrfError || error instanceof MongoAccessError) return 403;
  return 503;
}

/** A foreign tenant is indistinguishable from a missing resource to the caller. */
export function resourceStatus(value: unknown): 200 | 404 {
  return value === null ? 404 : 200;
}
