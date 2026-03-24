"""
etf_map_isins.py
────────────────
One-time step: maps the portfolio ISINs → Yahoo Finance ticker symbols
via the OpenFIGI API (free, no rate-limit issues with an API key).

Run once, result is cached to  ../Mercats Públics/isin_ticker_map.json
Re-run any time to refresh (e.g. if a new position is added).

Usage:
    python scripts/etf_map_isins.py [--api-key YOUR_OPENFIGI_KEY]

Get a free API key at: https://www.openfigi.com/api
(Without a key it works but rate-limits to 25 req/min.)
"""

import argparse
import json
import re
import time
from pathlib import Path

import requests

# ── ISINs extracted from src/data/publicMarkets.js ─────────────────────────
# Raw values — some have a leading "TICKER - " artefact that we strip below.
RAW_ISINS = [
    "FR0010524777",
    "FR0010527275",
    "IE000F6G1DE0",
    "IE00B3VWM098",
    "IE00B3XXRP09",
    "IE00B3ZW0K18",
    "IE00B3ZW0K19",
    "IE00B441G979",
    "IE00B9M6SJ31",
    "IE00BDBRDM35",
    "IE00BFMXXD54",
    "IE00BFXR7900",
    "IE00BGPP6473",
    "IE00BJGWQN72",
    "IE00BKM4GZ66",
    "IE00BKT6FV49",
    "IE00BQN1K901",
    "IE00BYVQ9F29",
    "IEMO - IE00BQN1K786",   # strip prefix → IE00BQN1K786
    "LU1407888137",
    "LU1681043599",
    "LU1681043600",
    "LU1681044647",
    "LU1834988518",
    "LU1834988519",
    "US4642871507",
    "US4642876555",
    "US78464A8392",
    "US92206C7065",
    "VWO - US9220428588",    # strip prefix → US9220428588
]

# Preferred exchange order when an ISIN maps to multiple listings.
# Xetra first (best EUR liquidity + yfinance history), then Euronext Amsterdam,
# then Paris, Milan, London. US tickers kept as-is.
EXCHANGE_PREFERENCE = ["GR", "NA", "FP", "IM", "LN", "US", "UN", "UW"]

# OpenFIGI exchCode → Yahoo Finance suffix
EXCH_SUFFIX = {
    "GR": ".DE",   # Xetra
    "NA": ".AS",   # Euronext Amsterdam
    "FP": ".PA",   # Euronext Paris
    "IM": ".MI",   # Borsa Italiana
    "LN": ".L",    # London Stock Exchange
    "SM": ".MC",   # BME Madrid
}

OPENFIGI_URL = "https://api.openfigi.com/v3/mapping"
BATCH_SIZE   = 100  # max jobs per request with API key (10 without)


def clean_isin(raw: str) -> str:
    """Strip 'TICKER - ' prefix artefacts and return the bare ISIN."""
    m = re.search(r"([A-Z]{2}[A-Z0-9]{10})", raw)
    return m.group(1) if m else raw.strip()


def pick_ticker(mappings: list[dict]) -> dict | None:
    """
    From a list of OpenFIGI mappings for one ISIN, pick the best listing.
    Returns a dict with keys: ticker, exchCode, name, securityType.
    """
    if not mappings:
        return None

    # Score each mapping by preferred exchange order
    def score(m):
        exch = m.get("exchCode", "")
        try:
            return EXCHANGE_PREFERENCE.index(exch)
        except ValueError:
            return 999

    best = sorted(mappings, key=score)[0]
    exch  = best.get("exchCode", "")
    raw_ticker = best.get("ticker", "")
    suffix = EXCH_SUFFIX.get(exch, "")
    yf_ticker = raw_ticker + suffix if suffix else raw_ticker

    return {
        "yf_ticker":    yf_ticker,
        "raw_ticker":   raw_ticker,
        "exchCode":     exch,
        "name":         best.get("name", ""),
        "securityType": best.get("securityType", ""),
        "figi":         best.get("figi", ""),
    }


def query_openfigi(isins: list[str], api_key: str | None) -> dict[str, dict | None]:
    """
    Query OpenFIGI for a list of ISINs.
    Returns {isin: ticker_info_or_None}.
    """
    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["X-OPENFIGI-APIKEY"] = api_key

    results = {}

    for i in range(0, len(isins), BATCH_SIZE):
        batch = isins[i : i + BATCH_SIZE]
        jobs  = [{"idType": "ID_ISIN", "idValue": isin} for isin in batch]

        resp = requests.post(OPENFIGI_URL, headers=headers, json=jobs, timeout=30)
        if resp.status_code == 429:
            print("  Rate limited — waiting 12 seconds…")
            time.sleep(12)
            resp = requests.post(OPENFIGI_URL, headers=headers, json=jobs, timeout=30)

        resp.raise_for_status()
        data = resp.json()

        for isin, result in zip(batch, data):
            if "data" in result and result["data"]:
                results[isin] = pick_ticker(result["data"])
            else:
                print(f"  ⚠  No mapping found for {isin}: {result.get('error', 'unknown')}")
                results[isin] = None

        if i + BATCH_SIZE < len(isins):
            time.sleep(1)  # be polite between batches

    return results


def main():
    parser = argparse.ArgumentParser(description="Map portfolio ISINs to Yahoo Finance tickers via OpenFIGI")
    parser.add_argument("--api-key", default=None, help="OpenFIGI API key (free at openfigi.com)")
    args = parser.parse_args()

    # Clean and deduplicate ISINs
    isins = sorted({clean_isin(r) for r in RAW_ISINS})
    print(f"Mapping {len(isins)} unique ISINs…")

    results = query_openfigi(isins, args.api_key)

    # Report
    mapped   = {k: v for k, v in results.items() if v is not None}
    unmapped = [k for k, v in results.items() if v is None]
    print(f"\n✓ Mapped:   {len(mapped)}")
    print(f"✗ Unmapped: {len(unmapped)}")
    if unmapped:
        print(f"  {unmapped}")

    print("\nTicker map:")
    for isin, info in sorted(mapped.items()):
        print(f"  {isin}  →  {info['yf_ticker']:20s}  ({info['name'][:50]})")

    # Save to JSON
    out_dir = Path(__file__).parent.parent / "Mercats Públics"
    out_dir.mkdir(exist_ok=True)
    out_path = out_dir / "isin_ticker_map.json"

    payload = {
        "generated": __import__("datetime").date.today().isoformat(),
        "map": {isin: info for isin, info in sorted(results.items()) if info},
        "unmapped": unmapped,
    }
    out_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False))
    print(f"\nSaved → {out_path}")


if __name__ == "__main__":
    main()
