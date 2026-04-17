"""
fund_fetch_prices.py
────────────────────
Downloads historical daily NAV prices for bank-managed portfolio funds
(UBS / CaixaBank / WAM-Andbank positions) via Morningstar (mstarpy).

Source: Morningstar NAV series (mstarpy library, free, ISIN-native)

Output:
  ../Mercats Públics/fund_prices/<ISIN>.csv      — one file per fund
  ../Mercats Públics/fund_prices_combined.csv    — long format, all funds
  ../Mercats Públics/fund_prices_wide.csv        — close prices only, wide (date × ISIN)

Usage:
    # Full history from inception:
    python scripts/fund_fetch_prices.py

    # Only update from a specific date:
    python scripts/fund_fetch_prices.py --start 2024-01-01

    # Incremental update (last N days):
    python scripts/fund_fetch_prices.py --days 90

    # Specific ISINs only:
    python scripts/fund_fetch_prices.py --isins LU0113258742 LU1663846050

Requirements:
    pip install mstarpy pandas
"""

import argparse
import io
import sys
import time
from datetime import date, timedelta
from pathlib import Path

import pandas as pd

# UTF-8 output on Windows
if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

FUND_DIR     = Path(__file__).parent.parent / "Mercats Públics" / "fund_prices"
COMBINED_CSV = Path(__file__).parent.parent / "Mercats Públics" / "fund_prices_combined.csv"
WIDE_CSV     = Path(__file__).parent.parent / "Mercats Públics" / "fund_prices_wide.csv"

