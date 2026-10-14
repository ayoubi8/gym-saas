# TRACEABILITY.md — FR → backend → screen → phase → test

Every PRD functional requirement traced to its implementation. `—` in a cell is a
gap: each one below is assigned to a phase (no empty cell is unowned).

Conventions: RPC names from DATA-MODEL.md; screens are `design/NN` + route;
phases are `docs/plans/*`.

## Members (FR-M) → Phase 3 (schema: 1A)

| FR | Tables / RPCs | Screen / route | Phase | Test |
|---|---|---|---|---|
| FR-M1 add/edit/view/soft-delete | `members`, `create_member`, `update_member` (1A skeleton → 3), soft delete sets `deleted_at` | 08 `/members/new`, `/members/:id/edit`; 07 `/members/:id` | 3 | vitest CRUD + soft-delete excluded from lists |
| FR-M2 search name/phone | `members` + pg_trgm index + btree `(gym_id, phone)` | 06 `/members` | 3 | search < 1s @ 5,000 rows (Phase 10 perf) |
| FR-M3 filter by status | `member_status` view | 06 `/members` chips | 3 | status matrix test |
| FR-M4 profile: subscription, end date, history, balance | `member_current_subscription`, `member_status`, `subscription_balance`, `payments` | 07 `/members/:id` | 3 | balance math test |
| FR-M5 DZ formats, normalized store | `normalizeDzPhone` (TS) + `create_member` normalizes server-side | 08 form | 1B shells → 3 | vitest: spaces, +213, Arabic-Indic digits |
| FR-M6 duplicate blocked, clear message | UNIQUE `(gym_id, phone)` WHERE `deleted_at IS NULL` + mapped error `DUPLICATE_PHONE` | 08 form | 3 | duplicate raises mapped code, AR/FR message shown |

## Plans & subscriptions (FR-S) → Phase 3 (schema: 1A)

| FR | Tables / RPCs | Screen / route | Phase | Test |
|---|---|---|---|---|
| FR-S1 plans CRUD + deactivate, per-gym | `plans`, `upsert_plan`, `set_plan_active` | 04 `/plans` | 3 | per-gym isolation on plans |
| FR-S2 assign plan + start date, auto end date | `assign_subscription`, `derive_end_date()` | 08 form (plan select), 07 | 3 | end-date per plan type |
| FR-S3 one-action renew (day-after / today) | `renew_subscription` (+ `renewed_from_id`) | 09 renew dialog (from 07) | 3 | renew-start rule test |
| FR-S4 packs track sessions, manual deduct | `deduct_session` + `session_logs` | 07 (sessions counter) | 3 | deduct decrements, log row written |
| FR-S5 freeze with reason, status Frozen | `pause_subscription` / `resume_subscription`, `pauses` (one open max) | 12 freeze dialog (from 07) | 3 | open-pause uniqueness, frozen status |
| FR-S6 extend by days with reason | `extend_subscription`, `extensions` | 12 extend section | 3 | end_date += days, reason stored |
| FR-S7 freeze/resume/extend logged | `audit_log` via triggers/RPCs | — (audit surface in 07 history) | 3 | audit rows asserted |
| FR-S8 price change never affects existing | `price_dzd` snapshot on `subscriptions` | 04 edit plan | 3 | snapshot isolation test |

## Payments (FR-P) → Phase 4 (schema: 1A)

| FR | Tables / RPCs | Screen / route | Phase | Test |
|---|---|---|---|---|
| FR-P1 record payment (amount/date/method/note) | `record_payment`, `receipt_counters` → `receipt_no` | 11 record dialog | 4 | insert path, defaults (cash, today) |
| FR-P2 installments: total/paid/remaining | `subscription_balance` view | 07 balance banner, 11 receipt | 4 | paid + remaining = price |
| FR-P3 owing flag + amount | `member_balance` (remaining > 0) | 06 owing chip, 05 widget | 4 (widget in 5) | owing threshold test |
| FR-P4 history per member + global date-filtered | `payments` indexes `(gym_id, paid_on)` | 07 history, 10 `/payments` | 4 | date filter correctness |
| FR-P5 printable/shareable receipt | `payments` + `receipt_no`, joins member/gym | 11 `/payments/:id/receipt` | 4 | receipt fields incl. remaining |
| FR-P6 edits/deletes audited, never silent | `edit_payment` / `delete_payment` (reason required) + `audit_log` | 10 row actions | 4 | audit old/new asserted |
| FR-P7 whole DZD | CHECK `amount_dzd > 0`, int | 11 form (integer input) | 4 | rejects fractions/negatives |

