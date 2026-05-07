# UI Sub-plan 3: Screens — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the upgraded KpiCard (hero variant for first card), SectionHeader, and tableCardStyle primitives consistently across all data screens.

**Architecture:** Additive changes only to screen components. No layout restructuring. All new components (`KpiCard`, `SectionHeader`, `tableCardStyle`) come from `SharedComponents.jsx`. The PublicMarketsShared.jsx local KpiCard is replaced by re-exporting from SharedComponents.

**Tech Stack:** React inline styles. Sub-plans 1 and 2 must be merged first (theme tokens, updated KpiCard, SectionHeader, tableCardStyle all exist).

**Prerequisite:** Sub-plans 1 and 2 merged.

---

### Task 1: FundDetail — hero KPI + SectionHeader + tableCardStyle

**Files:**
- Modify: `src/components/FundDetail.jsx`

Context: FundDetail already imports `KpiCard` from SharedComponents. The KPI strip (lines 130-142) has 8+ cards in a flex row. Section dividers are inline `div` with uppercase `textLight` labels.

Current KPI strip (lines 130-142):
```js
<div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
  <KpiCard label="Compromís"      value={compromis ? fmtM(compromis) : "—"} tc={tc} />
  <KpiCard label="Capital Cridat" value={fmtM(calls)} sub={utilPct ? `${utilPct} del compromís` : null} tc={tc} />
  <KpiCard label="Distribucions"  value={dist ? fmtM(dist) : "—"} tc={tc} />
  <KpiCard label="Net"            value={(net >= 0 ? "+" : "") + fmtM(net)} tc={tc} />
  <KpiCard label="TVPI" value={formatMultiple(tvpiFund)} sub="Inputat manualment" valueColor={multipleColor(tvpiFund, tc)} tc={tc} />
  <KpiCard label="IRR"  value={irrFund != null ? `${irrFund.toFixed(1)}%` : "—"} valueColor={multipleColor(tvpiFund, tc)} tc={tc} />
  <KpiCard label="DPI"  value={formatMultiple(dpiFund)}  valueColor={multipleColor(dpiFund, tc)}  tc={tc} />
  <KpiCard label="RVPI" value={formatMultiple(rvpiFund)} valueColor={multipleColor(rvpiFund, tc)} tc={tc} />
  {recallablePool > 0 && (
    <KpiCard label="Pool Recallable" value={fmtM(recallablePool)} valueColor={tc.green} tc={tc} />
  )}
</div>
```

J-curve section (line 145) has an inline section header:
```js
<div style={{ fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", color: tc.textLight, fontWeight: 600, flex: 1 }}>J-curve</div>
```

Read the file fully before editing to locate all section headings (search for `textTransform: "uppercase"` or `textLight` with small fontSize that act as section labels).

- [ ] **Step 1: Add SectionHeader to imports in FundDetail.jsx**

At the top of the file, the existing import of SharedComponents is:
```js
import { Badge, Logo, KpiCard, AddRowModal } from "./SharedComponents.jsx";
```

Replace with:
```js
import { Badge, Logo, KpiCard, AddRowModal, SectionHeader, tableCardStyle } from "./SharedComponents.jsx";
```

- [ ] **Step 2: Make the first KpiCard the hero variant**

In the KPI strip, add `hero` to the first KpiCard only:
```js
<KpiCard label="Compromís" value={compromis ? fmtM(compromis) : "—"} tc={tc} hero />
```

Leave all remaining KpiCard calls unchanged (they already get the standard variant with shadow from Sub-plan 2).

- [ ] **Step 3: Replace the J-curve section inline header with SectionHeader**

Inside the J-curve container, find the section label div:
```js
<div style={{ fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", color: tc.textLight, fontWeight: 600, flex: 1 }}>J-curve</div>
```

Replace it with:
```js
<SectionHeader title="J-curve" tc={tc} />
```