# Currently held fund ISINs (UBS + CaixaBank portfolios, excluding ETFs already in
# etf_fetch_prices.py). Source: Resum Financer Excel, Master sheet, 2025 values > 0.
# ISINs that overlap with publicMarkets.js ETFs are included — they appear in both
# the direct ETF portfolio AND the bank-managed portfolios.
ALL_ISINS = [
    # ── RV ─────────────────────────────────────────────────────────────────
    "IE00B1G3DH73",   # Vanguard U.S. 500 Stock Index Fund EUR Hedged Acc
    "IE00BD0NCM55",   # iShares Developed World Index Fund EUR
    "LU2489380217",   # Nordea 1 - Global Stable Equity
    "LU1883305259",   # Amundi Fds Euroland Equity J2 EUR C
    "IE00B9DPD161",   # Wellington Strategic Europe
    "LU1482751903",   # Fidelity Global Technology Fund Y-Acc EUR Hedged
    "IE00B42W4L06",   # Vanguard Global Small-Cap Index Fund EUR Acc
    "IE00BZ4D7085",   # Polar Capital Global Technology
    "LU0406496546",   # BlackRock Continental European Flexible
    "LU1472572954",   # DWS Invest Top Dividend IC
    "LU2870883613",   # Amundi Funds Global Equity Income ESG
    "IE00BF2S5F66",   # Man Japan CoreAlpha Equity IXX H EUR
    "LU1678963163",   # Janus Henderson Horizon Global Technology Leaders
    "LU0346388704",   # Fidelity Global Financial Services
    "LU2495342425",   # MFS Meridian Contrarian Value
    "LU0266118651",   # Morgan Stanley US Advantage Fund IH EUR
    "LU1240780673",   # UBS Greater China
    "LU1992117652",   # BSF Emerging Markets Equity Strategies I2 EUR
    "LU1736383024",   # Robeco BP Global Premium Equities FH EUR
    "LU0289214545",   # JPMorgan Europe Equity Plus Fund C
    "IE000KUAO1H5",   # BNY Mellon Small Cap Euroland
    "IE00BFPM9N11",   # Vanguard Global Stock Index Fund Institutional Plus EUR
    "IE00BFRSYK98",   # Janus Henderson Global Life Sciences H
    "LU1276852313",   # Morgan Stanley Global Opportunity Fund IH EUR
    "IE00BVVHP563",   # Brown Advisory Global Leaders B USD
    "LU2043963961",   # UBS MSCI EM Selection Index Fund EUR I A
    "LU1781816530",   # Edmond de Rothschild Big Data CR EUR
    "LU2190959374",   # Goldman Sachs Global Future Technology Leaders
    "LU1737526365",   # T. Rowe Price US Smaller Companies
    "IE00BYWYCC39",   # iShares Emerging Markets Index Fund IE
    "LU0129494729",   # JPMorgan Europe Dynamic Technologies Fund C
    "LU0415391514",   # Bellevue BB Adamant Medtech & Services I EUR
    "LU0625737753",   # Pictet China Index I EUR
    "LU1970471600",   # abrdn China A Share Equity Fund X EUR
    "LU2053547605",   # Pictet China Index IS EUR
    "LU0987205969",   # Amundi MSCI Europe Index
    # ── RF ─────────────────────────────────────────────────────────────────
    "LU0113258742",   # Schroder EURO Corporate Bond C Acc EUR
    "LU1663846050",   # DWS Corporate Hybrid Bonds TFC
    "IE00BDBRDM35",   # iShares Global AGG EUR Hedged
    "ES0165237019",   # Mutuafondo L FI
    "LU0712123867",   # Morgan Stanley Global Fixed Income Opportunities
    "LU0132602656",   # Morgan Stanley Euro Corporate Bond Fund I
    "IE00BD0NC698",   # iShares Euro Credit Bond Index
    "LU1718492769",   # Robeco Financial Institutions Bonds FH
    "IE00BKPLQQ52",   # Lazard Rathmore Alternative Fund S Acc EUR Hedged
    "IE0032464921",   # ANIMA Star High Potential Europe I
    "IE00B80G9288",   # PIMCO GIS Income Fund Institutional EUR Hedged Acc
    "IE00BCZNWT08",   # Algebris Financial Income I EUR Acc
    "LU2386637925",   # Franklin Euro Short Duration Bond AC
    "IE00B81TMV64",   # Algebris Financial Credit Fund I EUR Acc
    "IE00BD0NC698",   # iShares Euro Credit Bond Index (duplicate — kept for completeness)
    "IE00B70B9H10",   # BNY Mellon Global Real Return Fund (EUR) W Acc
    "IE00BD5HXD05",   # Comgest Growth Europe EUR Z Acc
    "IE00BJQ2XG97",   # Man Alpha Select Alternative IN H EUR
    "IE00BNK9T448",   # Amundi Tiedemann Arbitrage Strategy Fund SI EUR
    "LU0079555370",   # JPMorgan Investment Funds - Global Balanced Fund C (acc) - EUR
    "LU0095623541",   # JPMorgan Investment Funds - Global Macro Opportunities Fund C (acc) - EUR
    "LU1442549884",   # MFS Meridian Funds - Prudent Capital Fund WH1 EUR
    "LU1625225666",   # Invesco Funds - Invesco Pan European High Income Fund Z EUR Accumulation
    "LU1748854947",   # Flossbach von Storch - Multiple Opportunities II HT
    "LU2367665606",   # Lumyna-MW TOPS (Market Neutral) UCITS Fund - EUR F (acc)
    # ── Alt ────────────────────────────────────────────────────────────────
    "IE00B8BS6228",   # Amundi Tiedemann Arbitrage Strat I EUR
    "LU0966752916",   # Janus Henderson Absolute Return Fund G2 HEUR
    "LU1028182704",   # DWS Concept Kaldemorgen EUR SC
    "LU1433232698",   # Pictet TR - Atlas I EUR
    "DE000A1C5D13",   # Acatis Gane Value Event Fonds B
    "BE6246059354",   # DPAM B Real Estate E W EUR
    # ── Closed Positions (historical data only) ────────────────────────────
    "FR0013516028",   # Carmignac Credit 2025 F EUR Acc
    "LU0366534344",   # Pictet-Nutrition P EUR
    "LU0940007262",   # Robeco All Strategy Euro Bonds EurHdg
    "LU1878469862",   # Threadneedle (Lux) American Smaller Companies 3EH
    "LU2004795212",   # Schroder ISF QEP Global Emerging Markets K1 Acc EUR
    "LU2110829848",   # Infusive Consumer Alpha Global AA Acc EUR
    "LU2171257319",   # Vontobel Fund Emerging Markets Corporate Bond H EUR Hedged
    "LU2183143846",   # Amundi Funds European Value R (EUR) A
    "LU2257995980",   # Allianz Global Water RT11 EUR Acc
    # ── WAM Andbank Bonds ──────────────────────────────────────────────────
    "ES0280907025", "ES0840609020", "ES0844251019", "FR0013461795",
    "FR0013533999", "FR0014003S56", "PTBCPGOM0067", "US89356BAB45",
    "USF1067PAB25", "XS1172951508", "XS1182150950", "XS1629774230",
    "XS1693822634", "XS2010028343", "XS2010036874", "XS2050933972",
    "XS2056371334", "XS2077670342", "XS2108494837", "XS2121441856",
    "XS2193661324", "XS2224439385", "XS2282606578", "XS2312744217",
    "XS2321520525", "XS2332590632", "XS2342620924", "XS2454874285",
    "XS2463450408"
]

# Remove duplicates while preserving order
_seen: set[str] = set()
ALL_ISINS = [x for x in ALL_ISINS if x not in _seen and not _seen.add(x)]

