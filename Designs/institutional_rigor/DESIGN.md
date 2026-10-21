---
name: Institutional Rigor
colors:
  surface: '#f0fcfa'
  surface-dim: '#d0dddb'
  surface-bright: '#f0fcfa'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eaf6f4'
  surface-container: '#e4f0ee'
  surface-container-high: '#deebe9'
  surface-container-highest: '#d9e5e3'
  on-surface: '#131e1d'
  on-surface-variant: '#414845'
  inverse-surface: '#273331'
  inverse-on-surface: '#e7f3f1'
  outline: '#717975'
  outline-variant: '#c0c8c4'
  surface-tint: '#3e665a'
  primary: '#184237'
  on-primary: '#ffffff'
  primary-container: '#31594e'
  on-primary-container: '#a3cec0'
  inverse-primary: '#a5cfc1'
  secondary: '#7e5624'
  on-secondary: '#ffffff'
  secondary-container: '#fec78a'
  on-secondary-container: '#79511f'
  tertiary: '#721a1a'
  on-tertiary: '#ffffff'
  tertiary-container: '#91312e'
  on-tertiary-container: '#ffb2ac'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#c0ecdd'
  primary-fixed-dim: '#a5cfc1'
  on-primary-fixed: '#002019'
  on-primary-fixed-variant: '#264e43'
  secondary-fixed: '#ffddba'
  secondary-fixed-dim: '#f2bd80'
  on-secondary-fixed: '#2b1700'
  on-secondary-fixed-variant: '#633f0d'
  tertiary-fixed: '#ffdad7'
  tertiary-fixed-dim: '#ffb3ad'
  on-tertiary-fixed: '#410004'
  on-tertiary-fixed-variant: '#822624'
  background: '#f0fcfa'
  on-background: '#131e1d'
  surface-variant: '#d9e5e3'
typography:
  headline-xl:
    fontFamily: Inter
    fontSize: 2rem
    fontWeight: '600'
    lineHeight: 2.5rem
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 1.5rem
    fontWeight: '600'
    lineHeight: 2rem
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Inter
    fontSize: 1.25rem
    fontWeight: '600'
    lineHeight: 1.75rem
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Inter
    fontSize: 1.125rem
    fontWeight: '600'
    lineHeight: 1.5rem
    letterSpacing: 0em
  body-lg:
    fontFamily: Inter
    fontSize: 1rem
    fontWeight: '400'
    lineHeight: 1.5rem
    letterSpacing: 0em
  body-md:
    fontFamily: Inter
    fontSize: 0.875rem
    fontWeight: '400'
    lineHeight: 1.25rem
    letterSpacing: 0em
  body-sm:
    fontFamily: Inter
    fontSize: 0.75rem
    fontWeight: '400'
    lineHeight: 1.125rem
    letterSpacing: 0.005em
  label-md:
    fontFamily: Inter
    fontSize: 0.875rem
    fontWeight: '500'
    lineHeight: 1.25rem
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Inter
    fontSize: 0.75rem
    fontWeight: '600'
    lineHeight: 1rem
    letterSpacing: 0.025em
  tabular-data:
    fontFamily: Inter
    fontSize: 0.875rem
    fontWeight: '400'
    lineHeight: 1.25rem
    letterSpacing: 0em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-desktop: 1.5rem
  margin: 1rem
  margin-desktop: 2rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1rem
  space-xl: 1.5rem
---

## Brand & Style

This design system is tailored for the daily operational backbone of an established educational institution in Jaipur. It rejects tech-industry tropes—such as neon gradients, artificial glass blurs, and oversized consumer-grade cards—in favor of an authoritative, calm, and functional aesthetic.

The design movement is **Restrained Utilitarian Modernism**. The visual atmosphere evokes the clarity of architectural drafting, ledger records, and classic institutional stationery:
- **Tone:** Methodical, dignified, calm, and unhurried.
- **Audience:** School administrators, bursars, registrars, and department heads processing high-volume academic records, fee structures, and regulatory compliances.
- **Core Visual Philosophy:** Information architecture over decorative flourishes. High visual ergonomics for 8-hour desktop shifts, dense data views without visual strain, and strict typographic alignment.

## Colors

The palette is anchored by heritage architectural tones—pine needle green, dry ochre, and warm paper whites—producing an environment that feels tactile, trustworthy, and deeply focused.

### Surface Architecture
- **Base Canvas (`#F7F7F4`):** Warm-toned paper surface that prevents eye fatigue during sustained operational sessions.
- **Card & Pane Surfaces (`#FFFFFF`):** Crisp pure white applied to interactive work surfaces, modals, and dense tables.
- **Muted Surfaces (`#E9ECE8`):** Subtle backdrops for table headers, read-only containers, and inactive regions.

### Typographic Hierarchy & Contrast
- **Primary Text (`#202B2A`):** Deep graphite with a green-charcoal undertone, offering high contrast without the harshness of pure `#000000`.
- **Secondary / Supporting Text (`#5D6B68`):** Balanced neutral green-slate for labels, metadata, and timestamps.
- **Borders & Dividers (`#DFE3DF`):** Structural 1px boundary lines that delineate high-density data matrices cleanly.

### Semantics & Status
- **Primary / Brand / Confirmation (`#31594E`):** Pine green signifies primary interactive commitments, approved fees, and verified attendance.
- **Accent / Caution (`#D7A46A`):** Muted desert ochre denotes pending administrative steps, overdue invoices, and cautionary states.
- **Critical / Danger (`#C85A54`):** Muted terracotta red handles unexcused absences, critical disciplinary alerts, and validation errors without loud visual panic.

