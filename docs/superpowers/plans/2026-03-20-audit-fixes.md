# Audit Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Address all security and UX issues found in the site audit: toast error system, localStorage clear on logout, password reset, loading states, mobile tables, export feedback, tooltips, CSV validation, and RLS policies.

**Architecture:** Add a lightweight toast context (src/toast.jsx) consumed app-wide; update db.js functions to return errors; wire toasts into every component that calls db; add UX polish in-place without restructuring.

**Tech Stack:** React, Supabase JS v2, Vite, inline styles (no CSS framework)

---

## FILES TO MODIFY

- Create: `src/toast.jsx` — ToastProvider + useToast hook
- Modify: `src/main.jsx` — wrap app in ToastProvider
- Modify: `src/auth.jsx` — signOut clears localStorage tc_ keys; add resetPassword function
- Modify: `src/db.js` — make upsert/delete functions return errors
- Modify: `src/components/LoginPage.jsx` — add "Forgot password?" flow
- Modify: `src/components/SharedComponents.jsx` — loading state on EditableCell
- Modify: `src/components/FundsIndex.jsx` — wire toasts, table overflow-x
- Modify: `src/components/PipelineFY26.jsx` — wire toasts, table overflow-x
- Modify: `src/components/PortfolioCompaniesTab.jsx` — wire toasts, table overflow-x
- Modify: `src/components/SearchersTab.jsx` — wire toasts, table overflow-x
- Modify: `src/components/CompanyDetail.jsx` — wire toasts
- Modify: `src/components/Dashboard.jsx` — export loading state, CSV file size validation, table overflow-x

---

## TASKS

Write each task with exact code, file paths, and git commit steps. No TDD (no test framework exists).

### Task 1: Toast system

**Files:**
- Create: `src/toast.jsx`
- Modify: `src/main.jsx` — add `<ToastProvider>` around `<App />`