## Reminders (FR-A) → Phase 9 (schema: 1A)

| FR | Tables / RPCs / Edge Fn | Screen / route | Phase | Test |
|---|---|---|---|---|
| FR-A1 days-before (default 3) + optional expiry-day | `gym_settings`, `reminders_due()`, `reminders-sender` cron | 15 `/settings`, 13 `/reminders` | 9 | boundary + toggle tests |
| FR-A2 AR/FR templates with variables | `reminder_templates`, render fn validates `{memberName} {endDate} {gymName}` | 15 template editors | 9 | both languages render, missing var rejected |
| FR-A3 per-member language, default gym | `members.language` fallback `gyms.default_language` | 08 form, 13 send | 9 | override respected |
| FR-A4 expiring list, manual send / open chat | `reminders_due()` + `wa.me`/SMS/Viber deep links | 13 `/reminders` | 9 | one-tap link contains rendered body |
| FR-A5 message log (sent/delivered/failed + channel) | `reminders` table | 13 log, 07 per-member log | 9 | every attempt logged |
| FR-A6 never to frozen / already-renewed | `reminders_due()` exclusions + UNIQUE `(subscription_id, kind, scheduled_for)` | — (server rule) | 9 | exclusion tests |
| FR-A7 global on/off | `gym_settings.reminders_enabled` | 15 `/settings` | 9 | off suppresses all |

## Dashboard (FR-D) → Phase 5 (schema: 1A)

| FR | Tables / RPCs | Screen / route | Phase | Test |
|---|---|---|---|---|
| FR-D1 tappable widgets → filtered lists | `dashboard_summary()` + deep links | 05 `/` | 5 | links land filtered |
| FR-D2 numbers update after every change | query invalidation (DATA-CONTRACT.md) | 05 | 5 | mutation → widget refresh |
| FR-D3 revenue = payments in period | `dashboard_summary()` (SUM `payments.paid_on`, gym tz) | 05 revenue widget | 5 | prices excluded test |

## Roles & audit (FR-R) → Phases 1A/1B/2

| FR | Tables / RPCs / Edge Fn | Screen / route | Phase | Test |
|---|---|---|---|---|
| FR-R1 two roles only | `role` enum, route guards | all (guards) | 1B guards → 2 | owner blocked from `/admin/*` |
| FR-R2 phone-or-email + password; admin resets | synthetic-email mapping + `admin_reset_owner_password` (service role) | 01 `/login`; 02 reset action | 1B login → 2 reset | login both forms; reset works, no mail sent |
| FR-R3 admin creates/suspends/reactivates gyms | `admin_create_gym_with_owner`, `admin_set_gym_status` | 02 `/admin/gyms` | 2 | full lifecycle + data retained |
| FR-R4 tenant isolation at data layer | RLS on all gym tables + `current_gym_id()`, `gym_is_active()` | — (cross-cutting) | 1A | gym-A-can't-read-B on every table |
| FR-R5 audit for sensitive actions | `audit_log` + triggers/RPCs | — (surfaced in 07/10) | 1A triggers → 3/4 asserts | rows on payment edit/delete, plan change, freeze |

## i18n/RTL (FR-L) → Phase 6 (shells in 1B)

| FR | Backend need | Screen / route | Phase | Test |
|---|---|---|---|---|
| FR-L1 full AR + FR | `reminder_templates` both languages | all | 6 | zero missing keys both locales |
| FR-L2 RTL/LTR mirroring | — (frontend) | all | 6 | RTL mirror checklist per screen |
| FR-L3 switch anytime, remembered | `profiles.language` + localStorage | switcher (all) | 6 | persisted across reload |
| FR-L4 dates/numbers/currency DZD | — (Intl formatters) | money/date displays | 6 | `ar-DZ`/`fr-DZ` snapshots |
| FR-L5 templates both languages | UNIQUE `(gym_id, language, kind)` | 15 | 9 content | both exist per gym |
| FR-L6 mixed content displays correctly | — (`<bdi>`/isolate) | names + phones | 6 | visual checklist |

## Offline (FR-O) → Phase 7 (schema affordances: 1A)

