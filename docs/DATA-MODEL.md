# DATA-MODEL.md — authoritative schema (Supabase / Postgres)

## Conventions

- PKs are `uuid` (client may supply them: offline-safe, inserts are idempotent via `ON CONFLICT (id) DO NOTHING`).
- Every gym-scoped table has `gym_id uuid not null references gyms`, `created_at`, `updated_at` (trigger-maintained). Mutable tables: `updated_at` used for last-write-wins.
- Money: integer DZD, CHECK >= 0. Calendar values: `date`. Timestamps: `timestamptz`.
- "Today" is always computed in the gym's timezone (`gyms.timezone`, default 'Africa/Algiers').
- Phones stored normalized E.164 (`+213555123456`). Arabic-Indic digits normalized before save.
- Status is DERIVED (view), never stored.

## Enums

- role: admin | owner (extensible enum — post-MVP `staff` may be added via ALTER TYPE ... ADD VALUE; R5)
- gym_status: active | suspended
- lang: ar | fr
- plan_type: monthly | quarterly | semiannual | annual | per_session | class_pack
- payment_method: cash | bank_transfer | ccp
- pause_reason: travel | injury | ramadan | other
- extension_reason: compensation | promotion | other
- channel: whatsapp | sms | viber
- reminder_kind: before_expiry | expiry_day | manual
- reminder_status: pending | sent | delivered | failed
- import_status: uploaded | mapped | previewed | committed | failed
- import_row_status: valid | error | duplicate | imported | skipped | failed
- duplicate_policy: skip | update

## Tables

1. gyms: id, name, city, default_language lang, timezone text default 'Africa/Algiers', status gym_status default 'active', suspended_at, created_by (admin actor), created_at, updated_at.
2. profiles: id (= auth.users.id), gym_id null (null only for admin), role, full_name, phone (normalized, nullable), email (nullable), language lang, last_seen_at, created_at, updated_at.
   CHECK ((role='admin' AND gym_id IS NULL) OR (role='owner' AND gym_id IS NOT NULL)); CHECK (phone IS NOT NULL OR email IS NOT NULL).
3. gym_settings (1 row per gym, PK gym_id): reminders_enabled bool default true, reminder_days_before int default 3 (1..30), reminder_on_expiry_day bool default false, enabled_channels channel[] default '{whatsapp}', onboarding_completed bool default false.
4. reminder_templates: id, gym_id, language lang, kind reminder_kind (before_expiry|expiry_day), body text (variables {memberName} {endDate} {gymName}), UNIQUE (gym_id, language, kind).
5. members: id, gym_id, full_name, phone (normalized), language lang null (per-member override, FR-A3), created_by, created_at, updated_at, deleted_at.
   UNIQUE (gym_id, phone) WHERE deleted_at IS NULL. GIN trigram index on full_name; btree (gym_id, phone).
6. plans: id, gym_id, name, type plan_type, duration_months int null (1|3|6|12 for time plans), session_count int null (per_session = 1; class_pack = N), validity_days int null (end-date window for session-based plans; defaults: per_session 1, class_pack 60 — adjustable per plan), price_dzd int, active bool default true, created_by, created_at, updated_at.
   CHECK consistency per type.
7. subscriptions: id, gym_id, member_id, plan_id, plan_name_snapshot, plan_type_snapshot, price_dzd (copied from plan at assignment — FR-S8), start_date, end_date (includes extensions and resumed pause days), sessions_total null, sessions_remaining null (>=0), renewed_from_id null, cancelled_at null, created_by, created_at, updated_at.
   Index (member_id, end_date desc), (gym_id, end_date).
   end_date derivation (single SQL function `derive_end_date(plan, start_date)`): time-based plans = start_date + duration_months calendar months; session-based plans = start_date + validity_days. Cancelled subscriptions (cancelled_at NOT NULL) are excluded from member_current_subscription, member_status, balances, and reminders_due.
8. pauses: id, gym_id, subscription_id, start_date, planned_end_date null, resumed_on date null, reason pause_reason, note, days_added int null (set on resume = resumed_on − start_date), created_by, resumed_by null, created_at.
   UNIQUE (subscription_id) WHERE resumed_on IS NULL (one open pause).
