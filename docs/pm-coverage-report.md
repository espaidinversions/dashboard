# PM Vehicle Data Coverage Report

**Updated:** 2026-04-02
**Scope:** current public-market vehicle rows, historical closed rows, price series, current value coverage, one-pager coverage, and custodian/strategy attribution.

## Summary

- Raw source rows: 59 active tranches, 206 closed rows
- Deduped report rows: 33 active instrument keys, 202 closed historical rows
- One-pagers: available for all active and closed rows via the shared detail route

| Bucket | Rows | Price series | Current value | Custodian attribution | Strategy attribution |
| :--- | :---: | :---: | :---: | :---: | :---: |
| Active rows | 33 | 33/33 | 33/33 | 33/33 | 33/33 |
| Closed rows | 202 | 197/202 | 52/202 | 190/202 | 202/202 |
| Total | 235 | 230/235 | 85/235 | 223/235 | 235/235 |

## Data Strategy Coverage

| Source strategy | Active rows | Closed rows | Notes |
| :--- | :---: | :---: | :--- |
| ETF / market | 33 | 5 | Fully covered |
| Morningstar | 0 | 165 | Fully covered |
| WAM PDF | 0 | 27 | Fully covered |
| Manual / static | 0 | 5 | Legacy rows without a public price feed |

## Custodian Attribution

- Active rows with direct custodian attribution: 33/33
- Closed rows with direct custodian attribution: 52/202
- Closed rows with custodian derived from the transaction ledger: 138/202
- Closed rows still missing a deterministic custodian: 12/202

## Unresolved Price-Series Gaps

These are the closed rows that still have no public price history and remain on manual/static valuation paths.

| Year | Vehicle | ISIN | Custodian | Strategy | Source path |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 2022 | `INFUSIVE CONSUMER ALPHA GLOBAL _AA ACC EUR` | `LU2110829848` | Credit Suisse | RV | manual / static |
| 2022 | `Schroder International Selection Fund QEP Global Emerging Markets K1 Accumulation EUR` | `LU2004795212` | Credit Suisse | RV | manual / static |
| 2024 | `Carmignac Credit 2025 F EUR Acc` | `FR0013516028` | Credit Suisse | RF | manual / static |
| — | `Unicredit 3.875% VTO 03/06/2027` | `XS2121441856` | Andbank | RF | manual / static |
| — | `SACE SPA 5.511% CALL 10/02/2027` | `XS1182150950` | Andbank | RF | manual / static |

## Notes

- `price series` means an external historical CSV exists in `Mercats Públics/prices`, `Mercats Públics/fund_prices`, or `Mercats Públics/wam_prices` and is imported into `src/data/fundPrices.js`.
- `current value` means the vehicle has a current valuation in the public-market data model, even when there is no public history feed.
- The closed ledger still has legacy rows where custodian attribution cannot be reconstructed from the transaction history alone.
