# DATA-CONTRACT.md — screen ↔ backend wiring

One row-group per SCREENS.md screen. Reads list the exact view/table/RPC + filters.
Writes list the RPC + payload shape (screens NEVER multi-step client writes).
Errors map Postgres/domain codes → i18n keys. Last column lists TanStack Query
keys invalidated after each write (key factory: FRONTEND-BACKEND.md §4).

Global error codes (all screens): `RLS_DENIED → errors.rlsDenied`,
`SUSPENDED_GYM → errors.gymSuspended` (policies fail via `gym_is_active()`),
`NETWORK_OFFLINE → errors.offlineQueued` (Phase 7+: queued, not failed).

## 01 — Login `/login` (design/01-login/)

- Reads: `profiles` own row post-auth (`id = auth.uid()`); `gyms` status for own gym.
- Writes: `supabase.auth.signInWithPassword` (email or phone→synthetic email mapped client-side).
- Errors: `INVALID_CREDENTIALS → auth.invalidLogin`, `SUSPENDED_GYM → auth.gymSuspended`.
- Invalidates: `['session']` (post-login refetch profile+gym).

## 02 — Admin gyms `/admin/gyms` (design/02-admin-gyms/)

- Reads: `gyms` (all, admin), `profiles` (owners, admin) — admin bypass policies.
- Writes (Edge Functions, service role — never anon key):
  - `admin_create_gym_with_owner { name, city, default_language, owner_full_name, owner_phone_or_email, password }`
  - `admin_set_gym_status { gym_id, status }` (suspend/reactivate, keeps data)
  - `admin_reset_owner_password { user_id, new_password }`
- Errors: `PHONE_TAKEN → errors.duplicatePhone`, `WEAK_PASSWORD → errors.weakPassword`.
- Invalidates: `['admin','gyms']`.

## 03 — Onboarding `/onboarding` (no Stitch export)

- Reads: `gym_settings` own gym; `plans` count (skip setup if exists).
- Writes: `update_gym_settings { default_language, onboarding_completed }`, `upsert_plan` (quick-create defaults).
- Errors: standard global codes.
- Invalidates: `['settings'], ['plans']`.

## 04 — Plans `/plans` (design/04-plans/)

- Reads: `plans WHERE gym_id = current AND (active OR show_inactive)`.
- Writes: `upsert_plan { id?, name, type, duration_months?, session_count?, validity_days?, price_dzd }`, `set_plan_active { id, active }`.
- Errors: `PLAN_IN_USE_DEACTIVATE_OK` (info, not error — existing subs keep snapshot), `INVALID_PLAN_SHAPE → plans.invalidShape` (CHECK per type).
- Invalidates: `['plans'], ['dashboard']` (Phase 5+).

## 05 — Dashboard `/` (design/05-dashboard/)

- Reads: `dashboard_summary()` ONLY (one call: active_count, revenue_today, revenue_month, expiring_week_count, unpaid_total, unpaid_member_count) + preview lists via `reminders_due()` and owing-members query (limit 5).
- Writes: none (deep-links only).
- Errors: global only.
- Invalidates: n/a (invalidated BY others — see every write row).

## 06 — Members list `/members` (no Stitch export)

- Reads: `member_status` view `WHERE gym_id = current AND deleted_at IS NULL`, filters: status chip (active/expired/frozen), owing flag via `member_balance.remaining > 0`; search: trigram on `full_name` + normalized phone prefix.
- Writes: none (FAB routes to 08).
- Errors: global only.
- Invalidates: n/a (reader of `['members']`).

## 07 — Member profile `/members/:id` (design/07-member-profile/)

- Reads: `members` by id; `member_status` row; `member_current_subscription`; `subscription_balance`; `payments WHERE member_id` (desc); `pauses WHERE subscription_id` (history); `reminders WHERE member_id` (log).
- Writes: none direct — actions open 09/11/12 dialogs (their RPCs invalidate below).
- Errors: `MEMBER_DELETED → errors.memberDeleted` (row with `deleted_at`).
- Invalidates: n/a.

## 08 — Add/Edit member `/members/new`, `/members/:id/edit` (design/08-add-member/)

- Reads: `plans WHERE active` (plan select); member row (edit mode).
- Writes:
  - `create_member { id (client uuid), full_name, phone (raw — normalized server-side), language? }`
  - `update_member { id, full_name?, phone?, language? }` (LWW via `updated_at`)
  - optional chained `assign_subscription { …, first_payment? }` in ONE RPC call sequence (assign is a single RPC that accepts `first_payment`, not two client writes)
- Errors: `DUPLICATE_PHONE → members.duplicatePhone`, `INVALID_PHONE → members.invalidPhone`.
- Invalidates: `['members'], ['member', id], ['dashboard']`.

