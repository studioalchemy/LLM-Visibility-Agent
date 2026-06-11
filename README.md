# Agent 4 — LLM Share of Voice & Ad Visibility Agent

A control panel that queries ChatGPT, Perplexity, Gemini, and Claude with category-relevant prompts, records which brands appear (with position + sentiment), tracks **our brand's** share of voice over time, and emails a `.docx` report after each run.

Stack: **Next.js (App Router) · Supabase · Gmail API · docx · chartjs-node-canvas · recharts**.

---

## 1. Setup

```bash
npm install
cp .env.example .env.local
# fill in the keys
```

### Supabase

1. Create a project at supabase.com.
2. In SQL Editor, paste and run `supabase/migrations/0001_init.sql`.
3. Grab `NEXT_PUBLIC_SUPABASE_URL`, the anon key, and the **service role key** → `.env.local`.

> RLS is **disabled** by default. This is an internal tool. If you expose it, either enable a single shared password (`APP_PASSWORD`) or write RLS policies.

### LLM keys

| Provider | Var | Notes |
| --- | --- | --- |
| OpenAI | `OPENAI_API_KEY` | `gpt-4o-mini` by default |
| Perplexity | `PERPLEXITY_API_KEY` | OpenAI-compatible, `sonar` model |
| Gemini | `GOOGLE_GEMINI_API_KEY` | `gemini-1.5-flash` |
| Claude | `ANTHROPIC_API_KEY` | `claude-haiku-4-5-20251001`, also used as the structured brand extractor |

Models live in `lib/providers/models.ts` — change them in one place.

### Email (Gmail API)

Sending uses the Gmail API with an OAuth2 refresh token. One-time setup:

1. **Google Cloud Console** → create or pick a project → APIs & Services → **enable Gmail API**.
2. **OAuth consent screen** → User Type: External → fill in app name + your support email → add your Gmail address under **Test users**. You can leave the app in "Testing" mode — test users get refresh tokens that don't expire weekly as long as the project is published in production or only used by listed testers.
3. **Credentials → Create Credentials → OAuth client ID** → Application type **Web application** → add `https://developers.google.com/oauthplayground` as an Authorized redirect URI → save the client ID + client secret.
4. **Mint a refresh token** using the OAuth Playground:
   - Go to https://developers.google.com/oauthplayground.
   - Gear icon (top right) → check **Use your own OAuth credentials** → paste your client ID + secret.
   - Left panel → scroll to **Gmail API v1** → tick `https://www.googleapis.com/auth/gmail.send` → **Authorize APIs** → sign in as the Gmail account that will send (`REPORT_FROM_EMAIL`).
   - **Exchange authorization code for tokens** → copy the **Refresh token**.
5. Drop the four values into env:
   ```
   GOOGLE_GMAIL_CLIENT_ID=...
   GOOGLE_GMAIL_CLIENT_SECRET=...
   GOOGLE_GMAIL_REFRESH_TOKEN=...
   REPORT_FROM_EMAIL=you@gmail.com   # must be the account you signed in as in step 4
   ```

If any of those are missing, runs still complete and the UI still renders results — the `.docx` just isn't emailed.

### Cron

Two interchangeable modes — pick one, don't run both:

