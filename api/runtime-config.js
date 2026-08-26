export default function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  response.status(200).json({
    appName: process.env.NEXT_PUBLIC_APP_NAME || "Analiza en Casa",
    appUrl: process.env.NEXT_PUBLIC_APP_URL || "",
    dataMode: process.env.NEXT_PUBLIC_DATA_MODE || "mock",
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    supabasePublishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "",
    notificationsMode: process.env.NOTIFICATIONS_MODE || "mock",
    portalTokenTtlHours: Number(process.env.PORTAL_TOKEN_TTL_HOURS || 168)
  });
}
