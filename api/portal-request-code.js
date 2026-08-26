import {
  PORTAL_CODE_REQUEST_MESSAGE,
  callServiceRpc,
  createFixedWindowRateLimiter,
  createVerificationCode,
  requestFingerprint,
  sendVerificationCode,
  serverSupabaseConfig,
  sha256
} from "./_portal-security.js";

const requestLimiter = createFixedWindowRateLimiter();

export default async function handler(request, response) {
  if (request.method !== "POST") return response.status(405).json({ error: "Method not allowed" });

  const token = typeof request.body?.token === "string" ? request.body.token.trim() : "";
  const fingerprint = requestFingerprint(request);
  const rateKey = `portal-code:${fingerprint.ipHash || "unknown"}`;
  const genericResponse = () => response.status(202).json({ message: PORTAL_CODE_REQUEST_MESSAGE });

  if (!token || token.length > 1024 || !requestLimiter.allow(rateKey)) return genericResponse();

  const config = serverSupabaseConfig();
  if (!config) return response.status(503).json({ error: "Servicio temporalmente no disponible." });

  try {
    const code = createVerificationCode();
    const issued = await callServiceRpc(fetch, config, "portal_issue_verification_code", {
      p_token: token,
      p_verification_code_hash: sha256(code),
      p_ip_hash: fingerprint.ipHash,
      p_user_agent_hash: fingerprint.userAgentHash
    });
    if (issued?.accepted) {
      await sendVerificationCode({ channel: issued.channel, destination: issued.destination, code });
    }
    return genericResponse();
  } catch {
    return response.status(503).json({ error: "Servicio temporalmente no disponible." });
  }
}
