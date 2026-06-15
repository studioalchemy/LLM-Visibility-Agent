# Agent 4 — Project notes for Claude Code

Single-page dashboard that queries 4 LLMs (OpenAI, Perplexity, Gemini, Claude) with category prompts, tracks our brand's Share of Voice over time, and emails a `.docx` report after every run.

Read this file before making changes. Most pitfalls below come from subtle behaviour the brief required and that *will* be wrong if you "fix" them naively.

---

## Stack & layout

- **Next.js App Router (TS)** — single deployable. UI + all API routes in `app/`.
- **Supabase** — Postgres, RLS disabled (single-tenant internal tool). Schema in `supabase/migrations/0001_init.sql`. Single seeded row in `agent_config`.
- **Email — Gmail API via OAuth2 refresh token.** `lib/email.ts`. We do *not* use Resend (it was swapped out). MIME message built inline; no nodemailer.
- **Scheduling — Railway worker only** (`worker/scheduler.ts`, `npm run worker`). The `/api/cron/tick` endpoint still exists for Vercel-cron compatibility but `vercel.json` is intentionally absent. **Never run both** — they race on `agent_config.next_run_at`.
- **Charts** — `recharts` in the browser; `chartjs-node-canvas` in the docx report with a docx-table fallback if canvas native deps fail.

Repo: `github.com/studioalchemy/LLM-Visibility-Agent`.

---

## Hard rules — do not break these

### Kill-switch and scheduling (§6.7 of the brief)

| Action | Behavior |
|---|---|
| Toggle ON | `is_active=true`, `last_activated_at=now()`, **`next_run_at = now() + frequency_days`**. No immediate run — schedule restarts from today. |
| Toggle OFF | `is_active=false`. Cron skips. `next_run_at` left alone. Manual RUN NOW still works. |
| Change frequency (while active or not) | `next_run_at = now() + new_frequency_days`. |
| **Manual RUN NOW** | Runs `runAgent('manual')` and **MUST NOT touch `next_run_at`**. |
| Cron tick | Runs only if `is_active=true && next_run_at <= now()`. After running, sets `next_run_at = now() + frequency_days`. |

Code paths: `app/api/agent/toggle/route.ts`, `app/api/agent/frequency/route.ts`, `app/api/cron/tick/route.ts`, `worker/scheduler.ts`. If you touch any of them, re-verify against the table above.

### Frequency stops are fixed

`[1, 3, 7, 14, 30]` days only. Enforced server-side in `app/api/agent/frequency/route.ts`. Don't let the UI accept anything else; don't relax the API check.

### Service-role key stays server-only

`SUPABASE_SERVICE_ROLE_KEY` is only used from API routes / the worker via `getServerSupabase()` in `lib/supabase.ts`. Never reference it from a `'use client'` component or expose via `NEXT_PUBLIC_*`.

### Provider failures must not crash the run

`lib/runAgent.ts` catches per-response. A failing provider stores its error on the `llm_responses` row and shows up in `summary.errors`. Preserve this pattern when adding providers.

---

## Where things live

```
app/api/
  config/             GET/PATCH agent_config (brand + category)
  agent/toggle/       POST flip is_active (resets next_run_at on re-enable)
  agent/frequency/    POST set frequency_days (recomputes next_run_at)
  prompts/            GET/POST/DELETE
  recipients/         GET/POST/DELETE
  run/                POST runAgent('manual') — does NOT touch next_run_at
  runs/               GET recent list
  runs/[id]/          GET full detail
  cron/tick/          POST/GET (CRON_SECRET) — kept for Vercel-cron compat

lib/
  supabase.ts         server + browser clients
  config.ts           loadConfig()
  providers/
    openai.ts perplexity.ts gemini.ts claude.ts
    models.ts         CENTRAL model ID list — change models here only
  extract.ts          JSON extractor (Claude default, OpenAI fallback) + our-brand matcher
  runAgent.ts         orchestrator
  metrics.ts          aggregate() → RunSummary
  report.ts           docx builder
  email.ts            Gmail API send

components/           dashboard UI (pixel + MKBHD theme; tokens in styles/tokens.css)
worker/scheduler.ts   node-cron hourly tick (Railway)
supabase/migrations/0001_init.sql
```

---

## Conventions

- **Provider call pattern:** parallel per prompt (`Promise.all([openai, perplexity, gemini, claude])`), iterate prompts sequentially to stay under rate limits. See `lib/runAgent.ts:askAllProviders`.
- **Model IDs are centralized** in `lib/providers/models.ts`. Update there, never inline.
- **Brand matching** is in `lib/extract.ts:isOurBrandMatch` — substring match on tokens ≥3 chars of `agent_config.our_brand`. Tweak with care; loosening it inflates SoV.
- **RunSummary is the wire format** for the dashboard and the basis for `runs.summary` jsonb. Defined in `lib/types.ts`. Keep it backwards-compatible or migrate historical rows.
- **Design tokens** are CSS variables in `styles/tokens.css`. Tailwind config maps to them. Don't hardcode hex in components.
- **Fonts:** pixel ("Press Start 2P" / "Silkscreen") for headers/labels only, mono ("JetBrains Mono") for body. Pixel text must stay short, uppercase, well-spaced.

---

## Local dev

```bash
npm install
cp .env.example .env.local      # then fill .env.local with real values
npm run dev                     # Next.js on :3000
npm run worker                  # in another terminal, runs the cron worker
```

The dashboard at `localhost:3000` reads/writes the *same* Supabase as production. Use a separate Supabase project for dev if you don't want to pollute prod data.

---

## Deployment topology

- **Vercel** hosts the Next.js app (UI + API routes). Env vars in §A of the README.
- **Railway** hosts a worker service running `npm run worker`. Public networking OFF. Same env vars minus `NEXT_PUBLIC_*` (only needs `SUPABASE_SERVICE_ROLE_KEY` for Supabase).
- **Don't enable Vercel Cron** while Railway is running — they'll double-fire.

---

## Things that have tripped us up

- **`NEXT_PUBLIC_SUPABASE_URL`** is the bare project URL (`https://<ref>.supabase.co`), no `/rest/v1/` suffix. The SDK appends paths.
- **Gmail "invalid_grant"** means the refresh token was minted by a different account than `REPORT_FROM_EMAIL`, or the OAuth consent screen kicked the user out of test users. Re-mint via OAuth Playground.
- **`chartjs-node-canvas` native build fails** on some hosts. Charts fall back to docx tables automatically; if a deploy fails on the install step itself, add system libs (`cairo pango libpng jpeg giflib librsvg pixman`) via Nixpacks/Dockerfile.
- **`.env.example` previously had real values committed** — see security note below. Always keep example files placeholder-only.

---

## Security note (read this)

`.env.example` is git-tracked. Treat it as if it were a public file. Never paste real Supabase keys, LLM API keys, Gmail client secrets, or refresh tokens into it — even temporarily. Real values go in `.env.local` (gitignored) for dev, and in Vercel/Railway env settings for prod.

If you find real credentials in any tracked file: rotate them at the source first, then scrub the file. A `git rm --cached` doesn't unleak history.