The toast system:
- `ToastProvider` renders a fixed stack (bottom-right, z-index 9999) of toast items
- Each toast: `{ id, message, type }` where type is `"success"` or `"error"`
- Auto-dismisses after 4000ms
- `useToast()` returns `{ toast }` where `toast({ message, type })` adds a toast
- Max 5 toasts visible; oldest dismissed first if exceeded
- Styles: success = green (#1B5E20 text, #E8F5E9 bg), error = red (#C62828 text, #FDECEA bg), shared: borderRadius 8, padding "10px 14px", fontSize 13, fontFamily Outfit, boxShadow, minWidth 260, maxWidth 360

Exact `src/toast.jsx`:
```jsx
import React, { createContext, useContext, useState, useCallback } from "react";

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const toast = useCallback(({ message, type = "success" }) => {
    const id = Date.now() + Math.random();
    setToasts(prev => {
      const next = [...prev, { id, message, type }];
      return next.length > 5 ? next.slice(next.length - 5) : next;
    });
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div style={{
        position: "fixed", bottom: 24, right: 24, zIndex: 9999,
        display: "flex", flexDirection: "column", gap: 8,
        fontFamily: "'Outfit',system-ui,sans-serif",
        pointerEvents: "none",
      }}>
        {toasts.map(t => (
          <div key={t.id} style={{
            minWidth: 260, maxWidth: 360,
            padding: "10px 14px", borderRadius: 8, fontSize: 13,
            boxShadow: "0 4px 16px rgba(0,0,0,.15)",
            background: t.type === "error" ? "#FDECEA" : "#E8F5E9",
            color: t.type === "error" ? "#C62828" : "#1B5E20",
            fontWeight: 500,
          }}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
```

In `src/main.jsx`, wrap the existing `<App />` (or `<BrowserRouter><AuthProvider>...`) with `<ToastProvider>`. Read main.jsx first to find exact structure, then wrap the outermost component.

Steps:
- [ ] Create `src/toast.jsx` with the exact code above
- [ ] Read `src/main.jsx`, add `import { ToastProvider } from "./toast.jsx"`, wrap outermost JSX with `<ToastProvider>`
- [ ] Commit: `feat: add toast notification system`

---

### Task 2: Clear localStorage on logout + password reset

**Files:**
- Modify: `src/auth.jsx`
- Modify: `src/components/LoginPage.jsx`

**auth.jsx changes:**

1. Update `signOut` to clear all `tc_` localStorage keys before signing out:
```js
const signOut = () => {
  ["tc_rawCC","tc_fundMeta","tc_portfolioCompanies","tc_allSearchers"].forEach(k => localStorage.removeItem(k));
  return supabase.auth.signOut();
};
```

2. Add `resetPassword`:
```js
const resetPassword = (email) => supabase.auth.resetPasswordForEmail(email, {
  redirectTo: window.location.origin + "/reset-password",
});
```

3. Add `resetPassword` to the context value.

**LoginPage.jsx changes:**

Add a `"forgot"` mode. When mode is `"login"`, show a "Heu oblidat la contrasenya?" link below the form that switches to `"forgot"` mode. In `"forgot"` mode:
- Show only the email field
- Submit calls `resetPassword(email)`
- On success: show info message "Si existeix un compte amb aquest correu, rebràs un enllaç per restablir la contrasenya."
- On error: show error message
- Show "Tornar" link to go back to login mode

Add `"forgot"` to `switchMode` reset logic. The mode tabs should only show for `"login"` and `"register"` — hide tabs when mode is `"forgot"`.

Steps:
- [ ] Update `src/auth.jsx` signOut + add resetPassword
- [ ] Update `src/components/LoginPage.jsx` with forgot password mode
- [ ] Commit: `feat: clear localStorage on logout, add password reset flow`

---

### Task 3: Make db.js functions return errors

**Files:**
- Modify: `src/db.js`

Update these void functions to return `{ error }` so callers can show toasts:

```js
// upsertFundMeta
export async function upsertFundMeta(fons, tvpi) {
  if (!supabase) return { error: null };
  const { error } = await supabase.from("fund_meta").upsert({ fons, tvpi: tvpi ?? null }, { onConflict: "fons" });
  return { error };
}

// upsertCompany
export async function upsertCompany(company) {
  if (!supabase) return { error: null };
  const { error } = await supabase.from("portfolio_companies")
    .upsert(companyToRow(company), { onConflict: "nom" });
  return { error };
}

// upsertSearcher
export async function upsertSearcher(searcher) {
  if (!supabase) return { error: null };
  const { error } = await supabase.from("searchers")
    .update(searcherToRow(searcher))
    .eq("id", searcher.id);
  return { error };
}

// upsertPipelineDeal
export async function upsertPipelineDeal(deal) {
  if (!supabase) return { error: null };
  const { error } = await supabase.from("pipeline")
    .upsert({ id: deal.id, ...dealToRow(deal) }, { onConflict: "id" });
  return { error };
}

// deleteCompany
export async function deleteCompany(id) {
  if (!supabase) return { error: null };
  const { error } = await supabase.from("portfolio_companies").delete().eq("id", id);
  return { error };
}

// deleteSearcher
export async function deleteSearcher(id) {
  if (!supabase) return { error: null };
  const { error } = await supabase.from("searchers").delete().eq("id", id);
  return { error };
}

// deletePipelineDeal
export async function deletePipelineDeal(id) {
  if (!supabase) return { error: null };
  const { error } = await supabase.from("pipeline").delete().eq("id", id);
  return { error };
}
```

Steps:
- [ ] Update all 7 functions in `src/db.js` to return `{ error }`
- [ ] Commit: `refactor: db functions return errors`

---

### Task 4: Wire toasts into FundsIndex

**Files:**
- Modify: `src/components/FundsIndex.jsx`

Add `import { useToast } from "../toast.jsx"` and `const { toast } = useToast()` in `FundsIndexInner`.

Update `saveTvpi`:
```js
const saveTvpi = async (fons, tvpi) => {
  const updated = fundMeta.some(m => m.fons === fons)
    ? fundMeta.map(m => m.fons === fons ? { ...m, tvpi } : m)
    : [...fundMeta, { fons, tvpi }];
  setFundMeta(updated);
  try { localStorage.setItem("tc_fundMeta", JSON.stringify(updated)); } catch {}
  const { error } = await upsertFundMeta(fons, tvpi);
  if (error) toast({ message: "Error desant TVPI: " + error.message, type: "error" });
};
```

Update `handleDeleteFund` to show toast on success/error:
```js
const handleDeleteFund = async (fons) => {
  const err = await deleteFund(fons);
  if (err) {
    toast({ message: "Error eliminant fons: " + err.message, type: "error" });
    const fresh = await loadAll();
    if (fresh) { persistRawCC(fresh.rawCC); /* also refresh fundMeta */ }
    return;
  }
  persistRawCC(rawCC.filter(r => r.fons !== fons));
  setFundMeta(prev => { const u = prev.filter(m => m.fons !== fons); try { localStorage.setItem("tc_fundMeta", JSON.stringify(u)); } catch {} return u; });
  toast({ message: `Fons "${fons}" eliminat.` });
};
```

Update `handleAddFund` to show toast on success/error (it already handles the async flow — just add `toast({ message: "Fons afegit correctament." })` on success and `toast({ message: "Error: " + ..., type: "error" })` on error).

Wrap the funds table `<table>` in `<div style={{ overflowX: "auto" }}>`.

Steps:
- [ ] Add useToast import + hook call
- [ ] Update saveTvpi, handleDeleteFund, handleAddFund with toast calls
- [ ] Wrap table in overflow div
- [ ] Commit: `feat: toast feedback and table overflow in FundsIndex`

---

### Task 5: Wire toasts into PortfolioCompaniesTab

**Files:**
- Modify: `src/components/PortfolioCompaniesTab.jsx`

Read the file first to find exact function names. Add `useToast` import and `const { toast } = useToast()`.

Update `saveField` (calls `upsertCompany`): await the result, show error toast if `error` is set.

Update `handleDelete` (calls `deleteCompany`): await the result, show error toast if `error` is set; show success toast on delete.

Update `handleAdd` (calls `insertCompany`): already handles errors via `setError` in modal — also add error toast there as backup.

Wrap the companies `<table>` in `<div style={{ overflowX: "auto" }}>`.

Steps:
- [ ] Read `src/components/PortfolioCompaniesTab.jsx`
- [ ] Add useToast, wire toasts to saveField / handleDelete / handleAdd
- [ ] Wrap table in overflow div
- [ ] Commit: `feat: toast feedback and table overflow in PortfolioCompaniesTab`

---

### Task 6: Wire toasts into SearchersTab

**Files:**
- Modify: `src/components/SearchersTab.jsx`

Read the file first. Add `useToast` import and hook. Update `saveSearcherField`, `handleDeleteSearcher`, `handleAddSearcher` to show error toasts on failures, success toast on delete/add.

Wrap the historic searchers `<table>` in `<div style={{ overflowX: "auto" }}>`.

Steps:
- [ ] Read `src/components/SearchersTab.jsx`
- [ ] Wire toasts
- [ ] Wrap table
- [ ] Commit: `feat: toast feedback and table overflow in SearchersTab`

---

### Task 7: Wire toasts into PipelineFY26

**Files:**
- Modify: `src/components/PipelineFY26.jsx`

Read the file first. Add `useToast` import and hook. Update `upd` (calls `upsertPipelineDeal`), `del` (calls `deletePipelineDeal`), `add` (calls `insertPipelineDeal`) to show error toasts. Show success toast on delete.

Wrap the pipeline `<table>` in `<div style={{ overflowX: "auto" }}>`.

Steps:
- [ ] Read `src/components/PipelineFY26.jsx`
- [ ] Wire toasts
- [ ] Wrap table
- [ ] Commit: `feat: toast feedback and table overflow in PipelineFY26`

---

### Task 8: Wire toasts into CompanyDetail

**Files:**
- Modify: `src/components/CompanyDetail.jsx`

Read the file first. Add `useToast`. Update `saveQuarterField` (calls `upsertCompany`) and `addQuarter` (calls `upsertCompany`) to show error toasts on failure.

Steps:
- [ ] Read `src/components/CompanyDetail.jsx`
- [ ] Wire toasts to saveQuarterField and addQuarter
- [ ] Commit: `feat: toast feedback in CompanyDetail`

---

### Task 9: Export loading state + CSV file size validation + tooltips

**Files:**
- Modify: `src/components/Dashboard.jsx`

**Export loading:** Read Dashboard.jsx around the export function. Find the export button and `exportAll` / `exportMultiXLSX` call. Add `const [exporting, setExporting] = useState(false)`. Before export: `setExporting(true)`. After (in finally): `setExporting(false)`. Disable button and show "Exportant…" label while exporting.

**CSV file size validation:** In the DataLoader's file input handlers (ccRef, plRef, xlsxRef onChange/drop handlers), add a size check before processing:
```js
if (file.size > 10 * 1024 * 1024) {
  setError("El fitxer és massa gran (màxim 10 MB).");
  return;
}
```

**Tooltips on column headers:** In Dashboard.jsx's funds/capital calls table headers, add `title` attributes to abbreviated column names. Look for headers like "VCPE", "EST", "TVPI", "DPI", "RVPI" and add descriptive titles:
- VCPE → title="Venture Capital / Private Equity"
- EST → title="Estructura del fons"
- TVPI → title="Total Value to Paid-In"
- DPI → title="Distributions to Paid-In"
- RVPI → title="Residual Value to Paid-In"

Also add the same title attributes to FundsIndex column headers for TVPI, DPI, RVPI.

Steps:
- [ ] Read Dashboard.jsx lines 1-100, then read more as needed to find export button and CSV handlers
- [ ] Add export loading state
- [ ] Add file size validation in DataLoader
- [ ] Add title attributes to column headers in Dashboard and FundsIndex
- [ ] Commit: `feat: export loading, CSV size validation, column header tooltips`

---

### Task 10: RLS policies (SQL only — run in Supabase SQL Editor)

No code changes needed. Provide this SQL to run in the Supabase SQL Editor. The policies allow any authenticated user to read, but only superusers (role = 'superuser' in user_metadata) to write/delete.

```sql
-- Enable RLS on all tables
ALTER TABLE capital_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE fund_meta ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE searchers ENABLE ROW LEVEL SECURITY;

-- READ: any authenticated user
CREATE POLICY "authenticated read capital_calls" ON capital_calls FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated read fund_meta" ON fund_meta FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated read pipeline" ON pipeline FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated read portfolio_companies" ON portfolio_companies FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated read searchers" ON searchers FOR SELECT TO authenticated USING (true);

-- WRITE (INSERT/UPDATE/DELETE): superusers only
CREATE POLICY "superuser write capital_calls" ON capital_calls FOR ALL TO authenticated
  USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'superuser')
  WITH CHECK ((auth.jwt() -> 'user_metadata' ->> 'role') = 'superuser');

CREATE POLICY "superuser write fund_meta" ON fund_meta FOR ALL TO authenticated
  USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'superuser')
  WITH CHECK ((auth.jwt() -> 'user_metadata' ->> 'role') = 'superuser');

CREATE POLICY "superuser write pipeline" ON pipeline FOR ALL TO authenticated
  USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'superuser')
  WITH CHECK ((auth.jwt() -> 'user_metadata' ->> 'role') = 'superuser');

CREATE POLICY "superuser write portfolio_companies" ON portfolio_companies FOR ALL TO authenticated
  USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'superuser')
  WITH CHECK ((auth.jwt() -> 'user_metadata' ->> 'role') = 'superuser');

CREATE POLICY "superuser write searchers" ON searchers FOR ALL TO authenticated
  USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'superuser')
  WITH CHECK ((auth.jwt() -> 'user_metadata' ->> 'role') = 'superuser');
```

**Important:** After enabling RLS, the `loadAll()` function in db.js uses the anon key. Supabase RLS with `TO authenticated` requires the user's JWT to be passed. The Supabase JS client automatically passes the session JWT, so no code changes are needed — but verify by testing `loadAll()` after running the SQL.

Steps:
- [ ] Run the SQL in Supabase SQL Editor
- [ ] Log in to the app and verify data loads correctly
- [ ] Try editing data as superuser — should work
- [ ] Log in as regular user (if available) — edits should be blocked at DB level

---

After all tasks, run: `vercel --prod --yes`

Commit at end: `chore: deploy audit fixes to production`