- **Node-cron worker** (this repo's default — runs on Railway). `npm run worker` starts a process that immediately calls `tick()` once and then re-runs hourly. Polls `agent_config.next_run_at` directly via Supabase, so no HTTP endpoint or `CRON_SECRET` is needed.
- **Vercel Cron** (alternative). Add a `vercel.json` declaring a cron pointing at `/api/cron/tick` and set `CRON_SECRET` in Vercel env — Vercel Cron auto-attaches `Authorization: Bearer $CRON_SECRET`. The endpoint logic is already in place (`app/api/cron/tick/route.ts`).

The cron only *polls*: it does nothing unless `is_active=true` AND `next_run_at <= now()`.

---

## 2. Run it

```bash
npm run dev
# open http://localhost:3000
```

### Kill-switch semantics (important — get this right)

- **Off:** `is_active=false`. Cron skips. Manual `RUN NOW` still works.
- **On (re-enable):** `is_active=true`, `last_activated_at=now()`, and `next_run_at = now() + frequency_days`. The schedule **restarts from today**. No immediate run.
- **Change frequency while live:** `next_run_at = now() + new_frequency_days`.
- **RUN NOW:** instant run, does **not** alter `next_run_at`.

### Frequency slider stops

`1 / 3 / 7 / 14 / 30` days. Custom values are rejected by `/api/agent/frequency`.

---

## 3. Architecture

```
app/api/
  config/              GET/PATCH agent_config (brand, category)
  agent/toggle/        POST  flip is_active, reset next_run_at on re-enable
  agent/frequency/     POST  set frequency_days, recompute next_run_at
  prompts/             GET/POST/DELETE
  recipients/          GET/POST/DELETE
  run/                 POST  → runAgent('manual') → instant results + email
  runs/                GET   list recent
  runs/[id]/           GET   detail (responses + mentions)
  cron/tick/           POST/GET (CRON_SECRET) → tick()

lib/
  supabase.ts          server + browser clients (service-role server-only)
  config.ts            loadConfig()
  providers/
    openai.ts perplexity.ts gemini.ts claude.ts
    models.ts          central model IDs
  extract.ts           JSON extractor + normalization + our-brand matcher
  runAgent.ts          orchestrator (queries → extract → persist → email)
  metrics.ts           aggregate() → RunSummary
  report.ts            docx builder (charts via chartjs-node-canvas; table fallback)
  email.ts             Resend wrapper (abstracted as sendReport)

worker/scheduler.ts    node-cron mode

supabase/migrations/0001_init.sql
```

### Provider call pattern

For each prompt: all 4 providers in parallel. Prompts iterate sequentially across providers to stay under rate limits. A failing provider stores an `error` on its `llm_responses` row and shows up in the report appendix — it never crashes the run.

### Brand extraction

`lib/extract.ts` calls Claude (or OpenAI as fallback) with a strict JSON schema:
```json
{"brands":[{"brand_name":"…","position":1,"sentiment":"positive|neutral|negative","context_snippet":"…"}]}
```
Then normalizes brand names (lowercase, strip punctuation) and decides `is_our_brand` by substring-matching tokens of `agent_config.our_brand`.

### Metrics

`lib/metrics.ts` produces a `RunSummary` (typed in `lib/types.ts`) covering overall SoV, per-provider SoV + avg position, distinct brand count, competitor table, sentiment split, sample snippets, per-prompt grid, and a `delta_sov` vs the last completed run.

### Report

`lib/report.ts` builds a `.docx` with cover → executive summary → per-provider chart + table → SoV-over-time line chart → per-prompt grid → competitor landscape → sentiment + sample language → appendix. Chart rendering goes through `chartjs-node-canvas`; if it can't load (e.g. native deps missing) the same data renders as a docx table instead.

---

## 4. Acceptance checklist

Map of brief §11 → code:

| Requirement | Implementation |
| --- | --- |
| Kill OFF → no scheduled runs | `app/api/cron/tick/route.ts:tick()` returns early on `!is_active` |
| Kill ON → `next_run_at = today + frequency_days` | `app/api/agent/toggle/route.ts` |
| Slider sets `next_run_at` immediately | `app/api/agent/frequency/route.ts` |
| Prompts/recipients persist | `app/api/prompts/route.ts`, `app/api/recipients/route.ts` |
| RUN NOW: query 4 providers, render results, email .docx, schedule unchanged | `lib/runAgent.ts` (no mutation of `next_run_at`) |
| `.docx` contents | `lib/report.ts` |
| Provider failure isolated | per-response try/catch in `runAgent.ts` |
| All data in Supabase | every write goes through `getServerSupabase()` |

---

## 5. Optional password gate (§10)

`APP_PASSWORD` is reserved for a lightweight middleware gate. Not wired yet — drop a `middleware.ts` that compares a signed cookie set by a tiny `/login` page styled with the same pixel theme.

---

## 6. Notes

- Service-role key is **server-only**. Browser uses anon key (currently only via Supabase JS if you wire it; otherwise all reads go through API routes).
- `chartjs-node-canvas` depends on `canvas` (native). If install fails on macOS, run `brew install pkg-config cairo pango libpng jpeg giflib librsvg pixman` first. The docx will still render — charts just fall back to tables.
- Update model IDs in `lib/providers/models.ts` when providers ship newer defaults.
