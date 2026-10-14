# REVIEW-NOTES.md — gaps, contradictions, risks (scope NOT silently changed)

Each item: finding → proposed fix → owner decision needed (or "adopt unless objected").

## R1. Duration semantics: months (DATA-MODEL) vs 30/90/180/365 days (AGENTS.md §5.4)

- Finding: AGENTS.md hard-codes day counts; DATA-MODEL.md (plans-v2) uses calendar
  months via `duration_months` + `derive_end_date()`. Both can't be true (e.g. quarterly
  = 90d vs 3 calendar months differ).
- Proposed: keep DATA-MODEL (calendar months are owner-intuitive: "Jan 15 → Apr 15";
  day counts drift across month lengths). Align AGENTS.md §5.4 in Phase 1A.
- Decision: DECIDED 2026-10-14 — calendar months. AGENTS.md §5.4 aligned.

## R2. Synthetic-email domain must be owned (explanation for owner)

- In plain terms: Supabase login needs an "email + password". Gym owners log in with
  their PHONE number, so the system invents a fake email behind the scenes, e.g. phone
  `0555 12 34 56` → `213555123456@phone.gymdz.app`. The owner never sees or types it;
  they just type their phone + password.
- Why the domain matters: the fake address must belong to NOBODY real. If we used e.g.
  `@gmail.com`, some stranger could own that address and one day receive a
  password-reset email meant for a gym owner. So the part after `@` must be a domain
  YOU own (the same one you'll point at Vercel for the frontend, e.g. `gymdz.app` —
  then `phone.gymdz.app` is safely yours).
- What this blocks: nothing until Phase 1B. By then, tell me the domain you'll use
  (it can be the Vercel custom domain), and it gets recorded in the README locked
  decisions. Never enable Supabase "confirm email / reset by email" on that subdomain.
- Vercel note (frontend hosting, decided 2026-10-14): `apps/web` deploys to Vercel
  (Vite static build; `npm run build` output `dist/`). Only `VITE_SUPABASE_URL` +
  `VITE_SUPABASE_ANON_KEY` as Vercel env vars — never the service-role key.
- Decision: OPEN — owner provides domain (ideally the Vercel custom domain).

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