Note: the J-curve section also has `display: "flex", alignItems: "center", marginBottom: 16` wrapping the label + chart toggle buttons. Keep that wrapping div but replace just the label div with `<SectionHeader>`. The SectionHeader already handles its own bottom border and marginBottom. Remove the wrapper `display:flex` or restructure so SectionHeader appears above the button row if needed — read the surrounding context to decide. The chart view toggle buttons (`Trimestral` / `Anual`) can remain in a separate div below the SectionHeader.

- [ ] **Step 4: Find and replace remaining inline section headings**

Search `FundDetail.jsx` for patterns like:
```
fontSize: 12, letterSpacing:
fontSize: 11, letterSpacing:
textTransform: "uppercase"
```
that act as section labels. For each one found, replace the surrounding card header with `<SectionHeader title="…" tc={tc} />`.

Common ones to look for: "Log de transaccions", "Capital Cridat vs. Distribucions", any section label above a table.

- [ ] **Step 5: Wrap the transaction log table in tableCardStyle**

Find the transaction log table container. It likely looks like:
```js
<div style={{ background: tc.card, border: `1px solid ${tc.border}`, borderRadius: 10, ... }}>
```

Replace that outer style object with `tableCardStyle(tc)`, keeping `overflow: "auto"` if it exists inside.

- [ ] **Step 6: Run verify**

```bash
npm run verify
```

Expected: all checks pass.

- [ ] **Step 7: Commit**

```bash
git add src/components/FundDetail.jsx
git commit -m "feat(FundDetail): hero KpiCard, SectionHeader, tableCardStyle"
```

---

### Task 2: FundsIndex — SectionHeader + tableCardStyle

**Files:**
- Modify: `src/components/FundsIndex.jsx`

Context: FundsIndex doesn't use KpiCard. It has a table with a heading area and filter row. Badge is already imported (auto-upgraded to pill from Sub-plan 2). The table needs a card wrapper and the page section needs a SectionHeader.

Read `FundsIndex.jsx` fully before editing, especially the JSX return to locate:
1. The section label above the table (likely an `h2` or uppercase div with "Vehicles" or similar text)
2. The table element and its current container

- [ ] **Step 1: Add SectionHeader and tableCardStyle to imports**

Existing import from SharedComponents:
```js
import { Badge, EditableCell, DeleteRowButton, indexPageStyles } from "./SharedComponents.jsx";
```

Replace with:
```js
import { Badge, EditableCell, DeleteRowButton, indexPageStyles, SectionHeader, tableCardStyle } from "./SharedComponents.jsx";
```

- [ ] **Step 2: Replace toolbar section label with SectionHeader**

Find the section label (likely uppercase text above the table or in the toolbar area). Replace it with:
```js
<SectionHeader title="Vehicles" count={rows.length} tc={tc} />
```

Use the actual count variable — read the file to find what the filtered row count variable is called.

- [ ] **Step 3: Wrap the table in tableCardStyle**

Find the container div that wraps the `<table>` element. It likely has:
```js
style={{ background: tc.card, border: `1px solid ${tc.border}`, borderRadius: ... }}
```

Replace those style props with `{...tableCardStyle(tc)}` and add `overflowX: "auto"` for horizontal scroll:
```js
<div style={{ ...tableCardStyle(tc), overflowX: "auto" }}>
  <table ...>
```

- [ ] **Step 4: Upgrade table header row styling**

Inside the `<thead>`, update `<th>` cells to use the new chrome:
- Background: `#F7FAFC` (light) or `tc.bgAlt` (dark)
- `borderBottom: "2px solid " + tc.border`
- Font: `10px, 700, tc.navyLight ?? tc.textLight, uppercase, 0.06em letter-spacing`

Find the existing `sharedStyles.th(tc)` usage or inline th styles and update them. If using `sharedStyles.th`, update inline:
```js
style={{ ...sharedStyles.th(tc), background: "#F7FAFC", borderBottom: `2px solid ${tc.border}`, fontWeight: 700 }}
```

