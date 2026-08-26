const SAFE_CHANNELS = new Set(["WHATSAPP", "SMS", "EMAIL"]);
const SAFE_TYPES = new Set(["QUOTE_READY", "QUOTE_STATUS", "PAYMENT_RECEIVED", "DOCTOR_STATEMENT", "NURSING_NOTE_AVAILABLE"]);

function mask(destination = "") {
  if (destination.includes("@")) {
    const [name, domain] = destination.split("@");
    return `${name.slice(0, 2)}•••@${domain}`;
  }
  const digits = destination.replace(/\D/g, "");
  return `•••• ${digits.slice(-4)}`;
}

export default async function handler(request, response) {
  if (request.method !== "POST") return response.status(405).json({ error: "Method not allowed" });
  const body = request.body || {};
  if (!SAFE_CHANNELS.has(body.channel) || !SAFE_TYPES.has(body.type)) {
    return response.status(400).json({ error: "Canal o plantilla no permitida." });
  }
  if (!body.destination || !body.secureUrl) {
    return response.status(400).json({ error: "Destino y enlace seguro son obligatorios." });
  }

  // Nunca se acepta contenido clínico arbitrario desde el cliente.
  const payload = {
    type: body.type,
    channel: body.channel,
    destination: mask(body.destination),
    reference: String(body.reference || ""),
    secureUrl: String(body.secureUrl),
    queuedAt: new Date().toISOString()
  };

  const mode = process.env.NOTIFICATIONS_MODE || "mock";
  if (mode !== "live") {
    return response.status(202).json({ ok: true, mode: "mock", status: "DELIVERED", payload });
  }

  // Los adaptadores reales se habilitan solo con secretos en Vercel.
  // Esta rama devuelve QUEUED para que un worker procese el proveedor configurado.
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return response.status(503).json({ error: "Mensajería live sin configuración de cola." });
  }

  const insert = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/notifications`, {
    method: "POST",
    headers: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation"
    },
    body: JSON.stringify({
      organization_id: body.organizationId,
      channel: body.channel,
      template_code: body.type,
      destination_masked: payload.destination,
      entity_type: body.entityType || "UNKNOWN",
      entity_id: body.entityId || null,
      status: "QUEUED",
      payload: { reference: payload.reference, secure_url: payload.secureUrl }
    })
  });

  if (!insert.ok) return response.status(502).json({ error: "No fue posible registrar la notificación." });
  const rows = await insert.json();
  response.status(202).json({ ok: true, mode: "live", status: "QUEUED", id: rows?.[0]?.id });
}
