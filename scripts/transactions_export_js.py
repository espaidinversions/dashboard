"""
transactions_export_js.py
──────────────────────────
Builds a transaction log (buys + sells) for all PM positions from the Excel.

Sources:
  - ETf's Espai RV / ETf's Espai RF  → ETF buy tranches (exact date)
  - Master sheet (active)             → managed-fund buy tranches (date or year-end estimate)
  - Master sheet (TANCATS sections)   → managed-fund sells (approximated Dec 31 of TANCATS year)

Output:
  src/data/pmTransactions.js   export const PM_TRANSACTIONS = [...]

Each entry:
  { id, action, date, isin, nom, tipus, custodian, units, nav, valueEur }

Usage:
    python scripts/transactions_export_js.py
"""

import csv
import io
import json
import os
import re
import shutil
import sys
import tempfile
from datetime import date, datetime, timedelta
from pathlib import Path

import openpyxl

if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

ROOT   = Path(__file__).parent.parent
OUT_JS = ROOT / "src" / "data" / "pmTransactions.js"

YEAREND_COLS = {
    27: date(2018, 12, 31), 26: date(2019, 12, 31), 25: date(2020, 12, 31),
    24: date(2021, 12, 31), 23: date(2022, 12, 31), 22: date(2023, 12, 31),
    21: date(2024, 12, 31), 20: date(2025, 12, 31),
}

CUSTODIAN_CODES = {
    "CAIXA": "CaixaBank", "CAIXA*": "CaixaBank",
    "CS": "Credit Suisse", "UBS": "UBS",
    "JPM": "JPMorgan", "Abel": "CaixaBank", "ABEL": "CaixaBank",
    "Bankinter": "Bankinter", "BANKINTER": "Bankinter",
}

ISIN_RE      = re.compile(r"([A-Z]{2}[A-Z0-9]{10})")
TANCATS_RE   = re.compile(r"TANCATS\s+(\d{4})", re.IGNORECASE)
TIPUS_MAP    = {"RV": "RV", "RF": "RF", "Estruct": "Estruct"}
PRICES_DIR   = ROOT / "Mercats Públics" / "prices"


def load_etf_prices() -> dict[str, list[tuple[date, float]]]:
    """Load all ETF price CSVs → { isin: [(date, close), ...] sorted ascending }."""
    prices: dict[str, list[tuple[date, float]]] = {}
    for csv_path in PRICES_DIR.glob("*.csv"):
        isin = csv_path.stem
        rows = []
        with open(csv_path, encoding="utf-8", newline="") as f:
            for r in csv.DictReader(f):
                try:
                    rows.append((date.fromisoformat(r["date"]), float(r["close"])))
                except (KeyError, ValueError):
                    pass
        if rows:
            prices[isin] = sorted(rows)
    return prices


def find_closest_price(prices: list[tuple[date, float]], tx_date: date) -> float | None:
    """Binary-search for the closest price on or before tx_date; fall back to earliest if none."""
    if not prices:
        return None
    lo, hi = 0, len(prices) - 1
    result = None
    while lo <= hi:
        mid = (lo + hi) // 2
        if prices[mid][0] <= tx_date:
            result = prices[mid][1]
            lo = mid + 1
        else:
            hi = mid - 1
    # If no price on/before tx_date, return earliest available
    return result if result is not None else prices[0][1]


def clean_isin(v):
    if not v: return None
    m = ISIN_RE.search(str(v).upper())
    return m.group(1) if m else None


def parse_date(val):
    if val is None: return None
    if isinstance(val, datetime): return val.date()
    if isinstance(val, date): return val
    if isinstance(val, (int, float)) and val > 1000:
        try: return (datetime(1899, 12, 30) + timedelta(days=int(val))).date()
        except Exception: pass
    return None


def infer_date_from_yearend(row):
    """Return earliest year-end where the position had a positive value."""
    for col_idx in sorted(YEAREND_COLS.keys(), reverse=True):
        if col_idx < len(row) and isinstance(row[col_idx], (int, float)) and row[col_idx] > 0:
            return YEAREND_COLS[col_idx]
    return None


def load_wb():
    xlsx_files = list(ROOT.glob("Mercats Públics/*.xlsx"))
    if not xlsx_files:
        print("ERROR: no .xlsx in Mercats Públics/"); sys.exit(1)
    tmp = Path(os.environ.get("TEMP", tempfile.gettempdir())) / "espai_tx_tmp.xlsx"
    shutil.copy2(xlsx_files[0], tmp)
    return openpyxl.load_workbook(tmp, data_only=True)


def etf_buys(wb, etf_prices: dict):
    txs = []
    for sheet, isin_col, nom_col, date_col, units_col, banc_col, tipus in [
        ("ETf's Espai RV", 6, 3, 4, 8, 0, "RV"),
        ("ETf's Espai RF", 6, 2, 3, 8, None, "RF"),
    ]:
        ws = wb[sheet]
        for row in ws.iter_rows(min_row=3, values_only=True):
            isin = clean_isin(row[isin_col]) if row[isin_col] else None
            if not isin: continue
            nom     = str(row[nom_col]).strip() if row[nom_col] else ""
            pdate   = parse_date(row[date_col])
            units   = row[units_col]
            banc    = str(row[banc_col]).strip() if banc_col is not None and row[banc_col] else None
            custodian = "Bankinter" if banc and banc.upper() == "BANKINTER" else "CaixaBank"
            if not units or not isinstance(units, (int, float)) or units <= 0: continue
            nav = None
            value_eur = None
            if pdate and isin in etf_prices:
                nav = find_closest_price(etf_prices[isin], pdate)
                if nav is not None:
                    value_eur = round(float(units) * nav, 0)
            txs.append({
                "action": "buy", "date": pdate, "isin": isin, "nom": nom,
                "tipus": tipus, "custodian": custodian, "units": float(units),
                "nav": nav, "valueEur": value_eur,
            })
    return txs