- [ ] **Step 5: Run verify**

```bash
npm run verify
```

Expected: all checks pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/FundsIndex.jsx
git commit -m "feat(FundsIndex): SectionHeader, tableCardStyle, header chrome"
```

---

### Task 3: SearchersTab — hero KPI + SectionHeader + tableCardStyle

**Files:**
- Modify: `src/components/SearchersTab.jsx`

Context: SearchersTab does NOT use `KpiCard` from SharedComponents. It has a shared style `card` defined locally (line 54):
```js
const card = { background:TC.card, border:`1px solid ${TC.border}`, borderRadius:10, padding:"20px 22px", boxShadow:"0 2px 12px rgba(0,0,0,.06)" };
```

It also has inline `sec` (line 56) used as section labels. Read the file to find:
1. Any KPI metric display area (summary stats at the top of each sub-tab)
2. Section labels matching the `sec` style pattern
3. Table containers matching the `card` style

- [ ] **Step 1: Add KpiCard, SectionHeader, tableCardStyle to imports**

Existing import from SharedComponents:
```js
import { FlagImg, AddRowModal, DeleteRowButton, EditableCell } from "./SharedComponents.jsx";
```

Replace with:
```js
import { FlagImg, AddRowModal, DeleteRowButton, EditableCell, KpiCard, SectionHeader, tableCardStyle } from "./SharedComponents.jsx";
```

- [ ] **Step 2: Replace section label divs with SectionHeader**

Search for uses of the `sec` style object:
```js
<div style={sec}>...</div>
```
or
```js
<div style={{ fontSize:10, letterSpacing:"0.11em", color:TC.textLight, textTransform:"uppercase", ... }}>
```

For each one that acts as a section heading, replace with:
```js
<SectionHeader title="…" tc={TC} />
```

Use the text content of the original div as the title.

- [ ] **Step 3: Find and upgrade KPI metric displays**

Read the file to find areas where summary stats (totals, counts, percentages) are displayed. These may be:
- Inline card divs with a label + big number
- Grouped at the top of a sub-tab

For any such area with 2+ metrics side-by-side, convert the first metric div to a `<KpiCard hero label="…" value="…" tc={TC} />` and the rest to `<KpiCard label="…" value="…" tc={TC} />`.

If the metrics are displayed differently (not as standalone card divs), add a KPI row only if it's a natural fit — do not force it if metrics are embedded in a table or chart header.

- [ ] **Step 4: Wrap table containers in tableCardStyle**

Find card containers wrapping `<table>` elements. Replace the inline card style object with `tableCardStyle(TC)`:

Before:
```js
<div style={card}>
  <table ...>
```

After:
```js
<div style={{ ...tableCardStyle(TC), padding: "0", overflowX: "auto" }}>
  <table ...>
