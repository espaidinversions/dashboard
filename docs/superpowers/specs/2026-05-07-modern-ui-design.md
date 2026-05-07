# Modern UI Design — Spec

**Date:** 2026-05-07  
**Status:** Approved  
**Direction:** Modern dashboard (Option B) — hero metrics, gradient accent cards, improved typography hierarchy, Lucide icons

## Overview

Full-app visual upgrade across three independent sub-plans. No structural or data-flow changes — same component placement, routing, and logic. Visual layer only.

### Sub-plans

| # | Name | Scope |
|---|---|---|
| 1 | Design system | Theme tokens + Lucide icons + Sidebar emoji→icons |
| 2 | Shared primitives | KPI card, section header, table chrome, Badge |
| 3 | Screens | Dashboard, FundsIndex, FundDetail, SearchersTab, PublicMarkets, Pipeline, Companies |

Each sub-plan is independently shippable.

---

## Sub-plan 1: Design System

### 1a. Theme token extensions (`src/theme.js`)

Add three new token groups to both `TC_LIGHT` and `TC_DARK`:

```js
// Shadows
shadows: {
  card:      "0 1px 3px rgba(15,23,42,0.06), 0 4px 16px rgba(15,23,42,0.04)",
  cardHover: "0 4px 12px rgba(15,23,42,0.10), 0 8px 24px rgba(15,23,42,0.06)",
  modal:     "0 8px 40px rgba(0,0,0,0.20)",
  sm:        "0 1px 4px rgba(15,23,42,0.08)",
},

// Border radius scale (replaces magic numbers 4/6/10/12px)
radius: { sm: 6, md: 10, lg: 14, xl: 20 },

// Gradients
gradients: {
  navy:   "linear-gradient(135deg, #2B5070 0%, #1C3A52 100%)",
  green:  "linear-gradient(135deg, #3DC83E 0%, #28A029 100%)",
  accent: "linear-gradient(90deg, #3DC83E 0%, #2B5070 100%)",
},
```

**Dark mode variants** for `TC_DARK`:
```js
shadows: {
  card:      "0 1px 3px rgba(0,0,0,0.20), 0 4px 16px rgba(0,0,0,0.15)",
  cardHover: "0 4px 12px rgba(0,0,0,0.30), 0 8px 24px rgba(0,0,0,0.20)",
  modal:     "0 8px 40px rgba(0,0,0,0.50)",
  sm:        "0 1px 4px rgba(0,0,0,0.25)",
},
radius: { sm: 6, md: 10, lg: 14, xl: 20 }, // same
gradients: {
  navy:   "linear-gradient(135deg, #1a3a5c 0%, #0d1e30 100%)",
  green:  "linear-gradient(135deg, #3DC83E 0%, #28A029 100%)",
  accent: "linear-gradient(90deg, #4DD94E 0%, #2B5070 100%)",
},
```

All tokens are accessed via the existing `useTheme()` hook as `tc.shadows.card`, `tc.radius.md`, `tc.gradients.navy`.

### 1b. Lucide icons in Sidebar (`src/components/Sidebar.jsx`)

Install: `npm install lucide-react`

Replace emoji with Lucide icons. Keep all existing sidebar structure, layout, active states, and collapse/expand behavior unchanged.

Icon mapping:

| Current emoji | Lucide icon | Nav item |
|---|---|---|
| 💼 | `<Briefcase />` | Alternatius (parent) |
| 🏦 | `<Building2 />` | Fons |
| 🔍 | `<Search />` | Searchers |
| 🏢 | `<Building />` | Participades |
| 🏠 | `<Home />` | Real Estate |
| 📈 | `<TrendingUp />` | Mercats Públics |
| 📊 | `<BarChart2 />` | PM sub-items |
| ⚡ | `<Zap />` | Pipeline |
| 👥 | `<Users />` | Admin |
| 💰 | `<DollarSign />` | Tx log items |

Render icons at `size={16}` with `strokeWidth={1.75}`. Active items use `tc.green`, inactive use `tc.textLight`.

---

## Sub-plan 2: Shared Primitives

### 2a. KPI Card — two variants

**Hero variant** (gradient bg, white text — for primary metric per section):
```
┌─ gradient navy bg, accent bar top ──────┐
│ LABEL (10px, uppercase, white/55%)       │
│ €42.3M (22px, bold, white, monospace)    │
│ ▲ 12.4% TVPI (10px, green)              │
│                   ◯ decorative orb       │
└─────────────────────────────────────────┘
box-shadow: 0 4px 16px rgba(43,80,112,0.25)
border-radius: tc.radius.lg (14px)
```

