# Capital Calls Append Import Pipeline — Design Spec

**Date:** 2026-05-19
**Status:** Approved

## Overview

A new standalone Node.js ESM script `scripts/cc_import_append.mjs` that reads a new capital calls Excel (two sheets: funds + companies), resolves vehicle names to existing DB entities, deduplicates against existing rows, and inserts only new transactions. Does not touch the existing destructive `cc_import.mjs`.

## CLI Interface

```
node scripts/cc_import_append.mjs <excel.xlsx> [--equivalencia <eq.xlsx>] [--dry-run]
```

- `<excel.xlsx>` — required, path to the new capital calls Excel
- `--equivalencia` — optional, path to Equivalència Conceptes Excel (defaults to `260424_Equivalència_Conceptes.xlsx` in the same directory)
- `--dry-run` — prints the report without writing to DB

Exits with code 1 on: missing Supabase credentials, unparseable Excel, or full insert batch failure.

## Architecture & Data Flow

```
new_excel.xlsx
  ├─ sheet 0 (funds)     → rows, vcpe from col 12 (PE/VC/RE)
  └─ sheet 1 (companies) → rows, vcpe forced to "PC"
          ↓
Equivalència_Conceptes.xlsx → tipusConceptMap  (raw type → canonical concept)
          ↓
Supabase private_entities → nameToId map  (vehicle/company name → UUID)
          ↓
normalize each row  (tipus, cat, eur, sign)
          ↓
Supabase capital_calls (existing) → dedup set  keyed on (vehicle_id|normalizedTipus|data|eurCents)
          ↓
filter to new-only rows
          ↓
INSERT into capital_calls  (skipped if --dry-run)
          ↓
report: X read / Y unmatched / Z duplicate / W inserted
```

## Sheet Parsing & Column Mapping

Both sheets share the "Capital Calls log" layout. Header at row 7, data from row 8. Column indices (0-based):

| Col | Field | Notes |
|-----|-------|-------|
| 1 | `fons` | Vehicle / company name |
| 2 | `tipus` | Raw type string |
| 4 | `data` | Excel date serial → ISO `YYYY-MM-DD` |
| 5 | `importLocal` | Amount in original currency → `amountNative` |
| 6 | `divisa` | "EUR" / "USD" |
| 12 | `vcpe` | PE/VC/RE — overridden to "PC" for companies sheet |
| 14 | `eur` | Pre-converted EUR amount (read directly, no BCE API call) |
| 15 | `est` | Strategy |

Rows where `fons` is blank or `eur` is not a finite number are skipped silently (subtotal/header rows).

`amountNative` is signed via `normalizeCapitalCallSignedAmount(normalizedTipus, importLocal)`.

## Concept Mapping

Parse `Equivalència_Conceptes.xlsx` first sheet. Columns 0 and 1 = raw type string and canonical concept. Build `Map<slugifiedRawType, canonicalConcept>`.

During normalization:
1. Slugify raw `tipus` → lookup in map → canonical concept string
2. Fallback: `normalizeCapitalCallTipus()` from `capitalCallTipusModel.js` for types not in the Equivalència sheet
3. `inferCapitalCallCategoryFromTipus()` derives `cat` (Capital Call / Distribució / Compromís)

This replaces the hardcoded `CAT_MAP` in `cc_import.mjs`.

## Name Resolution

Fetch all `private_entities` rows once at startup. Build:
- `exactMap`: `normalized(name) → id`
- Fallback: first entity whose normalized name starts with the normalized input

Unmatched names: collected, logged as a warning block at the end, rows skipped. Does not abort the import.

## Deduplication

Fetch existing `capital_calls` with `select vehicle_id, tipus, data, eur` only.

Build dedup set: `Set<string>` of keys `${vehicle_id}|${normalizedTipus}|${data}|${Math.round(eur * 100)}`.

Integer cents comparison (`Math.round(eur * 100)`) avoids floating-point mismatches.

## Output Format

```
Reading sheets...
  funds:     142 rows
  companies:  38 rows

Resolving names...
  ✓ matched 168 / 180 rows
  ✗ unmatched (12 rows skipped):
      "Fons Innovació IV" — no match in private_entities
      ...

Deduplicating against 1 204 existing rows...
  new: 43 / duplicate: 125

Inserting 43 rows... done.
Summary: 180 read · 12 unmatched · 125 duplicate · 43 inserted
```

## Error Handling

- Missing Supabase credentials → exit 1 immediately
- Unparseable Excel → exit 1 with message
- Partial insert failure mid-batch → log error, continue, report failed count in summary
- All rows unmatched or all duplicates → exit 0 with summary (not an error)

## Files Touched

| File | Change |
|------|--------|
| `scripts/cc_import_append.mjs` | New file |

No changes to existing scripts, models, or migrations.