| FR | Backend need | Screen / route | Phase | Test |
|---|---|---|---|---|
| FR-O1 installable PWA phone + PC | — (Workbox) | shell | 7 | installability audit |
| FR-O2 core actions offline | client UUIDs + idempotent RPCs (1A) | 06/08/11/09/12 | 7 | airplane-mode flows |
| FR-O3 queued + auto-sync | `sync_log`, replay via `runMutation` | sync bar | 7 | reconnect flushes queue |
| FR-O4 online/offline/syncing/error indicator | `sync_log` latest outcome | bar on every screen | 7 | state transitions |
| FR-O5 LWW except payments append-only | `updated_at` + `flagged_duplicate` | conflict UI (10/07) | 7 | both-payments-kept test |
| FR-O6 server features show last-synced + time | cached `dashboard_summary()` + timestamp | 05, 13 offline | 7 | stale label visible |
| FR-O7 fast on slow connections | small payloads, cached shell | shell | 7 + 10 | 3G perf check |

## Mobile-first (FR-U) → all UI phases, verified in 10

| FR | Screen / route | Phase | Test |
|---|---|---|---|
| FR-U1 phones first, scale up | all (base 360px) | 2–5, 8–9 | viewport checks |
| FR-U2 Chrome/Safari/Firefox/Edge, Android/iOS | all | 10 | pilot device matrix |
| FR-U3 key actions ≤ 3 taps | FAB/bottom-nav (05/06) | 3–5 | tap-count review |
| FR-U4 tables → cards on small screens | 02/06/10 lists | 2–4 | mobile layout review |

## Import (FR-I) → Phase 8 (schema: 1A)

| FR | Tables / RPCs / Storage | Screen / route | Phase | Test |
|---|---|---|---|---|
| FR-I1 upload .xlsx/.csv | `imports/{gym_id}/…` bucket + `import_batches` | 14 `/import` | 8 | upload round-trip |
| FR-I2 downloadable template | template generator (fixed columns) | 14 | 8 | template columns exact |
| FR-I3 column mapping | `import_batches.mapping` jsonb | 14 mapping step | 8 | foreign headers map |
| FR-I4 validation preview (valid/error/duplicate) | `import_validate()` → `import_rows` | 14 preview | 8 | fixture counts exact |
| FR-I5 duplicate policy skip\|update | `import_commit(batch, policy)` | 14 policy selector | 8 | both policies verified |
| FR-I6 report + failed-rows download | batch counters + `failed_rows_path` | 14 report | 8 | download matches failures |
| FR-I7 Arabic + Arabic-Indic digits | shared normalization (same as `create_member`) | 14 | 8 | AR fixture passes |
| FR-I8 correct status from end_date | commit creates subscription with given `end_date`; status derived | 14 | 8 | Active/Expired assigned |
| FR-I9 re-runnable, never deletes | idempotent commit, no deletes | 14 | 8 | re-run changes nothing |

## NFR coverage

| NFR (PRD §8) | Where |
|---|---|
| Perf 3s/3G, 1s search @ 5k | indexes (1A) → verified Phase 10 |
| 99.5% uptime + offline-usable | Phase 7 + sync_log metric (§9) |
| HTTPS, hashed passwords (Auth), RLS, role checks | 1A/1B/2 |
| Privacy (DZ data law): phones siloed per gym | RLS (1A); region decision open (REVIEW-NOTES R3) |
| Daily backups + tested restore | Phase 10 note (states actual Supabase-plan offer) |
| 200 gyms / 50k members | indexes + chunked import (1A/8); load note in 10 |
| Accessibility contrast ≥ 4.5:1, ≥14px | DESIGN-SYSTEM.md enforced per screen |
| All text externalized | Phase 6 key-coverage test |

## Previously uncovered / underspecified (now assigned)

Before plans-v2, these had a screen but no backend definition: FR-S4 audit trail (`session_logs`, Ph3), FR-P5 receipt numbering (`receipt_counters`, Ph4), FR-P6 enforcement mechanism (RLS no-UPDATE + RPCs, Ph1A/Ph4), FR-D3 single-source function (`dashboard_summary()`, Ph5), FR-A1/A5 due-set + log schema (Ph9), FR-I4/I5 server-side validate/commit (Ph8), FR-O5 conflict columns (`flagged_duplicate`, Ph1A/Ph7), FR-R2/R3 auth mechanics (synthetic email + service-role Edge Fns, Ph1B/Ph2), PRD §9 sync metric (`sync_log`, Ph7).