## 09 — Renew dialog (from profile) (design/09-renew-subscription/)

- Reads: current subscription (end_date, plan); `plans WHERE active`.
- Writes: `renew_subscription { id (client uuid), member_id, plan_id, first_payment? }` — server starts day-after current `end_date` (or today if expired), sets `renewed_from_id`.
- Errors: `NO_ACTIVE_PLAN → renew.noActivePlan`, `ALREADY_RENEWED → renew.alreadyRenewed` (newer sub exists).
- Invalidates: `['member', id], ['members'], ['dashboard'], ['reminders']`.

## 10 — Payments list `/payments` (design/10-payments-list/)

- Reads: `payments WHERE gym_id = current` + date range on `paid_on` (desc, paginated); day/month totals via filtered SUM.
- Writes: `edit_payment { id, amount?, paid_on?, method?, note?, reason! }`, `delete_payment { id, reason! }` (online only — never queued offline).
- Errors: `REASON_REQUIRED → payments.reasonRequired`, `OFFLINE_EDIT_BLOCKED → payments.offlineEditBlocked`.
- Invalidates: `['payments'], ['member', member_id], ['dashboard']`.

## 11 — Record payment + receipt (dialog + `/payments/:id/receipt`) (design/11-receipt/)

- Reads: subscription (`price_dzd`) + `subscription_balance` (remaining for receipt).
- Writes: `record_payment { id (client uuid — idempotent replay), subscription_id, amount_dzd, paid_on, method?, note? }` → server stamps `receipt_no` from `receipt_counters`.
- Errors: `INVALID_AMOUNT → payments.invalidAmount` (CHECK > 0), `DUPLICATE_REPLAY_OK` (same id → `ON CONFLICT DO NOTHING`, returns existing row).
- Invalidates: `['payments'], ['member', member_id], ['dashboard']`.

## 12 — Freeze/Resume + Extend (from profile) (design/12-freeze-resume/)

- Reads: current subscription + open pause (`pauses WHERE resumed_on IS NULL`).
- Writes:
  - `pause_subscription { id, subscription_id, start_date, reason, note? }`
  - `resume_subscription { pause_id, resumed_on }` (server: `days_added`, `end_date += days`)
  - `extend_subscription { id, subscription_id, days, reason, note? }`
- Errors: `PAUSE_ALREADY_OPEN → freeze.alreadyOpen`, `RESUME_BEFORE_START → freeze.resumeBeforeStart`, `INVALID_DAYS → freeze.invalidDays`.
- Invalidates: `['member', id], ['members'], ['dashboard'], ['reminders']`.

## 13 — Reminders `/reminders` (design/13-reminders-expiring/)

- Reads: `reminders_due(gym, today)` (respects settings, excludes frozen/renewed) + `reminders` log (desc, per member). Cron `pending` rows display as "to send".
- Writes: `log_manual_reminder { member_id, subscription_id?, channel, language, body_rendered }` (kind=`manual`, created_by = owner); UI shows these as "Opened in WhatsApp" — never "sent". `delivered`/`failed` reserved for gateway.
- Errors: `REMINDERS_DISABLED → reminders.disabled`, `ALREADY_SENT → reminders.alreadySent` (unique index hit).
- Invalidates: `['reminders'], ['member', id]`.

## 14 — Import `/import` (no Stitch export)

- Reads: `import_batches` own gym (desc); `import_rows WHERE batch_id` by status.
- Writes:
  - upload → Storage `imports/{gym_id}/{batch_id}.xlsx` + `create_import_batch { filename, storage_path }`
  - `save_import_mapping { batch_id, mapping }`
  - `import_validate { batch_id }` (server, chunked) → fills `import_rows`
  - `import_commit { batch_id, policy: skip|update }` (server, chunked, idempotent)
- Errors: `BAD_FILE → import.badFile`, `UNKNOWN_COLUMNS → import.unknownColumns`, `BATCH_ALREADY_COMMITTED → import.alreadyCommitted`.
- Invalidates: `['members'], ['dashboard'], ['import', batch_id]`.

## 15 — Settings `/settings` (no Stitch export)

- Reads: `gym_settings` own row; `reminder_templates WHERE gym_id` (both languages × both kinds).
- Writes: `update_gym_settings { reminders_enabled?, reminder_days_before?, reminder_on_expiry_day?, enabled_channels?, default_language? }`, `upsert_reminder_template { language, kind, body }` (validates variables).
- Errors: `INVALID_TEMPLATE_VARS → settings.invalidVars`, `DAYS_OUT_OF_RANGE → settings.daysRange` (1..30).
- Invalidates: `['settings'], ['reminders']`.