# Some funds were re-registered or exposed under a different share class in
# Morningstar. When the exact ISIN is unavailable, try these fallbacks and
# keep writing the series under the original portfolio ISIN.
FALLBACK_ISINS: dict[str, list[str]] = {
    "LU1878469862": ["LU1878470019"],  # Threadneedle (Lux) American Smaller Companies 9EH
    "LU2257995980": ["LU1890834598"],   # Allianz Global Water AT EUR Acc
    "LU2005502690": ["LU1637618585", "LU1637618403"],  # Berenberg Eurozone Focus Fund
    "LU2110829848": ["IE00BMWWJZ56", "IE00BMWWK073", "IE00BMWWJX33", "IE00BMWWJY40", "LU1346073783"],  # Infusive Consumer Alpha
}


def fetch_mstarpy(isin: str, start: date | None, end: date | None) -> pd.DataFrame | None:
    """
    Fetch daily NAV history from Morningstar for a single ISIN via mstarpy.
    Returns a DataFrame with columns [date, close, source] or None on failure.
    """
    try:
        import mstarpy
        f = mstarpy.Funds(isin, language="en-gb", pageSize=1)
        name = f.name

        nav_data = f.nav(
            start_date=start or date(2000, 1, 1),
            end_date=end or date.today(),
            frequency="daily",
        )
        if not nav_data:
            return None

        df = pd.DataFrame(nav_data)
        df = df.rename(columns={"nav": "close"})
        df["date"] = pd.to_datetime(df["date"])
        df["source"] = "mstarpy"
        df["name"] = name
        return df[["date", "close", "source", "name"]] if len(df) > 0 else None
    except Exception as e:
        print(f"  mstarpy fail {isin}: {e}")
        return None


def fetch_fund_series(isin: str, start_dt: date | None, end_dt: date | None) -> tuple[pd.DataFrame | None, str | None]:
    """Fetch a fund series, trying the exact ISIN first and known share-class fallbacks."""
    candidates = [isin] + FALLBACK_ISINS.get(isin, [])
    for candidate in candidates:
        df = fetch_mstarpy(candidate, start_dt, end_dt)
        if df is not None and len(df) > 0:
            return df, candidate
    return None, None


def main():
    parser = argparse.ArgumentParser(
        description="Fetch fund NAV history (Morningstar via mstarpy)"
    )
    parser.add_argument("--start", default=None, help="Start date YYYY-MM-DD")
    parser.add_argument("--end",   default=None, help="End date YYYY-MM-DD")
    parser.add_argument("--days",  type=int, default=None,
                        help="Fetch last N days (overrides --start/--end)")
    parser.add_argument("--isins", nargs="*", default=None,
                        help="Specific ISINs to fetch (default: all)")
    args = parser.parse_args()

    start_dt: date | None = None
    end_dt:   date | None = None

    if args.days:
        start_dt = date.today() - timedelta(days=args.days)
        end_dt   = date.today()
    else:
        start_dt = date.fromisoformat(args.start) if args.start else None
        end_dt   = date.fromisoformat(args.end)   if args.end   else None

    isins = args.isins if args.isins else ALL_ISINS

    FUND_DIR.mkdir(parents=True, exist_ok=True)

    results = []
    ok, failed = [], []

    for isin in isins:
        print(f"  {isin} ...", end=" ", flush=True)

        df, resolved_isin = fetch_fund_series(isin, start_dt, end_dt)
        if df is not None and len(df) > 0:
            ok.append(isin)
            suffix = f" via {resolved_isin}" if resolved_isin and resolved_isin != isin else ""
            print(f"OK{suffix}  {len(df):5d} rows  {df['date'].min().date()} -> {df['date'].max().date()}"
                  f"  {df['name'].iloc[0][:40]}")
        else:
            failed.append(isin)
            print("FAILED")
            continue

        df["isin"] = isin
        if resolved_isin and resolved_isin != isin:
            df["source"] = df["source"] + f":alias:{resolved_isin}"

        out = FUND_DIR / f"{isin}.csv"
        df[["date", "isin", "name", "close", "source"]].sort_values("date").to_csv(out, index=False)
        results.append(df)

        time.sleep(0.5)   # be polite to Morningstar

    # ── Merge and save ──────────────────────────────────────────────────────
    if results:
        combined = pd.concat(results, ignore_index=True)
        combined = combined.sort_values(["isin", "date"])
        combined[["date", "isin", "name", "close", "source"]].to_csv(COMBINED_CSV, index=False)

        wide = combined.pivot(index="date", columns="isin", values="close").sort_index()
        wide.to_csv(WIDE_CSV)

        print(f"\n{'─'*60}")
        print(f"OK:     {len(ok):3d} ISINs")
        if failed:
            print(f"Failed: {len(failed):3d} ISINs: {failed}")
        print(f"Total rows:  {len(combined):,}")
        print(f"Date range:  {combined['date'].min().date()} -> {combined['date'].max().date()}")
        print(f"Output:      {FUND_DIR}/")
        print(f"             {COMBINED_CSV}")
        print(f"             {WIDE_CSV}")
    else:
        print("No data fetched.")


if __name__ == "__main__":
    main()
