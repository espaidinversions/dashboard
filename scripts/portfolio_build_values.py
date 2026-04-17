"""
portfolio_build_values.py
─────────────────────────
Builds a snapshot-based time series of portfolio values for active PM positions.

Logic:
  value(date) = current_market_value × historical_price(date) / latest_price

Sources:
  - src/generated/publicMarkets/publicMarketsRawWorkbook.js
      trusted active snapshot exported from the workbook overlay
  - Mercats Públics/prices/<ISIN>.csv
  - Mercats Públics/fund_prices/<ISIN>.csv
  - Mercats Públics/wam_prices/<ISIN>.csv
  - src/generated/publicMarkets/portfolioValues.js
      fallback series when a live price file is missing

Output:
  ../Mercats Públics/portfolio_value.csv
      date, isin, nom, custodian, units, nav, value_eur

Usage:
    python -m scripts.portfolio_build_values
"""

import io
import json
import re
import subprocess
import sys
from collections import defaultdict
from datetime import date, datetime, timedelta
from functools import lru_cache
from pathlib import Path
from typing import Mapping, Sequence, TypeVar, cast

import pandas as pd

from scripts.pm_model_types import PMTotalMismatch, PMValuePoint, PMValuesByIsin, PMSnapshotPosition, PMWorkbookRow

if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

# ── Paths ─────────────────────────────────────────────────────────────────────

ROOT          = Path(__file__).parent.parent
PRICES_DIR    = ROOT / "Mercats Públics" / "prices"
FUND_DIR      = ROOT / "Mercats Públics" / "fund_prices"
WAM_DIR       = ROOT / "Mercats Públics" / "wam_prices"
OUT_CSV       = ROOT / "Mercats Públics" / "portfolio_value.csv"
PM_RAW_WORKBOOK = ROOT / "src" / "generated" / "publicMarkets" / "publicMarketsRawWorkbook.js"
PM_VALUES_JS  = ROOT / "src" / "generated" / "publicMarkets" / "portfolioValues.js"
PRICE_BRIDGES_JSON = ROOT / "raw-data" / "price-bridges.json"
SERIES_START = date(2019, 1, 1)
LATEST_TOTAL_TOLERANCE = 0.005
T = TypeVar("T")


def parse_date(val) -> date | None:
    """Convert various Excel date formats to a date object."""
    if val is None:
        return None
    if isinstance(val, str):
        try:
            return date.fromisoformat(val[:10])
        except ValueError:
            return None
    if isinstance(val, datetime):
        return val.date()
    if isinstance(val, date):
        return val
    if isinstance(val, (int, float)):
        # Excel serial date (1 = 1900-01-01 with Excel's off-by-one)
        if val > 1000:   # plausible Excel serial
            try:
                return (datetime(1899, 12, 30) + timedelta(days=int(val))).date()
            except (OverflowError, ValueError, TypeError):
                return None
    return None


def load_nav_series(isin: str) -> pd.Series | None:
    """Load daily NAV/price series for an ISIN. Returns pd.Series(index=date, values=price) or None."""
    bridges = load_price_bridges().get(isin, [])
    series_parts: list[pd.Series] = []
    for d in [PRICES_DIR, FUND_DIR, WAM_DIR]:
        p = d / f"{isin}.csv"
        if p.exists():
            df = pd.read_csv(p, parse_dates=["date"])
            df = df.dropna(subset=["close"]).set_index("date")["close"].sort_index()
            series_parts.append(df)

    if bridges:
        bridge_index = pd.to_datetime([f"{month}-01" for month, _ in bridges])
        bridge_values = [float(value) for _, value in bridges]
        series_parts.append(pd.Series(bridge_values, index=bridge_index, dtype="float64").sort_index())

    if not series_parts:
        return None

    combined = pd.concat(series_parts).sort_index()
    combined = combined[~combined.index.duplicated(keep="first")]
    return combined


