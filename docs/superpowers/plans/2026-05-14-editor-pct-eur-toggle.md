# Editor % / € Input Toggle — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a € / % toggle to the forecast editor so users can enter amounts as percentages of committed/paid-in capital, with the total column showing % coverage when in % mode.

**Architecture:** Single file change — `src/components/ProspectiveCashTab.jsx`. Add `editorInputMode` state in `ProspectiveCashTab`, pass it to `EditorPanel`, and update the cell render + total column logic. Stored values remain absolute amounts in all paths — % input is purely a display/entry convenience.

**Tech Stack:** React (JSX), inline styles, existing `Segmented` + `fmtC` + `numberAtYear` helpers already in the file.

---

## Files Modified

| File | What changes |
|------|-------------|
| `src/components/ProspectiveCashTab.jsx` | Add `editorInputMode` state; pass to `EditorPanel`; update toolbar, cell render, total column |

---

## Task 1: Add `editorInputMode` state and pass it to `EditorPanel`

**Files:**
- Modify: `src/components/ProspectiveCashTab.jsx`

### Context

`ProspectiveCashTab` holds all editor state (lines 78–96). `EditorPanel` is rendered inside the `view === "editor"` branch (find it by searching for `<EditorPanel`). The component signature of `EditorPanel` is at line 833:

```jsx
function EditorPanel({ tc, editorData, committedByFund, paidInByFund, fundNames, editorType, setEditorType, editorSearch, setEditorSearch, updateFundValue, saveAndApply, exportEditorCsv, resetDraft, dirty, saving })
```

### Steps

- [ ] **Step 1: Add `editorInputMode` state in `ProspectiveCashTab`**

Find the block of `useState` declarations (lines 78–96). After line 96 (`const [dirty, setDirty] = useState(false);`), add:

```jsx
  const [editorInputMode, setEditorInputMode] = useState("eur"); // "eur" | "pct"
```

- [ ] **Step 2: Pass `editorInputMode` and `setEditorInputMode` to `EditorPanel`**

Find the `<EditorPanel` JSX call (search for `<EditorPanel`). Add the two new props:

```jsx
        editorInputMode={editorInputMode}
        setEditorInputMode={setEditorInputMode}
```

- [ ] **Step 3: Add the props to `EditorPanel`'s function signature**

Find line 833:
```jsx
function EditorPanel({ tc, editorData, committedByFund, paidInByFund, fundNames, editorType, setEditorType, editorSearch, setEditorSearch, updateFundValue, saveAndApply, exportEditorCsv, resetDraft, dirty, saving }) {
```
Replace with:
```jsx
function EditorPanel({ tc, editorData, committedByFund, paidInByFund, fundNames, editorType, setEditorType, editorSearch, setEditorSearch, updateFundValue, saveAndApply, exportEditorCsv, resetDraft, dirty, saving, editorInputMode, setEditorInputMode }) {
```

- [ ] **Step 4: Verify no runtime errors**

Start dev server (`npm run dev`), open Model Caixa → Editor tab. Console should be clean.

- [ ] **Step 5: Commit**

```bash
git add src/components/ProspectiveCashTab.jsx
git commit -m "feat(editor): add editorInputMode state and prop wiring"
```

---

## Task 2: Add the € / % toggle to the `EditorPanel` toolbar

**Files:**
- Modify: `src/components/ProspectiveCashTab.jsx` (inside `EditorPanel`, lines 838–848)

### Context

The toolbar is at lines 838–848. It currently starts with:
```jsx
      <div style={{ display: "flex", gap: 10, alignItems: "center", padding: 12, borderBottom: `1px solid ${tc.border}`, flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, color: tc.textLight, fontWeight: 750, textTransform: "uppercase", letterSpacing: "0.07em" }}>Prediccio</span>
        <Segmented tc={tc} value={editorType} onChange={setEditorType} options={[{ id: "calls", label: "Capital Calls" }, { id: "dist", label: "Distribucions" }]} />
        <input value={editorSearch} ...
```

`Segmented` is already used throughout the file and accepts `{ tc, value, onChange, options }`.

### Steps

- [ ] **Step 1: Add the € / % toggle after the calls/dist Segmented**

Find the toolbar `<Segmented>` for `editorType` (line ~840). After it, add:

```jsx
        <Segmented tc={tc} value={editorInputMode} onChange={setEditorInputMode} options={[{ id: "eur", label: "€" }, { id: "pct", label: "%" }]} />
```

- [ ] **Step 2: Verify in browser**

