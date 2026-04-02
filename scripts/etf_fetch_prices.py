"""
etf_fetch_prices.py
───────────────────
Downloads historical daily prices for all portfolio ETFs.

Primary source:  justetf-scraping (ISIN-native, full history back to inception,
                 handles renamed/discontinued/Lyxor→Amundi funds perfectly)
Fallback source: yfinance (exchange prices, used if justETF fetch fails)

Output:
  ../Mercats Públics/prices/<ISIN>.csv      — one file per ETF (close/NAV price)
  ../Mercats Públics/prices_combined.csv    — long format, all ETFs
  ../Mercats Públics/prices_wide.csv        — close prices only, wide (date × ISIN)

Usage:
    # Full history from inception:
    python scripts/etf_fetch_prices.py

    # Only update from a specific date:
    python scripts/etf_fetch_prices.py --start 2024-01-01

    # Incremental update (last N days):
    python scripts/etf_fetch_prices.py --days 90

Requirements:
    pip install -r scripts/requirements.txt
"""

import argparse
import io
import json
import os
import sys
import time
from datetime import date, timedelta
from pathlib import Path

# UTF-8 output on Windows
if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

# Fix SSL cert path broken on Windows Store Python when username has non-ASCII chars.
# libcurl (used by yfinance's curl_cffi backend) fails if cacert.pem path contains
# unicode characters. Copy it to an ASCII-safe location BEFORE importing yfinance.
try:
    import certifi, shutil
    _cert_src = certifi.where()
    if not all(ord(c) < 128 for c in _cert_src):
        _cert_dst = Path(os.environ.get("TEMP", "C:/tmp")) / "cacert_ascii.pem"
        _cert_dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy(_cert_src, _cert_dst)
        _cert_src = str(_cert_dst)
    os.environ["SSL_CERT_FILE"]      = _cert_src
    os.environ["REQUESTS_CA_BUNDLE"] = _cert_src
    os.environ["CURL_CA_BUNDLE"]     = _cert_src
except ImportError:
    pass

import pandas as pd

PRICES_DIR   = Path(__file__).parent.parent / "Mercats Públics" / "prices"
COMBINED_CSV = Path(__file__).parent.parent / "Mercats Públics" / "prices_combined.csv"
WIDE_CSV     = Path(__file__).parent.parent / "Mercats Públics" / "prices_wide.csv"
MAP_PATH     = Path(__file__).parent.parent / "Mercats Públics" / "isin_ticker_map.json"

# All valid ISINs in the portfolio.
# The 3 ISINs with bad check digits (IE00B3ZW0K19, LU1681043600, LU1834988519)
# are data-entry typos in publicMarkets.js — they map to the valid ISINs already listed.
ALL_ISINS = [
    "FR0010524777", "FR0010527275",
    "IE000F6G1DE0", "IE00B3VWM098", "IE00B3XXRP09", "IE00B3ZW0K18",
    "IE00B441G979", "IE00B9M6SJ31", "IE00BDBRDM35", "IE00BFMXXD54",
    "IE00BFXR7900", "IE00BGPP6473", "IE00BJGWQN72", "IE00BKM4GZ66",
    "IE00BKT6FV49", "IE00BQN1K786", "IE00BQN1K901", "IE00BYVQ9F29", "IE00BF4RFH31",
    "LU1407888137", "LU1681043599", "LU1681044647", "LU1834988518",
    "US4642871507", "US4642876555", "US78464A8392", "US9220428588", "US92206C7065",
]

# Some positions in the source data contain typo ISINs or stale internal codes.
# Fetch the canonical underlying series and write it under the portfolio ISIN so
# downstream consumers do not need to understand these aliases.
FALLBACK_ISINS = {
    "IE00B3ZW0K19": ["IE00B3ZW0K18"],
    "IE00BQN1K787": ["IE00BQN1K786"],
    "IE00BQN1K788": ["IE00BQN1K786"],
    "LU1681043600": ["LU1681043599"],
    "LU1834988519": ["LU1834988518"],
}


# ── justETF source ────────────────────────────────────────────────────────────

def fetch_justetf(isin: str, start: str | None, end: str | None) -> pd.DataFrame | None:
    """
    Fetch full NAV history from justETF.com for a single ISIN.
    Returns a DataFrame with columns [date, close, source] or None on failure.
    justETF uses NAV prices — essentially identical to exchange close for
    accumulating UCITS ETFs (typically within 0.1-0.2% of market price).
    """
    try:
        from justetf_scraping import load_chart
        df = load_chart(isin)
        df = df[["quote"]].rename(columns={"quote": "close"})
        df.index.name = "date"
        df = df.reset_index()
        df["date"] = pd.to_datetime(df["date"])
        if start:
            df = df[df["date"] >= pd.Timestamp(start)]
        if end:
            df = df[df["date"] <= pd.Timestamp(end)]
        df["source"] = "justetf"
        return df if len(df) > 0 else None
    except Exception as e:
        print(f"  justETF fail {isin}: {e}")
        return None


