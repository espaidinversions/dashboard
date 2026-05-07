# UI Sub-plan 1: Design System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add shadows/radius/gradients theme tokens and replace emoji sidebar icons with Lucide icons.

**Architecture:** Two isolated changes to two files. No component restructuring, no data changes. All inline styles. Tokens accessible via `useTheme()` after the change.

**Tech Stack:** React (inline styles), `lucide-react` npm package, `src/theme.js`, `src/components/Sidebar.jsx`

---

### Task 1: Add shadows, radius, and gradients tokens to theme.js

**Files:**
- Modify: `src/theme.js`

Context: `src/theme.js` exports `TC_LIGHT` and `TC_DARK` as plain objects. Currently each has color tokens only. We need to add `shadows`, `radius`, and `gradients` sub-objects to both. All consumers access tokens via `useTheme()` which returns the correct set.

The current `TC_LIGHT` object ends at line 16:
```js
export const TC_LIGHT = {
  green:"#3DC83E", greenLight:"#62D963", greenDark:"#28A029",
  navy:"#2B5070", navyLight:"#4A789A", navyDark:"#1C3A52",
  bg:"#F1F5F8", bgAlt:"#E6EDF3", border:"#C8D5E0",
  card:"#FFFFFF",
  text:"#16303F", textMid:"#3B5F75", textLight:"#6B8EA6",
  red:"#C62828", redLight:"#FDECEA", orange:"#E67E22",
  warning:"#D69E2E",
  yellow:"#B8860B", yellowLight:"#FFF8E1", purple:"#6A4C8A",
};
```

The current `TC_DARK` object starts at line 18:
```js
export const TC_DARK = {
  green:"#4DD94E", greenLight:"#76E477", greenDark:"#35B836",
  navy:"#6AB0D8", navyLight:"#8DC6E8", navyDark:"#4A8FBD",
  bg:"#0C1A26", bgAlt:"#112030", border:"#1C3348",
  card:"#132130",
  text:"#C8DDE8", textMid:"#5E90AB", textLight:"#3A6278",
  red:"#EF5350", redLight:"#2A0F0F", orange:"#E8922A",
  warning:"#F6AD55",
  yellow:"#E8C040", yellowLight:"#221900", purple:"#9B7CC8",
};
```

- [ ] **Step 1: Add tokens to TC_LIGHT**

In `src/theme.js`, replace the `TC_LIGHT` closing `};` with the new tokens appended:

```js
export const TC_LIGHT = {
  green:"#3DC83E", greenLight:"#62D963", greenDark:"#28A029",
  navy:"#2B5070", navyLight:"#4A789A", navyDark:"#1C3A52",
  bg:"#F1F5F8", bgAlt:"#E6EDF3", border:"#C8D5E0",
  card:"#FFFFFF",
  text:"#16303F", textMid:"#3B5F75", textLight:"#6B8EA6",
  red:"#C62828", redLight:"#FDECEA", orange:"#E67E22",
  warning:"#D69E2E",
  yellow:"#B8860B", yellowLight:"#FFF8E1", purple:"#6A4C8A",
  shadows: {
    card:      "0 1px 3px rgba(15,23,42,0.06), 0 4px 16px rgba(15,23,42,0.04)",
    cardHover: "0 4px 12px rgba(15,23,42,0.10), 0 8px 24px rgba(15,23,42,0.06)",
    modal:     "0 8px 40px rgba(0,0,0,0.20)",
    sm:        "0 1px 4px rgba(15,23,42,0.08)",
  },
  radius: { sm: 6, md: 10, lg: 14, xl: 20 },
  gradients: {
    navy:   "linear-gradient(135deg, #2B5070 0%, #1C3A52 100%)",
    green:  "linear-gradient(135deg, #3DC83E 0%, #28A029 100%)",
    accent: "linear-gradient(90deg, #3DC83E 0%, #2B5070 100%)",
  },
};
```

- [ ] **Step 2: Add tokens to TC_DARK**

Replace the `TC_DARK` object:

