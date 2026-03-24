"""
etf_fetch_prices.py
───────────────────
Downloads historical daily OHLCV prices for all portfolio ETFs using yfinance.
Reads the ISIN→ticker map produced by etf_map_isins.py.

Output:
  ../Mercats Públics/prices/<ISIN>.csv      — one file per ETF
  ../Mercats Públics/prices_combined.csv    — all ETFs in one long-format CSV
  ../Mercats Públics/prices_wide.csv        — close prices only, wide format (date × ETF)

Usage:
    # First time (fetch all history from 2021-01-01):
    python scripts/etf_fetch_prices.py

    # Incremental update (only last 30 days):
    python scripts/etf_fetch_prices.py --days 30

    # Custom date range:
    python scripts/etf_fetch_prices.py --start 2023-01-01 --end 2025-03-31

Requirements:
    pip install yfinance pandas
"""

import argparse
import json
from datetime import date, timedelta
from pathlib import Path

import pandas as pd
import yfinance as yf

MAP_PATH     = Path(__file__).parent.parent / "Mercats Públics" / "isin_ticker_map.json"
PRICES_DIR   = Path(__file__).parent.parent / "Mercats Públics" / "prices"
COMBINED_CSV = Path(__file__).parent.parent / "Mercats Públics" / "prices_combined.csv"
WIDE_CSV     = Path(__file__).parent.parent / "Mercats Públics" / "prices_wide.csv"

DEFAULT_START = "2021-01-01"


def load_map() -> dict[str, dict]:
    if not MAP_PATH.exists():
        raise FileNotFoundError(
            f"Ticker map not found at {MAP_PATH}.\n"
            "Run  python scripts/etf_map_isins.py  first."
        )
    data = json.loads(MAP_PATH.read_text())
    return data["map"]  # {isin: {yf_ticker, name, ...}}


def fetch_prices(ticker_map: dict[str, dict], start: str, end: str) -> pd.DataFrame:
    """
    Download adjusted close (OHLCV) for all tickers in one batched yfinance call.
    Returns a MultiIndex DataFrame (field × ticker).
    """
    # Build isin→ticker and ticker→isin lookups
    isin_to_ticker = {isin: info["yf_ticker"] for isin, info in ticker_map.items()}
    ticker_to_isin = {v: k for k, v in isin_to_ticker.items()}
    tickers = list(isin_to_ticker.values())

    print(f"Downloading {len(tickers)} tickers from {start} to {end}…")
    raw = yf.download(
        tickers,
        start=start,
        end=end,
        auto_adjust=True,   # adjusts for splits + dividends
        progress=True,
        threads=True,
    )

    # yfinance returns MultiIndex columns (field, ticker) when >1 ticker
    if isinstance(raw.columns, pd.MultiIndex):
        close = raw["Close"]
    else:
        # Single ticker edge case — wrap in a DataFrame with the ticker as column
        close = raw[["Close"]].rename(columns={"Close": tickers[0]})

    # Check for tickers that returned no data
    missing = [t for t in tickers if t not in close.columns or close[t].isna().all()]
    if missing:
        print(f"\n⚠  No data returned for: {missing}")
        print("   These may need a different exchange suffix. Check etf_map_isins.py output.")

    return raw, close, ticker_to_isin


