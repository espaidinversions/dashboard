# Editor % / € Input Toggle — Design Spec

## Goal

Allow the forecast editor in `ProspectiveCashTab` to accept either absolute amounts (€) or percentages of the fund's base capital. The stored value is always an absolute amount; percentage input is a convenience conversion. A running total % per fund row lets users verify coverage at a glance.

## What Is Not Changing

- DB schema and storage — `prospective_cash_forecasts` stores absolute amounts, unchanged.
- `editorDataToForecastRows` — receives absolute amounts as today.
- `deriveProspectiveCashRows` — unchanged.
- The base derivation — committed capital (calls) and paid-in capital (distributions) already computed from `rawCapitalCalls`.

## Architecture

### State

One new piece of state in `ProspectiveCashTab`:

```jsx
const [editorInputMode, setEditorInputMode] = useState("eur"); // "eur" | "pct"
```

Passed as prop to `EditorPanel`.

### Toolbar

Add a `€ / %` segmented toggle to `EditorPanel`'s toolbar, next to the existing calls/dist toggle:

```jsx
<Segmented
  tc={tc}
  value={editorInputMode}
  onChange={setEditorInputMode}
  options={[{ id: "eur", label: "€" }, { id: "pct", label: "%" }]}
/>
```

### Cell Display and Edit

`EditorPanel` receives `editorInputMode` as a prop.

**In `"eur"` mode** (current behaviour, unchanged):
- Input value: the absolute amount (`value || ""`)
- On change: store the raw number as today
- Below input: show `(value / base * 100).toFixed(1) + "%"` hint when both are non-zero (already exists)

**In `"pct"` mode:**
- Input value: `base > 0 ? ((value / base) * 100).toFixed(1) : value || ""`
- On change: compute `newAmount = (pctInput / 100) * base` and call `updateFundValue` with `newAmount`
- If `base === 0`: cell behaves as `"eur"` mode (cannot convert without a base)
- Below input: show the resolved `€` amount as a small hint: `fmtC(value)` when non-zero

### Total Column

- In `"eur"` mode: `fmtC(total)` (current behaviour)
- In `"pct"` mode and `base > 0`: `(total / base * 100).toFixed(1) + "%"`
- In `"pct"` mode and `base === 0`: `fmtC(total)` fallback

### Zero-base Fallback

Funds with no committed capital (calls) or no paid-in capital (distributions) cannot show meaningful percentages. When `base === 0`, the cell and total column silently fall back to `€` display and edit, regardless of `editorInputMode`.

## Files Changed

| File | Change |
|------|--------|
| `src/components/ProspectiveCashTab.jsx` | Add `editorInputMode` state; pass to `EditorPanel`; update `EditorPanel` cell render and total column logic; add toolbar toggle |

No other files change.
