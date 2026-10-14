# AGENTS.md — Rules for OpenCode (gym-saas)

> This is the most important file in the repo. Follow it on every change.
> Source of truth for scope: `docs/PRD.md`. Source of truth for UI: `docs/DESIGN-SYSTEM.md` + `design/<screen>/code.html`.

## 1. What this project is

Multi-tenant Gym Management SaaS for Algeria (MVP). Gym owners replace paper/Excel with:
members, subscription plans, subscriptions (renew / freeze / extend), cash payments +
installments, dashboard, expiry reminders (WhatsApp/SMS/Viber), Excel import.
Mobile-first PWA, Arabic (RTL) + French (LTR), works on bad connections. Currency DZD only.

Roles (MVP, only 2): `admin` (platform owner, manages gyms) and `owner` (one gym only).
No public self-signup — admin creates gym + owner login. Suspended gym cannot log in, data kept.

## 2. Repo layout (do not change without asking)

```text
gym-saas/
├── AGENTS.md              ← this file
├── docs/
│   ├── PRD.md             ← scope (MVP only, §3 Non-Goals are out)
│   ├── DESIGN-SYSTEM.md   ← tokens: colors, font, radius, status colors
│   └── SCREENS.md         ← screen name → Stitch prompt → file → route
├── design/
│   └── <NN>-<screen>/     ← one folder per screen (see SCREENS.md)
│       ├── mobile.png     ← Stitch mobile screenshot
│       ├── desktop.png    ← Stitch desktop screenshot
│       └── code.html      ← Stitch code export (reference, never import directly)
├── apps/
│   └── web/               ← PWA frontend (Vite + React + TS + Tailwind)
└── supabase/
    ├── migrations/        ← SQL migrations (schema + RLS)
    └── functions/         ← Edge Functions (reminders sender, etc.)
```

Rules:
- Frontend code lives ONLY in `apps/web/src/`. Never put app code in `design/`.
- `design/*/code.html` is a visual reference. Rebuild it with Tailwind + tokens, don't copy-paste inline styles.
- Backend is Supabase (Postgres + Auth + RLS). No custom `apps/api` server in MVP — use Edge Functions if server logic is needed.
- Every screen in `docs/SCREENS.md` must have a folder in `design/`. If you add a screen, update SCREENS.md + create the folder.

## 3. Stack (locked for MVP)

- Frontend: Vite + React 18 + TypeScript (strict) + Tailwind CSS + React Router + i18next + TanStack Query + vite-plugin-pwa (Workbox).
- Offline: IndexedDB outbox table (Dexie or idb) + sync worker. UI reads from cache first when offline.
- Backend: Supabase — Postgres with Row Level Security, Supabase Auth (email/phone + password), Storage (Excel files, receipts).
- Validation: zod on client + DB CHECK constraints. Phone normalization in one shared util.
- Excel: `xlsx` (SheetJS) for import/template parsing.

## 4. Commands (run from repo root unless noted)

```powershell
# web (workdir: apps/web)
npm install          # install
npm run dev          # dev server
npm run build        # typecheck + build
npm run preview      # preview PWA build
npm run lint         # eslint
npm run test         # vitest
npm run test:e2e     # playwright (critical flows only)
```

```powershell
# supabase (needs Supabase CLI + linked project)
supabase db diff -f <name>   # after schema change via Studio
supabase db push             # apply migrations
supabase functions serve <fn>  # local edge function
```

- Always run `npm run build` (typecheck) + `npm run lint` + `npm run test` before declaring a task done.
- Never commit secrets. Supabase keys go in `.env.local` (gitignored), never in code.

## 5. Hard business rules (from PRD — never violate)

1. **Tenant isolation:** every row in gym-scoped tables carries `gym_id`. ALL queries filter by `auth.gym_id()` / owner's gym. Enforce with RLS policies, not just client code. Owner must never see another gym's data. Test every query with 2 gyms.
2. **Member status (derived, never stored as input):**
   - `frozen` = subscription currently paused (open pause row covering today).
   - `active` = not paused AND `end_date >= today`.
   - `expired` = otherwise (no subscription or end_date passed).
   - Implement in ONE selector/util (`getMemberStatus`) + one SQL view. No duplicates.
