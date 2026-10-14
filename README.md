# gym-saas — Gym Management SaaS (Algeria, MVP)

Multi-tenant PWA for Algerian gyms: members, plans, subscriptions (renew/freeze/extend),
cash payments + installments, dashboard, expiry reminders, Excel import.
Arabic (RTL) + French (LTR), offline-first, DZD only.

- Scope: `docs/PRD.md` (MVP only — §3/§12 non-goals are out).
- Agent rules: `AGENTS.md` (read first, follow on every change).
- UI tokens: `docs/DESIGN-SYSTEM.md`. Screens: `docs/SCREENS.md`.
- Frontend: `apps/web/` (Vite + React + TS + Tailwind PWA).
- Backend: `supabase/` (Postgres + Auth + RLS + Edge Functions).

## Quick start

```powershell
# 1. Frontend
Set-Location apps/web
npm install
Copy-Item .env.example .env.local   # add Supabase URL + anon key
npm run dev

# 2. Backend (needs Supabase CLI + linked project)
supabase db push
supabase functions serve reminders-sender
```

## Repo layout

```text
AGENTS.md  docs/  design/<NN>-<screen>/  apps/web/  supabase/
```

Design exports (`design/*/code.html`) are visual references only — rebuild with
Tailwind + `docs/DESIGN-SYSTEM.md` tokens, never import directly.
