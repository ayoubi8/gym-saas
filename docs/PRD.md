# PRD – Gym Management SaaS (Algeria) – MVP Fundamentals

**Version:** 1.0 (draft)\
**Date:** October 13, 2026\
**Owner:** Admin / Product builder\
**Market:** Algeria (DZD, Arabic + French)

## 1. Overview

A multi-tenant SaaS that lets Algerian gym owners replace paper notebooks and Excel sheets with a simple system to manage members, subscriptions, cash payments and renewals. The product is mobile-first, works on unreliable internet, and is available in Arabic (RTL) and French.

This PRD covers **only the fundamental (MVP) features**. Mid-level and advanced features are out of scope.

## 2. Problem Statement

Most gyms in Algeria track members on paper, in Excel or in WhatsApp chats. This leads to:

- Lost or inaccurate records of who is active or expired.
- Missed renewals because nobody reminds members in time.
- Unclear cash flow and unpaid installments (debts owed by members).
- No quick view of daily or monthly revenue.

## 3. Goals and Non-Goals

### Goals

1. Give a gym owner a complete, accurate list of members with clear status (active, expired, frozen).
2. Make recording subscriptions, cash payments and installments take seconds.
3. Reduce missed renewals through automatic reminders.
4. Give the owner a one-screen view of the business (members, revenue, expiries, debts).
5. Work reliably on phone and PC, in Arabic and French, even with a poor connection.
6. Make migration painless by importing existing members from Excel.

### Non-Goals (MVP)

- Online card payments (CIB / Edahabia).
- Class booking, coach scheduling, women-only scheduling.
- Check-in hardware, QR cards, turnstiles.
- Invoicing and tax compliance features.
- Member-facing app or portal.
- Inventory, POS, expenses, multi-branch.

## 4. Users and Roles

| Role | Who | Permissions |
| --- | --- | --- |
| **Admin** | The product builder (platform owner) | Creates and manages gym accounts (tenants), creates gym owner users, activates or suspends gyms, views platform-wide status, support access. |
| **User (Gym Owner)** | Gym owner | Full access to their own gym's data only: members, plans, payments, reminders, dashboard, import. Cannot see other gyms. |

**Rules**

- Each gym's data is fully isolated from every other gym.
- Admin creates gym accounts and the owner's login (no public self-signup in MVP).
- A suspended gym cannot log in; its data is kept.

## 5. Functional Requirements

### 5.1 Member Management

**Description:** Create and manage the gym's members.

**Member fields (MVP):**

- Full name (required)
- Phone number (required, unique per gym)
- Status: **Active**, **Expired**, **Frozen** (system-calculated from the current subscription)

**Requirements**

- FR-M1: Add, edit, view and delete (soft delete) a member.
- FR-M2: Search by name or phone number, with instant results.
- FR-M3: Filter the list by status (Active / Expired / Frozen).
- FR-M4: Member profile shows current subscription, end date, payment history and remaining balance.
- FR-M5: Phone numbers accept Algerian formats (0555 12 34 56, +213 555 12 34 56) and are stored in one normalized format.
- FR-M6: Duplicate phone numbers within a gym are blocked with a clear message.

**Status logic**

- **Active:** has a subscription whose end date is today or later and which is not paused.
- **Frozen:** subscription currently paused.
- **Expired:** no valid subscription (end date passed).

### 5.2 Subscription Plans

**Description:** The owner defines plans and assigns them to members.

**Plan types**

- Monthly
- Quarterly (3 months)
- Semi-annual (6 months)
- Annual (12 months)
- Per-session (single visit)
- Class pack (a fixed number of sessions, e.g. 10 sessions)

**Requirements**

- FR-S1: Owner creates, edits and deactivates plans with a name, type, duration (or number of sessions) and price in DZD. Each gym has its own plans.
- FR-S2: Assign a plan to a member with a start date (default today). End date is calculated automatically.
- FR-S3: Renew a member in one action (starts from the day after the current end date, or from today if already expired).
- FR-S4: Class packs and per-session plans track **remaining sessions**; the owner can deduct a session manually.
- FR-S5: **Freeze / pause:** the owner can pause a subscription for a period with a reason (travel, injury, Ramadan, other). While paused, status is Frozen. On resume, the end date is extended by the number of paused days.
- FR-S6: **Extension:** the owner can extend a subscription by a number of days, with a reason (e.g. compensation, promotion).
- FR-S7: Every freeze, resume and extension is logged (who, when, reason).
- FR-S8: Changing a plan's price does not change existing subscriptions.

### 5.3 Payments Tracking (DZD)

**Description:** Record money received by the gym. All amounts are in Algerian Dinar (DA / DZD). Cash is the primary method.

**Requirements**

