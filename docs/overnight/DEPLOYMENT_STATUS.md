# Deployment status

`STATUS=READY_PREVIEW_ONLY`

Reviewed: 2026-09-03

Preview deployment: [web-nuexb31ir-clinqui7s-projects.vercel.app](https://web-nuexb31ir-clinqui7s-projects.vercel.app)

Deployment ID: `dpl_AHQzRG5HXRM3SnmMLhKxxFpnC8LB`

Certified implementation: `58030d1419e179a4bc51145106c7314cb6417c6c`

The Vercel build completed with `npm ci` and `npm run build --workspace=@analiza/web`. Authenticated Vercel CLI smoke returned: `/` 307, `/login` 200, `/dashboard` 200, and `/portal/demo-qt-2026-0148` 200.

The preview artifact deliberately omitted the production cron and set its output directory to `apps/web/.next`; the repository's versioned `vercel.json` was restored unchanged afterwards. No production deployment or promotion occurred.

Production remains blocked pending real Supabase/RLS and provider validation, approved clinical and financial contracts, and a scheduler that supports the required 15-minute cron. Vercel Hobby rejects that cron frequency.