9. extensions: id, gym_id, subscription_id, days_added int > 0, reason extension_reason, note, created_by, created_at.
10. session_logs: id, gym_id, subscription_id, member_id, delta int (−1 deduct, +1 correction), note, created_by, created_at. (FR-S4; keeps sessions_remaining auditable.)
11. payments: id, gym_id, subscription_id, member_id, amount_dzd int > 0, paid_on date, method payment_method default 'cash', note, receipt_no bigint (per-gym sequence assigned server-side at insert/sync), flagged_duplicate bool default false, edited_at null, created_by, created_at, updated_at.
    Index (gym_id, paid_on), (member_id), (subscription_id).
    RULE: `authenticated` has INSERT + SELECT only. Edit/delete only through audited RPCs (edit_payment / delete_payment require a reason, write audit_log with old/new). Offline queue may only CREATE payments; edits/deletes require online.
12. reminders (message log): id, gym_id, member_id, subscription_id null, kind reminder_kind, channel, language, body_rendered, status reminder_status, scheduled_for date, sent_at null, error null, created_by null (null = system), created_at.
    UNIQUE (subscription_id, kind, scheduled_for) WHERE kind <> 'manual' (cron idempotency).
    Status semantics (R6): cron rows are `pending` → UI shows "to send" until the owner acts; owner deep-link taps are logged with kind='manual' (+ channel, created_by = owner) and shown as "Opened in WhatsApp" — never "sent". `delivered`/`failed` are reserved for the future gateway.
13. audit_log: id bigint identity, gym_id null, actor_id, action text, entity_type, entity_id, old_value jsonb, new_value jsonb, reason text, created_at. INSERT-only (no update/delete for any role). Written by triggers and RPCs (actor = auth.uid()).
14. import_batches: id, gym_id, filename, storage_path, status import_status, mapping jsonb, duplicate_policy, total_rows, valid_rows, error_rows, duplicate_rows, imported_count, skipped_count, failed_count, failed_rows_path null, created_by, created_at.
15. import_rows: id, batch_id, gym_id, row_no, raw jsonb, normalized jsonb, status import_row_status, reason text.
16. sync_log: id, gym_id, user_id, device_id text, outcome (success|error), ops_count, error text, created_at. (PRD §9 sync success rate.)
17. receipt_counters: gym_id PK references gyms, last_no bigint default 0. `record_payment` increments it in-transaction and stamps `payments.receipt_no`, giving a gap-tolerant per-gym receipt sequence (no cross-gym Postgres sequences needed).

## Views / functions (SQL is the single source of truth for business rules)

- member_current_subscription: latest non-cancelled subscription per member (max end_date).
- member_status (view): 'frozen' if an open pause exists on the current subscription; 'active' if end_date >= today(gym tz) and (sessions_remaining IS NULL OR > 0); else 'expired' (includes members who never had a subscription — expose `has_subscription`).
- subscription_balance (view): price_dzd, paid (SUM payments), remaining = price − paid. member_balance = SUM remaining over subscriptions with remaining > 0. Overpayment (remaining < 0) is stored as-is and shown as credit; it never blocks renew.
- dashboard_summary(): active_count, revenue_today, revenue_month (SUM payments by paid_on in gym tz — never prices), expiring_week_count, unpaid_total, unpaid_member_count. One call, consistent numbers.
- reminders_due(gym, date): members with current subscription ending in `days_before` (or today if expiry-day toggle), excluding frozen and already-renewed (a newer subscription exists), respecting reminders_enabled.
- RLS helpers: current_gym_id(), is_admin(), gym_is_active().

## RPCs (single transaction, idempotent via client-supplied ids, SECURITY INVOKER unless noted; each checks gym via RLS)

- create_member(id, full_name, phone, language) → duplicate phone raises a mapped error code.
- assign_subscription(id, member_id, plan_id, start_date, first_payment jsonb null)
- renew_subscription(id, member_id, plan_id, first_payment jsonb null): starts day after current end_date, or today if expired (FR-S3).
- record_payment(id, subscription_id, amount, paid_on, method, note)
- edit_payment / delete_payment (reason required, audited).
- pause_subscription(id, subscription_id, start_date, reason, note) / resume_subscription(pause_id, resumed_on): end_date += days paused.
- extend_subscription(id, subscription_id, days, reason, note)
- deduct_session(id, subscription_id, note)
- import_validate(batch_id) / import_commit(batch_id, policy): same validation and normalization as manual entry; chunked; re-runnable. `import_commit` materializes each `valid` row as member + subscription (+ one `payments` row when amount_paid > 0); `update` policy modifies matched members instead of skipping.
- Edge Functions (service role): admin_create_gym_with_owner, admin_reset_owner_password, admin_set_gym_status, reminders-sender (cron).

