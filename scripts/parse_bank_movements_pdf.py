"""
parse_bank_movements_pdf.py
───────────────────────────
Normalizes the bank movements PDF into structured JSON consumed by the
public-markets generators.

Current target:
  - moviments Espai des de 2022.PDF.pdf

Output:
  - raw-data/bank-movements-40510.json

Only rows that can be resolved to a single ISIN are emitted to the main
`movements` payload. Unresolved codes are kept in `unresolved` for audit.
"""

from __future__ import annotations

import argparse
import json
import re
from collections import defaultdict
from datetime import date, datetime
from pathlib import Path

from PyPDF2 import PdfReader

from scripts.pm_model_types import PMBankMovement, PMBankMovementsPayload


ROOT = Path(__file__).resolve().parent.parent
DEFAULT_PDF = ROOT / "data" / "moviments Espai des de 2022.PDF.pdf"
OUT_JSON = ROOT / "raw-data" / "bank-movements-40510.json"
ONBOARDING_TRANSFER_CUTOFF = date(2022, 5, 31)

# Manual fallbacks for names/codes that do not expose their ISIN elsewhere
# in the PDF, but already exist in the PM model with a confident match.
MANUAL_CODE_MAP = {
    "047277-000": "IE00BD5HXD05",   # Comgest Growth Europe Z
    "049082-000": "LU1862449409",   # T. Rowe Price Small Comp Qn EUR Hedged
    "051284-000": "LU0957820193",   # Columbia/Threadneedle Global Smaller Cos ZE
    "051600-000": "LU1747711031",   # DWS ESG Equity INC
    "051663-000": "LU0368266499",   # BlackRock Euro Corporate Bond D2
    "053234-000": "IE00BF4RFH31",   # iShares MSCI World UCITS ETF
    "058363-000": "LU1431483780",   # Goldman Sachs US Dollar Credit RH EUR
}

PURCHASE_RE = re.compile(
    r"^(?P<gross>[0-9.,]+)\s+"
    r"(?P<amount_ccy>EUR|USD)\s+"
    r"(?P<price_ccy>EUR|USD)\s+"
    r"(?P<price>[0-9.,]+)\s+"
    r"(?P<units>[0-9.,]+)\s+"
    r"(?P<date>\d{2}/\d{2}/\d{4})\s+-\s+"
    r"(?P<reference>\S+)\s+"
    r"(?P<security_code>\d{6}-\d{3})\s+"
    r"(?P<name>.+)$"
)

SALE_RE = re.compile(
    r"^(?P<price_ccy>EUR|USD)\s+"
    r"(?P<price>[0-9.,]+)\s+"
    r"(?P<units>[0-9.,]+)\s+"
    r"(?P<security_code>\d{6}-\d{3})\s+"
    r"(?P<reference>\S+)\s+"
    r"(?P<date>\d{2}/\d{2}/\d{4})\s+SE[FL]\s+-\s+"
    r"(?:(?P<tax>[+-]?[0-9.,]+)\s+(?P<tax_ccy>EUR|USD)\s+)?"
    r"(?P<net_ccy>EUR|USD)\s+"
    r"(?P<net_amount>[0-9.,]+)\s+"
    r"(?P<name>.+)$"
)

TRANSFER_RE = re.compile(
    r"^(?P<date>\d{2}/\d{2}/\d{4})\s+-\s+"
    r"(?P<tx_type>TID TRF IN|PTI POSN TRANSF IN|PTO POSN TRANS OUT)\s+"
    r"(?:(?P<venue>[A-Z]+)\s+)?"
    r"(?P<reference>\S+)\s+"
    r"(?P<security_code>\d{6}-\d{3})\s+"
    r"(?P<name>.+?)\s+"
    r"(?P<ccy>EUR|USD)\s+"
    r"(?P<units>[0-9.,]+)\s+"
    r"(?P<isin>[A-Z]{2}[A-Z0-9]{10})"
    r"(?:\s+(?P<gross>[0-9.,]+)\s+(?P<acq_amount>[0-9.,]+))?$"
)

