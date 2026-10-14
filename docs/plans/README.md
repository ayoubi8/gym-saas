# Build plans — index

Phases run **one at a time, in order** (PRD §10 milestone order, Phase 1 split into
DB-first 1A then app-shell 1B). Each file is self-contained: Goal → Inputs →
Data contract → Backend tasks → Frontend wiring → Tests → Done when → Close-out.

| File | Phase | Scope |
|---|---|---|
| `00-init.md` | 0 | Init close-out, baseline |
| `01a-database.md` | 1A | Full schema, RLS, RPCs, seed, types, isolation proof (no UI) |
| `01b-app-shell.md` | 1B | App shell, auth, data layer, login, i18n shells |
| `02-admin.md` | 2 | Admin gyms (service-role Edge Fns) + onboarding wizard |
| `03-members-plans-subscriptions.md` | 3 | Members, plans, subscriptions, freeze/extend via RPCs |
| `04-payments.md` | 4 | Payments (insert-only rule) + receipts |
| `05-dashboard.md` | 5 | Dashboard via `dashboard_summary()` only |
| `06-i18n-rtl.md` | 6 | Arabic/French + RTL pass (scope-neutral) |
| `07-offline.md` | 7 | `runMutation`→Dexie swap + sync bar + conflicts |
| `08-import.md` | 8 | Server-side import_validate/commit, chunked |
| `09-reminders.md` | 9 | reminders_due() + cron + manual send |
| `10-pilot.md` | 10 | Pilot hardening, backups note, launch tag |

Supporting docs: `docs/DATA-MODEL.md` (authoritative schema),
`docs/TRACEABILITY.md` (FR → backend → screen → phase → test),
`docs/DATA-CONTRACT.md` (per-screen reads/writes/errors/invalidations),
`docs/FRONTEND-BACKEND.md` (linking architecture), `docs/plans/REVIEW-NOTES.md`
(open gaps/risks). Read the supporting doc a phase names before coding it.

## Locked decisions (do not re-ask)

- Backend: **Supabase** (Postgres + Auth + RLS + Edge Functions). No custom API in MVP.
- Auth: **password auth only; login accepts phone or email**. Phone is normalized and
  mapped to a synthetic email (`<digits>@phone.gymdz.app`, e.g.
  `213555123456@phone.gymdz.app`) at account creation; users created with
  `email_confirm = true`; **no SMS/email confirmation**; admin resets passwords via
  Edge Function. Limits: phone-based logins are not routable mail addresses; no
  self-service reset in MVP (FR-R2); the synthetic domain must be owned/reserved
  (REVIEW-NOTES R2).
- Reminders MVP: **scheduler computes due reminders + writes message log + manual
  WhatsApp deep-link send**. Real gateway deferred behind a `sendReminder()` seam.
- UI tokens: **`docs/DESIGN-SYSTEM.md` (gym-green) wins**; Stitch files are layout-only
  reference (`design/stitch-theme-reference.md` archived for context only).
- Region + data residency: **TBD — record here in Phase 1A** (REVIEW-NOTES R3;
  Supabase plan choice determines the backup/PITR offer stated in Phase 10).

## Per-phase ritual (mandatory)

1. Read the phase file + listed inputs fully before touching code.
2. Stay in scope: one milestone at a time; migrations for schema changes (never edit
   landed ones); don't touch unrelated files.
3. Verify: `npm run build` + `npm run lint` + `npm run test` green (from `apps/web`);
   SQL/RLS/RPC tests wherever the phase names them; regenerate types after migrations.
4. Close-out: append entry to `docs/PROGRESS.md` → commit → push `main` →
   stop and report; await order for next phase.