```

Note: `tableCardStyle` doesn't include padding (tables sit flush in their card), but other card usages (chart containers) keep their padding.

- [ ] **Step 5: Upgrade table th cells**

For `<th>` cells using the local `th` style, update to new chrome:
```js
style={{ ...th, background: "#F7FAFC", borderBottom: `2px solid ${TC.border}`, fontWeight: 700, color: TC.navyLight ?? TC.textLight }}
```

- [ ] **Step 6: Run verify**

```bash
npm run verify
```

Expected: all checks pass.

- [ ] **Step 7: Commit**

```bash
git add src/components/SearchersTab.jsx
git commit -m "feat(SearchersTab): KpiCard hero, SectionHeader, tableCardStyle"
```

---

### Task 4: PublicMarkets — consolidate KpiCard + hero variant + SectionHeader

**Files:**
- Modify: `src/components/publicMarkets/PublicMarketsShared.jsx`
- Modify: `src/components/publicMarkets/PublicMarketsSummarySection.jsx`

Context: `PublicMarketsShared.jsx` exports its own local `KpiCard` (lines 85-107) that is identical in shape to the SharedComponents KpiCard. `PublicMarketsSummarySection.jsx` imports `KpiCard` from `PublicMarketsShared`. We need to:
1. Replace the local KpiCard in PublicMarketsShared.jsx with a re-export from SharedComponents
2. Add hero variant to the first KpiCard in PublicMarketsSummarySection.jsx
3. Add SectionHeader before the chart section

Current local KpiCard in PublicMarketsShared.jsx (lines 85-107):
```js
export function KpiCard({ label, value, sub, tc = TC_LIGHT, valueColor }) {
  return (
    <div className="kpi-card card-hover" style={{ background: tc.card, border: `1px solid ${tc.border}`, borderRadius: 10, padding: "16px 20px", minWidth: 160, flex: 1 }}>
      <div style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: tc.textLight, fontWeight: 600, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: valueColor ?? tc.navy, fontFamily: "'DM Mono',monospace" }}>{value}</div>
      {sub ? <div style={{ fontSize: 11, color: tc.textLight, marginTop: 4 }}>{sub}</div> : null}
    </div>
  );
}
```

PublicMarketsSummarySection.jsx KPI strip (lines 35-40):
```js
<KpiCard label="Total Patrimoni" value={fmtM(total)} sub="Mercats Públics" tc={tc} />
<KpiCard label="Renda Variable" value={fmtM(totalRV)} sub={total > 0 ? `${(totalRV / total * 100).toFixed(1)}% del total` : "—"} tc={tc} />
<KpiCard label="Renda Fixa" value={fmtM(totalRF)} sub={total > 0 ? `${(totalRF / total * 100).toFixed(1)}% del total` : "—"} tc={tc} />
<KpiCard label="YTD Global" value={pctFmt(ytdWeighted)} sub="Ponderat per AUM" tc={tc} valueColor={ytdWeighted >= 0 ? tc.green : tc.red} />
<KpiCard label="TWR Cartera (Des '23)" value={pctFmt(portfolioTWR)} sub="Retorn acumulat, sense fluxos" tc={tc} valueColor={portfolioTWR >= 0 ? tc.green : tc.red} />
<KpiCard label="MWR Cartera (Des '23)" value={pctFmt(portfolioMWR)} sub="Anualitzat, Modified Dietz" tc={tc} valueColor={portfolioMWR >= 0 ? tc.green : tc.red} />
```

- [ ] **Step 1: Replace local KpiCard in PublicMarketsShared.jsx with re-export**

In `src/components/publicMarkets/PublicMarketsShared.jsx`:

1. Add import at the top (after existing imports):
```js
import { KpiCard as _KpiCard } from "../SharedComponents.jsx";
```

2. Replace the local `KpiCard` function with a re-export that preserves the same API:
```js
export function KpiCard({ label, value, sub, tc = TC_LIGHT, valueColor, hero = false }) {
  return <_KpiCard label={label} value={value} sub={sub} tc={tc} valueColor={valueColor} hero={hero} />;
}
```

This keeps `PublicMarketsSummarySection.jsx` and `PMPositionDetail.jsx` working without changing their imports.

- [ ] **Step 2: Add hero to first KpiCard in PublicMarketsSummarySection.jsx**

In `src/components/publicMarkets/PublicMarketsSummarySection.jsx`, change the first KpiCard:
```js
<KpiCard label="Total Patrimoni" value={fmtM(total)} sub="Mercats Públics" tc={tc} hero />
```

Leave the remaining five KpiCard calls unchanged.

- [ ] **Step 3: Add SectionHeader to PublicMarketsSummarySection.jsx**

Add `SectionHeader` import:
```js
import { AREA_COLORS, KpiCard, MGR_COLORS, pctFmt } from "./PublicMarketsShared.jsx";
import { SectionHeader, tableCardStyle } from "../SharedComponents.jsx";
```

Then read the file fully and add `<SectionHeader title="Resum" tc={tc} />` before the KPI row (`<div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>...`).

Also find any chart section headers (uppercase div labels above chart containers) and replace with SectionHeader.

- [ ] **Step 4: Run verify**

```bash
npm run verify
```

Expected: all checks pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/publicMarkets/PublicMarketsShared.jsx src/components/publicMarkets/PublicMarketsSummarySection.jsx
git commit -m "feat(PublicMarkets): consolidate KpiCard, hero variant, SectionHeader"
```

