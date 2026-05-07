# Recallable Capital Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add recallable/non-recallable tracking to distributions and a per-fund recallable pool that capital calls can optionally draw from.

**Architecture:** Three new nullable columns on `capital_calls` (`recallable`, `non_recallable`, `from_recallable`). The pool is computed on the fly as `SUM(recallable for distributions) − SUM(from_recallable for capital calls)` per fund. Conditional fields are shown in `AddRowModal` via a new `visible` prop. `FundDetail` gains a pool KPI chip and a Recallable column in the transactions table.

**Tech Stack:** React, Supabase (PostgreSQL), existing `AddRowModal` component, `buildFundDetailSnapshot` model.

---

## File Map

| File | Change |
|---|---|
| `supabase/migrations/<timestamp>_recallable_capital.sql` | Create — new migration adding 3 columns |
| `supabase/schema.sql` | Modify — add 3 columns to `capital_calls` definition |
| `src/components/SharedComponents.jsx` | Modify — add `visible` prop support to `AddRowModal` |
| `src/data/fundDetailModel.js` | Modify — expose `recallablePool` in snapshot |
| `src/db.js` | Modify — pass through new fields in `insertCapitalCall` / `updateCapitalCall` |
| `src/components/Dashboard.jsx` | Modify — add conditional fields + save-time validation/derivation |
| `src/components/FundDetail.jsx` | Modify — add recallable pool KPI chip + table column |

---

## Task 1: DB Migration

**Files:**
- Create: `supabase/migrations/20260424000000_recallable_capital.sql`
- Modify: `supabase/schema.sql`

- [ ] **Step 1: Create migration file**

```sql
-- supabase/migrations/20260424000000_recallable_capital.sql
ALTER TABLE capital_calls ADD COLUMN IF NOT EXISTS recallable NUMERIC;
ALTER TABLE capital_calls ADD COLUMN IF NOT EXISTS non_recallable NUMERIC;
ALTER TABLE capital_calls ADD COLUMN IF NOT EXISTS from_recallable NUMERIC;
```

- [ ] **Step 2: Update schema.sql to match**

In `supabase/schema.sql`, replace the `capital_calls` CREATE TABLE block (lines 18–32):

```sql
CREATE TABLE IF NOT EXISTS capital_calls (
  id      BIGSERIAL PRIMARY KEY,
  vehicle_id TEXT REFERENCES private_entities(id) ON UPDATE CASCADE ON DELETE SET NULL,
  fons    TEXT,
  tipus   TEXT,
  cat     TEXT,
  data    TEXT,
  mes     INTEGER,
  year    INTEGER,
  fy      TEXT,
  vcpe    TEXT,
  est     TEXT,
  eur     NUMERIC,
  divisa  TEXT,
  recallable      NUMERIC,
  non_recallable  NUMERIC,
  from_recallable NUMERIC
);
```

- [ ] **Step 3: Apply migration in Supabase SQL editor**

