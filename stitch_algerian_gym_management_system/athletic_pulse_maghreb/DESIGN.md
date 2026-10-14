---
name: Athletic Pulse Maghreb
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#584237'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#8c7164'
  outline-variant: '#e0c0b1'
  surface-tint: '#9d4300'
  primary: '#9d4300'
  on-primary: '#ffffff'
  primary-container: '#f97316'
  on-primary-container: '#582200'
  inverse-primary: '#ffb690'
  secondary: '#565e74'
  on-secondary: '#ffffff'
  secondary-container: '#dae2fd'
  on-secondary-container: '#5c647a'
  tertiary: '#006591'
  on-tertiary: '#ffffff'
  tertiary-container: '#09a4e8'
  on-tertiary-container: '#003650'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffdbca'
  primary-fixed-dim: '#ffb690'
  on-primary-fixed: '#341100'
  on-primary-fixed-variant: '#783200'
  secondary-fixed: '#dae2fd'
  secondary-fixed-dim: '#bec6e0'
  on-secondary-fixed: '#131b2e'
  on-secondary-fixed-variant: '#3f465c'
  tertiary-fixed: '#c9e6ff'
  tertiary-fixed-dim: '#89ceff'
  on-tertiary-fixed: '#001e2f'
  on-tertiary-fixed-variant: '#004c6e'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  display:
    fontFamily: Cairo, Plus Jakarta Sans, system-ui, sans-serif
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 36px
  display-mobile:
    fontFamily: Cairo, Plus Jakarta Sans, system-ui, sans-serif
    fontSize: 26px
    fontWeight: '700'
    lineHeight: 32px
  heading-1:
    fontFamily: Cairo, Plus Jakarta Sans, system-ui, sans-serif
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 28px
  heading-2:
    fontFamily: Cairo, Plus Jakarta Sans, system-ui, sans-serif
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 24px
  heading-3:
    fontFamily: Cairo, Plus Jakarta Sans, system-ui, sans-serif
    fontSize: 17px
    fontWeight: '600'
    lineHeight: 22px
  body-medium:
    fontFamily: Cairo, Plus Jakarta Sans, system-ui, sans-serif
    fontSize: 15px
    fontWeight: '500'
    lineHeight: 20px
  body-regular:
    fontFamily: Cairo, Plus Jakarta Sans, system-ui, sans-serif
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 20px
  label-strong:
    fontFamily: Cairo, Plus Jakarta Sans, system-ui, sans-serif
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 18px
  caption:
    fontFamily: Cairo, Plus Jakarta Sans, system-ui, sans-serif
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 16px
  caption-small:
    fontFamily: Cairo, Plus Jakarta Sans, system-ui, sans-serif
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-desktop: 1.5rem
  margin: 1rem
  margin-desktop: 2rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style

This design system is engineered for gym owners, fitness club operators, and sports facility managers across Algeria. The operating context demands immediate legibility in bright, glare-heavy daylight environments (front desk counters, sunlit entrances, and active gym floors) alongside extreme speed of interaction for high-throughput desk workflows like check-ins, subscription renewals, and walk-in sales.

### Personality & Core Attributes
- **Athletic & Energetic:** Grounded in high-visibility dynamic orange that conveys vigor, movement, and decisive action without visual fatigue.
- **Trustworthy & Authoritative:** Precise financial reporting and subscription tracking anchored by deep slate typography and crisp borders, instilling confidence in payment records and cash desk tracking.
- **Bilingual & Culturally Native:** Built from the ground up for seamless code-switching between Algerian Arabic (`dir="rtl"`) and French (`dir="ltr"`), ensuring typographic parity, natural reading flow, and effortless navigation across both languages.
- **Resilient & Pragmatic:** Designed as an offline-capable Progressive Web App (PWA) with explicit network state indicators, large touch ergonomics for sweaty or rushed interactions, and immediate visual status feedback.

### Visual Aesthetic
A modern, high-contrast, functional light design system. It eschews gratuitous decorations, deep blur layers, and decorative gradients in favor of sharp structural definition, pure white elevated cards with delicate ambient drop shadows, clear status tinting, and strict 48px minimum touch ergonomics.