- FR-P1: Record a payment against a member's subscription: amount, date, method (cash by default; bank / CCP transfer optional), optional note.
- FR-P2: **Installments:** a subscription can be paid in several payments. The system shows total price, total paid and remaining balance.
- FR-P3: Members with a remaining balance are marked as **unpaid / owing**, with the amount.
- FR-P4: Payment history per member and a global payments list filterable by date.
- FR-P5: Printable or shareable simple receipt (member, amount, date, remaining balance).
- FR-P6: Payments cannot be silently altered: edits and deletions are logged (who, when, old value).
- FR-P7: Amounts are whole DZD by default (no foreign currencies in MVP).

### 5.4 Expiry Alerts and Renewals

**Description:** Automatic reminders so members renew on time. Email is not used.

**Channels:** WhatsApp, SMS, Viber (the owner chooses which are enabled).

**Requirements**

- FR-A1: Automatic reminder sent a configurable number of days before expiry (default 3 days; optional second reminder on expiry day).
- FR-A2: Message templates in Arabic and French with variables (member name, end date, gym name). The owner can edit templates.
- FR-A3: Owner can choose the message language per member (default: gym's default language).
- FR-A4: Dashboard and a dedicated list show members expiring soon, with a one-tap action to send a reminder manually or to open a chat with the member.
- FR-A5: Message log per member (sent, delivered, failed) with the channel used.
- FR-A6: Reminders are not sent to frozen members or members who have already renewed.
- FR-A7: Owner can turn automatic reminders on or off.

> **Open question:** which provider/gateway is used for each channel in Algeria (WhatsApp Business API, a local SMS gateway, Viber business messages) and what the per-message cost is. See Section 11.

### 5.5 Dashboard

**Description:** One screen summarising the gym's current state. Designed to be read in a few seconds on a phone.

**Widgets**

- **Active members:** total count.
- **Revenue:** today and this month (DZD).
- **Expiring this week:** count and list.
- **Unpaid balances:** total amount owed and number of members.

**Requirements**

- FR-D1: Each widget is tappable and opens the related filtered list (e.g. tapping Unpaid shows members who owe money).
- FR-D2: Numbers update after every change (including after offline data syncs).
- FR-D3: Revenue counts payments received in the period, not subscription prices.

### 5.6 Staff Accounts and Roles

- FR-R1: Two roles only in MVP: **Admin** and **User (gym owner)** (see Section 4).
- FR-R2: Login with phone number or email plus password. Password reset handled by the Admin in MVP (no email dependency).
- FR-R3: The Admin can create, suspend and reactivate gym accounts and reset owner passwords.
- FR-R4: Strict tenant isolation: a gym owner can only access data of their own gym.
- FR-R5: Basic audit log for sensitive actions (payment edits/deletions, plan changes, freezes).

### 5.7 Arabic, French and RTL Support

- FR-L1: Full UI in **Arabic** and **French** from day one.
- FR-L2: Arabic uses right-to-left layout; French uses left-to-right. The layout mirrors correctly (menus, tables, icons, forms, charts).
- FR-L3: Users can switch language at any time; the choice is remembered per user.
- FR-L4: Dates, numbers and currency formats are consistent and clear (DZD / DA). Numerals style is configurable or consistent across the app.
- FR-L5: All reminder templates exist in both languages.
- FR-L6: Mixed content (Arabic names with French text, phone numbers inside Arabic text) displays correctly.

### 5.8 Works on a Bad Connection (PWA / Offline)

- FR-O1: The app is a **Progressive Web App**, installable on phone home screen and on PC.
- FR-O2: Core actions work **offline**: view members, add/edit members, record payments, assign/renew subscriptions, freeze/resume.
- FR-O3: Offline changes are stored locally and **sync automatically** when the connection returns.
- FR-O4: A clear indicator shows online / offline / syncing / sync error status.
- FR-O5: Conflict handling: if the same record was changed on two devices, the latest change wins, except that payments are never overwritten (they are appended).
- FR-O6: Reminders and the dashboard need the server; when offline, the app shows the last synced data with a visible "last updated" time.
- FR-O7: Fast load on slow connections (small initial payload, cached assets).

### 5.9 Mobile-First, Phone and PC Compatibility

- FR-U1: Designed first for phones (small screens, one-hand use, large tap targets), then scaled up for tablets and PCs.
- FR-U2: Works on current Chrome, Safari, Firefox and Edge, and on Android and iOS browsers.
- FR-U3: Key actions (add member, record payment, renew) reachable in 3 taps or fewer from the home screen.
- FR-U4: Tables become cards or lists on small screens.

### 5.10 Data Import from Excel

**Description:** Let a gym bring its existing members into the system.

**Requirements**

- FR-I1: Upload an Excel (.xlsx) or CSV file.
- FR-I2: Downloadable template file (columns: full name, phone number, plan, start date, end date, amount paid, amount remaining; plan and dates optional).
- FR-I3: Column mapping step, so files with different headers can still be imported.
- FR-I4: Validation preview before import: shows rows that are valid, rows with errors (missing name or phone, bad phone format) and duplicates (same phone already exists).
- FR-I5: The owner chooses how to handle duplicates: skip or update.
- FR-I6: Import report after completion (imported, skipped, failed) with a downloadable list of failed rows.
- FR-I7: Supports Arabic and French text and Arabic-Indic digits in names and phones.
- FR-I8: Imported members get correct status based on the end date provided (Active / Expired).
- FR-I9: Import can be run again later without breaking existing data.

## 6. Core Data Model (high level)

| Entity | Key fields |
| --- | --- |
| **Gym (tenant)** | id, name, default language, status (active/suspended), created at |
| **User** | id, gym id (null for Admin), full name, phone/email, password hash, role (admin / owner), language |
| **Member** | id, gym id, full name, phone (normalized), status (derived), created at, deleted at |
| **Plan** | id, gym id, name, type, duration days or session count, price (DZD), active |
| **Subscription** | id, member id, plan id, start date, end date, price, sessions remaining, status |
| **Pause** | id, subscription id, start date, end date, reason, days added |
| **Extension** | id, subscription id, days added, reason, created by |
| **Payment** | id, subscription id, member id, amount (DZD), method, date, note, created by |
| **Reminder / Message** | id, member id, channel, template, language, status, sent at |
| **Audit log** | id, user id, action, entity, old/new value, timestamp |

## 7. Key User Flows

1. **Onboarding (Admin):** Admin creates a gym account and owner login, sends credentials to the owner.
2. **First setup (Owner):** logs in, picks language, creates plans, imports existing members from Excel.
3. **New member:** add name and phone, choose a plan, record the first payment (full or partial).
4. **Collect an installment:** open member, add payment, balance updates, receipt shared.
5. **Renewal:** member is about to expire, reminder is sent, owner renews in one action and records payment.
6. **Freeze:** owner pauses a member's subscription with a reason; on resume the end date extends automatically.
7. **Daily check:** owner opens the dashboard and sees who expires this week and who owes money.

## 8. Non-Functional Requirements

| Area | Requirement |
| --- | --- |
| Performance | Pages load in under 3 seconds on a 3G connection after first load; search results in under 1 second for up to 5,000 members. |
| Availability | Target 99.5% uptime for the server; the app stays usable offline. |
| Security | HTTPS only, hashed passwords, tenant isolation enforced at the data layer, role checks on every request. |
| Privacy | Members' phone numbers are personal data; access limited to the gym's own users and the Admin; follow Algerian personal data protection law. |
| Backups | Automatic daily backups with a tested restore process. |
| Scalability | Support at least 200 gyms and 50,000 members in total at MVP launch. |
| Accessibility | Readable font sizes, sufficient contrast, usable in bright gym lighting. |
| Localization | All text externalized for Arabic and French; no hard-coded strings. |

## 9. Success Metrics

- **Adoption:** number of gyms onboarded and active weekly.
- **Activation:** percentage of gyms that import or create 20+ members within 7 days.
- **Retention:** percentage of gyms still active after 3 months.
- **Reminder impact:** percentage of expiring members who renew within 7 days of the reminder.
- **Reliability:** offline sync success rate above 99%.
- **Time to value:** a new gym can be fully set up in under 30 minutes.

## 10. Milestones (suggested)

| Phase | Scope |
| --- | --- |
| 1 | Auth, roles, tenant isolation, Admin gym management |
| 2 | Members, plans, subscriptions, freeze/extension |
| 3 | Payments and installments, receipts |
| 4 | Dashboard |
| 5 | Arabic/French + RTL, mobile-first polish |
| 6 | PWA offline and sync |
| 7 | Excel import |
| 8 | Reminders (WhatsApp / SMS / Viber) |
| 9 | Pilot with 3 to 5 gyms, fixes, launch |

## 11. Open Questions and Risks

1. **Messaging providers:** which provider for WhatsApp, SMS and Viber in Algeria, and who pays for messages (included in the subscription or charged separately)?
2. **Pricing model:** monthly price per gym in DZD, free trial length, how the Admin collects payment from gyms.
3. **Staff access:** do gym owners need receptionist accounts with limited permissions (planned after MVP)?
4. **Offline conflicts:** is last-write-wins enough for members and plans, or are more rules needed?
5. **Hosting:** where is data hosted, and does any local data residency requirement apply?
6. **Receipts:** is a simple receipt enough, or do gyms need legally formatted invoices (planned after MVP)?
7. **Session tracking:** for per-session and class packs, is manual deduction enough, or is check-in needed sooner?

## 12. Out of Scope (planned for later)

Women-only and gender-separated scheduling, class booking, coach management, online payments (CIB / Edahabia), tax invoicing, member app, inventory/POS, expenses, multi-branch, check-in hardware, workout tracking, advanced reports.
