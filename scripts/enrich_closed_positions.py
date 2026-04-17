"""
enrich_closed_positions.py
──────────────────────────
Enriches PM_CLOSED entries with computed fields derived from the canonical PM transactions model
and fetches historic price series for each closed ISIN via Morningstar (mstarpy).

Inputs:
  src/generated/publicMarkets/publicMarketsModel.generated.js  — canonical PM model

Per-ISIN computed fields (from transactions):
  gestor      — gestor from the first (oldest) buy transaction for this ISIN
  custodian   — custodian from the first (oldest) buy transaction for this ISIN
  divisa      — always "EUR"
  dataCompra  — min date of buy transactions
  costEur     — sum of buy valueEur
  unitats     — sum of buy units
  costInici   — costEur / unitats
  valorMercat — sum of ALL sell valueEur (total proceeds)
  rendInici   — (valorMercat − costEur) / costEur × 100

Price history fetch (Morningstar via mstarpy):
  Period: dataCompra → Dec 31 of `any` (year closed)
  Output: daily NAV × unitats = market-value series

Outputs (in scripts/out/ — review before merging):
  scripts/out/pm_closed_enriched.js  — enriched PM_CLOSED array
  scripts/out/pm_closed_values.js    — PM_CLOSED_VALUES export (same shape as PM_VALUES)

Usage:
    python -m scripts.enrich_closed_positions
    python -m scripts.enrich_closed_positions --skip-prices   # skip Morningstar fetch

Requirements:
    pip install mstarpy pandas
"""

import argparse
import io
import json
import re
import sys
from functools import lru_cache
from datetime import date
from pathlib import Path

from scripts.pm_model_types import PMClosedRow, PMTransactionRow, PMValuePoint

# ── UTF-8 output on Windows ───────────────────────────────────────────────────
if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

ROOT          = Path(__file__).parent.parent
SCRIPTS       = Path(__file__).parent
OUT_DIR       = SCRIPTS / "out"
PM_MODEL_FILE = ROOT / "src" / "generated" / "publicMarkets" / "publicMarketsModel.generated.js"


# ── Parse JavaScript data files ──────────────────────────────────────────────

def _strip_js(text: str) -> str:
    """Remove JS export/import boilerplate and trailing commas so json.loads works."""
    # Remove block comments
    text = re.sub(r"/\*.*?\*/", "", text, flags=re.DOTALL)
    # Remove line comments
    text = re.sub(r"//[^\n]*", "", text)
    # Remove trailing commas before } or ]
    text = re.sub(r",(\s*[}\]])", r"\1", text)
    # Add double quotes to unquoted property names
    text = re.sub(r'([{,]\s*)([a-zA-Z0-9_]+)(\s*:)', r'\1"\2"\3', text)
    return text


@lru_cache(maxsize=1)
def load_pm_model() -> dict:
    """Parse PM_MODEL_GENERATED from the generated canonical PM model export."""
    raw = PM_MODEL_FILE.read_text(encoding="utf-8")
    raw = _strip_js(raw)
    m = re.search(r"export\s+const\s+PM_MODEL_GENERATED\s*=\s*(\{.*\});", raw, re.DOTALL)
    if not m:
        raise ValueError(f"Could not parse PM_MODEL_GENERATED from {PM_MODEL_FILE}")
    return json.loads(m.group(1))


def load_transactions() -> list[PMTransactionRow]:
    """Load PM transactions from the canonical generated PM model."""
    return load_pm_model().get("activity", {}).get("transactions", [])


def load_pm_closed() -> list[PMClosedRow]:
    """Load PM_CLOSED from the canonical generated PM model."""
    return load_pm_model().get("holdings", {}).get("closed", [])


# ── Compute enriched fields ───────────────────────────────────────────────────