## Colors

The palette leverages high-contrast functional color assignments. Backgrounds and borders are cool slate tones to keep eye strain minimal, while structural text anchors the interface with pitch-slate contrast. The primary accent drives direct user action.

### Base & Structure
- **Canvas Background:** `#F8FAFC` (Slate 50) — Crisp, glare-resistant, clean surface foundation.
- **Surface / Card Background:** `#FFFFFF` — Pure white foreground separation.
- **Primary Text & Headings:** `#0F172A` (Slate 900) — Maximum contrast reading layer for sunlight readability.
- **Secondary / Muted Text:** `#64748B` (Slate 500) — Subdued contextual labels and helper metadata.
- **Structural Borders & Dividers:** `#E2E8F0` (Slate 200) — Crisp 1px geometric delimitation.
- **Subtle Surface Tint:** `#F1F5F9` (Slate 100) — Table headers, disabled inputs, and inactive tabs.

### Accent & Action
- **Primary Orange:** `#F97316` — Primary buttons, Floating Action Button (FAB), active tab indicators, and selection rings.
- **Primary Hover:** `#EA580C` — Hover state on pointer devices.
- **Primary Active / Pressed:** `#C2410C` — Physical press and active toggle state.
- **Focus Ring:** `rgba(249, 115, 22, 0.35)` — Accessible focus halo (3px outline).

### Status Badges & Indicators
Each status pairs a soft tinted fill, a structured border, and a vivid text value with a synchronized 6px status dot:
- **Active (نشط / Actif):**
  - Text & Dot: `#16A34A` (Green 600)
  - Background: `#DCFCE7` (Green 100)
  - Border: `#BBF7D0` (Green 200)
- **Expired (منتهي / Expiré):**
  - Text & Dot: `#DC2626` (Red 600)
  - Background: `#FEE2E2` (Red 100)
  - Border: `#FECACA` (Red 200)
- **Frozen / Suspended (مجمد / Suspendu):**
  - Text & Dot: `#0EA5E9` (Sky 500)
  - Background: `#E0F2FE` (Sky 100)
  - Border: `#BAE6FD` (Sky 200)
- **Debt / Owing (غير مسدد / En dette):**
  - Text & Dot: `#D97706` (Amber 600)
  - Background: `#FEF3C7` (Amber 100)
  - Border: `#FDE68A` (Amber 200)

### Connectivity Sync States
- **Online (متصل / En ligne):** `#16A34A` dot with `#DCFCE7` background badge.
- **Offline (غير متصل / Hors ligne):** `#DC2626` dot with `#FEE2E2` background badge.
- **Syncing (مزامنة / Synchronisation):** `#0EA5E9` pulsing dot with `#E0F2FE` background badge.

## Typography

The type system runs primarily on **Cairo** across both Latin and Arabic character sets, with high-quality fallback to **Plus Jakarta Sans** and system stacks. Cairo delivers robust x-height for Arabic naskh letterforms without clipping diacritics, matching the visual weight of Latin glyphs in French text.

### Typographic Rules & Best Practices
- **Directional Adaptation:** Text elements inherit `dir="ltr"` or `dir="rtl"` automatically from the document root. Text alignment rules must use logical properties (`text-align: start` and `text-align: end`) rather than static `left` or `right`.
- **Numbers & Currencies:** In both French and Arabic modes, modern Arabic numerals (`0 1 2 3 4 5 6 7 8 9`) are the standard for financial entries and gym metrics.
- **Algerian Dinar Currency Formatting:** Financial figures must be formatted with non-breaking thin spaces (`&nbsp;` / `\u00A0`) as the thousands separator, followed by currency notation:
  - French: `12 000 DA`
  - Arabic: `12 000 د.ج`
- **Line Heights:** Arabic typography requires slightly more vertical breathing room than pure Latin text to avoid descender/ascender collisions. Line-height tokens are calibrated to accommodate both scripts harmoniously.