Run the migration file contents in the Supabase project SQL editor. Verify by running:
```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'capital_calls'
  AND column_name IN ('recallable','non_recallable','from_recallable');
```
Expected: 3 rows returned.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260424000000_recallable_capital.sql supabase/schema.sql
git commit -m "feat: add recallable/non_recallable/from_recallable columns to capital_calls"
```

---

## Task 2: AddRowModal — `visible` prop

**Files:**
- Modify: `src/components/SharedComponents.jsx:369–508`

The `AddRowModal` renders all fields unconditionally. We need to support an optional `visible: (values) => bool` function on field definitions so conditional fields can be shown/hidden as form values change.

- [ ] **Step 1: Add `visible` filtering to the fields render loop**

In `src/components/SharedComponents.jsx`, inside `AddRowModal`, locate the `fields.map(f => (...))` block (line 408). Replace the outer `.map` with a `.filter` + `.map`:

```jsx
{fields.filter(f => !f.visible || f.visible(values)).map(f => (
  <div key={f.key}>
    {/* ... existing label + input rendering unchanged ... */}
  </div>
))}
```

The full block after the change (lines 408–487) becomes:

```jsx
{fields.filter(f => !f.visible || f.visible(values)).map(f => (
  <div key={f.key}>
    <label style={{ fontSize: 11, fontWeight: 600, color: tc.textLight,
      letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 4 }}>
      {f.label}
    </label>
    {f.type === "select" ? (
      <select value={values[f.key]} onChange={e => set(f.key, e.target.value)} style={inp}>
        {(f.options ?? []).map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    ) : f.type === "combo" ? (
      <div style={{ display: "flex", gap: 8 }}>
        {!customOpen[f.key] ? (
          <>
            <select
              value={(f.options ?? []).includes(values[f.key]) ? values[f.key] : ""}
              onChange={e => {
                if (e.target.value === "__custom__") {
                  setCustom(f.key, true);
                } else {
                  set(f.key, e.target.value);
                }
              }}
              style={{ ...inp, flex: 1 }}
            >
              <option value="" disabled>{f.placeholder ?? "Selecciona una opció"}</option>
              {(f.options ?? []).map(o => <option key={o} value={o}>{o}</option>)}
              <option value="__custom__">+ Nou valor…</option>
            </select>
            {values[f.key] && !(f.options ?? []).includes(values[f.key]) ? (
              <button
                type="button"
                onClick={() => setCustom(f.key, true)}
                style={{ padding: "0 12px", borderRadius: 6, border: `1.5px solid ${tc.border}`, background: "transparent", color: tc.textMid, cursor: "pointer", fontFamily: "inherit" }}
              >
                Edita
              </button>
            ) : null}
          </>
        ) : (
          <>
            <input
              type="text"
              value={values[f.key]}
              onChange={e => set(f.key, e.target.value)}
              placeholder={f.placeholder ?? ""}
              style={{ ...inp, flex: 1 }}
            />
            <button
              type="button"
              onClick={() => setCustom(f.key, false)}
              style={{ padding: "0 12px", borderRadius: 6, border: `1.5px solid ${tc.border}`, background: "transparent", color: tc.textMid, cursor: "pointer", fontFamily: "inherit" }}
            >
              Llista
            </button>
          </>
        )}
      </div>
    ) : f.type === "datalist" ? (
      <>
        <input
          type="text"
          value={values[f.key]}
          onChange={e => set(f.key, e.target.value)}
          placeholder={f.placeholder ?? ""}
          list={`addrow-${f.key}`}
          style={inp}
        />
        <datalist id={`addrow-${f.key}`}>
          {(f.options ?? []).map(o => <option key={o} value={o} />)}
        </datalist>
      </>
    ) : (
      <input type={f.type ?? "text"} value={values[f.key]}
        onChange={e => set(f.key, e.target.value)}
        placeholder={f.placeholder ?? ""}
        style={inp} />
    )}
  </div>
))}
```

- [ ] **Step 2: Verify invisible fields don't break initialisation**

The `useState` initialiser sets all field keys including hidden ones — that is correct, hidden fields still hold their value. No change needed.

- [ ] **Step 3: Commit**

```bash
git add src/components/SharedComponents.jsx
git commit -m "feat: add visible prop to AddRowModal for conditional field display"
```

---

## Task 3: Fund Detail Model — recallable pool

**Files:**
- Modify: `src/data/fundDetailModel.js`

- [ ] **Step 1: Add pool calculation and expose it**

In `buildFundDetailSnapshot`, after the existing `const dist = ...` line (line 37), add:

```js
const recallablePool = txs.reduce((sum, row) => {
  if ((row.cat === "Distribució" || row.cat === "Retorn Capital") && row.recallable) {
    return sum + Number(row.recallable);
  }
  if (row.cat === "Capital Call" && row.from_recallable) {
    return sum - Number(row.from_recallable);
  }
  return sum;
}, 0);
```

Then add `recallablePool` to the returned object (line 51–66):

```js
return {
  txs,
  txLog,
  fundName,
  fundId,
  vcpe,
  est,
  compromis,
  calls,
  dist,
  net,
  utilPct,
  tvpiFund,
  dpiFund,
  rvpiFund,
  recallablePool,
};
```

- [ ] **Step 2: Commit**

```bash
git add src/data/fundDetailModel.js
git commit -m "feat: compute recallablePool in buildFundDetailSnapshot"
```

---

## Task 4: DB layer — pass through new fields

**Files:**
- Modify: `src/db.js:703–748`

- [ ] **Step 1: Update `insertCapitalCall` to include new fields**

In the `row` object inside `insertCapitalCall` (lines 709–722), add the three new fields:

```js
const row = {
  vehicle_id: resolved.id,
  fons: resolved.canonicalName,
  tipus: normalizeCapitalCallTipus(cc.tipus) ?? null,
  cat: cc.cat,
  data: cc.data,
  mes,
  year,
  fy,
  vcpe: cc.vcpe ?? null,
  est: cc.est ?? null,
  eur: cc.eur,
  divisa: cc.divisa ?? "EUR",
  recallable: cc.recallable != null ? Number(cc.recallable) : null,
  non_recallable: cc.non_recallable != null ? Number(cc.non_recallable) : null,
  from_recallable: cc.from_recallable != null ? Number(cc.from_recallable) : null,
};
```

- [ ] **Step 2: `updateCapitalCall` already spreads `fields` into updates**

`updateCapitalCall` at line 731 does `const updates = { ...fields }` — no change needed. The three new fields will be passed through automatically as long as they appear in the `fields` object supplied by the caller.

- [ ] **Step 3: Commit**

```bash
git add src/db.js
git commit -m "feat: pass recallable/non_recallable/from_recallable through insertCapitalCall"
```

---

## Task 5: Dashboard modals — conditional fields + validation

**Files:**
- Modify: `src/components/Dashboard.jsx:545–579`

This task adds:
1. Recallable/non_recallable fields on distribution modals (visible when `cat === "Distribució"`)
2. `from_recallable` field on capital call modals (visible when `cat === "Capital Call"`)
3. A per-fund recallable pool computed from `rawCC` for use as a hint

- [ ] **Step 1: Compute per-fund recallable pool map**

Near the top of the Dashboard component (after `rawCC` is available, alongside other `useMemo` computations), add:

```js
const recallablePoolByFund = useMemo(() => {
  const map = {};
  for (const r of rawCC) {
    const fund = r.fons;
    if (!fund) continue;
    if (!map[fund]) map[fund] = 0;
    if ((r.cat === "Distribució" || r.cat === "Retorn Capital") && r.recallable) {
      map[fund] += Number(r.recallable);
    }
    if (r.cat === "Capital Call" && r.from_recallable) {
      map[fund] -= Number(r.from_recallable);
    }
  }
  return map;
}, [rawCC]);
```

- [ ] **Step 2: Update the Add modal field list**

Replace the current `fields` array passed to the Add `AddRowModal` (lines 548–557) with:

```js
fields={[
  { key: "fons", label: "Vehicle", type: "combo", options: ccNameOptions, defaultValue: ccAddModalFons },
  { key: "tipus", label: "Tipus Moviment", type: "combo", options: ccTipusOptions, defaultValue: ccAddModalDefaults?.tipus ?? "" },
  { key: "cat", label: "Categoria", type: "select", options: ["Capital Call", "Distribució", "Retorn Capital", "Compromís", "Altres"], defaultValue: ccAddModalDefaults?.cat ?? "Capital Call" },
  { key: "data", label: "Data", type: "date", defaultValue: new Date().toISOString().slice(0, 10) },
  { key: "eur", label: "Import EUR", type: "number" },
  { key: "divisa", label: "Divisa", type: "select", options: ["EUR", "USD"], defaultValue: "EUR" },
  { key: "vcpe", label: "VCPE", type: "select", options: ["PE", "VC", "RE", "SF", "PC"], defaultValue: ccAddModalDefaults?.vcpe ?? "PE" },
  { key: "est", label: "Estratègia", type: "select", options: ["Fons Primari", "Fons de Fons", "Directe", "SOCIMI"], defaultValue: ccAddModalDefaults?.est ?? "Fons Primari" },
  { key: "recallable", label: "Recallable (€)", type: "number", visible: v => v.cat === "Distribució" },
  { key: "non_recallable", label: "No Recallable (€)", type: "number", visible: v => v.cat === "Distribució" },
  {
    key: "from_recallable",
    label: `Des de pool recallable (€) — disponible: ${fmtM(recallablePoolByFund[ccAddModalFons] ?? 0)}`,
    type: "number",
    visible: v => v.cat === "Capital Call",
  },
]}
```

- [ ] **Step 3: Update the Edit modal field list**

Replace the current `fields` array in the Edit `AddRowModal` (lines 566–575) with:

```js
fields={[
  { key: "fons", label: "Vehicle", type: "text", defaultValue: ccEditModalRow.fons, disabled: true },
  { key: "tipus", label: "Tipus Moviment", type: "combo", options: ccTipusOptions, defaultValue: ccEditModalRow.tipus },
  { key: "cat", label: "Categoria", type: "select", options: ["Capital Call", "Distribució", "Retorn Capital", "Compromís", "Altres"], defaultValue: ccEditModalRow.cat },
  { key: "data", label: "Data", type: "date", defaultValue: ccEditModalRow.data },
  { key: "eur", label: "Import EUR", type: "number", defaultValue: ccEditModalRow.eur },
  { key: "divisa", label: "Divisa", type: "select", options: ["EUR", "USD"], defaultValue: ccEditModalRow.divisa },
  { key: "vcpe", label: "VCPE", type: "select", options: ["PE", "VC", "RE", "SF", "PC"], defaultValue: ccEditModalRow.vcpe },
  { key: "est", label: "Estratègia", type: "select", options: ["Fons Primari", "Fons de Fons", "Directe", "SOCIMI"], defaultValue: ccEditModalRow.est },
  { key: "recallable", label: "Recallable (€)", type: "number", defaultValue: ccEditModalRow.recallable ?? "", visible: v => v.cat === "Distribució" },
  { key: "non_recallable", label: "No Recallable (€)", type: "number", defaultValue: ccEditModalRow.non_recallable ?? "", visible: v => v.cat === "Distribució" },
  {
    key: "from_recallable",
    label: `Des de pool recallable (€) — disponible: ${fmtM(recallablePoolByFund[ccEditModalRow.fons] ?? 0)}`,
    type: "number",
    defaultValue: ccEditModalRow.from_recallable ?? "",
    visible: v => v.cat === "Capital Call",
  },
]}
```

- [ ] **Step 4: Add validation + auto-derivation in the Add modal's onSave**

The current `onSave` for the Add modal is `d.handleCCInsert`. That function calls `insertCapitalCall` directly. We need to wrap it to:
- If cat is "Distribució" and both recallable and non_recallable are provided, validate they sum to eur.
- If cat is "Distribució" and only recallable is provided, auto-fill non_recallable.

Replace `onSave={d.handleCCInsert}` with:

```jsx
onSave={(values, setError) => {
  if (values.cat === "Distribució" && values.recallable !== "" && values.recallable != null) {
    const rec = Number(values.recallable);
    const nonRec = values.non_recallable !== "" && values.non_recallable != null
      ? Number(values.non_recallable)
      : Number(values.eur) - rec;
    const total = rec + nonRec;
    if (Math.abs(total - Number(values.eur)) > 0.01) {
      setError(`Recallable (${rec}) + No recallable (${nonRec}) = ${total}, però l'import total és ${values.eur}`);
      return;
    }
    d.handleCCInsert({ ...values, non_recallable: nonRec }, setError);
  } else {
    d.handleCCInsert(values, setError);
  }
}}
```

- [ ] **Step 5: Add same validation for the Edit modal's onSave**

Replace the edit `onSave`:

```jsx
onSave={(values, setError) => {
  if (values.cat === "Distribució" && values.recallable !== "" && values.recallable != null) {
    const rec = Number(values.recallable);
    const nonRec = values.non_recallable !== "" && values.non_recallable != null
      ? Number(values.non_recallable)
      : Number(values.eur) - rec;
    const total = rec + nonRec;
    if (Math.abs(total - Number(values.eur)) > 0.01) {
      setError(`Recallable (${rec}) + No recallable (${nonRec}) = ${total}, però l'import total és ${values.eur}`);
      return;
    }
    d.handleCCUpdate(ccEditModalRow._rowId, { ...values, non_recallable: nonRec }, setError);
  } else {
    d.handleCCUpdate(ccEditModalRow._rowId, values, setError);
  }
}}
```

- [ ] **Step 6: Commit**

```bash
git add src/components/Dashboard.jsx
git commit -m "feat: conditional recallable fields in capital call add/edit modals"
```

---

## Task 6: FundDetail — pool KPI + table column

**Files:**
- Modify: `src/components/FundDetail.jsx:50,117–124,215–254`

- [ ] **Step 1: Destructure recallablePool from detail**

On line 50, add `recallablePool` to the destructure:

```js
const { fundName, fundId, vcpe, est, compromis, calls, dist, net, utilPct, tvpiFund, dpiFund, rvpiFund, txLog, recallablePool } = detail;
```

- [ ] **Step 2: Add recallable pool KPI chip**

In the KPI cards section (lines 117–124), add a new `KpiCard` after the existing ones, only when the pool is non-zero:

```jsx
<KpiCard label="Compromís"      value={compromis ? fmtM(compromis) : "—"} tc={tc} />
<KpiCard label="Capital Cridat" value={fmtM(calls)} sub={utilPct ? `${utilPct} del compromís` : null} tc={tc} />
<KpiCard label="Distribucions"  value={dist ? fmtM(dist) : "—"} tc={tc} />
<KpiCard label="Net"            value={(net >= 0 ? "+" : "") + fmtM(net)} tc={tc} />
<KpiCard label="TVPI" value={formatMultiple(tvpiFund)} sub="Inputat manualment" valueColor={multipleColor(tvpiFund, tc)} tc={tc} />
<KpiCard label="DPI"  value={formatMultiple(dpiFund)}  valueColor={multipleColor(dpiFund, tc)}  tc={tc} />
<KpiCard label="RVPI" value={formatMultiple(rvpiFund)} valueColor={multipleColor(rvpiFund, tc)} tc={tc} />
{recallablePool > 0 && (
  <KpiCard label="Pool Recallable" value={fmtM(recallablePool)} valueColor={tc.green} tc={tc} />
)}
```

- [ ] **Step 3: Add "Recallable" column header**

In the transactions table `<thead>` (line 223), replace the headers array:

```jsx
{["Data", "Tipus", "Categoria", "Import", "Recallable"].map(h => (
  <th key={h} style={{ padding: "10px 12px", textAlign: h === "Import" || h === "Recallable" ? "right" : "left", fontSize: 11, letterSpacing: "0.08em", color: tc.textLight, textTransform: "uppercase", fontWeight: 600 }}>{h}</th>
))}
```

- [ ] **Step 4: Add filter input for the Recallable column**

After the existing 4 filter `<th>` cells (lines 228–232), add a fifth empty one to maintain column alignment:

```jsx
<th style={{ padding: "6px 12px" }} />
```

- [ ] **Step 5: Add Recallable cell to each row**

In the `<tbody>` row render (lines 235–251), add a fifth `<td>` after the Import cell:

```jsx
<td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "'DM Mono',monospace", fontSize: 11, color: tc.textLight }}>
  {(r.cat === "Distribució" || r.cat === "Retorn Capital") && r.recallable != null
    ? `${fmtM(r.recallable)} rec / ${fmtM(r.non_recallable ?? 0)} no rec`
    : r.cat === "Capital Call" && r.from_recallable
    ? `${fmtM(r.from_recallable)} del pool`
    : "—"}