Open Model Caixa → Editor. The toolbar should now show: `Prediccio | Capital Calls · Distribucions | € · %  | [search input]`. Clicking `%` or `€` changes the value but has no visual effect on cells yet (that's Task 3).

- [ ] **Step 3: Commit**

```bash
git add src/components/ProspectiveCashTab.jsx
git commit -m "feat(editor): add € / % toolbar toggle"
```

---

## Task 3: Update cell display and edit logic for % mode

**Files:**
- Modify: `src/components/ProspectiveCashTab.jsx` (inside `EditorPanel`, lines 864–895)

### Context

The per-fund rows are rendered at lines 864–895. The relevant cell block is:

```jsx
                  {yearCols.map((year) => {
                    const value = numberAtYear(values, year);
                    return (
                      <td key={year} style={{ ...tdStyle(tc), background: periodBg(tc, year) }}>
                        <input
                          type="number"
                          value={value || ""}
                          onChange={(event) => updateFundValue(fundName, (draft) => ({ ...draft, [key]: yearMapValue(draft[key], year, event.target.value) }))}
                          style={editorNumberStyle(tc)}
                        />
                        {value && base ? <div style={{ fontSize: 9, color: tc.textLight }}>{((value / base) * 100).toFixed(1)}%</div> : null}
                      </td>
                    );
                  })}
```

`numberAtYear` is a helper already in the file. `yearMapValue` is also already defined.

**Important:** `base` is already computed per-fund row at lines 867–870:
```jsx
              const base = editorType === "calls"
                ? Number(committedByFund[fundName] ?? data.committed ?? 0) || 0
                : Number(paidInByFund[fundName] ?? 0) || 0;
```

When `editorInputMode === "pct"` and `base > 0`:
- Display value = `(value / base * 100)` rounded to 2 decimal places
- On change: stored amount = `(pctInput / 100) * base`
- Hint below input = resolved € amount: `fmtC(value)`

When `editorInputMode === "pct"` and `base === 0`: fall back to `"eur"` behaviour.

### Steps

- [ ] **Step 1: Extract an `inPct` local boolean per row**

Inside the `fundNames.map` callback, after the `base` declaration, add:

```jsx
              const inPct = editorInputMode === "pct" && base > 0;
```

- [ ] **Step 2: Replace the year cell block**

Replace the entire `{yearCols.map((year) => { ... })}` block with:

```jsx
                  {yearCols.map((year) => {
                    const value = numberAtYear(values, year);
                    const displayValue = inPct ? (value ? ((value / base) * 100).toFixed(2) : "") : (value || "");
                    const hint = inPct
                      ? (value ? fmtC(value) : null)
                      : (value && base ? `${((value / base) * 100).toFixed(1)}%` : null);
                    return (
                      <td key={year} style={{ ...tdStyle(tc), background: periodBg(tc, year) }}>
                        <input
                          type="number"
                          value={displayValue}
                          onChange={(event) => {
                            const raw = Number(event.target.value);
                            const stored = inPct ? (raw / 100) * base : raw;
                            updateFundValue(fundName, (draft) => ({ ...draft, [key]: yearMapValue(draft[key], year, stored || "") }));
                          }}
                          style={editorNumberStyle(tc)}
                        />
                        {hint ? <div style={{ fontSize: 9, color: tc.textLight }}>{hint}</div> : null}
                      </td>
                    );
                  })}
```

- [ ] **Step 3: Verify cell behaviour in browser**

Open Editor, switch to `%`:
- A fund with base = €1,000,000 and a stored value of €150,000 should show `15.00` in the input and `150K€` as hint.
- Typing `20` should update the cell to show `20.00` and the hint to `200K€`.
- Switching back to `€` should show `200,000` in the input and `20.0%` as hint.
- A fund with base = 0 should behave identically in both modes (no percentage shown).

- [ ] **Step 4: Commit**

```bash
git add src/components/ProspectiveCashTab.jsx
git commit -m "feat(editor): % mode cell display and edit"
```

---

## Task 4: Update the Total column for % mode

**Files:**
- Modify: `src/components/ProspectiveCashTab.jsx` (inside `EditorPanel`, line ~891)

### Context

The Total cell is currently:
```jsx
                  <td style={tdStyle(tc)}><strong>{fmtC(total)}</strong></td>
```

`total` is `Object.values(values).reduce((sum, value) => sum + (Number(value) || 0), 0)` — the sum of all absolute amounts across years for this fund row. `inPct` and `base` are available in scope from Task 3.

When `inPct` is true: show `(total / base * 100).toFixed(1) + "%"` instead of `fmtC(total)`.

### Steps

- [ ] **Step 1: Replace the Total cell**

Find:
```jsx
                  <td style={tdStyle(tc)}><strong>{fmtC(total)}</strong></td>
```
Replace with:
```jsx
                  <td style={tdStyle(tc)}>
                    <strong>{inPct ? `${((total / base) * 100).toFixed(1)}%` : fmtC(total)}</strong>
                    {inPct && <div style={{ fontSize: 9, color: tc.textLight }}>{fmtC(total)}</div>}
                  </td>
```

- [ ] **Step 2: Verify in browser**

In `%` mode, the Total column should show `X.X%` for each fund. For a fund where all years sum to 80% of committed, it should show `80.0%`. A fund with base = 0 still shows `fmtC(total)`.

The `€` hint below the `%` total lets users cross-check the absolute amount without switching modes.

- [ ] **Step 3: Commit**

```bash
git add src/components/ProspectiveCashTab.jsx
git commit -m "feat(editor): % mode total column shows coverage percentage"
```