def build_long_df(raw: pd.DataFrame, ticker_to_isin: dict[str, str], ticker_map: dict[str, dict]) -> pd.DataFrame:
    """Build a long-format DataFrame with columns: date, isin, ticker, name, open, high, low, close, volume."""
    isin_to_name = {isin: info.get("name", "") for isin, info in ticker_map.items()}

    if not isinstance(raw.columns, pd.MultiIndex):
        # Single ticker
        ticker = list(ticker_to_isin.keys())[0]
        isin   = ticker_to_isin[ticker]
        df = raw.copy()
        df.columns = [c.lower() for c in df.columns]
        df["isin"]   = isin
        df["ticker"] = ticker
        df["name"]   = isin_to_name.get(isin, "")
        df.index.name = "date"
        return df.reset_index()[["date", "isin", "ticker", "name", "open", "high", "low", "close", "volume"]]

    records = []
    for ticker in raw["Close"].columns:
        isin = ticker_to_isin.get(ticker, "")
        name = isin_to_name.get(isin, "")
        sub  = raw.xs(ticker, axis=1, level=1).copy()
        sub.columns = [c.lower() for c in sub.columns]
        sub["isin"]   = isin
        sub["ticker"] = ticker
        sub["name"]   = name
        sub.index.name = "date"
        records.append(sub.reset_index())

    return pd.concat(records, ignore_index=True)[
        ["date", "isin", "ticker", "name", "open", "high", "low", "close", "volume"]
    ]


def save_per_isin(long_df: pd.DataFrame):
    """Save one CSV per ISIN to Mercats Públics/prices/."""
    PRICES_DIR.mkdir(exist_ok=True)
    for isin, group in long_df.groupby("isin"):
        path = PRICES_DIR / f"{isin}.csv"
        group.sort_values("date").to_csv(path, index=False)
    print(f"Saved {long_df['isin'].nunique()} per-ISIN CSV files → {PRICES_DIR}/")


def main():
    parser = argparse.ArgumentParser(description="Fetch historical ETF prices via yfinance")
    parser.add_argument("--start", default=DEFAULT_START, help="Start date YYYY-MM-DD")
    parser.add_argument("--end",   default=date.today().isoformat(), help="End date YYYY-MM-DD")
    parser.add_argument("--days",  type=int, default=None,
                        help="Shortcut: fetch last N days (overrides --start/--end)")
    args = parser.parse_args()

    if args.days:
        args.start = (date.today() - timedelta(days=args.days)).isoformat()
        args.end   = date.today().isoformat()

    ticker_map = load_map()
    print(f"Loaded ticker map: {len(ticker_map)} ISINs")

    raw, close, ticker_to_isin = fetch_prices(ticker_map, args.start, args.end)

    # ── Per-ISIN CSVs ─────────────────────────────────────────────────────
    long_df = build_long_df(raw, ticker_to_isin, ticker_map)
    long_df = long_df.dropna(subset=["close"])

    save_per_isin(long_df)

    # ── Combined long CSV ─────────────────────────────────────────────────
    long_df.sort_values(["isin", "date"]).to_csv(COMBINED_CSV, index=False)
    print(f"Saved combined CSV → {COMBINED_CSV}")

    # ── Wide close prices CSV (date × ISIN) ───────────────────────────────
    isin_to_ticker = {isin: info["yf_ticker"] for isin, info in ticker_map.items()}
    ticker_to_isin_clean = {v: k for k, v in isin_to_ticker.items()}

    wide = close.copy()
    # Rename columns from ticker to ISIN for clarity
    wide.rename(columns=ticker_to_isin_clean, inplace=True)
    wide.index.name = "date"
    wide.sort_index().to_csv(WIDE_CSV)
    print(f"Saved wide close prices CSV → {WIDE_CSV}")

    # ── Summary ───────────────────────────────────────────────────────────
    print(f"\n── Summary ──────────────────────────────────────────")
    print(f"Period:  {args.start} → {args.end}")
    print(f"ETFs:    {long_df['isin'].nunique()} with data / {len(ticker_map)} total")
    print(f"Rows:    {len(long_df):,}")
    print(f"Dates:   {long_df['date'].min().date()} → {long_df['date'].max().date()}")
    if not long_df.empty:
        print("\nLatest close prices:")
        latest = (
            long_df.sort_values("date")
            .groupby("isin")
            .last()
            .reset_index()[["isin", "name", "ticker", "date", "close"]]
        )
        latest["name"] = latest["name"].str[:45]
        print(latest.to_string(index=False))


if __name__ == "__main__":
    main()
