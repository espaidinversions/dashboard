# Superuser Inline Editing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow superusers (role set in Supabase user metadata) to edit all dashboard data inline and create/delete entries, while regular users remain read-only.

**Architecture:** `isSuperuser` is derived from `session.user.user_metadata.role` in `auth.jsx` and exposed via `useAuth()`. Each component reads `isSuperuser` directly from the hook and passes `disabled={!isSuperuser}` to `EditableCell`, or conditionally renders edit controls. New shared components (`DeleteRowButton`, `AddRowModal`) are added to `SharedComponents.jsx`. All DB mutations go through `db.js`.

**Tech Stack:** React, Supabase JS client (`@supabase/supabase-js`), localStorage (keys: `tc_rawCC`, `tc_fundMeta`, `tc_portfolioCompanies`, `tc_allSearchers`), existing `EditableCell` in `SharedComponents.jsx`.

**Spec:** `docs/superpowers/specs/2026-03-20-superuser-inline-editing-design.md`

---

## File Map

| File | Change |
|---|---|
| `src/auth.jsx` | Add `isSuperuser` to context value |
| `src/db.js` | Fix mappings; add insert/delete/upsert functions; update `upsertSearcher` |
| `src/components/SharedComponents.jsx` | Fix `EditableCell` (disabled + Escape on select); add `DeleteRowButton`; add `AddRowModal` |
| `src/components/FundsIndex.jsx` | Wire disabled; convert rawCC to useState; add fund creation form + delete |
| `src/components/PipelineFY26.jsx` | Remove fetch useEffect; gate controls; replace add() with async insertPipelineDeal |
| `src/components/PortfolioCompaniesTab.jsx` | EditableCell on all fields; AddRowModal; DeleteRowButton |
| `src/components/SearchersTab.jsx` | EditableCell on historicData table; AddRowModal; DeleteRowButton |
| `src/components/CompanyDetail.jsx` | Load from localStorage; EditableCell on quarterly KPIs; add quarter form |

---

## Task 1: Schema migration + `isSuperuser` in auth

**Files:**
- Modify: `supabase/schema.sql` (add migration SQL as comments)
- Modify: `src/auth.jsx`

- [ ] **Step 1: Run schema migration in Supabase SQL editor**

Open Supabase dashboard → SQL editor → run:

```sql
-- Make pipeline.id auto-increment
ALTER TABLE pipeline ALTER COLUMN id SET DATA TYPE BIGINT;
CREATE SEQUENCE IF NOT EXISTS pipeline_id_seq;
ALTER TABLE pipeline ALTER COLUMN id SET DEFAULT nextval('pipeline_id_seq');
ALTER SEQUENCE pipeline_id_seq OWNED BY pipeline.id;
SELECT setval('pipeline_id_seq', COALESCE((SELECT MAX(id) FROM pipeline), 0) + 1);

-- Add estimatedClosing column
ALTER TABLE pipeline ADD COLUMN IF NOT EXISTS estimated_closing TEXT;

-- Unique constraint on searchers.nom
ALTER TABLE searchers ADD CONSTRAINT searchers_nom_unique UNIQUE (nom);
```

Expected: all statements complete with no errors.

- [ ] **Step 2: Add `isSuperuser` to `src/auth.jsx`**

Open `src/auth.jsx`. Find the `AuthContext.Provider` value and add `isSuperuser`:

```jsx
// Before (line ~20):
<AuthContext.Provider value={{ session, signIn, signOut }}>

// After:
const isSuperuser = session?.user?.user_metadata?.role === "superuser";
<AuthContext.Provider value={{ session, signIn, signOut, isSuperuser }}>
```

- [ ] **Step 3: Verify in browser**

Start dev server (`npm run dev`). Log in. Open browser console and run:
```js
// Should print true if your account has role="superuser", false otherwise
```
No errors in console. Proceed to grant yourself superuser: Supabase dashboard → Authentication → Users → click your user → Edit → User Metadata → set `{"role": "superuser"}` → Save.

- [ ] **Step 4: Commit**

```bash
git add src/auth.jsx supabase/schema.sql
git commit -m "feat: add isSuperuser to auth context + pipeline schema migration"
```

---

## Task 2: Fix `db.js` mappings + new DB functions

**Files:**
- Modify: `src/db.js`

- [ ] **Step 1: Fix `rowToCompany` — add `id`**

Find `rowToCompany` (line ~20) and add `id: r.id` as the first field:

```js
function rowToCompany(r) {
  return {
    id: r.id,       // ← ADD THIS
    nom: r.nom, tipus: r.tipus, segment: r.segment,
    entrepreneurs: r.entrepreneurs, origen: r.origen, geo: r.geo,
    ticket: r.ticket, tvpi: r.tvpi,
    rvpiEur: r.rvpi_eur, dpiEur: r.dpi_eur,
    rev: r.rev, ebitda: r.ebitda, dfn: r.dfn,
    grossEV: r.gross_ev, multEntry: r.mult_entry,
    dataCompr: r.data_compr, mesosOperant: r.mesos_operant,
    isMock: r.is_mock,
    quarters: r.quarters ?? [],
  };
}
```

- [ ] **Step 2: Fix `rowToSearcher` — add `id`**

Find `rowToSearcher` (line ~46) and add `id: r.id` as first field:

