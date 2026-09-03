# Deployment status

`STATUS=READY_PREVIEW_ONLY`

Reviewed: 2026-09-03 07:15 -06:00

Preview deployment: [web-anu19vg20-clinqui7s-projects.vercel.app](https://web-anu19vg20-clinqui7s-projects.vercel.app)

Deployment ID: `dpl_3cGwvYKhLaxPUcX4ie6Xvm1KxMZu`

Certified implementation: `2c52fbb5e74c53057ffd417f6af2452efea74f6d`; published evidence head: `bbcab6d74a4c0845ba504794ed5a3842b7140981`.

The Vercel build completed with `npm ci` and `npm run build --workspace=@analiza/web`. Authenticated Vercel CLI smoke returned: `/` 307; `/login`, `/dashboard`, `/patients`, `/hospitalizations`, `/quotes`, `/agenda`, `/inventory`, and `/portal/demo-qt-2026-0148` 200. `Acuses` is a tested UI tab within `/inventory`, not a separate route.

The preview artifact deliberately omitted the production cron and set its output directory to `apps/web/.next`; the repository's versioned `vercel.json` was restored unchanged afterwards. No production deployment or promotion occurred.

Production remains blocked pending real Supabase/RLS and provider validation, approved clinical and financial contracts, and a scheduler that supports the required 15-minute cron. Vercel Hobby rejects that cron frequency.