@lru_cache(maxsize=1)
def load_price_bridges() -> dict[str, list[tuple[str, float]]]:
    if not PRICE_BRIDGES_JSON.exists():
        return {}
    raw = json.loads(PRICE_BRIDGES_JSON.read_text(encoding="utf-8"))
    bridges: dict[str, list[tuple[str, float]]] = {}
    for isin, series in raw.items():
        rows: list[tuple[str, float]] = []
        for row in series or []:
            if not isinstance(row, list) or len(row) != 2:
                continue
            month, value = row
            try:
                rows.append((str(month), float(value)))
            except (TypeError, ValueError):
                continue
        if rows:
            bridges[str(isin).upper()] = rows
    return bridges


def load_js_export(path: Path, export_name: str) -> T:
    """Import a JS module via Node and return the named export as Python data."""
    script = (
        "import { pathToFileURL } from 'url';\n"
        "const mod = await import(pathToFileURL(process.argv[1]).href);\n"
        f"console.log(JSON.stringify(mod.{export_name}));\n"
    )
    proc = subprocess.run(
        ["node", "--input-type=module", "-e", script, str(path.resolve())],
        capture_output=True,
        text=True,
        check=False,
    )
    if proc.returncode != 0:
        raise RuntimeError(
            f"Failed to import {export_name} from {path}: {proc.stderr.strip() or proc.stdout.strip()}"
        )
    return cast(T, json.loads(proc.stdout))


def merge_defined_row(prev: Mapping[str, object], next_row: Mapping[str, object]) -> dict[str, object]:
    merged = {**dict(prev or {})}
    for key, value in (next_row or {}).items():
        if value in (None, ""):
            continue
        merged[key] = value
    return merged


def normalize_isin(value: object) -> str | None:
    raw = str(value or "").strip().upper()
    match = re.search(r"([A-Z]{2}[A-Z0-9]{10})", raw)
    return match.group(1) if match else (raw or None)


def row_dedupe_key(row: Mapping[str, object]) -> str | None:
    isin = normalize_isin(row.get("isin"))
    if not isin:
        return None
    purchase_date = row.get("dataCompra") or row.get("startDate") or ""
    units = row.get("unitats")
    if units is None:
        units = row.get("n_titols")
    try:
        units_key = f"{float(units or 0):.6f}"
    except (TypeError, ValueError):
        units_key = str(units or 0)
    return "||".join([
        isin,
        str(row.get("custodian") or "").strip(),
        str(purchase_date)[:10],
        units_key,
    ])


def dedupe_rows(rows: Sequence[PMWorkbookRow]) -> list[PMWorkbookRow]:
    seen: dict[str, PMWorkbookRow] = {}
    order: list[str] = []
    for row in rows or []:
        key = row_dedupe_key(row)
        if not key:
            continue
        prev = seen.get(key)
        if prev is None:
            order.append(key)
            seen[key] = cast(PMWorkbookRow, {**row, "isin": normalize_isin(row.get("isin"))})
        else:
            seen[key] = cast(PMWorkbookRow, merge_defined_row(prev, {**row, "isin": normalize_isin(row.get("isin"))}))
    return [seen[key] for key in order]


def merge_raw_rows(*sources: Sequence[PMWorkbookRow]) -> list[PMWorkbookRow]:
    seen: dict[str, PMWorkbookRow] = {}
    order: list[str] = []
    for source in sources:
        for row in source or []:
            key = row_dedupe_key(row)
            if not key:
                continue
            prev = seen.get(key)
            normalized = cast(PMWorkbookRow, {**row, "isin": normalize_isin(row.get("isin"))})
            if prev is None:
                order.append(key)
                seen[key] = normalized
            else:
                seen[key] = cast(PMWorkbookRow, merge_defined_row(prev, normalized))
    return [seen[key] for key in order]


