# Build plans — index

Phases run **one at a time, in order** (PRD §10 milestone order). Each file is a
self-contained run prompt: goal → inputs → DB → build → tests → done → close-out.

| File | Phase | Scope |
|---|---|---|
| `00-init.md` | 0 | Init, remote, first push, PROGRESS workflow |
| `01-foundation.md` | 1 | Scaffold, schema + RLS, auth, seeds, isolation proof |
| `02-admin.md` | 2 | Admin gyms + onboarding wizard |
| `03-members-plans-subscriptions.md` | 3 | Members, plans, subscriptions, freeze/extend |
| `04-payments.md` | 4 | Payments + receipts |
| `05-dashboard.md` | 5 | Dashboard widgets |
| `06-i18n-rtl.md` | 6 | Arabic/French + RTL pass |
| `07-offline.md` | 7 | PWA offline + sync |
| `08-import.md` | 8 | Excel import |
| `09-reminders.md` | 9 | Reminders (log + manual share; gateway deferred) |
| `10-pilot.md` | 10 | Pilot hardening + launch |

## Locked decisions (do not re-ask)

- Backend: **Supabase** (Postgres + Auth + RLS + Edge Functions). No custom API in MVP.
- Reminders MVP: **scheduler computes due reminders + writes message log + manual
  WhatsApp deep-link send**. Real gateway deferred behind a `sendReminder()` seam.
- UI tokens: **`docs/DESIGN-SYSTEM.md` (gym-green) wins**; Stitch files are layout-only
  reference (`design/stitch-theme-reference.md` archived for context only).

## Per-phase ritual (mandatory)

1. Read the phase file + listed inputs fully before touching code.
2. Stay in scope: do not touch unrelated files (AGENTS.md working-style rule).
3. Verify: `npm run build` + `npm run lint` + `npm run test` green (from `apps/web`);
   RLS/isolation check wherever data access changes.
4. Close-out: append entry to `docs/PROGRESS.md` → commit → push `main` →
   stop and report; await order for next phase.
