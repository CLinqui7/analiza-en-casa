import { notificationProvider } from "./_notification-provider.js";
import { serverSupabaseConfig } from "./_notification-contract.js";

export default async function handler(request, response) {
  const auth = request.headers.authorization || "";
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return response.status(401).json({ error: "Unauthorized" });
  }
  const { url } = serverSupabaseConfig();
  if (!url || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return response.status(200).json({ ok: true, mode: "mock", processed: 0 });
  }

  const headers = {
    apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json"
  };
  const result = await fetch(`${url}/rest/v1/rpc/claim_notification_jobs`, {
    method: "POST",
    headers,
    body: JSON.stringify({ p_limit: 25 })
  });

  if (!result.ok) return response.status(502).json({ error: "Retry queue unavailable" });
  const jobs = await result.json();
  const provider = notificationProvider();
  let processed = 0;
  for (const job of Array.isArray(jobs) ? jobs : []) {
    const outcome = await provider.deliver(job);
    const recorded = await fetch(`${url}/rest/v1/rpc/record_notification_attempt`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        p_notification_id: job.id,
        p_provider: provider.provider,
        p_state: outcome.state,
        p_provider_reference: outcome.providerReference,
        p_error_code: outcome.errorCode
      })
    });
    if (recorded.ok) processed += 1;
  }
  response.status(200).json({ ok: true, mode: provider.provider, processed });
}