## RLS summary

- Owner: SELECT/INSERT/UPDATE only rows where gym_id = current_gym_id() AND gym_is_active(). No access to other gyms. Writes go through RPCs where listed above.
- profiles: a user reads/updates only their own row (`id = auth.uid()`); admin reads all. Owners cannot list other users.
- gym_settings / reminder_templates: owner reads + updates only their own gym's row(s); admin reads all, writes all.
- Admin: read all; write gyms, profiles, gym_settings. Never receives a public signup path.
- Suspended gym: every policy fails on gym_is_active() (data kept).
- audit_log, payments: no UPDATE/DELETE grants for authenticated.
- Storage bucket `imports/{gym_id}/...`: path-scoped policies.

## Auth mapping (password auth only, no SMS/email confirmation)

- Supabase Auth is email+password. A phone login is mapped at account creation to a synthetic email `<digits>@phone.gymdz.app` (digits = normalized phone without `+`, e.g. `213555123456@phone.gymdz.app`). Users created with `email_confirm = true`; no confirmation mails are ever sent.
- Login accepts phone or email: phone input is normalized first, then mapped to the synthetic email before `signInWithPassword`.
- `profiles.phone`/`profiles.email` mirror the auth identity for display and lookup; the synthetic domain must be reserved/owned so no real mailbox can collide with it.
- Limits: no self-service password reset by mail/SMS in MVP — resets go through the admin Edge Function (FR-R2). Owner login names are therefore not routable mail addresses when phone-based.

## Offline-readiness (built in Phase 1, used in Phase 7)

- Client-generated UUIDs on every insertable entity; all RPCs idempotent on those ids.
- `updated_at` on mutable tables for LWW; payments never overwritten (appended); duplicate payments from two devices are kept and flagged (`flagged_duplicate`) for owner review.
- Mutations go through one client function `runMutation(op)`; online = call RPC. Phase 7 swaps its internals to Dexie outbox + replay, with no change to screens.

## Changes made by Spark (plans-v2 validation vs PRD)

1. Added `import_row_status` enum — `import_rows.status` was a bare inline list; enums are now exhaustive and traceable (FR-I4).
2. Added `derive_end_date(plan, start_date)` rule (calendar months for time plans, `validity_days` for session plans) — end-date derivation was previously unspecified in SQL terms (FR-S2). NOTE: AGENTS.md §5.4 says 30/90/180/365 days; DATA-MODEL.md uses calendar months — flagged in REVIEW-NOTES.md for an owner decision.
3. Defined `cancelled_at` semantics (excluded from current subscription, status, balances, reminders_due) — the column existed with no rule (FR-M/FR-A hygiene).
4. Added `receipt_counters` table + `record_payment` stamping rule — per-gym `receipt_no` had no mechanism (FR-P5).
5. Clarified overpayment: stored as-is, shown as credit, never blocks renew — `remaining` could go negative with no rule (FR-P2).
6. Specified `import_commit` materialization (member + subscription + optional payment row; update-policy behavior) — was "same validation as manual entry" with no write path (FR-I5/I8).
7. Added RLS rows for `profiles` (self-read only), `gym_settings` and `reminder_templates` (own-gym only) — RLS summary covered only generic gym tables (FR-R4).
8. Added Auth mapping section (synthetic-email phone login, no confirmations, admin resets) — FR-R2 had no implementable design.
9. Typed `sync_log.device_id` as text — was undefined.
10. No scope additions: every change maps to an existing MVP FR; PRD §3/§12 exclusions untouched.

## Changes made by Spark, round 2 (owner decisions R3–R7, 2026-10-14)

11. `role` enum marked extensible (post-MVP `staff` via ADD VALUE) — R5 guard.
12. Added `created_by` to `gyms` and `plans` — they were the only writable tables without actor attribution (R5: every write carries created_by/actor).
13. Added reminders status semantics: cron `pending` = "to send", manual taps = kind 'manual' shown as "Opened in WhatsApp", `delivered`/`failed` gateway-reserved — R6.
