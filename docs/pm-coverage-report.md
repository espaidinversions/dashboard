# PM Vehicle Data Coverage Report

**Updated:** 2026-04-14
**Scope:** current public-market vehicle rows, historical closed rows, price series, current value coverage, one-pager coverage, and custodian/strategy attribution.

## Summary

- Raw source rows: 118 active tranches, 150 closed rows
- Deduped report rows: 92 active instrument keys, 150 closed historical rows
- One-pagers: available for all active and closed rows via the shared detail route

| Bucket | Rows | Price series | Current value | Custodian attribution | Strategy attribution |
| :--- | :---: | :---: | :---: | :---: | :---: |
| Active rows | 92 | 92/92 | 92/92 | 92/92 | 92/92 |
| Closed rows | 150 | 148/150 | 150/150 | 149/150 | 150/150 |
| Total | 242 | 240/242 | 242/242 | 241/242 | 242/242 |

## Data Strategy Coverage

| Source strategy | Active rows | Closed rows | Notes |
| :--- | :---: | :---: | :--- |
| ETF / market | 36 | 2 | Fully covered |
| Morningstar | 56 | 146 | Fully covered |
| WAM PDF | 0 | 0 | Fully covered |
| Estimated bond | 0 | 0 | Fully covered |
| Manual / static | 0 | 2 | Legacy rows without a public price feed |

## Custodian Attribution

- Active rows with direct custodian attribution: 92/92
- Closed rows with direct custodian attribution: 35/150
- Closed rows with custodian derived from the transaction ledger: 114/150
- Closed rows still missing a deterministic custodian: 1/150

## Unresolved Price-Series Gaps

These are the closed rows that still have no public price history and remain on manual/static valuation paths.

| Year | Vehicle | ISIN | Custodian | Strategy | Source path |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 2022 | `Schroder International Selection Fund QEP Global Emerging Markets K1 Accumulation EUR` | `LU2004795212` | Credit Suisse | RV | manual / static |
| 2024 | `Carmignac Credit 2025 F EUR Acc` | `FR0013516028` | Credit Suisse | RF | manual / static |

## Notes

- `price series` means an external historical CSV exists in `Mercats Públics/prices`, `Mercats Públics/fund_prices`, or `Mercats Públics/wam_prices` and is imported into `src/generated/prices/fundPrices.js`; 2 additional bond ISINs are now covered by an explicit estimated series.
- `current value` means the vehicle has a current valuation in the public-market data model, even when there is no public history feed.
- The closed ledger still has legacy rows where custodian attribution cannot be reconstructed from the transaction history alone.