```js
export const TC_DARK = {
  green:"#4DD94E", greenLight:"#76E477", greenDark:"#35B836",
  navy:"#6AB0D8", navyLight:"#8DC6E8", navyDark:"#4A8FBD",
  bg:"#0C1A26", bgAlt:"#112030", border:"#1C3348",
  card:"#132130",
  text:"#C8DDE8", textMid:"#5E90AB", textLight:"#3A6278",
  red:"#EF5350", redLight:"#2A0F0F", orange:"#E8922A",
  warning:"#F6AD55",
  yellow:"#E8C040", yellowLight:"#221900", purple:"#9B7CC8",
  shadows: {
    card:      "0 1px 3px rgba(0,0,0,0.20), 0 4px 16px rgba(0,0,0,0.15)",
    cardHover: "0 4px 12px rgba(0,0,0,0.30), 0 8px 24px rgba(0,0,0,0.20)",
    modal:     "0 8px 40px rgba(0,0,0,0.50)",
    sm:        "0 1px 4px rgba(0,0,0,0.25)",
  },
  radius: { sm: 6, md: 10, lg: 14, xl: 20 },
  gradients: {
    navy:   "linear-gradient(135deg, #1a3a5c 0%, #0d1e30 100%)",
    green:  "linear-gradient(135deg, #3DC83E 0%, #28A029 100%)",
    accent: "linear-gradient(90deg, #4DD94E 0%, #2B5070 100%)",
  },
};
```

- [ ] **Step 3: Run verify to confirm no breakage**

```bash
npm run verify
```

Expected: all checks pass. The new tokens are additive; no existing consumer references them yet so no risk of breakage.

- [ ] **Step 4: Commit**

```bash
git add src/theme.js
git commit -m "feat(theme): add shadows, radius, and gradients tokens to TC_LIGHT and TC_DARK"
```

---

### Task 2: Replace emoji icons with Lucide icons in Sidebar

**Files:**
- Modify: `src/components/Sidebar.jsx`

Context: The sidebar uses emoji strings stored in the nav tree (`PORTFOLI_SECTIONS`, `TX_LEAVES`, `BOTTOM_ITEMS`) and renders them via `<span>{item.icon}</span>`. We need to replace these with Lucide React component references and update rendering to call them as components.

The toggle button text `"☰"` and `"←"` also need replacing with `<Menu>` and `<ChevronLeft>`.

**Icon mapping (spec):**

| Location | Current | Lucide import | Size |
|---|---|---|---|
| Alternatius parent | `"💼"` | `Briefcase` | 15 (section) |
| Fons child | `"🏦"` | `Building2` | 13 (leaf) |
| Searchers child | `"🔍"` | `Search` | 13 |
| Participades child | `"🏢"` | `Building` | 13 |
| Real Estate parent | `"🏠"` | `Home` | 15 |
| Mercats Públics parent | `"📈"` | `TrendingUp` | 15 |
| tx-alt leaf | `"💼"` | `Briefcase` | 13 |
| tx-mp leaf | `"📈"` | `TrendingUp` | 13 |
| Guia bottom | `"📖"` | `BookOpen` | 14 (bottom) |
| Admin bottom | `"⚙️"` | `Settings` | 14 |
| Toggle expand | `"☰"` | `Menu` | 15 |
| Toggle collapse | `"←"` | `ChevronLeft` | 15 |

- [ ] **Step 1: Install lucide-react**

```bash
npm install lucide-react
```

Expected: package added to node_modules and package.json.

- [ ] **Step 2: Update the import line and nav tree in Sidebar.jsx**

At the top of `src/components/Sidebar.jsx`, replace:
```js
import React, { useState } from "react";
import { Link } from "react-router-dom";
import { TC_LIGHT } from "../theme.js";
```

With:
```js
import React, { useState } from "react";
import { Link } from "react-router-dom";
import { TC_LIGHT } from "../theme.js";
import { Briefcase, Building2, Search, Building, Home, TrendingUp, BookOpen, Settings, Menu, ChevronLeft } from "lucide-react";
```

- [ ] **Step 3: Replace emoji strings in PORTFOLI_SECTIONS**

Replace:
```js
const PORTFOLI_SECTIONS = [
  {
    id:"alt", label:"Alternatius", icon:"💼",
    children:[
      {id:"fons",      label:"Fons",                icon:"🏦"},
      {id:"searchers", label:"Searchers",           icon:"🔍"},
      {id:"companies", label:"Participades",        icon:"🏢"},
    ],
  },
  {
    id:"re", label:"Real Estate", icon:"🏠",
    children:[
      {id:"re-directe",    label:"Directe"},
      {id:"re-altres",     label:"Altres Vehicles"},
      {id:"re-inversions", label:"Totes les Posicions"},
    ],
  },
  {
    id:"mp", label:"Mercats Públics", icon:"📈",
    children:[
      {id:"mp-resum",        label:"Resum"},
      {id:"mp-rv",           label:"Renda Variable"},
      {id:"mp-rf",           label:"Renda Fixa"},
      {id:"mp-posicions",    label:"Posicions"},
      {id:"mp-transaccions", label:"Transaccions"},
      {id:"mp-traçabilitat", label:"Traçabilitat"},
    ],
  },
];
```

