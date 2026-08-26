export default async function handler(request, response) {
  const auth = request.headers.authorization || "";
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return response.status(401).json({ error: "Unauthorized" });
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return response.status(200).json({ ok: true, mode: "mock", processed: 0 });
  }

  const result = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/claim_notification_retries`, {
    method: "POST",
    headers: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ p_limit: 25 })
  });

  if (!result.ok) return response.status(502).json({ error: "Retry queue unavailable" });
  const jobs = await result.json();
  response.status(200).json({ ok: true, processed: Array.isArray(jobs) ? jobs.length : 0 });
}
