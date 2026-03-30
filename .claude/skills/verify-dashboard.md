---
name: verify-dashboard
description: Pre-commit verification checklist for the Turtle Capital Dashboard
type: project
---

# Verify Dashboard

**Trigger:** Run before any commit. Run after any non-trivial code change.

## Checklist

- [ ] Dev server starts without errors: `npm run dev`
- [ ] `/` loads — Dashboard shows portfolio summary cards
- [ ] `/investments` loads — table shows both funds and companies
- [ ] `/fund/<any-slug>` loads — KPI cards, J-curve chart, and transaction log visible
- [ ] `/company/<any-slug>` loads — KPI cards, operative metrics, and entry info visible
- [ ] Dark/light toggle works on all pages (sun/moon icon in header)
- [ ] No red errors in browser console
- [ ] No React key warnings in browser console
- [ ] Build passes: `npm run build` exits 0

## Example

Passing run:
```
✅ npm run dev — server on :5173 + :3001, no errors
✅ / — "Turtle Capital" header, 5 KPI cards visible
✅ /investments — fund table + company table, no blank rows
✅ /fund/acme-growth — Compromís €1.2M, J-curve renders
✅ /company/abc-co — TVPI 1.4×, revenue €5M, flag "ES"
✅ Dark toggle — colors switch, no flash of unstyled content
✅ Console — 0 errors, 0 key warnings
✅ npm run build — exit 0
```

## Gotchas

- **Blank page, no error** — ThemeContext crash. The page's outer wrapper must pass `{ tc, dark, toggle }` to `ThemeContext.Provider`. Never pass a raw color object (`TC_LIGHT`/`TC_DARK`). `useTheme()` returns `{ tc, dark, toggle }`.
- **"Not found" page** — Slug mismatch. Verify `slugify(fons)` or `slugify(nom)` matches the URL segment. Check `src/utils.js` for the `slugify` function.