def aggregate_snapshot_positions(rows: Sequence[PMWorkbookRow]) -> list[PMSnapshotPosition]:
    groups: dict[tuple[str, str], list[PMWorkbookRow]] = defaultdict(list)
    for row in rows or []:
        isin = normalize_isin(row.get("isin"))
        if not isin:
            continue
        custodian = str(row.get("custodian") or "").strip()
        groups[(isin, custodian)].append(cast(PMWorkbookRow, {**row, "isin": isin, "custodian": custodian}))

    positions: list[PMSnapshotPosition] = []
    for (isin, custodian), group in sorted(groups.items()):
        ordered = sorted(group, key=lambda r: str(r.get("dataCompra") or r.get("startDate") or ""))
        first = ordered[0]
        nom = first.get("nom") or isin
        data_compra = None
        for row in ordered:
            data_compra = parse_date(row.get("dataCompra") or row.get("startDate"))
            if data_compra:
                break
        unitats = sum(float(r.get("unitats") or r.get("n_titols") or 0) for r in group)
        valor_mercat = sum(float(r.get("valorMercat") or 0) for r in group)
        positions.append({
            "isin": isin,
            "nom": nom,
            "custodian": custodian or "Unknown",
            "dataCompra": data_compra.isoformat() if data_compra else None,
            "startDate": data_compra.isoformat() if data_compra else None,
            "endDate": None,
            "unitats": unitats,
            "valorMercat": valor_mercat,
        })
    return positions


def load_snapshot_positions() -> list[PMSnapshotPosition]:
    """Load the trusted active snapshot the dashboard uses."""
    workbook: list[PMWorkbookRow] = load_js_export(PM_RAW_WORKBOOK, "PM_POSITIONS_RAW_WORKBOOK")
    workbook = dedupe_rows(workbook)
    return aggregate_snapshot_positions(workbook)


def load_existing_pm_values() -> PMValuesByIsin:
    """Load the checked-in PM_VALUES module as a fallback for price-missing rows."""
    if not PM_VALUES_JS.exists():
        return {}
    return load_js_export(PM_VALUES_JS, "PM_VALUES")


def load_workbook_total_active() -> float | None:
    return float(load_js_export(PM_RAW_WORKBOOK, "PM_WORKBOOK_TOTAL_ACTIVE"))


def load_pm_values_end_date(fallback_values: PMValuesByIsin | None = None) -> date | None:
    latest = None
    for by_custodian in (fallback_values or {}).values():
        for series in (by_custodian or {}).values():
            for point in series or []:
                cur = parse_date(point.get("date"))
                if cur and (latest is None or cur > latest):
                    latest = cur
    return latest


def biweekly_bucket(dt: date) -> date:
    return date(dt.year, dt.month, 1 if dt.day < 15 else 15)


def next_biweekly_bucket(dt: date) -> date:
    if dt.day == 1:
        return date(dt.year, dt.month, 15)
    if dt.month == 12:
        return date(dt.year + 1, 1, 1)
    return date(dt.year, dt.month + 1, 1)


def iter_biweekly_buckets(start: date, end: date):
    cur = start
    while cur <= end:
        yield cur
        cur = next_biweekly_bucket(cur)


