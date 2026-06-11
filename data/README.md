# data/

Local source documents and exports used by the import/backfill scripts in `scripts/`.
Everything here except this README and `tipus_transaccions_harmonization.csv` is
git-ignored (workbooks, PDFs, screenshots contain private financial data).

| File | Used by |
|------|---------|
| `2022.06.16 Capital Calls.xlsx` | `scripts/cc_import.mjs`, `scripts/cc_import_append.mjs`, `scripts/compare_cash_model_inputs.mjs` |
| `260120_Allocation_Fons.xlsx` | `scripts/backfill_vehicle_tipus.mjs`, `scripts/backfill_cc_est_from_allocation.mjs` |
| `260424_Equivalència_Conceptes.xlsx` | `scripts/cc_import_append.mjs` (type-mapping overrides) |
| `ID_Vehicles.xlsx` | `scripts/generate_private_entities_catalog.mjs` |
| `moviments Espai des de 2022.PDF.pdf` | `scripts/parse_bank_movements_pdf.py` |
| `nif_gaps_*.xlsx` | output of `scripts/nif_gaps.mjs export` |
| `files search/` | search-fund raw source documents |
| Other workbooks / images / html | reference material, not read by code |

Related data folders that stay at the repo root because code and ignore rules
point at them directly:

- `raw-data/` — CSV drop folder watched by `server.js`
- `Mercats Públics/` — public-markets price data managed by the fetch scripts