3. **Phones (Algeria):** accept `0555 12 34 56`, `+213 555 12 34 56`, Arabic-Indic digits. Normalize to ONE format `+213XXXXXXXXX` before save/compare. Unique per gym (partial unique index where `deleted_at IS NULL`). Duplicate → clear FR/AR error message.
4. **Subscriptions:** `end_date` auto-calculated from plan by SQL `derive_end_date()` — time plans use CALENDAR MONTHS (monthly=1, quarterly=3, semi-annual=6, annual=12; e.g. Jan 15 → Apr 15), session/pack plans use `validity_days` (no session end date otherwise, sessions count instead). Renew = new subscription starting day after current `end_date` (or today if expired). Plan price change never affects existing subscriptions (copy price onto subscription row).
5. **Freeze/resume:** pause with reason (travel/injury/ramadan/other). Resume extends `end_date` by paused days. Every freeze/resume/extension logged (who, when, reason) in audit table.
6. **Payments:** amounts are whole DZD integers (`>= 0`). Record amount/date/method (`cash` default, `bank`/`ccp` optional)/note. Installments: show total price / total paid / remaining. Owing members flagged. Edits/deletes of payments are NEVER silent — write audit log row with old/new value + actor.
7. **Dashboard:** revenue = SUM(payments.received_at in period), NOT subscription prices. 4 widgets, each tappable → filtered list. Show `last_synced_at` when offline.
8. **Reminders:** never to frozen or already-renewed members. Configurable days-before (default 3) + optional expiry-day reminder. Templates in AR+FR with `{memberName} {endDate} {gymName}` variables. Log every send (sent/delivered/failed + channel). Owner can disable globally.
9. **Import:** template columns `full_name, phone, plan, start_date, end_date, amount_paid, amount_remaining`. Always: column-mapping step → validation preview (valid / error / duplicate) → duplicate policy (skip|update) → report (imported/skipped/failed + failed-rows download). Re-runnable, never deletes existing data. Must handle Arabic text + Arabic-Indic digits.
10. **Soft delete members:** set `deleted_at`, keep history. Exclude from lists/counts by default.

## 6. i18n + RTL (non-negotiable)

- All UI strings via `i18next` (`apps/web/src/i18n/*.json` for `ar` + `fr`). NO hard-coded French/Arabic/English strings in components.
- `ar` = `dir="rtl"`, `fr` = `dir="ltr"`. Use logical CSS properties (`ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`) — never physical `ml-/mr-/left/right`.
- Dates/numbers/currency: `Intl.DateTimeFormat` + `Intl.NumberFormat` with locale `ar-DZ` / `fr-DZ`, currency `DZD`. Mixed content (Arabic name + phone in Arabic text) must use `<bdi>` / `unicode-bidi: isolate`.
- Language switcher always visible; choice persisted per user (`localStorage` + user profile).
- Reminder templates exist in both languages; per-member language override, default = gym default.

## 7. Offline-first rules

- These MUST work offline: view members, add/edit member, record payment, assign/renew subscription, freeze/resume. Queue writes in IndexedDB outbox, auto-sync on reconnect.
- Status bar component (`Online / Offline / Syncing / Sync error`) visible on every screen.
- Conflict policy: last-write-wins for members/plans EXCEPT payments which are append-only (never overwrite, server keeps both, UI flags duplicates for review).
- Dashboard/reminders show last synced data + visible `last updated` timestamp when offline.

## 8. UI / design workflow (Stitch-first)

1. Look up the screen in `docs/SCREENS.md` → get route + target file.
2. Open `design/<NN>-<screen>/code.html` + the two PNGs. Match layout, spacing, hierarchy.
3. Rebuild with Tailwind + tokens from `docs/DESIGN-SYSTEM.md`. Status colors: active=green, expired=red, frozen=amber, owing=red badge (see DESIGN-SYSTEM.md §4).
4. Mobile-first: base styles = phone (one-hand, ≥44px tap targets, key actions ≤3 taps from home). `md:`/`lg:` scale up to tablet/PC. Tables → cards on small screens.
5. Key actions (add member, record payment, renew) reachable in ≤3 taps from home — keep FAB / bottom nav.
6. After building a screen, export/screenshot back into its `design/` folder and update SCREENS.md if the route/file changed.

## 9. Code conventions

- TypeScript strict, no `any` (use `unknown` + narrowing). zod schemas colocated with forms.
- File naming: `kebab-case` for files, `PascalCase` for components. Routes in `apps/web/src/routes.tsx` match SCREENS.md.
- Data layer: TanStack Query hooks in `apps/web/src/hooks/`, Supabase client in `apps/web/src/lib/supabase.ts`. No raw `fetch` to Supabase outside `lib/`.
- Forms: controlled + zod resolver, inline errors in user's language, optimistic UI with rollback on sync fail.
- Accessibility: readable sizes (≥14px body), contrast ≥4.5:1 (bright gym lighting), focus states, labels on all inputs.

## 10. What NOT to build (PRD §3 + §12 — reject or ask first)

Online card payments (CIB/Edahabia), class booking, coach scheduling, check-in hardware/QR, tax invoices, member-facing app/portal, inventory/POS, expenses, multi-branch, workout tracking, advanced reports, receptionist role. If asked, point to PRD and propose as post-MVP.

## 11. Definition of done (every task)

- [ ] Scope is in PRD MVP (or flagged as post-MVP).
- [ ] RLS + tenant isolation holds (no cross-gym leak).
- [ ] AR + FR strings exist, RTL/LTR mirrors correctly.
- [ ] Offline behavior per §7 (or explicit online-only with last-updated label).
- [ ] Audit log written for payments edits/deletes, plan changes, freeze/resume/extend.
- [ ] `npm run build`, `npm run lint`, `npm run test` pass.
- [ ] SCREENS.md + design folder updated if UI changed.

## 12. Working-style rule (mandatory per phase)

**One milestone at a time; migrations for schema changes (new files only, never edit
landed ones); build/lint/test before done; don't touch unrelated files.**

This mirrors `docs/plans/README.md §Per-phase ritual`. Every phase begins with reading
its phase file + listed inputs and ends with a green `npm run build && npm run lint &&
npm run test` (from `apps/web`) before closing out.
