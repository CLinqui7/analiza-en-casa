import { createHash, randomInt } from "node:crypto";

export const PORTAL_ACCESS_ERROR = "No fue posible validar el acceso.";
export const PORTAL_CODE_REQUEST_MESSAGE = "Si el enlace es válido, enviamos un código al canal registrado.";
export const PORTAL_CODE_MESSAGE = "Use este código de un solo uso para continuar en el portal seguro.";

export function sha256(value) {
  return createHash("sha256").update(String(value || "")).digest("hex");
}

export function createVerificationCode() {
  return String(randomInt(0, 100_000_000)).padStart(8, "0");
}

export function requestFingerprint(request) {
  const forwarded = String(request?.headers?.["x-forwarded-for"] || "").split(",")[0].trim();
  const address = forwarded || String(request?.socket?.remoteAddress || "");
  const userAgent = String(request?.headers?.["user-agent"] || "");
  return {
    ipHash: address ? sha256(address) : null,
    userAgentHash: userAgent ? sha256(userAgent) : null
  };
}

export function createFixedWindowRateLimiter({ limit = 5, windowMs = 10 * 60 * 1000, now = () => Date.now() } = {}) {
  const hits = new Map();
  return {
    allow(key) {
      const current = now();
      const cutoff = current - windowMs;
      const existing = (hits.get(key) || []).filter((timestamp) => timestamp > cutoff);
      if (existing.length >= limit) {
        hits.set(key, existing);
        return false;
      }
      existing.push(current);
      hits.set(key, existing);
      return true;
    }
  };
}

export function serverSupabaseConfig(environment = process.env) {
  const url = environment.SUPABASE_URL || environment.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = environment.SUPABASE_SERVICE_ROLE_KEY;
  return url && serviceRoleKey ? { url, serviceRoleKey } : null;
}

export async function callServiceRpc(fetchImpl, config, functionName, parameters) {
  const response = await fetchImpl(`${config.url}/rest/v1/rpc/${functionName}`, {
    method: "POST",
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(parameters)
  });
  if (!response.ok) return null;
  return response.json();
}

export async function sendVerificationCode({ channel, destination, code, environment = process.env }) {
  // The production transport is intentionally not selected without explicitly
  // configured credentials. The safe mock has no clinical or financial content.
  if (!environment.PORTAL_DELIVERY_PROVIDER) {
    return { provider: "mock", status: "SIMULATED", channel, destination, body: `${PORTAL_CODE_MESSAGE} ${code}` };
  }
  throw new Error("Proveedor de portal no implementado en este entorno.");
}
