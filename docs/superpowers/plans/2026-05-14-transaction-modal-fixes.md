# Transaction Modal Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix three issues in the transaction add/edit modal: show NIF & Fiscal Name fields for new vehicles, fix RLS violation for non-admin users inserting movements, and prevent backdrop click from closing the modal.

**Architecture:** Three independent fixes touching `SharedComponents.jsx` (modal UX), `CcTransactionModal.jsx` (new-vehicle fields), `src/data/mappers.js` (entity serializer), and `src/db.js` (entity upsert guard). No new files needed.

**Tech Stack:** React (JSX), Supabase JS client, plain CSS-in-JS inline styles.

---

## Files Modified

| File | What changes |
|------|-------------|
| `src/components/SharedComponents.jsx` | Remove backdrop-click close; add × button + Esc key handler to `AddRowModal` |
| `src/components/CcTransactionModal.jsx` | Add conditional `nif` and `fiscal_name` fields for new vehicles; pass them through `onInsert` |
| `src/data/mappers.js` | Add `nif` and `fiscal_name` to `privateEntityToRow` serializer |
| `src/db.js` | Guard `upsertPrivateEntities` in `insertCapitalCall` and `updateCapitalCall`: skip write if entity already exists |

---

## Task 1: Remove backdrop-click close; add × button and Esc handler

**Files:**
- Modify: `src/components/SharedComponents.jsx` (function `AddRowModal`, ~line 535–670)

### Context
`AddRowModal` renders a full-screen overlay `<div>` with `onClick={e => { if (e.target === e.currentTarget) handleClose(); }}`. That must be removed. We also need:
- An `×` close button in the top-right of the modal card header area.
- A `useEffect` that listens for `Escape` keydown and calls `handleClose`.

### Steps

- [ ] **Step 1: Read current `AddRowModal` to confirm line numbers**

Open `src/components/SharedComponents.jsx` and locate `AddRowModal` (starts ~line 486). Confirm the overlay `onClick` is on line ~539 and the title `<div>` is on line ~544.

- [ ] **Step 2: Remove backdrop click handler from the overlay div**

In `src/components/SharedComponents.jsx`, find:
```jsx
      onClick={e => { if (e.target === e.currentTarget) handleClose(); }}>
```
Replace with (remove the onClick entirely):
```jsx
      >
```

- [ ] **Step 3: Add Esc key handler**

After the existing `const [closing, setClosing] = useState(false);` line (~line 496), add:
```jsx
  const handleClose = () => { setClosing(true); setTimeout(onClose, 175); };

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") handleClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
```

> **Note:** `handleClose` is already defined on the next line — move it *above* the `useEffect` so the effect can reference it, or keep the definition order and rely on hoisting. The safest approach is to define `handleClose` first, then the effect.

The existing `const handleClose = () => { setClosing(true); setTimeout(onClose, 175); };` line stays — just add the `useEffect` immediately after it.

- [ ] **Step 4: Add × close button to the modal header**

Find the title `<div>`:
```jsx
        <div style={{ fontSize: 16, fontWeight: 700, color: tc.navy, marginBottom: 20 }}>{title}</div>
```
Replace with a flex row containing the title and the × button:
```jsx
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: tc.navy }}>{title}</div>
          <button
            type="button"
            onClick={handleClose}
            style={{ background: "transparent", border: "none", cursor: "pointer", color: tc.textLight, fontSize: 18, lineHeight: 1, padding: "0 2px", fontFamily: "inherit" }}
            aria-label="Tanca"
          >×</button>
        </div>
```

- [ ] **Step 5: Verify in browser**

Start dev server (`npm run dev`), open any transaction modal, click outside — modal should stay open. Press Esc or click × — modal should close with animation.

- [ ] **Step 6: Commit**

```bash
git add src/components/SharedComponents.jsx
git commit -m "fix(modal): close only on Esc or × button, not backdrop click"
```

---

## Task 2: Add NIF & Fiscal Name fields for new vehicles

**Files:**
- Modify: `src/components/CcTransactionModal.jsx`

### Context
The `fons` field is a `combo` — users can pick from `ccNameOptions` (existing vehicles) or type a new value via "Nou valor…". When a new name is entered (i.e. `values.fons` is non-empty and not in `ccNameOptions`), we should show two extra fields: `nif` (text) and `fiscal_name` (text). These will be passed to `onInsert` alongside the other values and picked up in Task 3 / Task 4.