With:
```js
const PORTFOLI_SECTIONS = [
  {
    id:"alt", label:"Alternatius", icon:Briefcase,
    children:[
      {id:"fons",      label:"Fons",                icon:Building2},
      {id:"searchers", label:"Searchers",           icon:Search},
      {id:"companies", label:"Participades",        icon:Building},
    ],
  },
  {
    id:"re", label:"Real Estate", icon:Home,
    children:[
      {id:"re-directe",    label:"Directe"},
      {id:"re-altres",     label:"Altres Vehicles"},
      {id:"re-inversions", label:"Totes les Posicions"},
    ],
  },
  {
    id:"mp", label:"Mercats Públics", icon:TrendingUp,
    children:[
      {id:"mp-resum",        label:"Resum"},
      {id:"mp-rv",           label:"Renda Variable"},
      {id:"mp-rf",           label:"Renda Fixa"},
      {id:"mp-posicions",    label:"Posicions"},
      {id:"mp-transaccions", label:"Transaccions"},
      {id:"mp-traçabilitat", label:"Traçabilitat"},
    ],
  },
];
```

- [ ] **Step 4: Replace emoji strings in TX_LEAVES and BOTTOM_ITEMS**

Replace:
```js
const TX_LEAVES = [
  {id:"tx-alt", label:"Alternatius",    icon:"💼"},
  {id:"tx-mp",  label:"Mercats Públics", icon:"📈"},
];

const BOTTOM_ITEMS = [
  {id:"guia",  label:"Guia",  icon:"📖", to:"/guia"},
  {id:"admin", label:"Admin", icon:"⚙️",  to:"/admin", adminOnly:true},
];
```

With:
```js
const TX_LEAVES = [
  {id:"tx-alt", label:"Alternatius",    icon:Briefcase},
  {id:"tx-mp",  label:"Mercats Públics", icon:TrendingUp},
];

const BOTTOM_ITEMS = [
  {id:"guia",  label:"Guia",  icon:BookOpen, to:"/guia"},
  {id:"admin", label:"Admin", icon:Settings,  to:"/admin", adminOnly:true},
];
```

- [ ] **Step 5: Update Leaf rendering to call icon as component**

In the `Leaf` function, replace:
```js
{item.icon && <span style={{fontSize:13,flexShrink:0,lineHeight:1}}>{item.icon}</span>}
```

With:
```js
{item.icon && (() => { const Icon = item.icon; return <Icon size={13} strokeWidth={1.75} style={{flexShrink:0}} />; })()}
```

- [ ] **Step 6: Update Section header rendering to call icon as component**

In the `Section` function's section header button, replace:
```js
<span style={{fontSize:15,flexShrink:0,lineHeight:1}}>{sec.icon}</span>
```

With:
```js
{(() => { const Icon = sec.icon; return <Icon size={15} strokeWidth={1.75} style={{flexShrink:0}} />; })()}
```

- [ ] **Step 7: Update bottom links rendering**

In the bottom links map, replace:
```js
<span style={{fontSize:14,lineHeight:1}}>{item.icon}</span>
```

With:
```js
{(() => { const Icon = item.icon; return <Icon size={14} strokeWidth={1.75} style={{flexShrink:0}} />; })()}
```

- [ ] **Step 8: Update toggle button text to Lucide icons**

Replace the toggle button content:
```js
<button onClick={onToggle} style={{background:"none",border:"none",cursor:"pointer",color:C.text,fontSize:16,padding:6,lineHeight:1,flexShrink:0}}>
  {collapsed ? "☰" : "←"}
</button>
```

With:
```js
<button onClick={onToggle} style={{background:"none",border:"none",cursor:"pointer",color:C.text,padding:6,lineHeight:1,flexShrink:0,display:"flex",alignItems:"center"}}>
  {collapsed ? <Menu size={15} strokeWidth={1.75} /> : <ChevronLeft size={15} strokeWidth={1.75} />}
</button>
```

- [ ] **Step 9: Run verify**

```bash
npm run verify
```

Expected: all checks pass.

- [ ] **Step 10: Commit**

```bash
git add src/components/Sidebar.jsx package.json package-lock.json
git commit -m "feat(sidebar): replace emoji icons with Lucide React icons"
```
