"""
fetch_fx.py
───────────
Downloads historical daily FX rates (EUR base) via Yahoo Finance and writes one
CSV per currency pair. These series are consumed by the value-building pipeline
to convert non-EUR instrument prices into EUR:

    pm_monthly_snapshot.mjs   — month-end bucket totals
    portfolio_build_values.py — historical value reconstruction

Rate convention: each CSV stores the number of QUOTE-currency units per 1 EUR
(e.g. EURUSD close = USD per 1 EUR). To convert a price in USD to EUR:
    eur = usd / EURUSD_rate(date)

Output:
  ../Mercats Públics/fx/<PAIR>.csv    — columns: date, pair, close, source

Usage:
    python scripts/fetch_fx.py                      # default pairs (EURUSD)
    python scripts/fetch_fx.py --pairs EURUSD EURGBP
    python scripts/fetch_fx.py --start 2019-01-01

Requirements:
    pip install yfinance pandas
"""

import argparse
import io
import os
import sys
from datetime import date
from pathlib import Path

# UTF-8 output on Windows
if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

# Fix SSL cert path broken on Windows Store Python when username has non-ASCII chars.
try:
    import certifi
    import shutil

    _cert_src = certifi.where()
    if not all(ord(c) < 128 for c in _cert_src):
        _cert_dst = Path(os.environ.get("TEMP", "C:/tmp")) / "cacert_ascii.pem"
        _cert_dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy(_cert_src, _cert_dst)
        _cert_src = str(_cert_dst)
    os.environ["SSL_CERT_FILE"] = _cert_src
    os.environ["REQUESTS_CA_BUNDLE"] = _cert_src
    os.environ["CURL_CA_BUNDLE"] = _cert_src
except ImportError:
    pass

import pandas as pd

FX_DIR = Path(__file__).parent.parent / "Mercats Públics" / "fx"

# EUR-base pairs. The Yahoo ticker for EURUSD is "EURUSD=X" and its Close is the
# number of USD per 1 EUR — exactly the convention this pipeline expects.
DEFAULT_PAIRS = ["EURUSD"]


def fetch_pair(pair: str, start_dt: date | None) -> pd.DataFrame | None:
    """Fetch a EUR-base FX series. `pair` like 'EURUSD' (no '=X')."""
    try:
        import yfinance as yf

        ticker = f"{pair}=X"
        t = yf.Ticker(ticker)
        kw: dict = dict(auto_adjust=False)
        if start_dt:
            kw["start"] = start_dt.isoformat()
        else:
            kw["period"] = "max"
        hist = t.history(**kw)
        if hist.empty:
            return None
        df = hist[["Close"]].rename(columns={"Close": "close"})
        df.index.name = "date"
        df = df.reset_index()
        df["date"] = pd.to_datetime(df["date"]).dt.tz_localize(None)
        df["pair"] = pair
        df["source"] = "yfinance"
        return df[["date", "pair", "close", "source"]]
    except Exception as exc:  # noqa: BLE001 — surface any fetch failure to the operator
        print(f"  yfinance fail {pair}: {exc}")
        return None


def main() -> None:
    parser = argparse.ArgumentParser(description="Fetch EUR-base FX rates (Yahoo Finance)")
    parser.add_argument("--pairs", nargs="*", default=None, help="Pairs like EURUSD EURGBP")
    parser.add_argument("--start", default=None, help="Start date YYYY-MM-DD")
    args = parser.parse_args()

    start_dt = date.fromisoformat(args.start) if args.start else None
    pairs = args.pairs if args.pairs else DEFAULT_PAIRS

    FX_DIR.mkdir(parents=True, exist_ok=True)

    ok, failed = [], []
    for pair in pairs:
        print(f"  {pair} ...", end=" ", flush=True)
        df = fetch_pair(pair, start_dt)
        if df is None or df.empty:
            failed.append(pair)
            print("FAILED")
            continue
        out = FX_DIR / f"{pair}.csv"
        df.sort_values("date").to_csv(out, index=False)
        ok.append(pair)
        print(f"{len(df):5d} rows  {df['date'].min().date()} -> {df['date'].max().date()}")

    print(f"\n{'─' * 50}")
    print(f"OK:     {ok}")
    if failed:
        print(f"Failed: {failed}")
    print(f"Output: {FX_DIR}/")


if __name__ == "__main__":
    main()
