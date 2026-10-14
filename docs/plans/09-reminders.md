# Phase 9 — Reminders (PRD §5.4; log + manual share, gateway deferred)

## Goal
Fewer missed renewals without a messaging contract: the system decides WHO is due
and logs everything; the owner sends with one tap.

## Inputs
@AGENTS.md @docs/PRD.md @docs/DESIGN-SYSTEM.md @docs/SCREENS.md
@design/13-reminders-expiring/ @supabase/functions/reminders-sender/

> `design/15-settings/` has NO Stitch export — build `/settings` reminder section
> from FR-A2/A7 + DESIGN-SYSTEM.md.

## DB
- `reminders` log: member, channel, template, language, status
  (pending/sent/delivered/failed), `sent_at`. Gym settings: days-before (default 3),
  expiry-day toggle, global on/off, AR/FR templates with
  `{memberName} {endDate} {gymName}`.

## Build
1. `/settings`: days-before, expiry-day reminder toggle, global on/off, AR/FR
   template editors with variable validation.
2. `/reminders`: expiring-soon list + one-tap manual send (WhatsApp `wa.me` deep
   link with prefilled template, SMS/Viber equivalents) + per-member message log.
3. Edge Function `reminders-sender` (cron): computes due set — excludes frozen and
   already-renewed — creates `pending` log rows; delivery seam is ONE interface
   `sendReminder()` currently implemented as log-only + owner deep-link.
   Real gateway (PRD §11 open question) plugs in here later without UI changes.
4. Per-member language override, default = gym language.

## Tests
- Due-set logic: frozen excluded, renewed excluded, days-before boundary,
  expiry-day toggle, global off suppresses all; template renders both languages
  with all variables; every send attempt logged.

## Done when
AGENTS.md §11 ticks; build/lint/test green.

## Close-out
`docs/PROGRESS.md` entry → commit → push `main` → stop; await order for Phase 10.