## Typography

The type scale emphasizes compactness and precision over dramatic display scales. Heading sizes are consciously modest, preventing administrative dashboards from losing vertical information density.

- **Tabular Numerals (`tnum`):** All financial summaries, student roll numbers, fee schedules, and percentages must enable `font-feature-settings: "tnum" 1` to guarantee vertical digit alignment across tables.
- **Hierarchy Structure:** Section headings max out at 32px (`headline-xl`). Internal modal titles and table section partitions use 18px (`headline-sm`) to 20px (`headline-md`).
- **Data Densities:** Standard body copy is locked at 14px (`body-md`), with secondary meta-data and system logs set to 12px (`body-sm`) with a crisp medium weight for optimal legibility against light borders.

## Layout & Spacing

The layout model is based on a strict 4px/8px incremental grid. Every layout region, table cell, and form panel snaps to deliberate micro-increments to create an orderly administrative workspace.

- **Layout Grid:** A 12-column responsive grid on desktop with a fixed navigation sidebar (240px default, 64px collapsed). Outer page margins are locked to `2rem` (32px), with column gutters set to `1.5rem` (24px).
- **Control Sizing:** Interactive items adhere to rigid vertical metrics:
  - Standard action controls: 36px height.
  - Primary form inputs and select dropdowns: 36px to 40px height.
  - Compact table inputs: 32px height.
- **Rhythm & Padding:** Form groupings use `space-lg` (16px) separation. Internal card padding is strictly `1rem` (16px) for compact listings and `1.5rem` (24px) for master record sheets.

## Elevation & Depth

This system avoids floating ambient drop-shadows and blurred colored backdrops. Hierarchy is maintained through **Tonal Layering** and **Low-Contrast Structural Outlines**.

- **Level 0 (Base Canvas):** `#F7F7F4` plain paper ground.
- **Level 1 (Card & Panel Surface):** `#FFFFFF` bounded by a crisp 1px border of `#DFE3DF`. No shadow.
- **Level 2 (Popovers, Select Menus, Dropdowns):** `#FFFFFF` surface with a 1px border of `#DFE3DF` accompanied by an ultra-subtle architectural shadow: `0 2px 4px rgba(32, 43, 42, 0.06), 0 1px 2px rgba(32, 43, 42, 0.04)`.
- **Level 3 (Modals & Action Sheets):** `#FFFFFF` surface, 1px border of `#DFE3DF`, overlay backdrop of `#202B2A` at 40% opacity (no blur), supported by a grounded physical shadow: `0 8px 16px -2px rgba(32, 43, 42, 0.08)`.

## Shapes

The geometric signature is disciplined and architectural. A base roundedness of 4px (`roundedness: 1`) governs inputs, buttons, and badges, while master panels and modal dialogues utilize a 6px to 8px ceiling (`rounded-lg`).

- **Base Radius (4px / `0.25rem`):** Buttons, form text fields, table cell badges, dropdown toggles, and status tags.
- **Container Radius (6px / `0.375rem`):** Data tables, informational alert callouts, card groupings, and flyout popups.
- **Modal Radius (8px / `0.5rem`):** Dialogue windows and central system confirmation sheets.
- **Circles:** Reserved strictly for user avatars and circular numeric progress indicators.

## Components

### Buttons
- **Primary:** Solid `#31594E` fill, `#FFFFFF` text, 36px height, 4px border radius. Hover: `#284A41`. Active: `#203B34`. Focused: 2px offset ring in `#31594E`.
- **Secondary / Outline:** `#FFFFFF` fill, 1px solid `#DFE3DF`, `#202B2A` text. Hover: `#F7F7F4` background, border `#202B2A`.
- **Destructive:** `#FFFFFF` fill, 1px solid `#C85A54`, text `#C85A54`. Hover: `#C85A54` fill with `#FFFFFF` text.

### Form Inputs & Selects
- 36px or 40px height, `#FFFFFF` background, 1px solid `#DFE3DF` border, 4px corner radius.
- Inner padding: 8px vertical, 12px horizontal.
- Placeholder text in `#5D6B68`. Focus: 1px border in `#31594E` with no glowing halo. Error state: 1px border in `#C85A54`.

### Data Tables (Academic & Ledger Records)
- Clean lines with 1px horizontal borders in `#DFE3DF`.
- Header row: `#E9ECE8` background, 32px height, uppercase 11px label font (`label-sm`), `#5D6B68` text color.
- Row items: 40px height for dense view, 48px height for standard view. Alternating row fills are avoided; hover row state is `#F7F7F4`.
- All monetary and ledger columns align right with tabular figures enabled.

### Status Badges & Chips
- Restrained 22px height pill/box tags with a 3px radius.
- **Active / Paid / Verified:** `#EAF0EE` background, `#31594E` text, 1px border `#31594E` at 20% opacity.
- **Pending / In Review:** `#FBF5EE` background, `#9E6E36` text, 1px border `#D7A46A` at 30% opacity.
- **Overdue / Suspended:** `#FAECEB` background, `#C85A54` text, 1px border `#C85A54` at 25% opacity.

### Checkboxes & Radio Buttons
- 16px square (checkbox) or circle (radio), 1px solid `#DFE3DF` on white.
- Checked state: `#31594E` solid fill with crisp white internal mark.

### Institutional Ledger Cards
- Flat `#FFFFFF` container with 1px continuous border in `#DFE3DF`.
- Header section demarcated by an interior bottom border of `#DFE3DF` and 12px vertical padding. No drop shadows.