```js
function rowToSearcher(r) {
  return {
    id: r.id,       // ← ADD THIS
    nom: r.nom, tipus: r.tipus, modalitat: r.modalitat, geo: r.geo,
    statusScreening: r.status_screening, formEntrada: r.form_entrada,
    introPer: r.intro_per, searcher1: r.searcher1 || "", searcher2: r.searcher2 || "",
    escola1: r.escola1 || "", escola2: r.escola2 || "",
    ticket: r.ticket, dataInici: r.data_inici,
    dataCompr: r.data_compr, mesosCercant: r.mesos_cercant,
    equityStake: r.equity_stake, isMock: r.is_mock ?? false,
  };
}
```

- [ ] **Step 3: Fix `loadAll` — add `estimatedClosing` to pipeline mapping**

Find line 73 (the `funds0` mapping) and add `estimatedClosing`:

```js
funds0: pl.data.map(r => ({
  id: r.id, name: r.name, amount: r.amount, currency: r.currency,
  geography: r.geography, strategy: r.strategy, sector: r.sector,
  status: r.status, canal: r.canal, active: r.active,
  estimatedClosing: r.estimated_closing ?? null,   // ← ADD THIS
})),
```

- [ ] **Step 4: Add `dealToRow` / `rowToDeal` helper functions**

Add after `rowToSearcher` (before the `// ── Load all` comment):

```js
function dealToRow(d) {
  return {
    name: d.name, amount: d.amount, currency: d.currency,
    geography: d.geography, strategy: d.strategy, sector: d.sector,
    status: d.status, canal: d.canal, active: d.active ?? true,
    estimated_closing: d.estimatedClosing ?? null,
  };
}

function rowToDeal(r) {
  return {
    id: r.id, name: r.name, amount: r.amount, currency: r.currency,
    geography: r.geography, strategy: r.strategy, sector: r.sector,
    status: r.status, canal: r.canal, active: r.active,
    estimatedClosing: r.estimated_closing ?? null,
  };
}
```

- [ ] **Step 5: Fix `upsertSearcher` — use `id` directly**

Replace the current `upsertSearcher` implementation with a direct id-based update:

```js
export async function upsertSearcher(searcher) {
  if (!supabase) return;
  await supabase.from("searchers")
    .update(searcherToRow(searcher))
    .eq("id", searcher.id);
}
```

- [ ] **Step 6: Add insert functions**

Append to `src/db.js` after `upsertSearcher`:

```js
// ── Insert (single-row, returns row with DB-assigned id) ──

export async function insertCompany(company) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("portfolio_companies")
    .insert(companyToRow(company))
    .select()
    .single();
  if (error) { console.error(error); return null; }
  return rowToCompany(data);
}

export async function insertSearcher(searcher) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("searchers")
    .insert(searcherToRow(searcher))
    .select()
    .single();
  if (error) { console.error(error); return null; }
  return rowToSearcher(data);
}

export async function insertPipelineDeal(deal) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("pipeline")
    .insert(dealToRow(deal))
    .select()
    .single();
  if (error) { console.error(error); return null; }
  return rowToDeal(data);
}

export async function insertFund(fons, vcpe, est, compromisEur, divisa) {
  if (!supabase) return null;
  const { MESOS } = await import("./config.js");
  const now  = new Date();
  const mes  = MESOS[now.getMonth() + 1]; // MESOS is 1-indexed; index 0 = ""
  const year = now.getFullYear();
  const fy   = "FY " + year;
  const data_iso = now.toISOString().slice(0, 10);

  const { error: ccErr } = await supabase.from("capital_calls").insert({
    fons, vcpe, est, cat: "Compromís", eur: compromisEur, divisa,
    mes, year, fy, tipus: vcpe, data: data_iso,
  });
  if (ccErr) { console.error(ccErr); return null; }

  await supabase.from("fund_meta")
    .upsert({ fons, tvpi: null }, { onConflict: "fons" });

  // Return in rawCC shape (key `any`, not `year`)
  return { fons, vcpe, est, cat: "Compromís", eur: compromisEur, divisa, mes, any: year, fy, tipus: vcpe, data: data_iso };
}
```

- [ ] **Step 7: Add delete + upsertPipelineDeal functions**

Append after the insert functions:

```js
// ── Delete ────────────────────────────────────────────────

export async function deleteCompany(id) {
  if (!supabase) return;
  await supabase.from("portfolio_companies").delete().eq("id", id);
}

export async function deleteSearcher(id) {
  if (!supabase) return;
  await supabase.from("searchers").delete().eq("id", id);
}

export async function deletePipelineDeal(id) {
  if (!supabase) return;
  await supabase.from("pipeline").delete().eq("id", id);
}

export async function deleteFund(fons) {
  if (!supabase) return null;
  const { error: e1 } = await supabase.from("capital_calls").delete().eq("fons", fons);
  if (e1) return e1;
  const { error: e2 } = await supabase.from("fund_meta").delete().eq("fons", fons);
  return e2 ?? null;
}

// ── Upsert (pipeline) ─────────────────────────────────────

export async function upsertPipelineDeal(deal) {
  if (!supabase) return;
  await supabase.from("pipeline")
    .upsert({ id: deal.id, ...dealToRow(deal) }, { onConflict: "id" });
}
```

- [ ] **Step 8: Commit**

```bash
git add src/db.js
git commit -m "feat: fix db mappings (add id), add insert/delete/upsert functions"
```

---

## Task 3: Fix `SharedComponents.jsx` — EditableCell disabled + Escape on select; add DeleteRowButton + AddRowModal

**Files:**
- Modify: `src/components/SharedComponents.jsx`

- [ ] **Step 1: Add `disabled` prop and Escape handler on `<select>` to `EditableCell`**

Find the `EditableCell` function signature and the select branch:

```jsx
// Change signature from:
export function EditableCell({ value, onSave, type = "text", options, fmt, style = {}, align = "left" }) {

// To:
export function EditableCell({ value, onSave, type = "text", options, fmt, style = {}, align = "left", disabled = false }) {
```

