# PM Vehicle Price Data Coverage Report

**Generated:** 2026-03-31
**Script source:** `Mercats Públics/` Python scripts (Morningstar via `mstarpy`)

## Summary

| Category | Total vehicles | With price data | Missing price data |
|----------|---------------|-----------------|-------------------|
| Active positions | 30 | 27 | **3** |
| Closed/discontinued | 139 | 128 | **11** |
| **Total** | **169** | **155** | **14** |

---

## Active Positions Without Price Data (3)

| ISIN | Name | Reason |
|------|------|--------|
| `IE00B3ZW0K19` | iShares S&P 500 EUR Hedged UCITS ETF (Acc) | Purchased 2026-03-19 — too new, Morningstar not yet indexed |
| `LU1681043600` | Amundi MSCI World UCITS ETF - EUR (C) | Morningstar coverage gap |
| `LU1834988519` | Amundi Stoxx Europe 600 Technology UCITS ETF Acc | Morningstar coverage gap |

---

## Closed Positions Without Price Data (11)

| ISIN | Name |
|------|------|
| `FR0013516028` | Carmignac Credit 2025 F EUR Acc |
| `IE00BQN1K787` | iShares Edge MSCI Europe Momentum Factor UCITS ETF |
| `IE00BQN1K788` | iShares Edge MSCI Europe Momentum Factor UCITS ETF (dup) |
| `LU0366534344` | Pictet-Nutrition P EUR |
| `LU0940007262` | Robeco All Strategy Euro Bonds EurHdg |
| `LU1878469862` | Threadneedle (Lux) American Smaller Companies 3EH |
| `LU2004795212` | Schroder ISF QEP Global Emerging Markets K1 Acc EUR |
| `LU2110829848` | Infusive Consumer Alpha Global AA Acc EUR |
| `LU2171257319` | Vontobel Fund Emerging Markets Corporate Bond H EUR Hedged |
| `LU2183143846` | Amundi Funds European Value R (EUR) A |
| `LU2257995980` | Allianz Global Water RT11 EUR Acc |

---

## How to Fix

Add missing ISINs to the Morningstar fetch list in the Python scripts under `Mercats Públics/`.
Re-run the script to populate `fund_prices_combined.csv` and regenerate `portfolioValues.js`.

For `IE00B3ZW0K19`: wait ~1 month for Morningstar to index the new position, then re-run.