def enrich_from_transactions(closed: list[PMClosedRow], txs: list[PMTransactionRow]) -> list[PMClosedRow]:
    """Add computed fields to each PM_CLOSED entry from the transaction ledger."""
    # Group transactions by ISIN
    by_isin: dict[str, list[dict]] = {}
    for t in txs:
        isin = t.get("isin")
        if not isin:
            continue
        by_isin.setdefault(isin, []).append(t)

    # Detect duplicate ISINs in PM_CLOSED (same ISIN, multiple years)
    isin_counts: dict[str, int] = {}
    for p in closed:
        isin_counts[p["isin"]] = isin_counts.get(p["isin"], 0) + 1
    duplicate_isins = {isin for isin, cnt in isin_counts.items() if cnt > 1}
    if duplicate_isins:
        print(f"\n⚠  WARNING — duplicate ISINs in PM_CLOSED (multi-year positions):")
        for isin in sorted(duplicate_isins):
            entries = [p for p in closed if p["isin"] == isin]
            years   = [str(p["any"]) for p in entries]
            print(f"   {isin}  years={years}  — fields will be blended across all years")
        print("   Review these entries manually before merging pm_closed_enriched.js\n")

    enriched = []
    for p in closed:
        isin  = p["isin"]
        isin_txs = by_isin.get(isin, [])

        buys  = sorted(
            [t for t in isin_txs if t.get("action") == "buy" and t.get("date")],
            key=lambda t: t["date"],
        )
        sells = [t for t in isin_txs if t.get("action") == "sell"]

        result = dict(p)  # start with existing fields

        if buys:
            first_buy      = buys[0]
            result["gestor"]    = first_buy.get("gestor") or first_buy.get("custodian") or None
            result["custodian"] = first_buy.get("custodian") or None
            result["divisa"]    = "EUR"
            result["dataCompra"]= first_buy["date"]

            cost_eur   = sum(t.get("valueEur") or 0 for t in buys)
            units      = sum(t.get("units")    or 0 for t in buys)
            result["costEur"]   = round(cost_eur, 2) if cost_eur else None
            result["unitats"]   = round(units, 4)    if units    else None
            result["costInici"] = round(cost_eur / units, 4) if units else None
        else:
            result["gestor"]    = None
            result["custodian"] = None
            result["divisa"]    = "EUR"
            result["dataCompra"]= None
            result["costEur"]   = None
            result["unitats"]   = None
            result["costInici"] = None

        sell_val = sum(t.get("valueEur") or 0 for t in sells) if sells else 0
        result["valorMercat"] = round(sell_val, 2) if sell_val else 0

        if result.get("costEur") and result["costEur"] > 0:
            result["rendInici"] = round(
                (result["valorMercat"] - result["costEur"]) / result["costEur"] * 100, 2
            )
        else:
            result["rendInici"] = None

        # Preserve existing annual return fields (manual from Excel) as null
        result.setdefault("costAnual", None)
        for yr in range(2019, date.today().year + 1):
            result.setdefault(f"rend{yr}", None)

        enriched.append(result)

    return enriched


# ── Price fetch ───────────────────────────────────────────────────────────────

def fetch_prices_for_closed(enriched: list[PMClosedRow]) -> dict[str, dict[str, list[PMValuePoint]]]:
    """
    Fetch Morningstar NAV series for each closed ISIN and multiply by units
    to get a market-value series.

    Returns: { isin: { custodian: [{date, value}, ...] } }
    Coverage note: Most PM_CLOSED entries are UCITS mutual funds. yfinance covers
    ETFs and equities well but mstarpy has better UCITS coverage. Expect price
    charts for a minority — the detail page degrades gracefully with an empty dict.
    """
    try:
        import mstarpy
    except ImportError:
        print("⚠  mstarpy not installed — skipping price fetch (pip install mstarpy)")
        return {}

    closed_values: dict[str, dict] = {}

    for p in enriched:
        isin      = p["isin"]
        units     = p.get("unitats") or 0
        start_date= p.get("dataCompra")
        any_year  = p.get("any")
        custodian = p.get("custodian") or "Unknown"

        if not units or not start_date or not any_year:
            continue

        end_date = f"{any_year}-12-31"

        try:
            fund = mstarpy.Fund(term=isin, country="es")
            hist = fund.historicalData(
                start_date=start_date,
                end_date=end_date,
                frequency="monthly",
            )
            if not hist:
                continue

            series = []
            for row in hist:
                d    = row.get("date") or row.get("Date") or row.get("endDate")
                nav  = row.get("nav")  or row.get("NAV")  or row.get("close") or row.get("Close")
                if d and nav:
                    try:
                        val = round(float(nav) * units, 2)
                        series.append({"date": str(d)[:10], "value": val})
                    except (ValueError, TypeError):
                        pass

            if series:
                closed_values[isin] = {custodian: sorted(series, key=lambda x: x["date"])}
                print(f"  ✓ {isin}  {len(series)} monthly points")
            else:
                print(f"  - {isin}  no data returned")

        except Exception as exc:
            print(f"  - {isin}  fetch error: {exc}")

    return closed_values


