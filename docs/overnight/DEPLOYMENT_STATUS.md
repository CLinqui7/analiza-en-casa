# Deployment status

`STATUS=READY_PREVIEW_ONLY`

Reviewed: 2026-09-03 08:15 -06:00

Preview deployment: [web-1idc2eofx-clinqui7s-projects.vercel.app](https://web-1idc2eofx-clinqui7s-projects.vercel.app)

Deployment ID: `dpl_2CBtezndaDgBrSWs1CGxYUEMQur6`

Certified implementation: `4b2f2b8275a19268fecd1cceddbbb19fd3ec6cce`; published evidence head: `56c4952611147f84e08df147c0a943ac9b1fede7`.

The Vercel build completed with `npm ci` and `npm run build --workspace=@analiza/web`; its dependency audit reported 0 vulnerabilities. Authenticated Vercel CLI smoke returned: `/` 307; `/login`, `/dashboard`, `/patients`, `/hospitalizations`, `/quotes`, `/agenda`, `/inventory`, `/portal/demo-qt-2026-0148`, and `/api/health` 200. `Acuses` is a tested UI tab within `/inventory`, not a separate route.

The preview artifact deliberately omitted the production cron and set its output directory to `apps/web/.next`; the repository's versioned `vercel.json` was restored unchanged afterwards. No production deployment or promotion occurred.

Production remains blocked pending real Supabase/RLS and provider validation, approved clinical and financial contracts, and a scheduler that supports the required 15-minute cron. Vercel Hobby rejects that cron frequency.
