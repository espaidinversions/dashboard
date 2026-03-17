"""
convert-data.py
───────────────
Converts the CSV data files into JS modules consumed by the dashboard.

Usage:
    python convert-data.py

Input:
    data/capital-calls.csv   → transactions & commitments
    data/pipeline.csv        → pipeline FY26 opportunities

Output:
    data/capital-calls.js    (auto-generated, do not edit manually)
    data/pipeline.js         (auto-generated, do not edit manually)
"""

import csv, json, os, sys

BASE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(BASE, "data")


# ── Helpers ───────────────────────────────────────────────

def read_csv(filename):
    path = os.path.join(DATA, filename)
    if not os.path.exists(path):
        sys.exit(f"ERROR: {path} not found.")
    with open(path, encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))

def write_js(filename, varname, rows, comment):
    path = os.path.join(DATA, filename)
    with open(path, "w", encoding="utf-8") as f:
        f.write(f"// AUTO-GENERATED — do not edit manually.\n")
        f.write(f"// Edit {comment} and run: python convert-data.py\n\n")
        f.write(f"export const {varname} = ")
        f.write(json.dumps(rows, ensure_ascii=False, indent=2))
        f.write(";\n")
    print(f"  OK {filename} ({len(rows)} rows)")


# ── capital-calls.csv → capital-calls.js ─────────────────

def convert_capital_calls():
    rows = read_csv("capital-calls.csv")
    out = []
    for i, r in enumerate(rows, 1):
        try:
            out.append({
                "fons":   r["fons"].strip(),
                "tipus":  r["tipus"].strip(),
                "cat":    r["cat"].strip(),
                "data":   r["data"].strip(),
                "mes":    int(r["mes"]),
                "any":    int(r["any"]),
                "fy":     r["fy"].strip(),
                "vcpe":   r["vcpe"].strip(),
                "est":    r["est"].strip(),
                "eur":    float(r["eur"]),
                "divisa": r["divisa"].strip(),
            })
        except (KeyError, ValueError) as e:
            sys.exit(f"ERROR in capital-calls.csv row {i+1}: {e}")
    write_js("capital-calls.js", "RAW_CC", out, "data/capital-calls.csv")


# ── pipeline.csv → pipeline.js ────────────────────────────

def convert_pipeline():
    rows = read_csv("pipeline.csv")
    out = []
    for i, r in enumerate(rows, 1):
        try:
            active_val = r["active"].strip().lower()
            out.append({
                "id":         int(r["id"]),
                "name":       r["name"].strip(),
                "amount":     float(r["amount"]),
                "currency":   r["currency"].strip(),
                "geography":  r["geography"].strip(),
                "strategy":   r["strategy"].strip(),
                "sector":     r["sector"].strip(),
                "status":     r["status"].strip(),
                "canal":      r["canal"].strip(),
                "active":     active_val in ("true", "1", "yes"),
            })
        except (KeyError, ValueError) as e:
            sys.exit(f"ERROR in pipeline.csv row {i+1}: {e}")
    write_js("pipeline.js", "FUNDS0", out, "data/pipeline.csv")


# ── Main ──────────────────────────────────────────────────

if __name__ == "__main__":
    print("Converting CSV data files...")
    convert_capital_calls()
    convert_pipeline()
    print("Done.")