## Layout & Spacing

The layout follows a fluid-hybrid model with strict logical direction handling (`margin-inline-start`, `padding-inline-end`).

### Breakpoints & Adaptive Modes
- **Mobile (< 768px):**
  - Outer horizontal margin: `1rem` (16px).
  - Single-column flow with touch-optimized vertical stacks.
  - Fixed bottom navigation bar (5 items) with center-docked or trailing FAB.
  - Data tables transform into stacked touch cards.
  - Dialog windows transform into swipeable bottom sheets.
- **Tablet (768px – 1023px):**
  - Outer margin: `1.5rem` (24px).
  - Compact icon-only collapsible sidebar.
  - 2-column card layouts and multi-column tabular previews.
- **Desktop (≥ 1024px):**
  - Outer margin: `2rem` (32px).
  - Fixed/collapsible left sidebar (240px expanded, 72px icon collapsed) in LTR, mirrored to the right side in RTL.
  - Full data grids with inline actions, sorting, and batch filters.
  - Top bar fixed at 64px height hosting quick global search, sync chip, language toggle, and manager profile.

### Bi-Directional (LTR/RTL) Rules
- Never use physical directional CSS properties (`left`, `right`, `margin-left`, `padding-right`). Use logical properties (`inset-inline-start`, `inset-inline-end`, `margin-inline`, `padding-inline`).
- Chevrons indicating forward navigation flip 180° automatically: pointing right in LTR, pointing left in RTL.
- Structural elements (e.g. sidebar, topbar icons, table columns) mirror along the vertical axis when switching from `dir="ltr"` to `dir="rtl"`.

## Elevation & Depth

To guarantee high visibility in intense natural gym lighting, the design system relies primarily on **surface contrast and crisp 1px structural borders**, augmented with minimal, soft ambient shadows. Heavy blurs, deep drop shadows, and dark overlays are explicitly avoided.

### Elevation Hierarchy
- **Level 0 (Flat Canvas):** `#F8FAFC`. Base view canvas. No shadow, no border.
- **Level 1 (Cards, List Items, Standard Containers):** `#FFFFFF` fill, 1px solid `#E2E8F0` border, and shadow: `box-shadow: 0 1px 3px rgba(15, 23, 42, 0.05), 0 1px 2px rgba(15, 23, 42, 0.03)`.
- **Level 2 (Hovered Cards, Dropdowns, Popovers):** `#FFFFFF` fill, 1px solid `#CBD5E1` border, and shadow: `box-shadow: 0 4px 6px -1px rgba(15, 23, 42, 0.08), 0 2px 4px -2px rgba(15, 23, 42, 0.05)`.
- **Level 3 (Mobile Bottom Navigation & Fixed Top Bar):** Background `#FFFFFF` with high opacity (98%), subtle backdrop filter blur (4px) to retain contrast, anchored by 1px border on the opposing side (`border-t` for bottom bar, `border-b` for top bar) and shadow: `box-shadow: 0 -2px 10px rgba(15, 23, 42, 0.04)`.
- **Level 4 (Floating Action Button - FAB):** Solid `#F97316` fill with shadow: `box-shadow: 0 4px 14px rgba(249, 115, 22, 0.4)`.
- **Level 5 (Modals, Bottom Sheets & Drawers):** `#FFFFFF` surface resting over a 40% `#0F172A` scrim backdrop. Shadow: `box-shadow: 0 20px 25px -5px rgba(15, 23, 42, 0.15), 0 8px 10px -6px rgba(15, 23, 42, 0.1)`.

## Shapes

The design system uses a balanced geometric shape language centered on 8px base units, yielding soft yet purposeful container boundaries.

### Corner Radii
- **Base Elements (Buttons, Inputs, Selectors):** `0.5rem` (8px). Provides a comfortable target silhouette without turning bubbly.
- **Surface Cards & Table Containers (`rounded-xl`):** `0.75rem` (12px). Distinctive boundary for membership details, payment recaps, and stats.
- **Modals & Bottom Sheets:** `1rem` (16px) top radius for mobile swipe sheets; `1rem` uniform for desktop modals.
- **Status Badges, Chips & Avatars (`rounded-full`):** 9999px (full pill shape) for status chips, count tags, and photo avatars.
- **Floating Action Button (FAB):** Circular (56px × 56px, `border-radius: 50%`) with centered 24px icon.

