"""
fund_fetch_ter.py
─────────────────
Fetches TER (Total Expense Ratio / Ongoing Charge) for all portfolio ISINs.

Sources:
  - ETFs:           justetf_scraping.load_overview()  → df.loc[isin]['ter']
  - Managed funds:  mstarpy.Funds.feeMifid()           → Mifid.OngoingCostActual

Output:
  Mercats Públics/fund_ter.json   { [isin]: ter_pct }   e.g. "IE00BFMXXD54": 0.07

Usage:
    python scripts/fund_fetch_ter.py

Existing values in fund_ter.json are preserved if a new fetch fails (incremental).
"""

import io
import json
import sys
import time
from pathlib import Path

if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

ROOT     = Path(__file__).parent.parent
OUT_JSON = ROOT / "Mercats Públics" / "fund_ter.json"

# ── ETF ISINs (justETF source) ─────────────────────────────────────────────────
ETF_ISINS = [
    "FR0010524777", "FR0010527275",
    "IE000F6G1DE0", "IE00B3VWM098", "IE00B3XXRP09", "IE00B3ZW0K18",
    "IE00B441G979", "IE00B9M6SJ31", "IE00BDBRDM35", "IE00BFMXXD54",
    "IE00BFXR7900", "IE00BGPP6473", "IE00BJGWQN72", "IE00BKM4GZ66",
    "IE00BKT6FV49", "IE00BQN1K786", "IE00BQN1K901", "IE00BYVQ9F29",
    "LU1407888137", "LU1681043599", "LU1681044647", "LU1834988518",
    "US4642871507", "US4642876555", "US78464A8392", "US9220428588", "US92206C7065",
]

# ── Managed fund ISINs (mstarpy source) ───────────────────────────────────────
FUND_ISINS = [
    # RV
    "IE00B1G3DH73", "IE00BD0NCM55", "LU2489380217", "LU1883305259",
    "IE00B9DPD161", "LU1482751903", "IE00B42W4L06", "IE00BZ4D7085",
    "LU0406496546", "LU1472572954", "LU2870883613", "IE00BF2S5F66",
    "LU1678963163", "LU0346388704", "LU2495342425", "LU0266118651",
    "LU1240780673", "LU1992117652", "LU1736383024", "LU0289214545",
    "IE000KUAO1H5", "IE00BFPM9N11", "IE00BFRSYK98", "LU1276852313",
    "IE00BVVHP563", "LU2043963961", "LU1781816530", "LU2190959374",
    "LU1737526365", "IE00BYWYCC39", "LU0129494729", "LU0415391514",
    "LU0625737753", "LU1970471600", "LU2053547605", "LU0987205969",
    # RF
    "LU0113258742", "LU1663846050", "IE00BDBRDM35", "ES0165237019",
    "LU0712123867", "LU0132602656", "IE00BD0NC698", "LU1718492769",
    "IE00BKPLQQ52", "IE0032464921", "IE00B80G9288", "IE00BCZNWT08",
    "LU2386637925", "IE00B81TMV64",
    # Additional active positions
    "LU1279334053", "IE00B246KL88", "LU2098119287", "LU0346389181",
    "LU1299707072", "IE00B03HD316", "LU0690374029",
    "LU1587985224", "LU0248183658", "ES0125104002", "LU0957820193",
    "LU1862449409", "LU0950588763", "IE0007471471", "LU1431483780",
    "BE6246078545", "IE00B3PY8J28",
    # Alt
    "IE00B8BS6228", "LU0966752916", "LU1028182704", "LU1433232698",
    "DE000A1C5D13", "BE6246059354",
]

# Deduplicate, exclude ETF ISINs from fund list
_etf_set = set(ETF_ISINS)
FUND_ISINS = list(dict.fromkeys(i for i in FUND_ISINS if i not in _etf_set))