# ── JS serialisation ──────────────────────────────────────────────────────────

def _to_js_value(v) -> str:
    if v is None:
        return "null"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int, float)):
        return str(v)
    # Escape backslashes and double quotes
    s = str(v).replace("\\", "\\\\").replace('"', '\\"')
    return f'"{s}"'


def _obj_to_js(obj: dict, indent: int = 2) -> str:
    pad = " " * indent
    lines = []
    for k, v in obj.items():
        lines.append(f"{pad}{k}: {_to_js_value(v)}")
    return "{ " + ", ".join(lines) + " }"


def write_enriched_js(enriched: list[PMClosedRow], path: Path) -> None:
    lines = [
        "// Auto-generated by scripts/enrich_closed_positions.py",
        "// Review before merging into src/data/publicMarkets.js",
        "// Excel-sourced fields (rend20XX, costAnual) remain null — fill manually.",
        "export const PM_CLOSED = [",
    ]
    for p in enriched:
        # Build ordered key list matching spec schema
        ordered_keys = [
            "any", "nom", "isin", "tipus",
            "gestor", "custodian", "divisa",
            "dataCompra", "costEur", "unitats", "costInici",
            "valorMercat", "rendInici", "costAnual",
        ]
        # Append annual rend keys found in the object
        rend_keys = sorted([k for k in p if k.startswith("rend") and k not in ordered_keys])
        ordered_keys += rend_keys
        # Append any remaining keys
        for k in p:
            if k not in ordered_keys:
                ordered_keys.append(k)

        pairs = [f"{k}: {_to_js_value(p.get(k))}" for k in ordered_keys if k in p or k in [
            "gestor", "custodian", "divisa", "dataCompra", "costEur", "unitats",
            "costInici", "valorMercat", "rendInici", "costAnual",
        ]]
        lines.append("  { " + ", ".join(pairs) + " },")
    lines.append("];")
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"✓ Wrote {path}")


def write_closed_values_js(closed_values: dict, path: Path) -> None:
    lines = [
        "// Auto-generated by scripts/enrich_closed_positions.py",
        "// Review before merging into src/data/pmClosedValues.js",
        "export const PM_CLOSED_VALUES = {",
    ]
    for isin, custodian_map in closed_values.items():
        lines.append(f'  "{isin}": {{')
        for custodian, series in custodian_map.items():
            entries = ", ".join(
                f'{{ date: "{r["date"]}", value: {r["value"]} }}' for r in series
            )
            lines.append(f'    "{custodian}": [{entries}],')
        lines.append("  },")
    lines.append("};")
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"✓ Wrote {path}")


# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="Enrich PM_CLOSED with transaction-derived fields and price history.")
    parser.add_argument("--skip-prices", action="store_true", help="Skip Morningstar price fetch (fast run, no charts)")
    args = parser.parse_args()

    OUT_DIR.mkdir(parents=True, exist_ok=True)

    print("Loading transactions…")
    txs    = load_transactions()
    print(f"  {len(txs)} transactions loaded")

    print("Loading PM_CLOSED…")
    closed = load_pm_closed()
    print(f"  {len(closed)} closed positions loaded")

    print("\nEnriching from transactions…")
    enriched = enrich_from_transactions(closed, txs)

    # Summary stats
    with_data    = sum(1 for p in enriched if p.get("costEur"))
    without_data = len(enriched) - with_data
    print(f"  {with_data} enriched  |  {without_data} with no matching transactions")

    closed_values: dict = {}
    if not args.skip_prices:
        print("\nFetching price history from Morningstar…")
        closed_values = fetch_prices_for_closed(enriched)
        print(f"  {len(closed_values)} ISINs with price data")
    else:
        print("\nSkipping price fetch (--skip-prices)")

    print("\nWriting output files…")
    write_enriched_js(enriched,     OUT_DIR / "pm_closed_enriched.js")
    write_closed_values_js(closed_values, OUT_DIR / "pm_closed_values.js")

    print("\nDone.")
    print("Next steps:")
    print("  1. Review scripts/out/pm_closed_enriched.js")
    print("     — fill in rend20XX / costAnual fields from Excel")
    print("     — check ⚠ WARNING ISINs for blended figures")
    print("  2. Copy PM_CLOSED block into src/data/publicMarkets.js")
    print("  3. Review scripts/out/pm_closed_values.js")
    print("  4. Copy content into src/data/pmClosedValues.js")


if __name__ == "__main__":
    main()
