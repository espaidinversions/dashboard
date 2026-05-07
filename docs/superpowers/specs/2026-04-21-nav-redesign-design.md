# Navigation Redesign — Design Spec
_Date: 2026-04-21_

## Overview

Replace the current three-bar horizontal navigation (section nav + supra nav + sub-tab bar) with a persistent left sidebar. Group content under **Portfoli** and add a new top-level **Transaccions** section. Add vcpe routing so SF/PC/RE transactions surface in the right sub-sections.

---

## 1. Information Architecture

```
Sidebar
├── 📊 Portfoli  (group header — non-clickable)
│   ├── 💼 Alternatius  (collapsible group)
│   │   ├── 🏦 Fons
│   │   ├── 🔍 Searchers
│   │   ├── 🏢 Participades
│   │   └── 📋 Totes les Posicions
│   ├── 🏠 Real Estate  (collapsible group)
│   │   ├── Directe
│   │   └── Altres Vehicles
│   └── 📈 Mercats Públics  (collapsible group)
│       └── Resum · RV · RF · Posicions · Transaccions · Traçabilitat
│
├── 💸 Transaccions  (group header — non-clickable)
│   ├── Alternatives
│   └── Mercats Públics
│
├── 📖 Guia
└── ⚙️  Admin  (admin-only)
```

---

## 2. Content Sub-tabs (horizontal tabs within content area)

| Sidebar item | Content sub-tabs |
|---|---|
| Fons | Pipeline · Resum · Mensual · Per Fons · **Transaccions** |
| Searchers | Tots · Actius · **Transaccions** |
| Participades | Totes · Search Funds · Altres · **Transaccions** |
| Totes les Posicions | Fons · Participades |
| Real Estate › Directe | (placeholder) |
| Real Estate › Altres Vehicles | Fund table · **Transaccions** |
| Mercats Públics › * | existing tabs unchanged |
| Transaccions › Alternatives | Full aggregated txlog (all vcpe) |
| Transaccions › Mercats Públics | PM buy/sell log |

---

## 3. Sidebar Behaviour

### Expanded state (~220px)
- Logo + wordmark at top.
- Group headers (Portfoli, Transaccions) are non-clickable dividers with uppercase label.
- Collapsible sub-groups (Alternatius, Real Estate, Mercats Públics) toggle open/closed on click; default open.
- Leaf items navigate on click; active item gets green left-border + background tint.
- Guia and Admin pinned at bottom.

### Collapsed state (~52px — icon rail)
- Logo icon only at top.
- Each top-level group collapses to a single icon.
- Leaf items hidden; hovering a group icon shows a floating popover with its children.
- Toggle button (← / ☰) at top of sidebar.
- Collapsed state persisted to localStorage (`ui_sidebarCollapsed`).

---

## 4. Top Bar (slim, ~44px, full width)

Persists across all views. Replaces the current wide header.

Contents (left → right):
- Sidebar toggle button (hamburger / arrow)
- `flex: 1` spacer
- Global search input
- Dark mode toggle
- ↓ Excel · ↓ PDF · ↓ PNG export buttons
- ↑ Carregar dades
- Sign out

Logo moves into sidebar top. No section/supra tabs in top area.

---

## 5. Transactions Routing (vcpe)

Two new vcpe values added to `VCPE_CFG` in `config.js`:

| vcpe | Label | Appears in |
|---|---|---|
| `PE` | Private Equity | Fons transactions |
| `VC` | Venture Capital | Fons transactions |
| `SF` | Search Fund | Searchers transactions |
| `PC` | Participades | Participades transactions |
| `RE` | Real Estate | Real Estate › Altres Vehicles |

**Aggregation rules:**
- `Transaccions › Alternatives` = ALL vcpe types (PE + VC + SF + PC + RE)
- `Fons` transactions tab = vcpe ∈ {PE, VC} only
- `Searchers` transactions tab = vcpe = SF
- `Participades` transactions tab = vcpe = PC
- `Real Estate › Altres Vehicles` = vcpe = RE

KPIs in each sub-section are scoped to their own vcpe slice. Global Alternatius KPIs (shown when Alternatius group header is selected, if any) show PE+VC only; RE/SF/PC have their own KPI contexts.

---

## 6. Technical Approach

### New files
- `src/components/Sidebar.jsx` — sidebar component (~200 lines)

### Modified files
- `src/components/Dashboard.jsx`
  - Remove three nav bars (section, supra, sub-tabs for sections)
  - Add `sidebarCollapsed` persisted state
  - Add slim top bar
  - Add sidebar layout wrapper (flex row: sidebar + content)
  - Add new top-level states: `"transaccions-alt"`, `"transaccions-pm"`
  - Rename "inversions" → "posicions" in SUPRA_ALL
  - `baseTx` / `baseCompr` scoped to vcpe ∈ {PE, VC} for Fons section
  - New derived slices: `sfTx`, `pcTx`, `reTx`, `sfCompr`, `pcCompr`, `reCompr`
  - Searchers sub-tabs: add "transaccions"
  - Participades sub-tabs: add "transaccions"
- `src/config.js`
  - Add `SF` and `PC` to `VCPE_CFG`

### State mapping (existing → new)
Existing `tab`/`supra`/`section` state is preserved. Sidebar items call the same setters. New leaf items added for SF/PC transactions and top-level Transaccions section.

### No routing changes
URL routing stays as-is (no new React Router routes). Navigation state stays in localStorage via `usePersistedState`.

---

## 7. Out of scope
- Mobile responsiveness (sidebar always visible on desktop)
- Drag-to-resize sidebar
- Per-section permissions on new vcpe types (inherit from existing section permissions)