---

### Task 5: CompanyDetail — hero KPI + SectionHeader

**Files:**
- Modify: `src/components/CompanyDetail.jsx`

Context: CompanyDetail imports `KpiCard` from SharedComponents (line 10). Has two rows of KPI cards (lines 320-337). First row: Ticket, TVPI, RVPI, DPI, Mesos operant. Second row (conditional): LTM metrics.

- [ ] **Step 1: Add SectionHeader and tableCardStyle to imports in CompanyDetail.jsx**

Find existing import:
```js
import { EditableCell, FlagImg, Logo, KpiCard } from "./SharedComponents.jsx";
```

Replace:
```js
import { EditableCell, FlagImg, Logo, KpiCard, SectionHeader, tableCardStyle } from "./SharedComponents.jsx";
```

- [ ] **Step 2: Add hero to first KpiCard (Investment KPIs row)**

In the first KPI row (Row 1 — Investment KPIs), make the first card hero:
```js
<KpiCard label="Ticket" value={fmtM(ticket)} tc={tc} hero />
```

Leave TVPI, RVPI, DPI, Mesos operant unchanged.

- [ ] **Step 3: Find and replace inline section headings with SectionHeader**

Read `CompanyDetail.jsx` fully. Find divs that act as section labels (uppercase, small font, textLight color). Common ones: "Inversió", "Métriques operatives", "Transaccions", "Mètriques" or similar. Replace each with `<SectionHeader title="…" tc={tc} />`.

- [ ] **Step 4: Wrap any data tables in tableCardStyle**

Find table containers and apply `tableCardStyle(tc)` to their wrapper divs. Add `overflowX: "auto"` for horizontal scroll.

- [ ] **Step 5: Run verify**

```bash
npm run verify
```

Expected: all checks pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/CompanyDetail.jsx
git commit -m "feat(CompanyDetail): hero KpiCard, SectionHeader, tableCardStyle"
```

---

### Task 6: PipelineFY26 — SectionHeader + tableCardStyle

**Files:**
- Modify: `src/components/PipelineFY26.jsx`

Context: PipelineFY26 does not use KpiCard. It has charts and a deal table. Badge is already imported and auto-upgraded. Read the file fully to find section labels and table containers.

- [ ] **Step 1: Add SectionHeader and tableCardStyle to imports**

Existing SharedComponents import:
```js
import { EmptyState, EditableCell } from "./SharedComponents.jsx";
```

Replace:
```js
import { EmptyState, EditableCell, SectionHeader, tableCardStyle } from "./SharedComponents.jsx";
```

- [ ] **Step 2: Replace section label divs with SectionHeader**

Read the file. Find uppercase label divs above chart sections or the pipeline table. For each one, replace with `<SectionHeader title="…" tc={TC} />`.

Common labels to look for: "Pipeline FY26", "Per Estratègia", "Per Geografi", "Deals en Estudi" or similar.

- [ ] **Step 3: Wrap the deal table in tableCardStyle**

Find the table container. Replace inline card style with `tableCardStyle(TC)`:
```js
<div style={{ ...tableCardStyle(TC), overflowX: "auto" }}>
  <table ...>
```

- [ ] **Step 4: Run verify**

```bash
npm run verify
```

Expected: all checks pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/PipelineFY26.jsx
git commit -m "feat(PipelineFY26): SectionHeader, tableCardStyle"
```