def fetch_etf_ters() -> dict[str, float]:
    """Batch-fetch TER for all ETF ISINs via justetf_scraping.load_overview()."""
    try:
        from justetf_scraping import load_overview
        print("  Loading justETF overview…", flush=True)
        df = load_overview(currency="EUR")
        # Index is ISIN, column is 'ter'
        result = {}
        for isin in ETF_ISINS:
            if isin in df.index:
                ter = df.loc[isin, "ter"]
                if ter is not None and str(ter) not in ("", "nan", "None"):
                    result[isin] = round(float(ter), 4)
        print(f"  justETF: {len(result)}/{len(ETF_ISINS)} TERs found", flush=True)
        return result
    except Exception as e:
        print(f"  justETF batch fetch failed: {e}", flush=True)
        return {}


def fetch_fund_ter_mstarpy(isin: str) -> float | None:
    """Fetch ongoing charge for a single managed-fund ISIN via mstarpy feeMifid()."""
    try:
        import mstarpy
        f = mstarpy.Funds(isin, language="en-gb", pageSize=1)

        # Primary: feeMifid → Mifid.OngoingCostActual
        try:
            data = f.feeMifid()
            mifid = data.get("Mifid", {})
            for key in ("OngoingCostActual", "OngoingCostEstimated"):
                if mifid.get(key) is not None:
                    return round(float(mifid[key]), 4)
        except Exception:
            pass

        # Fallback: investmentFee → kiidOngoingCharge
        try:
            data = f.investmentFee()
            actual = data.get("actualInvestmentFees", {})
            for key in ("kiidOngoingCharge", "ongoingCost"):
                if actual.get(key) is not None:
                    return round(float(actual[key]), 4)
        except Exception:
            pass

        return None
    except Exception as e:
        print(f"  mstarpy fail {isin}: {type(e).__name__}: {e}", flush=True)
        return None


def main():
    # Load existing data to preserve values for ISINs that fail
    existing: dict[str, float] = {}
    if OUT_JSON.exists():
        try:
            existing = json.loads(OUT_JSON.read_text(encoding="utf-8"))
            print(f"Loaded {len(existing)} existing TER values from {OUT_JSON.name}", flush=True)
        except Exception:
            pass

    result = dict(existing)

    # ── ETFs via justETF ───────────────────────────────────────────────────────
    print("\nFetching ETF TERs via justETF…", flush=True)
    etf_ters = fetch_etf_ters()
    result.update(etf_ters)

    # ── Managed funds via mstarpy ──────────────────────────────────────────────
    print(f"\nFetching managed fund TERs via mstarpy ({len(FUND_ISINS)} ISINs)…", flush=True)
    ok = fail = skip = 0
    for i, isin in enumerate(FUND_ISINS, 1):
        ter = fetch_fund_ter_mstarpy(isin)
        if ter is not None:
            result[isin] = ter
            print(f"  [{i:3}/{len(FUND_ISINS)}] {isin}  →  {ter:.4f}%", flush=True)
            ok += 1
        else:
            if isin in existing:
                print(f"  [{i:3}/{len(FUND_ISINS)}] {isin}  →  (kept: {existing[isin]:.4f}%)", flush=True)
                skip += 1
            else:
                print(f"  [{i:3}/{len(FUND_ISINS)}] {isin}  →  FAILED", flush=True)
                fail += 1
        time.sleep(0.4)

    print(f"\nManaged funds: {ok} new, {skip} kept existing, {fail} failed", flush=True)

    # ── Write output ───────────────────────────────────────────────────────────
    OUT_JSON.write_text(
        json.dumps(result, ensure_ascii=False, indent=2, sort_keys=True),
        encoding="utf-8",
    )
    print(f"\nTotal ISINs with TER: {len(result)}", flush=True)
    print(f"Output: {OUT_JSON}", flush=True)

    sample = list(sorted(result.items()))[:5]
    for isin, ter in sample:
        print(f"  {isin}: {ter}%", flush=True)


if __name__ == "__main__":
    main()
