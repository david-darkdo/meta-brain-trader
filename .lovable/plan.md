## MetaBrain Trader — Group 1: Foundation & Database

Scope: data layer, auth, trade entry/viewing CRUD. No AI, no payments, no learning engine.

### 1. Enable Lovable Cloud
Provisions Supabase (auth, DB, storage). Required first step.

### 2. Database (migration)
Tables with RLS (`auth.uid() = user_id` scoping, with FK joins for child rows via the parent trade):
- `users` (mirrors `auth.users` with `subscription_tier` enum default `FREE`)
- `profile_settings`, `usage_logs`, `prompt_registry` (registry readable to all authenticated)
- `trades` with `trade_status` enum
- `screenshots`, `ai_analyses`, `reflections`, `results` (RLS via parent trade ownership using a security-definer helper `public.owns_trade(trade_id)`)

Trigger `on_auth_user_created` → inserts `users` row with `FREE` tier.

Storage bucket `trade-screenshots` (private). RLS on `storage.objects`: only owner (path prefix = `auth.uid()/...`) can select/insert/update/delete.

GRANTs for `authenticated` + `service_role` on all new tables. `prompt_registry`: SELECT for `authenticated`.

### 3. Design system
Minimal, dark, trader-focused. Define semantic tokens in `src/styles.css` (deep slate background, emerald primary for wins, rose for losses, amber accents). No purple.

### 4. Routes (TanStack Start file-based)
- `/auth` — public; email/password signup+login+password reset (and `/reset-password` page).
- `/_authenticated/route.tsx` — managed gate.
- `/_authenticated/dashboard` — placeholder cards/charts grid.
- `/_authenticated/trade-creator` — 3-step wizard (details → screenshots upload with labels → review/save as DRAFT). Mobile-first.
- `/_authenticated/trade-detail/$id` — read-only trade view + editable reflections section. Edit core trade only when status is DRAFT.
- `/_authenticated/profile` — subscription tier + account info.
- Root layout: navbar with links, sign-out, auth state listener.

### 5. Client wiring
- `supabase` browser client used directly for queries (RLS enforced) — no server functions needed in this phase.
- TanStack Query for data fetching; per-user cache invalidation on auth changes.
- Upload flow: upload files to `trade-screenshots/{user_id}/{trade_id}/{uuid}` then insert `screenshots` rows with signed-url retrieval on detail page.

### 6. Acceptance verification
- Build passes.
- Manual smoke: sign up → land on dashboard → create trade with 2 labeled screenshots → view on detail page → add reflection.

### Technical notes
- Enums created via `CREATE TYPE` for tier, status, stage, verdict, outcome, analysis_type, prompt_type.
- `owns_trade(_trade_id uuid)` SECURITY DEFINER returns boolean; used in policies for child tables to avoid recursion.
- Screenshots displayed via short-lived signed URLs (bucket private).
- No social login configured (not requested).