The `CcTransactionModal` receives `ccNameOptions` as a prop — use it in the `visible` condition.

### Steps

- [ ] **Step 1: Add `nif` and `fiscal_name` fields to the fields array**

In `src/components/CcTransactionModal.jsx`, after the `from_recallable` field definition (the last entry in the `fields` array, ~line 103–109), add:

```jsx
    {
      key: "nif",
      label: "NIF (nou vehicle)",
      type: "text",
      defaultValue: "",
      placeholder: "p. ex. A12345678",
      visible: (v) => {
        const name = String(v.fons ?? "").trim();
        return name !== "" && !(ccNameOptions ?? []).includes(name);
      },
    },
    {
      key: "fiscal_name",
      label: "Nom fiscal (nou vehicle)",
      type: "text",
      defaultValue: "",
      placeholder: "Raó social completa",
      visible: (v) => {
        const name = String(v.fons ?? "").trim();
        return name !== "" && !(ccNameOptions ?? []).includes(name);
      },
    },
```

These fields close the `fields` array — make sure the comma after `from_recallable`'s closing `}` is present.

- [ ] **Step 2: Verify fields appear correctly**

Start dev server. Open "Afegeix moviment", type a new vehicle name (anything not in the list). The two new fields `NIF (nou vehicle)` and `Nom fiscal (nou vehicle)` should appear. Switch back to an existing vehicle — fields should disappear.

- [ ] **Step 3: Commit**

```bash
git add src/components/CcTransactionModal.jsx
git commit -m "feat(modal): show NIF and fiscal name fields for new vehicles"
```

---

## Task 3: Serialize NIF and Fiscal Name in `privateEntityToRow`

**Files:**
- Modify: `src/data/mappers.js` (function `privateEntityToRow`, lines 27–42)

### Context
`privateEntityToRow` serializes a `PrivateEntity` object to a Supabase row. It currently omits `nif` and `fiscal_name` even though both columns exist in `private_entities`. We need to include them so that when a new vehicle is created via `upsertPrivateEntities`, the values from the modal are persisted.

### Steps

- [ ] **Step 1: Add `nif` and `fiscal_name` to `privateEntityToRow`**

In `src/data/mappers.js`, find `privateEntityToRow`:
```js
export function privateEntityToRow(entity) {
  return {
    id: entity.id,
    kind: entity.kind,
    canonical_name: entity.canonicalName,
    source_name: entity.sourceName ?? entity.canonicalName,
    workbook_name: entity.workbookName ?? null,
    match_type: entity.matchType ?? null,
    isin: entity.isin ?? null,
    country: entity.country ?? null,
    first_investment_date: entity.firstInvestmentDate ?? null,
    active: entity.active ?? true,
    notes: entity.notes ?? null,
    updated_at: new Date().toISOString(),
  };
}
```
Replace with:
```js
export function privateEntityToRow(entity) {
  return {
    id: entity.id,
    kind: entity.kind,
    canonical_name: entity.canonicalName,
    source_name: entity.sourceName ?? entity.canonicalName,
    workbook_name: entity.workbookName ?? null,
    match_type: entity.matchType ?? null,
    isin: entity.isin ?? null,
    country: entity.country ?? null,
    first_investment_date: entity.firstInvestmentDate ?? null,
    active: entity.active ?? true,
    notes: entity.notes ?? null,
    nif: entity.nif ?? null,
    fiscal_name: entity.fiscalName ?? null,
    updated_at: new Date().toISOString(),
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/data/mappers.js
git commit -m "fix(mappers): include nif and fiscal_name in privateEntityToRow"
```

---

## Task 4: Pass NIF/fiscal_name into entity on insert + guard upsert for existing entities

**Files:**
- Modify: `src/db.js` — functions `insertCapitalCall` (~line 907) and `updateCapitalCall` (~line 945)

### Context

Two sub-problems fixed together:

**4a — Pass nif/fiscal_name:** `insertCapitalCall` receives the full `cc` payload (which now has `nif` and `fiscal_name` from the modal). It calls `resolvePrivateEntity("vehicle", cc.fons, ...)` which returns an entity object without `nif`/`fiscal_name`. We need to merge those values onto the resolved object before calling `upsertPrivateEntities`.

