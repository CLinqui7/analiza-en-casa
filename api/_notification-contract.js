export const NOTIFICATION_CHANNELS = new Set(["WHATSAPP", "SMS", "EMAIL"]);

export const NOTIFICATION_TEMPLATES = Object.freeze({
  QUOTE_READY: { recipientType: "PATIENT", permission: "quotes:write", preview: "Su cotización está disponible en el portal seguro." },
  QUOTE_STATUS: { recipientType: "PATIENT", permission: "insurance:write", preview: "Su solicitud tiene una actualización. Consulte el portal seguro." },
  PAYMENT_RECEIVED: { recipientType: "PATIENT", permission: "payments:write", preview: "Hay una actualización administrativa disponible en el portal seguro." },
  DOCTOR_STATEMENT: { recipientType: "DOCTOR", permission: "statements:write", preview: "Su estado de cuenta está disponible en el portal profesional seguro." },
  NURSING_NOTE_AVAILABLE: { recipientType: "DOCTOR", permission: "clinical:write", preview: "Hay un documento disponible en el portal profesional seguro." }
});

export function maskDestination(destination = "") {
  const value = String(destination).trim();
  if (value.includes("@")) {
    const [local, domain] = value.split("@", 2);
    return `${local.slice(0, 2)}•••@${domain}`;
  }
  const digits = value.replace(/\D/g, "");
  return digits ? `•••• ${digits.slice(-4)}` : "••••";
}

export function validateNotificationRequest(body = {}) {
  const channel = String(body.channel || "").toUpperCase();
  const templateCode = String(body.templateCode || body.type || "").toUpperCase();
  const recipientType = String(body.recipientType || "").toUpperCase();
  const recipientId = String(body.recipientId || "").trim();
  const relatedEntityType = String(body.relatedEntityType || body.entityType || "").toUpperCase();
  const relatedEntityId = String(body.relatedEntityId || body.entityId || "").trim();
  const idempotencyKey = String(body.idempotencyKey || "").trim();

  if (!NOTIFICATION_CHANNELS.has(channel)) return { ok: false, error: "Canal no permitido." };
  const template = NOTIFICATION_TEMPLATES[templateCode];
  if (!template) return { ok: false, error: "Plantilla no permitida." };
  if (recipientType !== template.recipientType || !recipientId) return { ok: false, error: "Destinatario no permitido." };
  if (!relatedEntityType || !relatedEntityId || !idempotencyKey || idempotencyKey.length > 160) {
    return { ok: false, error: "Referencia de notificación inválida." };
  }

  // The client may identify an authorized record only. It may never supply a
  // destination, message, diagnosis, free-form subject, or a public token.
  if (["destination", "secureUrl", "message", "content", "subject", "organizationId"].some((key) => body[key] !== undefined)) {
    return { ok: false, error: "La notificación debe usar una plantilla segura." };
  }

  return {
    ok: true,
    value: { channel, templateCode, recipientType, recipientId, relatedEntityType, relatedEntityId, idempotencyKey }
  };
}

export function serverSupabaseConfig(environment = process.env) {
  return {
    url: environment.SUPABASE_URL || environment.NEXT_PUBLIC_SUPABASE_URL || "",
    publishableKey: environment.SUPABASE_PUBLISHABLE_KEY || environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || environment.SUPABASE_ANON_KEY || ""
  };
}
