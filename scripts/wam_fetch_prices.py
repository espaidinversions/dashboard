"""
wam_fetch_prices.py
───────────────────
Downloads historical daily prices for WAM-Andbank corporate bonds
via Boerse Frankfurt (TradingView API).

Output:
  ../Mercats Públics/wam_prices/<ISIN>.csv      — one file per bond
  ../Mercats Públics/wam_prices_combined.csv    — long format, all bonds
  ../Mercats Públics/wam_prices_wide.csv        — close prices only, wide (date × ISIN)

Usage:
    python scripts/wam_fetch_prices.py
"""

import io
import sys
import time
import requests
import json
from datetime import datetime, date
from pathlib import Path
import pandas as pd

# UTF-8 output on Windows
if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

WAM_DIR      = Path(__file__).parent.parent / "Mercats Públics" / "wam_prices"
COMBINED_CSV = Path(__file__).parent.parent / "Mercats Públics" / "wam_prices_combined.csv"
WIDE_CSV     = Path(__file__).parent.parent / "Mercats Públics" / "wam_prices_wide.csv"

ALL_ISINS = [
    "ES0280907025", "ES0840609020", "ES0844251019", "FR0013461795",
    "FR0013533999", "FR0014003S56", "PTBCPGOM0067", "US89356BAB45",
    "USF1067PAB25", "XS1172951508", "XS1182150950", "XS1629774230",
    "XS1693822634", "XS2010028343", "XS2010036874", "XS2050933972",
    "XS2056371334", "XS2077670342", "XS2108494837", "XS2121441856",
    "XS2193661324", "XS2224439385", "XS2282606578", "XS2312744217",
    "XS2321520525", "XS2332590632", "XS2342620924", "XS2454874285",
    "XS2463450408"
]

def fetch_bf_history(isin: str):
    """Fetch history from Boerse Frankfurt TradingView API."""
    url = f"https://api.boerse-frankfurt.de/v1/tradingview/history?symbol={isin}&resolution=D&from=1577836800&to={int(time.time())}"
    headers = {'User-Agent': 'Mozilla/5.0'}
    
    try:
        r = requests.get(url, headers=headers, timeout=10)
        if r.status_code == 200:
            data = r.json()
            if data.get('s') == 'ok' and 't' in data:
                df = pd.DataFrame({
                    'date': pd.to_datetime(data['t'], unit='s'),
                    'close': data['c']
                })
                df['isin'] = isin
                df['source'] = "BF"
                df['name'] = isin
                return df
    except Exception as e:
        print(f"  Error for {isin}: {e}")
    return None

def main():
    WAM_DIR.mkdir(parents=True, exist_ok=True)
    results = []
    ok, failed = [], []

    print(f"Fetching {len(ALL_ISINS)} WAM bonds from Boerse Frankfurt...")

    for isin in ALL_ISINS:
        print(f"  {isin} ...", end=" ", flush=True)
        df = fetch_bf_history(isin)
        if df is not None and not df.empty:
            ok.append(isin)
            print(f"OK ({len(df):4d} rows) {df['date'].min().date()} -> {df['date'].max().date()}")
            df["isin"] = isin
            out = WAM_DIR / f"{isin}.csv"
            df.to_csv(out, index=False)
            results.append(df)
        else:
            failed.append(isin)
            print("FAILED")
        time.sleep(0.5)

    if results:
        combined = pd.concat(results, ignore_index=True)
        combined = combined.sort_values(["isin", "date"])
        combined.to_csv(COMBINED_CSV, index=False)

        wide = combined.pivot(index="date", columns="isin", values="close").sort_index()
        wide.to_csv(WIDE_CSV)

        print(f"\n{'─'*60}")
        print(f"OK:     {len(ok):3d} ISINs")
        if failed:
            print(f"Failed: {len(failed):3d} ISINs: {failed}")
        print(f"Output: {WAM_DIR}/")
    else:
        print("\nNo data fetched.")

if __name__ == "__main__":
    main()
