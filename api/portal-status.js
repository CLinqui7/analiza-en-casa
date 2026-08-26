import {
  PORTAL_ACCESS_ERROR,
  callServiceRpc,
  createFixedWindowRateLimiter,
  requestFingerprint,
  serverSupabaseConfig
} from "./_portal-security.js";

const verificationLimiter = createFixedWindowRateLimiter();

export default async function handler(request, response) {
  if (request.method !== "POST") return response.status(405).json({ error: "Method not allowed" });
  const token = typeof request.body?.token === "string" ? request.body.token.trim() : "";
  const verificationCode = typeof request.body?.verificationCode === "string" ? request.body.verificationCode.trim() : "";
  const fingerprint = requestFingerprint(request);
  const rateKey = `portal-verify:${fingerprint.ipHash || "unknown"}`;
  if (!token || !verificationCode || token.length > 1024 || verificationCode.length > 128 || !verificationLimiter.allow(rateKey)) {
    return response.status(401).json({ error: PORTAL_ACCESS_ERROR });
  }

  const config = serverSupabaseConfig();
  if (!config) return response.status(503).json({ error: "Servicio temporalmente no disponible." });

  try {
    const data = await callServiceRpc(fetch, config, "portal_quote_snapshot", {
      p_token: token,
      p_verification_code: verificationCode,
      p_ip_hash: fingerprint.ipHash,
      p_user_agent_hash: fingerprint.userAgentHash
    });
    if (!data) return response.status(401).json({ error: PORTAL_ACCESS_ERROR });
    response.setHeader("Cache-Control", "no-store");
    response.status(200).json(data);
  } catch {
    response.status(503).json({ error: "Servicio temporalmente no disponible." });
  }
}