def master_txs(wb):
    """Returns both buy (active) and sell (TANCATS) transactions from Master sheet."""
    ws = wb["Master"]
    # Find Gestor column
    gestor_col = None
    for row in ws.iter_rows(min_row=1, max_row=5, values_only=True):
        if row[1] == "Tipus":
            gestor_col = next((i for i, v in enumerate(row) if v == "Gestor"), None)
            break

    txs = []
    current_tancats_year = None

    for row in ws.iter_rows(min_row=4, values_only=True):
        row_str = " ".join(str(c) for c in row if c is not None)
        m = TANCATS_RE.search(row_str)
        if m:
            current_tancats_year = int(m.group(1))

        tipus_raw  = str(row[1]).strip() if row[1] else ""
        nom        = str(row[2]).strip() if row[2] else ""
        isin_raw   = row[5]
        n_titols   = row[9]
        nav_raw    = row[10]   # current NAV column
        value_raw  = row[11]   # current value column
        gestor_raw = row[gestor_col] if gestor_col and len(row) > gestor_col else None

        isin = clean_isin(isin_raw) if isin_raw else None
        if not isin or not nom or len(nom) < 3: continue
        if not isinstance(gestor_raw, str) or not gestor_raw.strip(): continue
        if not n_titols or not isinstance(n_titols, (int, float)) or n_titols <= 0: continue

        custodian = CUSTODIAN_CODES.get(gestor_raw.strip(), gestor_raw.strip())
        tipus     = "RV" if "RV" in tipus_raw.upper() else ("RF" if "RF" in tipus_raw.upper() else "RV")
        nav       = float(nav_raw) if isinstance(nav_raw, (int, float)) and nav_raw > 0 else None
        value_eur = float(value_raw) if isinstance(value_raw, (int, float)) and value_raw > 0 else None

        is_closed = current_tancats_year is not None

        if not is_closed:
            # Active buy
            pdate = parse_date(row[3]) or infer_date_from_yearend(row)
            txs.append({
                "action": "buy", "date": pdate, "isin": isin, "nom": nom,
                "tipus": tipus, "custodian": custodian, "units": float(n_titols),
                "nav": nav, "valueEur": value_eur,
            })
        else:
            # Closed sell — approximate sell date to Dec 31 of TANCATS year
            sell_date = date(current_tancats_year, 12, 31)
            txs.append({
                "action": "sell", "date": sell_date, "isin": isin, "nom": nom,
                "tipus": tipus, "custodian": custodian, "units": float(n_titols),
                "nav": nav, "valueEur": value_eur,
            })

    return txs


def main():
    wb = load_wb()
    print("Loading ETF price CSVs…")
    etf_prices = load_etf_prices()
    print(f"  {len(etf_prices)} ISINs with price history")

    print("Reading ETF tranches…")
    etf = etf_buys(wb, etf_prices)
    print(f"  {len(etf)} ETF buy tranches")

    print("Reading Master sheet tranches…")
    master = master_txs(wb)
    buys  = [t for t in master if t["action"] == "buy"]
    sells = [t for t in master if t["action"] == "sell"]
    print(f"  {len(buys)} managed-fund buys")
    print(f"  {len(sells)} managed-fund sells (TANCATS)")

    all_txs = etf + master
    # Sort by date (None dates last)
    all_txs.sort(key=lambda t: t["date"] or date(2099, 1, 1))

    # Assign stable IDs
    for i, tx in enumerate(all_txs):
        tx["id"] = f"tx-{i:04d}"
        # Serialize date
        tx["date"] = tx["date"].isoformat() if tx["date"] else None

    # Round floats
    for tx in all_txs:
        if tx["nav"] is not None: tx["nav"] = round(tx["nav"], 4)
        if tx["valueEur"] is not None: tx["valueEur"] = round(tx["valueEur"], 0)

    payload = json.dumps(all_txs, ensure_ascii=False, indent=None, separators=(",", ":"))
    out = (
        "// Auto-generated by scripts/transactions_export_js.py — do not edit manually\n"
        f"export const PM_TRANSACTIONS = {payload};\n"
    )
    OUT_JS.write_text(out, encoding="utf-8")
    print(f"\nTotal transactions: {len(all_txs)}")
    print(f"Output: {OUT_JS}")

    # Preview first/last 3
    print("\nSample (first 3):")
    for tx in all_txs[:3]:
        print(f"  {tx['date']} {tx['action']:4} {tx['isin']} {tx['nom'][:40]}")
    print("Sample (last 3):")
    for tx in all_txs[-3:]:
        print(f"  {tx['date']} {tx['action']:4} {tx['isin']} {tx['nom'][:40]}")


if __name__ == "__main__":
    main()
