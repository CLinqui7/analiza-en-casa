export default async function handler(request, response) {
  const started = Date.now();
  const checks = {
    runtime: "ok",
    supabaseConfigured: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
    notificationsMode: process.env.NOTIFICATIONS_MODE || "mock"
  };

  let database = "not-configured";
  if (checks.supabaseConfigured) {
    try {
      const result = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/organizations?select=id&limit=1`, {
        headers: {
          apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY}`
        }
      });
      database = result.ok ? "reachable" : `http-${result.status}`;
    } catch {
      database = "unreachable";
    }
  }

  response.setHeader("Cache-Control", "no-store");
  response.status(database === "unreachable" ? 503 : 200).json({
    status: database === "unreachable" ? "degraded" : "ok",
    version: "2026.08.26-qa",
    timestamp: new Date().toISOString(),
    elapsedMs: Date.now() - started,
    checks: { ...checks, database }
  });
}