</td>
```

- [ ] **Step 6: Commit**

```bash
git add src/components/FundDetail.jsx
git commit -m "feat: recallable pool KPI and Recallable column in FundDetail"
```

---

## Task 7: Manual QA

- [ ] **Step 1: Add a distribution with recallable split**
  - Open a fund detail, click Add movement
  - Set cat = "Distribució", eur = 100000
  - Enter recallable = 60000, non_recallable = 40000
  - Save → verify row appears in transactions table with "€60K rec / €40K no rec" in Recallable column
  - Verify "Pool Recallable" KPI chip appears showing €60K

- [ ] **Step 2: Test validation**
  - Try saving with recallable = 70000 and non_recallable = 40000 (sum ≠ total)
  - Verify error message appears

- [ ] **Step 3: Test auto-derivation**
  - Add distribution with recallable = 60000, leave non_recallable empty
  - Verify saves successfully with non_recallable auto-filled as 40000

- [ ] **Step 4: Add a capital call drawing from pool**
  - Add a capital call for the same fund
  - Verify the "Des de pool recallable" field appears with "disponible: €60K" hint
  - Enter from_recallable = 20000, save
  - Verify row shows "€20K del pool" in Recallable column
  - Verify Pool Recallable KPI updates to €40K

- [ ] **Step 5: Test edit modal**
  - Edit the distribution row → verify recallable/non_recallable fields pre-fill correctly
  - Edit the capital call row → verify from_recallable pre-fills correctly