Then after the `const display = ...` line (currently line ~143), replace the display `<span>` with:

```jsx
// Replace the display <span> return block:
if (disabled) {
  return (
    <span style={{ display: "block", textAlign: align, padding: "1px 2px", ...style }}>
      {display}
    </span>
  );
}

return (
  <span onClick={start} title="Fes clic per editar"
    style={{ cursor: "text", display: "block", textAlign: align,
      borderRadius: 3, padding: "1px 2px",
      transition: "background 0.1s",
      ...style,
    }}
    onMouseEnter={e => e.currentTarget.style.background = tc.bgAlt}
    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
    {display}
  </span>
);
```

Then add `onKeyDown` to the `<select>` branch (currently around line 125-131):

```jsx
if (editing && options) {
  return (
    <select ref={ref} value={draft} onChange={e => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === "Escape") setEditing(false); }}
      style={inputStyle}>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}
```

- [ ] **Step 2: Add `DeleteRowButton` component**

Add after the `EditableCell` export (before `EmptyState`):

```jsx
export function DeleteRowButton({ onDelete }) {
  const { tc } = useTheme();
  const [confirming, setConfirming] = useState(false);
  const containerRef = useRef(null);

  const handleBlur = (e) => {
    // Only cancel if focus moves outside the container
    if (!containerRef.current?.contains(e.relatedTarget)) {
      setConfirming(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Escape") setConfirming(false);
  };

  if (confirming) {
    return (
      <div ref={containerRef} tabIndex={-1} onBlur={handleBlur} onKeyDown={handleKeyDown}
        style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 11, color: tc.textMid }}>Eliminar?</span>
        <button onClick={onDelete}
          style={{ fontSize: 11, padding: "2px 8px", borderRadius: 5, border: "none",
            background: tc.red ?? "#C62828", color: "#fff", cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>
          Confirmar
        </button>
      </div>
    );
  }

  return (
    <button onClick={() => setConfirming(true)}
      style={{ background: "transparent", border: "none", cursor: "pointer",
        color: tc.textLight, fontSize: 14, padding: "2px 4px", lineHeight: 1 }}
      title="Eliminar fila">
      🗑
    </button>
  );
}
```

- [ ] **Step 3: Add `AddRowModal` component**

Add after `DeleteRowButton`:

```jsx
export function AddRowModal({ fields, onSave, onClose, title = "Nou registre" }) {
  const { tc } = useTheme();
  const [values, setValues] = useState(() =>
    Object.fromEntries(fields.map(f => [f.key, f.defaultValue ?? ""]))
  );
  const [error, setError] = useState(null);

  const set = (key, val) => setValues(v => ({ ...v, [key]: val }));

  const inp = {
    width: "100%", padding: "7px 10px", fontSize: 13,
    border: `1.5px solid ${tc.border}`, borderRadius: 7,
    background: tc.bg, color: tc.text, fontFamily: "inherit",
    outline: "none", boxSizing: "border-box",
  };

  const submit = (e) => {
    e.preventDefault();
    setError(null);
    onSave(values, setError);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex",
      alignItems: "center", justifyContent: "center", zIndex: 1000 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: tc.card, borderRadius: 14, padding: "28px 28px 24px",
        width: 420, maxWidth: "90vw", boxShadow: "0 8px 40px rgba(0,0,0,.25)",
        fontFamily: "'Outfit',system-ui,sans-serif" }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: tc.navy, marginBottom: 20 }}>{title}</div>
        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {fields.map(f => (
            <div key={f.key}>
              <label style={{ fontSize: 11, fontWeight: 600, color: tc.textLight,
                letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 4 }}>
                {f.label}
              </label>
              {f.type === "select" ? (
                <select value={values[f.key]} onChange={e => set(f.key, e.target.value)} style={inp}>
                  {(f.options ?? []).map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : (
                <input type={f.type ?? "text"} value={values[f.key]}
                  onChange={e => set(f.key, e.target.value)}
                  placeholder={f.placeholder ?? ""}
                  style={inp} />
              )}
            </div>
          ))}
          {error && (
            <div style={{ fontSize: 12, color: "#C62828", background: "#FDECEA",
              borderRadius: 7, padding: "8px 12px" }}>{error}</div>
          )}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
            <button type="button" onClick={onClose}
              style={{ padding: "8px 16px", borderRadius: 7, border: `1.5px solid ${tc.border}`,
                background: "transparent", color: tc.textMid, cursor: "pointer",
                fontFamily: "inherit", fontSize: 13 }}>
              Cancel·lar
            </button>
            <button type="submit"
              style={{ padding: "8px 16px", borderRadius: 7, border: "none",
                background: tc.navy, color: "#fff", cursor: "pointer",
                fontFamily: "inherit", fontSize: 13, fontWeight: 600 }}>
              Afegir
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verify in browser**

`npm run dev` — open any page. No console errors. EditableCell cells in FundsIndex TVPI column should still work.

- [ ] **Step 5: Commit**

```bash
git add src/components/SharedComponents.jsx
git commit -m "feat: EditableCell disabled+select Escape; add DeleteRowButton and AddRowModal"
```

---

## Task 4: `FundsIndex.jsx` — wire disabled, add fund creation + delete

**Files:**
- Modify: `src/components/FundsIndex.jsx`

- [ ] **Step 1: Import new hooks and db functions**

At the top of `FundsIndex.jsx`, add to imports:

```js
import { useAuth } from "../auth.jsx";
import { DeleteRowButton } from "./SharedComponents.jsx";
import { insertFund, deleteFund } from "../db.js";
```

- [ ] **Step 2: Wire `isSuperuser` and convert `rawCC` to `useState`**

Inside `FundsIndexInner`, add at the top:

```js
const { isSuperuser } = useAuth();
```

Replace the current `rawCC` useMemo (lines ~27-30):

```js
// Remove:
const rawCC = useMemo(() => {
  try { const s = localStorage.getItem("tc_rawCC"); return s ? JSON.parse(s) : RAW_CC_DEFAULT; }
  catch { return RAW_CC_DEFAULT; }
}, []);