---

### Task 7: ResumTab + CompaniesIndex — SectionHeader + tableCardStyle

**Files:**
- Modify: `src/components/tabs/ResumTab.jsx`
- Modify: `src/components/CompaniesIndex.jsx`

Context:

**ResumTab** (`src/components/tabs/ResumTab.jsx`): Contains chart sections with inline label divs (e.g. "Capital Cridat vs. Retornat per Any Fiscal"). These act as chart headers and should become SectionHeader. No KpiCard exists here.

Current chart container header pattern in ResumTab (line 16-17):
```js
<div style={{ fontSize: 11, letterSpacing: "0.13em", color: tc.textLight, textTransform: "uppercase", marginBottom: 16, fontWeight: 600 }}>
  Capital Cridat vs. Retornat per Any Fiscal
</div>
```

**CompaniesIndex** (`src/components/CompaniesIndex.jsx`): Read the file. Likely has a table listing portfolio companies. Apply SectionHeader + tableCardStyle pattern.

- [ ] **Step 1: Update ResumTab imports**

Existing import:
```js
import { TC_LIGHT } from "../../theme.js";
```

Add SharedComponents import:
```js
import { TC_LIGHT } from "../../theme.js";
import { SectionHeader } from "../../components/SharedComponents.jsx";
```

Wait — ResumTab is inside `src/components/tabs/`, so the path is `../SharedComponents.jsx`:
```js
import { SectionHeader } from "../SharedComponents.jsx";
```

- [ ] **Step 2: Replace chart section label divs in ResumTab with SectionHeader**

For each uppercase label div (like "Capital Cridat vs. Retornat per Any Fiscal", "Capital Cridat per Tipus", "Capital Cridat per Estratègia"), replace:
```js
<div style={{ fontSize: 11, letterSpacing: "0.13em", color: tc.textLight, textTransform: "uppercase", marginBottom: 16, fontWeight: 600 }}>
  {title text}
</div>
```
With:
```js
<SectionHeader title="{title text}" tc={tc} />
```

Adjust `marginBottom` on the surrounding container if needed since SectionHeader includes its own `marginBottom: 14`.

- [ ] **Step 3: Update CompaniesIndex**

Read `src/components/CompaniesIndex.jsx` fully. Add `SectionHeader`, `tableCardStyle` to its SharedComponents import. Replace section label divs with SectionHeader. Wrap table containers with `tableCardStyle(tc)`.

- [ ] **Step 4: Run verify**

```bash
npm run verify
```

Expected: all checks pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/tabs/ResumTab.jsx src/components/CompaniesIndex.jsx
git commit -m "feat(ResumTab, CompaniesIndex): SectionHeader, tableCardStyle"
```

---

### Task 8: PMPositionDetail — hero KPI

**Files:**
- Modify: `src/components/PMPositionDetail.jsx`

Context: PMPositionDetail imports `KpiCard` from PublicMarketsShared.jsx (which after Task 4 now delegates to SharedComponents KpiCard). Read the file to find the KPI strip and add `hero` to the first card.

- [ ] **Step 1: Read PMPositionDetail.jsx**

Read the full file. Find the KPI strip (likely `display: "flex", gap:` container with multiple KpiCard calls). Identify the first card (likely "Patrimoni" or similar).

- [ ] **Step 2: Add hero to first KpiCard**

Make the first KpiCard hero. The `hero` prop is accepted by the PublicMarketsShared re-export after Task 4. Leave all other KpiCards unchanged.

- [ ] **Step 3: Add SectionHeader for any section labels**

Read the file and replace any uppercase label divs that act as section headings with SectionHeader. Import `SectionHeader` from `../SharedComponents.jsx`.

- [ ] **Step 4: Run verify**

```bash
npm run verify
```

Expected: all checks pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/PMPositionDetail.jsx
git commit -m "feat(PMPositionDetail): hero KpiCard, SectionHeader"
```
