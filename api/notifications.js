import { serverSupabaseConfig, validateNotificationRequest } from "./_notification-contract.js";

export default async function handler(request, response) {
  if (request.method !== "POST") return response.status(405).json({ error: "Method not allowed" });
  const validated = validateNotificationRequest(request.body || {});
  if (!validated.ok) return response.status(400).json({ error: validated.error });

  const authorization = request.headers.authorization || "";
  if (!/^Bearer\s+\S+$/i.test(authorization)) {
    return response.status(401).json({ error: "No fue posible procesar la notificación." });
  }
  const { url, publishableKey } = serverSupabaseConfig();
  if (!url || !publishableKey) {
    return response.status(503).json({ error: "La cola de notificaciones no está configurada." });
  }

  // queue_notification derives organization, authorization and registered
  // recipient contact from the authenticated Supabase session. No service key,
  // destination, free-form content, or public portal token crosses this route.
  const queued = await fetch(`${url}/rest/v1/rpc/queue_notification`, {
    method: "POST",
    headers: {
      apikey: publishableKey,
      Authorization: authorization,
      "Content-Type": "application/json",
      Prefer: "return=representation"
    },
    body: JSON.stringify({
      p_channel: validated.value.channel,
      p_template_code: validated.value.templateCode,
      p_recipient_type: validated.value.recipientType,
      p_recipient_id: validated.value.recipientId,
      p_related_entity_type: validated.value.relatedEntityType,
      p_related_entity_id: validated.value.relatedEntityId,
      p_idempotency_key: validated.value.idempotencyKey
    })
  });

  if (!queued.ok) return response.status(403).json({ error: "No fue posible procesar la notificación." });
  const row = await queued.json();
  response.status(202).json({
    ok: true,
    status: row?.status || "QUEUED",
    id: row?.id,
    idempotencyKey: validated.value.idempotencyKey
  });
}