SKIP_PREFIXES = (
    "Movements Report",
    "ESPAI D'INVERSIONS 2005, SL",
    "EURESPAI D'INVERSIONS 2005, SL",
    "EURCustomer:",
    "Reference ccy",
    "Portfolio nº",
    "DateSecurities tranfers",
    "Transaction Reference",
    "ISIN Nom. Sec. CCY",
    "From 01/01/2022",
    "Lots Price",
    "Página",
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--pdf", type=Path, default=DEFAULT_PDF)
    parser.add_argument("--out", type=Path, default=OUT_JSON)
    return parser.parse_args()


def parse_number(raw: str | None) -> float | None:
    if raw is None:
        return None
    return float(raw.replace(".", "").replace(",", "."))


def parse_iso_date(raw: str) -> str:
    return datetime.strptime(raw, "%d/%m/%Y").date().isoformat()


def iter_clean_lines(pdf_path: Path) -> list[str]:
    text = "\n".join((page.extract_text() or "") for page in PdfReader(str(pdf_path)).pages)
    lines = []
    for raw in text.splitlines():
        line = raw.strip()
        if not line:
            continue
        lower = line.lower()
        if any(marker in lower for marker in ("purchases", "sales", "securities tranfers", "futures")):
            lines.append(line)
            continue
        if line.startswith(SKIP_PREFIXES):
            continue
        lines.append(line)
    return lines


def build_isin_map(lines: list[str]) -> dict[str, str]:
    code_to_isins: dict[str, set[str]] = defaultdict(set)
    for line in lines:
        match = TRANSFER_RE.match(line)
        if match:
            code_to_isins[match.group("security_code")].add(match.group("isin"))
    for code, isin in MANUAL_CODE_MAP.items():
        code_to_isins[code].add(isin)
    return {code: next(iter(isins)) for code, isins in code_to_isins.items() if len(isins) == 1}


def parse_sections(lines: list[str], code_to_isin: dict[str, str]) -> tuple[list[PMBankMovement], list[PMBankMovement]]:
    mode = None
    movements: list[PMBankMovement] = []
    unresolved: list[PMBankMovement] = []

    for line in lines:
        lower = line.lower()
        if "purchases" in lower:
            mode = "purchases"
            continue
        if lower.endswith("sales") or "sales" in lower:
            mode = "sales"
            continue
        if "securities tranfers" in lower:
            mode = "transfers"
            continue
        if "futures" in lower:
            mode = None
            continue

        if mode == "purchases":
            match = PURCHASE_RE.match(line)
            if not match:
                continue
            raw = match.groupdict()
            isin = code_to_isin.get(raw["security_code"])
            row: PMBankMovement = {
                "action": "buy",
                "section": "purchases",
                "date": parse_iso_date(raw["date"]),
                "reference": raw["reference"],
                "securityCode": raw["security_code"],
                "isin": isin,
                "nameRaw": raw["name"].strip(),
                "currency": raw["amount_ccy"],
                "priceCurrency": raw["price_ccy"],
                "price": parse_number(raw["price"]),
                "units": parse_number(raw["units"]),
                "valueEur": parse_number(raw["gross"]),
            }
        elif mode == "sales":
            match = SALE_RE.match(line)
            if not match:
                continue
            raw = match.groupdict()
            isin = code_to_isin.get(raw["security_code"])
            row: PMBankMovement = {
                "action": "sell",
                "section": "sales",
                "date": parse_iso_date(raw["date"]),
                "reference": raw["reference"],
                "securityCode": raw["security_code"],
                "isin": isin,
                "nameRaw": raw["name"].strip(),
                "currency": raw["net_ccy"],
                "priceCurrency": raw["price_ccy"],
                "price": parse_number(raw["price"]),
                "units": parse_number(raw["units"]),
                "valueEur": parse_number(raw["net_amount"]),
                "tax": parse_number(raw["tax"]),
                "taxCurrency": raw.get("tax_ccy"),
            }
        elif mode == "transfers":
            match = TRANSFER_RE.match(line)
            if not match:
                continue
            raw = match.groupdict()
            row: PMBankMovement = {
                "action": "transfer_in" if "IN" in raw["tx_type"] else "transfer_out",
                "section": "transfers",
                "date": parse_iso_date(raw["date"]),
                "reference": raw["reference"],
                "securityCode": raw["security_code"],
                "isin": raw["isin"],
                "nameRaw": raw["name"].strip(),
                "currency": raw["ccy"],
                "priceCurrency": raw["ccy"],
                "price": None,
                "units": parse_number(raw["units"]),
                "valueEur": parse_number(raw["acq_amount"]),
                "grossAmount": parse_number(raw["gross"]),
            }
        else:
            continue

        if row["isin"]:
            if row["action"] == "transfer_in" and row["date"] <= ONBOARDING_TRANSFER_CUTOFF.isoformat():
                row["isInitialTransferIn"] = True
            movements.append(row)
        else:
            unresolved.append(row)

    movements.sort(key=lambda row: (row["date"], row["action"], row["securityCode"], row["reference"]))
    unresolved.sort(key=lambda row: (row["section"], row["securityCode"], row["date"]))
    return movements, unresolved


def main() -> None:
    args = parse_args()
    if not args.pdf.exists():
        raise SystemExit(f"PDF not found: {args.pdf}")

    lines = iter_clean_lines(args.pdf)
    code_to_isin = build_isin_map(lines)
    movements, unresolved = parse_sections(lines, code_to_isin)

    payload: PMBankMovementsPayload = {
        "sourcePdf": args.pdf.name,
        "generatedAt": datetime.now().isoformat(timespec="seconds"),
        "initialTransferCutoff": ONBOARDING_TRANSFER_CUTOFF.isoformat(),
        "movements": movements,
        "unresolved": unresolved,
    }
    args.out.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"Resolved rows:   {len(movements)}")
    print(f"Unresolved rows: {len(unresolved)}")
    print(f"Output:          {args.out}")


if __name__ == "__main__":
    main()