## Components

### 1. Buttons & Interactive Controls
- **Touch Target:** Mandatory minimum 48px height (`h-12`) across all mobile buttons, tabs, and clickable list rows.
- **Primary Button:** Background `#F97316`, text `#FFFFFF`, font-weight 600. Hover: `#EA580C`, Active: `#C2410C`. Focus-visible ring: 3px `#F97316` at 35% opacity.
- **Secondary Button:** White `#FFFFFF` surface, 1px `#E2E8F0` border, text `#0F172A`. Hover: `#F1F5F9`.
- **Destructive Button:** Pale red `#FEE2E2` background with `#DC2626` text; active turns to `#DC2626` solid with `#FFFFFF` text.
- **Floating Action Button (FAB):** 56px circular button floating 20px above the mobile bottom bar. Positioned at `inset-inline-end: 1rem`. Features a 24px `+` icon, invoking quick actions (New Member, New Payment, Check-in).

### 2. Status Chips & Badges
- Displayed as pill shapes (`rounded-full`), padding `0.25rem 0.75rem` (4px 12px), text `caption` font weight 600.
- Contains an inline 6px circular dot indicator placed at `margin-inline-end: 6px`.
- Four mandatory semantic tokens: Active (`#16A34A`), Expired (`#DC2626`), Frozen (`#0EA5E9`), and Debt (`#D97706`).

### 3. Form Inputs & Search Fields
- Height: 48px (`h-12`). Border: 1px `#E2E8F0`. Background: `#FFFFFF`. Corner radius: `8px`.
- Text: 15px `#0F172A`, Placeholder: `#94A3B8`.
- Focus State: Border color `#F97316`, box-shadow `0 0 0 3px rgba(249, 115, 22, 0.2)`.
- Input Affix / Icons: Positioned using logical inline padding (`padding-inline-start: 42px`) to swap cleanly between Arabic and French.

### 4. Cards & Mobile Stacked Views
- **Desktop:** Crisp table with sticky headers, striped or plain borders, and 48px row heights.
- **Mobile Member Card:** Desktop table rows collapse into standalone touch cards (`rounded-xl`, 12px padding).
  - Top row: Member name + Current status pill.
  - Middle row: Subscription plan name, remaining days counter, and debt balance (highlighted in `#D97706` if unpaid).
  - Bottom row: Quick action icon triggers (Call, WhatsApp, Renew Subscription, Check In).

### 5. Navigation & Layout Frame
- **Desktop Sidebar:** 240px wide, docked start (`left` in LTR, `right` in RTL). Shows Gym Logo, location badge, navigation links with 20px outline icons, and collapses to 72px on tablet.
- **Desktop Top Bar:** 64px height, contains quick global search field (search by member barcode, phone, or name), Language Switcher button (`العربية` / `Français`), Connectivity Chip, and Admin Avatar.
- **Mobile Bottom Navigation Bar:** Fixed at screen bottom, 64px height + device safe area padding. Exactly 5 destinations:
  1. Home / الرئيسية
  2. Members / الأعضاء
  3. Payments / المدفوعات
  4. Alerts / التنبيهات
  5. More / المزيد
- Active nav icon and label receive `#F97316` tint with a 3px active top-indicator line.

### 6. Modals & Bottom Sheets
- Desktop: Centered modal with 16px corner radius, max-width 540px.
- Mobile: Slides up from bottom as an interactive sheet with a 36px × 4px rounded grab handle at top center, full width, auto-height.

### 7. Iconography Guidelines
- Stroke-based icons (20px or 24px) with a consistent 1.75px stroke width.
- Symmetrical icons remain untransformed; directional action icons (chevrons, back arrows, export/import arrows) mirror on the horizontal plane when `dir="rtl"`.