**Standard variant** (white bg, optional progress bar):
```
┌─ white bg, card shadow ─────────────────┐
│ LABEL (10px, uppercase, textLight)       │
│ €68.1M (20px, bold, navy, monospace)     │
│ ▓▓▓▓▓▓▓░░░░  62% desplegat (optional)   │
└─────────────────────────────────────────┘
border: 1px solid tc.border
border-radius: tc.radius.md (10px) → lg (14px) upgrade
box-shadow: tc.shadows.card
```

Both variants live in `SharedComponents.jsx` as `<KpiCard hero? label value subtitle progress? />`.

### 2b. Section header

Replace the current `<h2>`/uppercase label pattern with a consistent `<SectionHeader>` component:

```
┌─────────────────────────────────────────┐
│ ▌  Resum per vehicle          24 items  │
│    ↑ green accent bar (3×18px)          │
└─────────────────────────────────────────┘
font-size: 14px, font-weight: 700, color: tc.navyDark
accent bar: 3px wide, 18px tall, gradient green
optional right slot: count badge or action button
padding-bottom: 10px, border-bottom: 1px solid tc.border
```

Used as `<SectionHeader title="Resum" count={24} action={<Button/>} />`.

### 2c. Table chrome

Tables wrapped in a card container. Header row gets a distinct background:

```
┌─ card (white bg, shadow, radius md) ────┐
│ [HEADER ROW — #F7FAFC bg, 2px border]   │
│  Col A     Col B     Col C              │ ← 10px, bold, navyLight, uppercase
│─────────────────────────────────────────│ ← 2px solid tc.border
│  Row 1     val       1.4x               │ ← 9px padding, 1px border bottom
│  Row 2     val       1.2x               │
└─────────────────────────────────────────┘
```

The card wrapper (`tableCardStyle`) uses `tc.shadows.card`, `borderRadius: tc.radius.md`, `background: tc.card`, `overflow: hidden`.

Header cells: `background: #F7FAFC` (light), `borderBottom: "2px solid " + tc.border`, font `10px 700 navyLight uppercase 0.06em spacing`.

Row cells: `borderBottom: "1px solid " + tc.bgAlt`, padding `9px 14px`.

### 2d. Badge — pill style

Change from square (`borderRadius: 4px`) to pill (`borderRadius: 20px`). Add a subtle matching border:

```
Before: bg=#E8EFF5  color=#2B5070  radius=4px  no border
After:  bg=#E8EFF5  color=#2B5070  radius=20px border=1px rgba(43,80,112,0.15)
        padding: 3px 9px (was 2px 7px)
```

The `Badge` component in `SharedComponents.jsx` gets `borderRadius: 20` and `border: "1px solid " + rgba(cfg.color, 0.15)`. All existing color configs (`VCPE_CFG`, `EST_CFG`, `VEHICLE_TIPUS_CFG`, etc.) need no changes — only the shape changes.

---

## Sub-plan 3: Screens

Apply the new primitives consistently across all data screens. No layout restructuring — same component arrangement, just upgraded building blocks.

### Per-screen changes

**Dashboard (`Dashboard.jsx`)**
- First KPI card in each section row → hero variant (gradient)
- Remaining KPI cards → standard variant with `tc.shadows.card`
- All section breaks → `<SectionHeader>`

**FundsIndex (`FundsIndex.jsx`)**
- Table wrapped in card container (`tableCardStyle`)
- Table header upgraded to new chrome
- Badges → pill style (automatic via Badge component)
- Toolbar area: `<SectionHeader title="Vehicles" count={n}>`

**FundDetail (`FundDetail.jsx`)**
- KPI strip at top: first card → hero variant
- Tabs: add `borderRadius: tc.radius.sm` on active tab indicator
- Section headers throughout → `<SectionHeader>`
- Tables → card-wrapped chrome

**SearchersTab (`SearchersTab.jsx`)**
- KPI row → hero + standard variants
- Tables → card chrome
- Section headers → `<SectionHeader>`
- Badges → pill (automatic)

**PublicMarkets screens**
- Chart sections wrapped in `tableCardStyle` cards
- `<SectionHeader>` before each chart group
- KPI strip → standard variant cards with shadow

**PipelineFY26 (`PipelineFY26.jsx`)**
- KPI cards at top → standard variant
- `<SectionHeader>` for each pipeline stage
- Badges → pill (automatic)

**CompanyDetail / CompaniesIndex**
- Tables → card chrome
- `<SectionHeader>` for each data section
- Badges → pill (automatic)

---

## Implementation notes

- All inline style changes stay inline (no CSS files introduced)
- `SharedComponents.jsx` exports `KpiCard` and `SectionHeader` as new named exports
- `tableCardStyle` is a style object helper exported from `SharedComponents.jsx`
- Dark mode: all new tokens have dark variants; `useTheme()` returns the right set
- No new dependencies except `lucide-react` (sub-plan 1)
- `npm run verify` must pass after each sub-plan

## Non-goals

- No layout restructuring (same component placement)
- No new routes or data changes
- No animation or transition overhaul
- No mobile/responsive work