**4b — RLS guard for non-admin users:** `upsertPrivateEntities` unconditionally tries to INSERT or UPDATE `private_entities`. The RLS policy (`private_entities_write_superuser`) blocks non-admin users. Fix: before upserting, check if the entity row already exists (`SELECT id FROM private_entities WHERE id = ?`). If it exists, skip the write — the entity data is already correct and the capital call can proceed. If it doesn't exist (brand new vehicle), only admins can create it, so the upsert proceeds and will correctly fail with a permission error for non-admins.

This applies to both `insertCapitalCall` and `updateCapitalCall`.

### Steps

- [ ] **Step 1: Extract a helper `upsertEntityIfNew` inside `db.js`**

Find the existing private `upsertPrivateEntities` function (~line 92):
```js
async function upsertPrivateEntities(rows) {
  if (!supabase || !rows.length) return { error: null };
  const { error } = await supabase
    .from("private_entities")
    .upsert(rows.map(privateEntityToRow), { onConflict: "id" });
  return { error };
}
```
Replace it with:
```js
async function upsertPrivateEntities(rows) {
  if (!supabase || !rows.length) return { error: null };
  const { error } = await supabase
    .from("private_entities")
    .upsert(rows.map(privateEntityToRow), { onConflict: "id" });
  return { error };
}

async function upsertPrivateEntitiesIfNew(rows) {
  if (!supabase || !rows.length) return { error: null };
  const ids = rows.map((r) => r.id).filter(Boolean);
  const { data: existing } = await supabase
    .from("private_entities")
    .select("id")
    .in("id", ids);
  const existingIds = new Set((existing ?? []).map((r) => r.id));
  const toInsert = rows.filter((r) => !existingIds.has(r.id));
  if (!toInsert.length) return { error: null };
  const { error } = await supabase
    .from("private_entities")
    .upsert(toInsert.map(privateEntityToRow), { onConflict: "id" });
  return { error };
}
```

- [ ] **Step 2: Update `insertCapitalCall` to use the new helper and pass nif/fiscal_name**

Find `insertCapitalCall` (~line 907):
```js
export async function insertCapitalCall(cc) {
  if (!supabase) return { data: null, error: null };
  const resolved = resolvePrivateEntity("vehicle", cc.fons, cc.vehicle_id ?? null);
  const { error: entityError } = await upsertPrivateEntities([resolved]);
  if (entityError) return { data: null, error: entityError };
```
Replace those first 4 lines with:
```js
export async function insertCapitalCall(cc) {
  if (!supabase) return { data: null, error: null };
  const resolved = resolvePrivateEntity("vehicle", cc.fons, cc.vehicle_id ?? null);
  if (resolved) {
    resolved.nif = String(cc.nif ?? "").trim() || null;
    resolved.fiscalName = String(cc.fiscal_name ?? "").trim() || null;
  }
  const { error: entityError } = await upsertPrivateEntitiesIfNew([resolved]);
  if (entityError) return { data: null, error: entityError };
```

- [ ] **Step 3: Update `updateCapitalCall` to use the guard helper**

Find in `updateCapitalCall` (~line 991):
```js
    const resolved = resolvePrivateEntity("vehicle", fields.fons, old?.vehicle_id ?? null);
    const { error: entityError } = await upsertPrivateEntities([resolved]);
```
Replace with:
```js
    const resolved = resolvePrivateEntity("vehicle", fields.fons, old?.vehicle_id ?? null);
    const { error: entityError } = await upsertPrivateEntitiesIfNew([resolved]);
```

- [ ] **Step 4: Manual smoke-test**

With a non-admin account:
1. Open "Afegeix moviment", pick an **existing** vehicle, fill in the form → save. Should succeed without RLS error.
2. With an admin account: pick "+ Nou valor…", type a new vehicle name, fill in NIF and Nom Fiscal → save. Check the `private_entities` table in Supabase to confirm the new row has `nif` and `fiscal_name` populated.

- [ ] **Step 5: Commit**

```bash
git add src/db.js
git commit -m "fix(db): skip entity upsert for existing vehicles; pass nif/fiscal_name for new ones"
```
