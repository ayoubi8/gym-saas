# AGENT-HANDOFF.md — implement gym-saas with Claude (Antigravity)

Paste the "First prompt" at the bottom into a fresh Claude session with this repo
open (`https://github.com/ayoubi8/gym-saas`, branch `main`). One phase per session.

## 1. What we are building

Multi-tenant **Gym Management SaaS for Algeria (MVP)**: gym owners replace
paper/Excel with members, subscription plans, subscriptions (renew / freeze /
extend), cash payments + installments, a 4-widget dashboard, expiry reminders
(WhatsApp/SMS/Viber), and Excel import. Mobile-first PWA, Arabic (RTL) + French
(LTR), offline-capable, currency DZD only. Two roles: `admin` (platform owner,
manages gyms) and `owner` (one gym). No public signup — admin creates gym + owner.

## 2. Stack (locked — do not change)

- Frontend: Vite + React 18 + TS strict + Tailwind + React Router + i18next +
  TanStack Query + vite-plugin-pwa + Dexie. Deploys to **Vercel** (static `dist/`).
- Backend: **Supabase** (Postgres + Auth + RLS + Edge Functions). No custom API.
  EU region (Frankfurt/Paris); Free during build, Pro before first pilot gym.
- Auth: password only; login accepts phone or email (phone → synthetic email
  `<digits>@phone.gymdz.app`, `email_confirm=true`, auth emails DISABLED, admin resets).
- Reminders: scheduler writes log + owner sends via deep link (`sendReminder()` seam;
  gateway post-MVP). Manual taps = "Opened in WhatsApp", cron rows = "to send".

## 3. Repo map (read these first, in this order)

1. `AGENTS.md` — rules (most important; §5 business rules are law, §11 is done criteria)
2. `docs/PRD.md` — scope (§3/§12 non-goals are OUT: card payments, booking, QR, invoices…)
3. `docs/DATA-MODEL.md` — authoritative schema (tables, RPCs, RLS, changelog)
4. `docs/DATA-CONTRACT.md` — per-screen reads/writes/RPC payloads/error→i18n codes
5. `docs/TRACEABILITY.md` — every FR → backend → screen → phase → test
6. `docs/FRONTEND-BACKEND.md` — wiring architecture (types, key factory, runMutation seam)
7. `docs/DESIGN-SYSTEM.md` — UI tokens (gym-green wins over Stitch orange)
8. `docs/SCREENS.md` + `design/<NN>-*/code.html` — layout reference (never import directly)
9. `docs/plans/README.md` — locked decisions + phase index; then the ONE phase file
   you are told to implement (`docs/plans/00` → `01a` → `01b` → `02` … `10`)

## 4. How to work (mandatory per phase)

1. Read the phase file + every input it lists. Stay in scope; don't touch unrelated files.
2. Schema changes = NEW files in `supabase/migrations/` (never edit landed ones) +
   regenerate `apps/web/src/lib/database.types.ts` in the same commit.
3. Screens call RPCs (DATA-CONTRACT.md) — never multi-step client writes. All strings
   via i18next (`ar`+`fr`); logical CSS only (`ms-/me-/ps-/pe-`); money = integer DZD.
4. Verify: `npm run build` + `npm run lint` + `npm run test` (from `apps/web`) +
   the phase's SQL/RLS tests (`npm run test:db`). All green or the phase is NOT done.
5. **Progress log (required after every successful implementation): append to
   `docs/PROGRESS.md`** using the entry template at its bottom (landed / verification
   incl. test results / design refs / deviations or "none" / next phase), flip that
   phase's table row from `planned` to `done` with commit hash, then
   `git add -A && git commit -m "<type>: <what>" && git push origin main`.
6. Stop and report: what landed, test results, deviations, what's next. Never start
   the next phase unasked.

## 5. Phase order

`00` init close-out → `01a` database (isolation test = gate) → `01b` app shell +
login → `02` admin → `03` members/plans/subscriptions → `04` payments →
`05` dashboard → `06` i18n/RTL → `07` offline swap → `08` import → `09` reminders →
`10` pilot + launch tag. Status lives in `docs/PROGRESS.md`.

## 6. First prompt (copy-paste into Claude)

```text
You are implementing the gym-saas MVP (repo open in front of you, branch main).
Read in order: AGENTS.md, docs/plans/README.md, docs/PROGRESS.md, then the phase file
docs/plans/00-init.md plus every input it lists. Follow the phase file exactly:
Goal → Inputs → Data contract → Backend tasks → Frontend wiring → Tests → Done when
→ Close-out. Key rules: stay in scope; migrations are new files only; screens call
RPCs per docs/DATA-CONTRACT.md; i18n ar+fr, logical CSS, integer DZD; verify with
npm run build + lint + test and the phase's SQL tests. When everything is green,
append the entry to docs/PROGRESS.md (template at its bottom), mark the phase done
with the commit hash, commit and push to origin main, then stop and report. Do NOT
start any other phase. Begin by confirming what Phase 0 requires and its current state.
```