def fetch_justetf_with_aliases(isin: str, start: str | None, end: str | None) -> tuple[pd.DataFrame | None, str | None]:
    candidates = [isin] + FALLBACK_ISINS.get(isin, [])
    for candidate in candidates:
        df = fetch_justetf(candidate, start, end)
        if df is not None and len(df) > 0:
            return df, candidate
    return None, None


# ── yfinance fallback ─────────────────────────────────────────────────────────

def load_ticker_map() -> dict:
    if not MAP_PATH.exists():
        return {}
    return json.loads(MAP_PATH.read_text(encoding="utf-8")).get("map", {})


def fetch_yfinance(isin: str, ticker: str, start: str | None, end: str | None) -> pd.DataFrame | None:
    """Fetch exchange price history from Yahoo Finance for a single ticker."""
    try:
        import yfinance as yf
        t = yf.Ticker(ticker)
        kw = dict(auto_adjust=True)
        if start:
            kw["start"] = start
        else:
            kw["period"] = "max"
        if end:
            kw["end"] = end
        hist = t.history(**kw)
        if hist.empty:
            return None
        df = hist[["Close"]].rename(columns={"Close": "close"})
        df.index.name = "date"
        df = df.reset_index()
        df["date"] = pd.to_datetime(df["date"]).dt.tz_localize(None)
        df["source"] = "yfinance"
        return df
    except Exception as e:
        print(f"  yfinance fail {isin} ({ticker}): {e}")
        return None


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Fetch ETF price history (justETF + yfinance fallback)")
    parser.add_argument("--start", default=None, help="Start date YYYY-MM-DD (default: from inception)")
    parser.add_argument("--end",   default=None, help="End date YYYY-MM-DD (default: today)")
    parser.add_argument("--days",  type=int, default=None,
                        help="Fetch last N days (overrides --start/--end)")
    parser.add_argument("--isins", nargs="*", default=None,
                        help="Specific ISINs to fetch (default: all)")
    args = parser.parse_args()

    if args.days:
        args.start = (date.today() - timedelta(days=args.days)).isoformat()
        args.end   = date.today().isoformat()

    isins = args.isins if args.isins else ALL_ISINS
    ticker_map = load_ticker_map()

    PRICES_DIR.mkdir(parents=True, exist_ok=True)

    results = []
    justetf_ok, yf_ok, failed = [], [], []

    for isin in isins:
        print(f"  {isin} ...", end=" ", flush=True)

        # ── Step 1: try justETF ──
        df, resolved_isin = fetch_justetf_with_aliases(isin, args.start, args.end)
        if df is not None and len(df) > 0:
            justetf_ok.append(isin)
            suffix = f" via {resolved_isin}" if resolved_isin and resolved_isin != isin else ""
            print(f"justETF{suffix}  {len(df):5d} rows  {df['date'].min().date()} -> {df['date'].max().date()}")
        else:
            # ── Step 2: yfinance fallback ──
            info = ticker_map.get(resolved_isin or isin, {})
            ticker = info.get("yf_ticker") if info else None
            if ticker:
                df = fetch_yfinance(isin, ticker, args.start, args.end)
                if df is not None:
                    yf_ok.append(isin)
                    print(f"yfinance {len(df):5d} rows  {df['date'].min().date()} -> {df['date'].max().date()}")
                else:
                    failed.append(isin)
                    print("FAILED")
                    continue
            else:
                failed.append(isin)
                print("FAILED (no ticker)")
                continue

        df["isin"] = isin
        df["name"] = ticker_map.get(resolved_isin or isin, {}).get("name", "") if ticker_map else ""

        # Save per-ISIN CSV
        out = PRICES_DIR / f"{isin}.csv"
        df[["date", "isin", "name", "close", "source"]].sort_values("date").to_csv(out, index=False)
        results.append(df)

        time.sleep(0.25)   # be polite to justETF

    # ── Merge and save ────────────────────────────────────────────────────────
    if results:
        combined = pd.concat(results, ignore_index=True)
        combined = combined.sort_values(["isin", "date"])
        combined[["date", "isin", "name", "close", "source"]].to_csv(COMBINED_CSV, index=False)

        wide = combined.pivot(index="date", columns="isin", values="close").sort_index()
        wide.to_csv(WIDE_CSV)

        print(f"\n{'─'*56}")
        print(f"justETF source:  {len(justetf_ok):2d} ISINs")
        print(f"yfinance source: {len(yf_ok):2d} ISINs")
        if failed:
            print(f"Failed:          {len(failed):2d} ISINs: {failed}")
        print(f"Total rows:      {len(combined):,}")
        print(f"Date range:      {combined['date'].min().date()} -> {combined['date'].max().date()}")
        print(f"Output:          {PRICES_DIR}/")
        print(f"                 {COMBINED_CSV}")
        print(f"                 {WIDE_CSV}")
    else:
        print("No data fetched.")


if __name__ == "__main__":
    main()