def build_snapshot_value_rows(
    positions: Sequence[PMSnapshotPosition],
    fallback_values: PMValuesByIsin | None = None,
    global_end: date | None = None,
) -> pd.DataFrame:
    rows = []
    fallback_values = fallback_values or {}

    for pos in positions:
        isin = normalize_isin(pos.get("isin"))
        if not isin:
            continue
        units = float(pos.get("unitats") or 0)
        current_value = float(pos.get("valorMercat") or 0)
        if units <= 0:
            continue

        nav = load_nav_series(isin)
        fallback_series: list[PMValuePoint] = (fallback_values.get(isin) or {}).get(pos.get("custodian")) or []

        start_date = parse_date(pos.get("dataCompra")) or None
        if nav is not None and start_date is None and len(nav.index) > 0:
            start_date = nav.index.min().date()
        if start_date is None:
            start_date = SERIES_START
        if start_date < SERIES_START:
            start_date = SERIES_START

        if nav is not None and len(nav.index) > 0:
            current_price = float(nav.iloc[-1])
            if pd.isna(current_price) or current_price == 0:
                current_price = None
            series_end = global_end or nav.index.max().date()
            for bucket in iter_biweekly_buckets(biweekly_bucket(start_date), biweekly_bucket(series_end)):
                if bucket < start_date:
                    continue
                price = nav.asof(pd.Timestamp(bucket))
                if pd.isna(price):
                    price = nav.iloc[0]
                if price is None or current_price in (None, 0):
                    continue
                if current_value > 0:
                    value_eur = current_value * (float(price) / current_price)
                else:
                    value_eur = units * float(price)
                rows.append({
                    "date": bucket,
                    "isin": isin,
                    "nom": pos.get("nom") or isin,
                    "custodian": pos.get("custodian") or "Unknown",
                    "units": units,
                    "nav": round(float(price), 4),
                    "value_eur": round(float(value_eur), 2),
                })
            continue

        # Fallback to the checked-in PM_VALUES series when we do not have a live price file.
        if fallback_series:
            for point in fallback_series:
                bucket = parse_date(point.get("date"))
                value = point.get("value")
                if bucket is None or value is None or bucket < SERIES_START:
                    continue
                rows.append({
                    "date": bucket,
                    "isin": isin,
                    "nom": pos.get("nom") or isin,
                    "custodian": pos.get("custodian") or "Unknown",
                    "units": units,
                    "nav": round(float(value) / units, 4) if units else None,
                    "value_eur": round(float(value), 2),
                })
            continue

        # Last resort: keep the current market value flat from the purchase date forward.
        series_end = global_end or date.today()
        for bucket in iter_biweekly_buckets(biweekly_bucket(start_date), biweekly_bucket(series_end)):
            if bucket < start_date or bucket < SERIES_START:
                continue
            rows.append({
                "date": bucket,
                "isin": isin,
                "nom": pos.get("nom") or isin,
                "custodian": pos.get("custodian") or "Unknown",
                "units": units,
                "nav": round(current_value / units, 4) if units else None,
                "value_eur": round(current_value, 2),
            })

    return pd.DataFrame(rows)


def latest_total_mismatch(
    df: pd.DataFrame,
    workbook_total: float | None,
    tolerance: float = LATEST_TOTAL_TOLERANCE,
) -> PMTotalMismatch | None:
    if workbook_total is None or df.empty:
        return None

    latest_date = df["date"].max()
    latest_total = float(df.loc[df["date"] == latest_date, "value_eur"].sum())
    if latest_total <= 0:
        return {
            "latest_date": latest_date,
            "latest_total": latest_total,
            "workbook_total": workbook_total,
            "ratio": None,
            "delta": workbook_total - latest_total,
        }

    ratio = workbook_total / latest_total
    if abs(1 - ratio) <= tolerance:
        return None

    return {
        "latest_date": latest_date,
        "latest_total": latest_total,
        "workbook_total": workbook_total,
        "ratio": ratio,
        "delta": workbook_total - latest_total,
    }


def main():
    print("Loading active snapshot from JS…")
    positions = load_snapshot_positions()
    fallback_values = load_existing_pm_values()
    global_end = load_pm_values_end_date(fallback_values)
    workbook_total = load_workbook_total_active()

    print(f"  Active positions:       {len(positions)}")
    print()

    print("Building portfolio value time series from price history…")
    df = build_snapshot_value_rows(positions, fallback_values, global_end)

    if df.empty:
        print("No data produced.")
        return

    mismatch = latest_total_mismatch(df, workbook_total)
    if mismatch is not None:
        raise SystemExit(
            "Latest total does not reconcile with workbook total. "
            f"date={mismatch['latest_date']} latest={mismatch['latest_total']:.2f} "
            f"workbook={mismatch['workbook_total']:.2f} ratio={mismatch['ratio']:.6f} "
            "Fix the source positions or price coverage instead of scaling the whole history."
        )

    df = df.sort_values(["isin", "custodian", "date"])
    df.to_csv(OUT_CSV, index=False)

    print(f"\n{'─'*64}")
    print(f"Positions processed: {df.groupby(['isin','custodian']).ngroups}")
    print(f"Total rows:          {len(df):,}")
    print(f"Date range:          {df['date'].min()} → {df['date'].max()}")
    last_day = df[df["date"] == df["date"].max()]
    total = last_day["value_eur"].sum()
    print(f"Latest total value:  {total:>15,.0f} €")
    print(f"Output:              {OUT_CSV}")


if __name__ == "__main__":
    main()