// Add:
const [rawCC, setRawCC] = useState(() => {
  try { const s = localStorage.getItem("tc_rawCC"); return s ? JSON.parse(s) : RAW_CC_DEFAULT; }
  catch { return RAW_CC_DEFAULT; }
});

const persistRawCC = (updated) => {
  setRawCC(updated);
  try { localStorage.setItem("tc_rawCC", JSON.stringify(updated)); } catch {}
};
```

- [ ] **Step 3: Wire `disabled` on TVPI EditableCell**

Find the `EditableCell` for TVPI (~line 189) and add `disabled={!isSuperuser}`:

```jsx
<EditableCell value={r.tvpi} type="number" align="right"
  fmt={fmtX} onSave={v => saveTvpi(r.fons, v)}
  disabled={!isSuperuser} />
```

- [ ] **Step 4: Add delete handler and `DeleteRowButton` to each row**

Also add `loadAll` to the imports at the top of the file:

```js
import { insertFund, deleteFund, loadAll } from "../db.js";
```

Add a `handleDeleteFund` function after `saveTvpi`:

```js
const handleDeleteFund = async (fons) => {
  const err = await deleteFund(fons);
  if (err) {
    alert("Error en eliminar el fons: " + err.message);
    // Re-sync from DB to fix any partial state (capital_calls deleted but fund_meta survived)
    const data = await loadAll();
    if (data) {
      persistRawCC(data.rawCC);
      setFundMeta(data.fundMeta);
      try { localStorage.setItem("tc_fundMeta", JSON.stringify(data.fundMeta)); } catch {}
    }
    return;
  }
  const updatedCC = rawCC.filter(r => r.fons !== fons);
  persistRawCC(updatedCC);
  const updatedMeta = fundMeta.filter(m => m.fons !== fons);
  setFundMeta(updatedMeta);
  try { localStorage.setItem("tc_fundMeta", JSON.stringify(updatedMeta)); } catch {}
};
```

Add a delete column to `COLS`:

```js
// Add at end of COLS array:
{ k: "del", label: "", align: "center" },
```

Add `DeleteRowButton` in the row render after the RVPI cell:

```jsx
{isSuperuser && (
  <td style={{ padding: "4px 8px", textAlign: "center" }}>
    <DeleteRowButton onDelete={() => handleDeleteFund(r.fons)} />
  </td>
)}
```

Also add an empty `<th>` at the end of the header row when superuser:

```jsx
{isSuperuser && <th style={{ width: 40 }} />}
```

- [ ] **Step 5: Add "+ Nou fons" inline form**

Add state for the form at the top of `FundsIndexInner`:

```js
const [addingFund, setAddingFund] = useState(false);
const [newFund, setNewFund] = useState({ fons: "", vcpe: "PE", est: "Fons Primari", compromis: "", divisa: "EUR" });
```

Add `handleAddFund` after `handleDeleteFund`:

```js
const handleAddFund = async (e) => {
  e.preventDefault();
  if (!newFund.fons.trim()) return;
  const row = await insertFund(
    newFund.fons.trim(),
    newFund.vcpe,
    newFund.est,
    parseFloat(newFund.compromis) || 0,
    newFund.divisa,
  );
  if (!row) { alert("Error en crear el fons"); return; }
  persistRawCC([...rawCC, row]);
  setAddingFund(false);
  setNewFund({ fons: "", vcpe: "PE", est: "Fons Primari", compromis: "", divisa: "EUR" });
};
```

Add the form below the `</table>` closing tag (still inside the `padding: "24px 32px"` div):

```jsx
{isSuperuser && (
  <div style={{ marginTop: 16 }}>
    {!addingFund ? (
      <button onClick={() => setAddingFund(true)}
        style={{ background: "transparent", border: `1.5px dashed ${tc.border}`, borderRadius: 8,
          padding: "8px 16px", cursor: "pointer", fontSize: 12, color: tc.textMid,
          fontFamily: "inherit", fontWeight: 600 }}>
        + Nou fons
      </button>
    ) : (
      <form onSubmit={handleAddFund}
        style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end",
          background: tc.bgAlt, padding: 12, borderRadius: 10 }}>
        {[
          { label: "Nom", key: "fons", type: "text", placeholder: "Nom del fons" },
        ].map(f => (
          <div key={f.key}>
            <div style={{ fontSize: 10, color: tc.textLight, marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.06em" }}>{f.label}</div>
            <input value={newFund[f.key]} onChange={e => setNewFund(p => ({ ...p, [f.key]: e.target.value }))}
              placeholder={f.placeholder} style={{ padding: "6px 10px", borderRadius: 6, border: `1.5px solid ${tc.border}`, background: tc.bg, color: tc.text, fontSize: 13, fontFamily: "inherit", outline: "none" }} />
          </div>
        ))}
        {[
          { label: "Tipus", key: "vcpe", options: ["PE", "VC", "RE"] },
          { label: "Estructura", key: "est", options: ["Fons Primari", "Fons de Fons", "SOCIMI"] },
          { label: "Divisa", key: "divisa", options: ["EUR", "USD"] },
        ].map(f => (
          <div key={f.key}>
            <div style={{ fontSize: 10, color: tc.textLight, marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.06em" }}>{f.label}</div>
            <select value={newFund[f.key]} onChange={e => setNewFund(p => ({ ...p, [f.key]: e.target.value }))}
              style={{ padding: "6px 10px", borderRadius: 6, border: `1.5px solid ${tc.border}`, background: tc.bg, color: tc.text, fontSize: 13, fontFamily: "inherit", outline: "none" }}>
              {f.options.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
        ))}
        <div>
          <div style={{ fontSize: 10, color: tc.textLight, marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.06em" }}>Compromís (€)</div>
          <input type="number" value={newFund.compromis} onChange={e => setNewFund(p => ({ ...p, compromis: e.target.value }))}
            placeholder="0" style={{ padding: "6px 10px", borderRadius: 6, border: `1.5px solid ${tc.border}`, background: tc.bg, color: tc.text, fontSize: 13, fontFamily: "inherit", outline: "none", width: 100 }} />
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button type="submit"
            style={{ padding: "7px 14px", borderRadius: 6, border: "none", background: tc.navy, color: "#fff", cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 600 }}>
            Afegir
          </button>
          <button type="button" onClick={() => setAddingFund(false)}
            style={{ padding: "7px 14px", borderRadius: 6, border: `1.5px solid ${tc.border}`, background: "transparent", color: tc.textMid, cursor: "pointer", fontFamily: "inherit", fontSize: 12 }}>
            Cancel·lar
          </button>
        </div>
      </form>
    )}
  </div>
)}
```

- [ ] **Step 6: Verify**

Log in as superuser. Go to `/investments/funds`. TVPI cells should be click-to-edit. A "+ Nou fons" button should appear. Trash icons should appear per row. Log in as regular user — no edit affordances visible.

- [ ] **Step 7: Commit**

```bash
git add src/components/FundsIndex.jsx
git commit -m "feat: FundsIndex superuser editing — disabled TVPI, add fund, delete fund"
```

---

## Task 5: `PipelineFY26.jsx` — remove fetch useEffect, gate controls, replace add()

**Files:**
- Modify: `src/components/PipelineFY26.jsx`

- [ ] **Step 1: Read the current file to understand the structure**

Read `src/components/PipelineFY26.jsx`. Locate:
- The debounced `useEffect` that calls `fetch("/api/pipeline")` (around lines 54-60)
- The `add()` function (around line 126) that uses `Date.now()`
- The `del()` and `upd()` functions
- Where `EditCell` and `EditableSelect` are used in JSX

- [ ] **Step 2: Add imports**

At the top of `PipelineFY26.jsx`, add:

```js
import { useAuth } from "../auth.jsx";
import { insertPipelineDeal, deletePipelineDeal, upsertPipelineDeal } from "../db.js";
```

- [ ] **Step 3: Remove debounced fetch useEffect (do this FIRST)**

Find and delete the entire `useEffect` block that calls `fetch("/api/pipeline")`. It looks like:

```js
useEffect(() => {
  // ... debounce logic ...
  fetch("/api/pipeline", { method: "POST", ... })
  // ...
}, [funds]);
```

Delete it entirely. Do not add any replacement yet.

- [ ] **Step 4: Add `isSuperuser` and replace `add()`**

Add at the top of the component function:

```js
const { isSuperuser } = useAuth();
```

Replace the existing `add()` function with an async version:

```js
// Remove the old add() and replace with:
const add = async (nf) => {
  const deal = {
    name: nf.name, amount: parseFloat(nf.amount) || 0,
    currency: nf.currency, geography: nf.geography,
    strategy: nf.strategy, sector: nf.sector,
    status: nf.status, canal: nf.canal,
    active: true, estimatedClosing: nf.estimatedClosing ?? null,
  };
  const inserted = await insertPipelineDeal(deal);
  if (inserted) setFunds(p => [inserted, ...p]);
};
```

- [ ] **Step 5: Replace `del()` and `upd()` to use db functions**

```js
const del = async (id) => {
  await deletePipelineDeal(id);
  setFunds(p => p.filter(f => f.id !== id));
};

const upd = async (id, field, val) => {
  // Compute updated array first so we can read the new deal value (not stale closure)
  let updatedDeal = null;
  setFunds(p => {
    const next = p.map(f => {
      if (f.id !== id) return f;
      updatedDeal = { ...f, [field]: val };
      return updatedDeal;
    });
    return next;
  });
  // updatedDeal is set synchronously during the map above
  if (updatedDeal) await upsertPipelineDeal(updatedDeal);
};
```

- [ ] **Step 6: Gate all edit controls with `isSuperuser` using conditional rendering**

Find every `<EditCell .../>`, `<EditableSelect .../>`, and the delete `×` button in JSX. Wrap each with:

```jsx
{isSuperuser ? <EditCell .../> : <span style={{ display: "block" }}>{value}</span>}
```

Do the same for `<EditableSelect />`:

```jsx
{isSuperuser ? <EditableSelect .../> : <span>{value}</span>}
```

For the delete `×` button:

```jsx
{isSuperuser && <button onClick={() => del(f.id)} ...>×</button>}
```

For the "Afegir Fons" modal trigger button:

```jsx
{isSuperuser && <button onClick={() => setModal(true)} ...>+ Afegir fons</button>}
```

- [ ] **Step 7: Verify**

Open `/` dashboard → pipeline tab. As superuser: all fields editable, add/delete visible. As regular user: static text, no controls.

- [ ] **Step 8: Commit**

```bash
git add src/components/PipelineFY26.jsx
git commit -m "feat: PipelineFY26 superuser editing — remove fetch, gate controls, async add/del/upd"
```

---

## Task 6: `PortfolioCompaniesTab.jsx` — EditableCell on all fields, AddRowModal, DeleteRowButton

**Files:**
- Modify: `src/components/PortfolioCompaniesTab.jsx`

- [ ] **Step 1: Add imports**

```js
import { useAuth } from "../auth.jsx";
import { AddRowModal, DeleteRowButton } from "./SharedComponents.jsx";
import { upsertCompany, insertCompany, deleteCompany } from "../db.js";
```

- [ ] **Step 2: Add `isSuperuser` and modal state**

At the top of the component:

```js
const { isSuperuser } = useAuth();
const [showAddModal, setShowAddModal] = useState(false);
const [addError, setAddError] = useState(null);
```

- [ ] **Step 3: Add `handleAdd` and `handleDelete` (do NOT re-add `saveField` — it already exists in the file)**

```js
const handleAdd = async (values, setError) => {
  const nom = values.nom?.trim();
  if (!nom) { setError("El nom és obligatori"); return; }
  if (companies.some(c => c.nom === nom)) {
    setError("Ja existeix una empresa amb aquest nom");
    return;
  }
  const company = {
    nom, tipus: values.tipus || null, segment: values.segment || null,
    entrepreneurs: values.entrepreneurs || null, origen: values.origen || null,
    geo: values.geo || null, ticket: parseFloat(values.ticket) || null,
    tvpi: null, rvpiEur: null, dpiEur: null, rev: null, ebitda: null,
    dfn: null, grossEV: null, multEntry: null, dataCompr: null,
    mesosOperant: null, isMock: false, quarters: [],
  };
  const inserted = await insertCompany(company);
  if (!inserted) { setError("Error en crear l'empresa"); return; }
  const updated = [inserted, ...companies];
  setCompanies(updated);
  try { localStorage.setItem("tc_portfolioCompanies", JSON.stringify(updated)); } catch {}
  setShowAddModal(false);
};

const handleDelete = async (id, nom) => {
  await deleteCompany(id);
  const updated = companies.filter(c => c.nom !== nom);
  setCompanies(updated);
  try { localStorage.setItem("tc_portfolioCompanies", JSON.stringify(updated)); } catch {}
};
```

- [ ] **Step 4: Add "Nova participada" button**

Find the table header area and add (superuser only):

```jsx
{isSuperuser && (
  <button onClick={() => setShowAddModal(true)}
    style={{ padding: "7px 14px", borderRadius: 7, border: `1.5px solid ${tc.border}`,
      background: "transparent", color: tc.navy, cursor: "pointer",
      fontFamily: "inherit", fontSize: 12, fontWeight: 600 }}>
    + Nova participada
  </button>
)}
```

- [ ] **Step 5: Wrap displayed fields with EditableCell and add DeleteRowButton**

For each text/number field in the table rows, wrap the display value with `EditableCell`. Example pattern for the `nom` field:

```jsx
<td>
  <EditableCell value={r.nom} type="text"
    onSave={v => saveField(r.nom, "nom", v)}
    disabled={!isSuperuser} />
</td>
```

For numeric fields like `ticket`:

```jsx
<EditableCell value={r.ticket} type="number" align="right"
  fmt={v => v != null ? fmtM(v) : "—"}
  onSave={v => saveField(r.nom, "ticket", v)}
  disabled={!isSuperuser} />
```

Add a delete column at the end of each row:

```jsx
{isSuperuser && (
  <td style={{ padding: "4px 8px", textAlign: "center" }}>
    <DeleteRowButton onDelete={() => handleDelete(r.id, r.nom)} />
  </td>
)}
```

Add an empty `<th>` at the end of the header row when superuser.

- [ ] **Step 6: Add `AddRowModal` at component root**

```jsx
{showAddModal && (
  <AddRowModal
    title="Nova participada"
    fields={[
      { key: "nom", label: "Nom", type: "text", placeholder: "Nom de l'empresa" },
      { key: "tipus", label: "Tipus", type: "select", options: ["", "Searcher", "Direct", "Co-inversió"], defaultValue: "" },
      { key: "segment", label: "Segment", type: "text" },
      { key: "geo", label: "Geografia", type: "text", placeholder: "ES, FR, ..." },
      { key: "ticket", label: "Ticket (€M)", type: "number" },
    ]}
    onSave={handleAdd}
    onClose={() => setShowAddModal(false)}
  />
)}
```

- [ ] **Step 7: Verify**

As superuser: all company fields click-to-edit, "+ Nova participada" button visible, delete icons per row. Creating a company persists after page refresh.

- [ ] **Step 8: Commit**

```bash
git add src/components/PortfolioCompaniesTab.jsx
git commit -m "feat: PortfolioCompaniesTab superuser editing — inline edit, add, delete"
```

---

## Task 7: `SearchersTab.jsx` — EditableCell on historicData, AddRowModal, DeleteRowButton

**Files:**
- Modify: `src/components/SearchersTab.jsx`

- [ ] **Step 1: Add imports**

```js
import { useAuth } from "../auth.jsx";
import { AddRowModal, DeleteRowButton } from "./SharedComponents.jsx";
import { upsertSearcher, insertSearcher, deleteSearcher } from "../db.js";
```

- [ ] **Step 2: Add `isSuperuser` and modal state**

```js
const { isSuperuser } = useAuth();
const [showAddModal, setShowAddModal] = useState(false);
```

- [ ] **Step 3: Add `saveSearcherField`, `handleAddSearcher`, `handleDeleteSearcher`**

```js
const saveSearcherField = (id, field, value) => {
  const updated = historicData.map(s => s.id === id ? { ...s, [field]: value } : s);
  setHistoricData(updated);
  try { localStorage.setItem("tc_allSearchers", JSON.stringify(updated)); } catch {}
  const searcher = updated.find(s => s.id === id);
  if (searcher) upsertSearcher(searcher);
};

const handleAddSearcher = async (values, setError) => {
  const nom = values.nom?.trim();
  if (!nom) { setError("El nom és obligatori"); return; }
  if (historicData.some(s => s.nom === nom)) {
    setError("Ja existeix un searcher amb aquest nom");
    return;
  }
  const searcher = {
    nom, tipus: values.tipus || null, modalitat: values.modalitat || null,
    geo: values.geo || null, statusScreening: values.statusScreening || null,
    formEntrada: values.formEntrada || null, introPer: null,
    searcher1: null, searcher2: null, escola1: null, escola2: null,
    ticket: parseFloat(values.ticket) || null,
    dataInici: null, dataCompr: null, mesosCercant: null,
    equityStake: null, isMock: false,
  };
  const inserted = await insertSearcher(searcher);
  if (!inserted) { setError("Error en crear el searcher"); return; }
  const updated = [inserted, ...historicData];
  setHistoricData(updated);
  try { localStorage.setItem("tc_allSearchers", JSON.stringify(updated)); } catch {}
  setShowAddModal(false);
};

const handleDeleteSearcher = async (id) => {
  await deleteSearcher(id);
  const updated = historicData.filter(s => s.id !== id);
  setHistoricData(updated);
  try { localStorage.setItem("tc_allSearchers", JSON.stringify(updated)); } catch {}
};
```

- [ ] **Step 4: Add "Nou searcher" button**

Near the historic table section header:

```jsx
{isSuperuser && (
  <button onClick={() => setShowAddModal(true)}
    style={{ padding: "7px 14px", borderRadius: 7, border: `1.5px solid ${tc.border}`,
      background: "transparent", color: tc.navy, cursor: "pointer",
      fontFamily: "inherit", fontSize: 12, fontWeight: 600 }}>
    + Nou searcher
  </button>
)}
```

- [ ] **Step 5: Wrap historic table fields with EditableCell and add DeleteRowButton**

For text fields in the historic table rows:

```jsx
<EditableCell value={r.nom} type="text"
  onSave={v => saveSearcherField(r.id, "nom", v)}
  disabled={!isSuperuser} />
```

For select fields like `statusScreening`:

```jsx
<EditableCell value={r.statusScreening} type="select"
  options={["Contactat", "En procés", "Descartat", "Invertit"]}
  onSave={v => saveSearcherField(r.id, "statusScreening", v)}
  disabled={!isSuperuser} />
```

Add delete column:

```jsx
{isSuperuser && (
  <td style={{ padding: "4px 8px", textAlign: "center" }}>
    <DeleteRowButton onDelete={() => handleDeleteSearcher(r.id)} />
  </td>
)}
```

- [ ] **Step 6: Add AddRowModal**

```jsx
{showAddModal && (
  <AddRowModal
    title="Nou searcher"
    fields={[
      { key: "nom", label: "Nom", type: "text", placeholder: "Nom del searcher" },
      { key: "tipus", label: "Tipus", type: "select", options: ["", "Solo", "Duo"] },
      { key: "modalitat", label: "Modalitat", type: "select", options: ["", "Solo", "Partnership"] },
      { key: "geo", label: "Geografia", type: "text", placeholder: "ES, FR, ..." },
      { key: "ticket", label: "Ticket (€M)", type: "number" },
    ]}
    onSave={handleAddSearcher}
    onClose={() => setShowAddModal(false)}
  />
)}
```

- [ ] **Step 7: Verify**

As superuser: historic table rows are click-to-edit. "+ Nou searcher" button visible. Delete icons appear. Changes persist after refresh.

- [ ] **Step 8: Commit**

```bash
git add src/components/SearchersTab.jsx
git commit -m "feat: SearchersTab superuser editing — inline edit historicData, add, delete"
```

---

## Task 8: `CompanyDetail.jsx` — load from localStorage, EditableCell on quarterly KPIs, add quarter

**Files:**
- Modify: `src/components/CompanyDetail.jsx`

- [ ] **Step 1: Add imports**

```js
import { useAuth } from "../auth.jsx";
import { EditableCell } from "./SharedComponents.jsx";
import { upsertCompany } from "../db.js";
import { PORTFOLIO_COMPANIES } from "../data/searchers.js";
```

(Remove or check that `PORTFOLIO_COMPANIES` was already imported — it may be used as fallback.)

- [ ] **Step 2: Change data loading from static import to localStorage with useState**

Find where the component reads the company (currently `const company = PORTFOLIO_COMPANIES.find(...)`). Replace with:

```js
const { isSuperuser } = useAuth();
const { id: slug } = useParams();

const [companies, setCompanies] = useState(() => {
  try {
    const s = localStorage.getItem("tc_portfolioCompanies");
    return s ? JSON.parse(s) : PORTFOLIO_COMPANIES;
  } catch { return PORTFOLIO_COMPANIES; }
});

const company = companies.find(c => slugify(c.nom) === slug);
```

All downstream destructuring from `company` (quarters, etc.) stays the same.

- [ ] **Step 3: Add `saveQuarterField` and `addQuarter`**

```js
const saveQuarterField = (qLabel, field, value) => {
  if (!company) return;
  const updatedQuarters = company.quarters.map(q =>
    q.q === qLabel ? { ...q, [field]: value === null ? null : parseFloat(value) || null } : q
  );
  const updatedCompany = { ...company, quarters: updatedQuarters };
  const updatedCompanies = companies.map(c => c.nom === company.nom ? updatedCompany : c);
  setCompanies(updatedCompanies);
  try { localStorage.setItem("tc_portfolioCompanies", JSON.stringify(updatedCompanies)); } catch {}
  upsertCompany(updatedCompany);
};

const [addingQuarter, setAddingQuarter] = useState(false);
const [newQ, setNewQ] = useState({ q: "1", year: String(new Date().getFullYear()) });

const addQuarter = () => {
  if (!company) return;
  const label = `Q${newQ.q} ${newQ.year}`;
  if (company.quarters.some(q => q.q === label)) return; // already exists
  const blank = { q: label, rev: null, ebitda: null, dfn: null, revBudget: null, ebitdaBudget: null, dfnBudget: null };
  const updatedCompany = { ...company, quarters: [...company.quarters, blank] };
  const updatedCompanies = companies.map(c => c.nom === company.nom ? updatedCompany : c);
  setCompanies(updatedCompanies);
  try { localStorage.setItem("tc_portfolioCompanies", JSON.stringify(updatedCompanies)); } catch {}
  upsertCompany(updatedCompany);
  setAddingQuarter(false);
  setNewQ({ q: "1", year: String(new Date().getFullYear()) });
};
```

- [ ] **Step 4: Wrap quarterly table cells with EditableCell**

In the quarterly table rendering, for each metric cell (rev, ebitda, dfn, revBudget, ebitdaBudget, dfnBudget), wrap with EditableCell:

```jsx
<EditableCell
  value={q.rev}
  type="number"
  align="right"
  fmt={v => v != null ? fmtM(v) : "—"}
  onSave={v => saveQuarterField(q.q, "rev", v)}
  disabled={!isSuperuser}
/>
```

Apply same pattern for all other fields per quarter row/column.

- [ ] **Step 5: Add "Nou trimestre" button and form**

After the quarterly table, add (superuser only):

```jsx
{isSuperuser && (
  <div style={{ marginTop: 12 }}>
    {!addingQuarter ? (
      <button onClick={() => setAddingQuarter(true)}
        style={{ background: "transparent", border: `1.5px dashed ${tc.border}`, borderRadius: 7,
          padding: "6px 14px", cursor: "pointer", fontSize: 12, color: tc.textMid,
          fontFamily: "inherit", fontWeight: 600 }}>
        + Nou trimestre
      </button>
    ) : (
      <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 10, color: tc.textLight, marginBottom: 3, textTransform: "uppercase" }}>Trimestre</div>
          <select value={newQ.q} onChange={e => setNewQ(p => ({ ...p, q: e.target.value }))}
            style={{ padding: "6px 10px", borderRadius: 6, border: `1.5px solid ${tc.border}`, background: tc.bg, color: tc.text, fontSize: 13, fontFamily: "inherit" }}>
            {["1","2","3","4"].map(v => <option key={v} value={v}>Q{v}</option>)}
          </select>
        </div>
        <div>
          <div style={{ fontSize: 10, color: tc.textLight, marginBottom: 3, textTransform: "uppercase" }}>Any</div>
          <input type="number" value={newQ.year} onChange={e => setNewQ(p => ({ ...p, year: e.target.value }))}
            style={{ padding: "6px 10px", borderRadius: 6, border: `1.5px solid ${tc.border}`, background: tc.bg, color: tc.text, fontSize: 13, fontFamily: "inherit", width: 80 }} />
        </div>
        <button onClick={addQuarter}
          style={{ padding: "7px 14px", borderRadius: 6, border: "none", background: tc.navy, color: "#fff", cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 600 }}>
          Afegir
        </button>
        <button onClick={() => setAddingQuarter(false)}
          style={{ padding: "7px 14px", borderRadius: 6, border: `1.5px solid ${tc.border}`, background: "transparent", color: tc.textMid, cursor: "pointer", fontFamily: "inherit", fontSize: 12 }}>
          Cancel·lar
        </button>
      </div>
    )}
  </div>
)}
```

- [ ] **Step 6: Verify**

Navigate to a company detail page as superuser. Quarterly cells should be click-to-edit. "+ Nou trimestre" button appears. After adding a quarter and refreshing, it persists.

- [ ] **Step 7: Commit**

```bash
git add src/components/CompanyDetail.jsx
git commit -m "feat: CompanyDetail superuser editing — localStorage load, editable KPIs, add quarter"
```

---

## Task 9: End-to-end verification

- [ ] **Step 1: Verify role gate works**

Log in as a non-superuser. Confirm: no edit affordances anywhere (FundsIndex, pipeline, companies, searchers, company detail). All data displays correctly in read-only mode.

- [ ] **Step 2: Verify superuser CRUD flow**

Log in as superuser. Test each table:
- **Funds**: edit TVPI → refreshes correctly. Add a test fund → appears in list. Delete it → disappears.
- **Pipeline**: edit a deal field → change persists after reload. Add a deal → appears. Delete → gone.
- **Companies**: edit a company field → persists. Add a company → appears in table. Delete → gone.
- **Searchers**: edit a searcher field → persists. Add → appears. Delete → gone.
- **Company KPIs**: open a company. Edit a quarterly value → saves. Add a new quarter → appears in chart.

- [ ] **Step 3: Deploy to Vercel**

```bash
vercel --prod --yes
```

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: superuser inline editing — complete"
```
