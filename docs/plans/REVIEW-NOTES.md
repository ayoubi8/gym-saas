# REVIEW-NOTES.md — gaps, contradictions, risks (scope NOT silently changed)

Each item: finding → proposed fix → owner decision needed (or "adopt unless objected").

## R1. Duration semantics: months (DATA-MODEL) vs 30/90/180/365 days (AGENTS.md §5.4)

- Finding: AGENTS.md hard-codes day counts; DATA-MODEL.md (plans-v2) uses calendar
  months via `duration_months` + `derive_end_date()`. Both can't be true (e.g. quarterly
  = 90d vs 3 calendar months differ).
- Proposed: keep DATA-MODEL (calendar months are owner-intuitive: "Jan 15 → Apr 15";
  day counts drift across month lengths). Align AGENTS.md §5.4 in Phase 1A.
- Decision: owner confirms months (recommended) or days.

## R2. Synthetic-email domain must be owned

- Finding: phone login maps to `<digits>@phone.gymdz.app`. If that domain ever
  receives real mail or is claimed by someone else, Supabase emails (if ever enabled)
  could leak password-reset tokens.
- Proposed: owner registers/reserves `gymdz.app` (or substitutes an owned domain) and
  records it in plans README locked decisions before Phase 1B. Never enable Auth
  emails to that domain.
- Decision: owner provides domain.

## R3. Region + data residency undecided (PRD §11.5)

- Finding: PRD asks where data is hosted; Algerian DZ personal-data law applies to
  member phone numbers. Supabase region choice (e.g. EU-West vs closer regions) and
  plan (backups/PITR differ per plan) are still open.
- Proposed: default to EU region (lowest latency to DZ, GDPR-grade DPA), Free/Pro per
  budget; Phase 10 note will state the ACTUAL plan's backup offer (daily backups +
  PITR only on paid tiers). Record region+plan in README locked decisions in Phase 1A.
- Decision: owner picks region + plan before pilot.

## R4. `stitch_algerian_gym_management_system/` raw folder + zip duplicate `design/`

- Finding: ~2× storage of the same exports is committed (raw folder + filed copies).
- Proposed: keep through Phase 5 (reference safety), delete raw folder + zip in
  Phase 10 and keep only `design/` (+ note in PROGRESS). No scope impact.
- Decision: adopt unless objected.

## R5. No receptionist role can block pilot gyms (PRD §11.3)

- Finding: some gyms will ask for a desk-staff login on day one; MVP has admin/owner
  only and sharing the owner password is a security regression.
- Proposed: hold the line for MVP (cite PRD §3/§12); log requests as post-MVP with a
  `staff` role sketch (gym-scoped, no admin, no settings). Do NOT build in pilot.
- Decision: owner confirms the refusal script.

## R6. WhatsApp deep-link is manual-share, not delivery proof (FR-A5)

- Finding: `wa.me` links can't report delivered/failed; the log will show `sent`
  (owner tapped) at best. True delivery status needs the deferred gateway.
- Proposed: log manual sends as `sent` with `channel` + `created_by` = owner, and
  document that `delivered/failed` apply only to gateway sends (post-MVP). No schema change.
- Decision: adopt unless objected.

## R7. pgTAP vs plain SQL tests for Phase 1A

- Finding: task allows "pgTAP or SQL tests". pgTAP needs the extension on the Supabase
  project (available as `pgtap` extension on hosted Supabase, but adds setup).
- Proposed: plain SQL assertion scripts (`supabase/tests/*.sql` with DO blocks raising
  on failure, run via `psql`) + vitest for TS mirrors — zero extension dependency,
  runs identically local and hosted.
- Decision: adopt unless objected.
