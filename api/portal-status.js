export default async function handler(request, response) {
  if (request.method !== "POST") return response.status(405).json({ error: "Method not allowed" });
  const { token, document, verificationCode } = request.body || {};
  if (!token || !document || !verificationCode) {
    // Respuesta deliberadamente genérica para evitar enumeración.
    return response.status(400).json({ error: "No fue posible validar el acceso." });
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return response.status(503).json({ error: "Portal productivo no configurado.", mode: "mock-only" });
  }

  try {
    const rpc = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/portal_quote_snapshot`, {
      method: "POST",
      headers: {
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        p_token: token,
        p_document: document,
        p_verification_code: verificationCode
      })
    });
    if (!rpc.ok) return response.status(401).json({ error: "No fue posible validar el acceso." });
    const data = await rpc.json();
    response.setHeader("Cache-Control", "no-store");
    response.status(200).json(data);
  } catch {
    response.status(503).json({ error: "Servicio temporalmente no disponible." });
  }
}
