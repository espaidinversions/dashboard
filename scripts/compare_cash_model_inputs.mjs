/**
 * Compare Capital Calls Excel vs current CSV export (raw-data/capital-calls.csv)
 * using the same normalization/exclusion rules as the cash model.
 *
 * Usage:
 *   node scripts/compare_cash_model_inputs.mjs
 *   node scripts/compare_cash_model_inputs.mjs --excel "2022.06.16 Capital Calls.xlsx" --csv "raw-data/capital-calls.csv" --top 40
 */

import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";

import {
  buildTipusConceptMap,
  parseSheets,
  resolveConceptFromTipus,
} from "./cc_import_append.mjs";

import {
  inferCapitalCallCategoryFromTipus,
  normalizeCapitalCallSignedAmount,
  normalizeCapitalCallTipus,
} from "../src/data/capitalCallTipusModel.js";

import { FUND_NAME_MAP } from "../src/data/fundNameMap.js";

import XLSX from "./lib/xlsx_compat.mjs";

const __dir = path.dirname(fileURLToPath(import.meta.url));
const __root = path.join(__dir, "..");

const EXCLUDED_CASH_MODEL_TIPUS = new Set([
  "Transferència Participacions",
  "Conversió Participacions",
]);

function parseArgs(argv) {
  const out = { excel: path.join(__root, "2022.06.16 Capital Calls.xlsx"), csv: path.join(__root, "raw-data/capital-calls.csv"), eq: path.join(__root, "260424_Equivalència_Conceptes.xlsx"), top: 30 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--excel") out.excel = path.isAbsolute(argv[i + 1]) ? argv[++i] : path.join(process.cwd(), argv[++i]);
    else if (a === "--csv") out.csv = path.isAbsolute(argv[i + 1]) ? argv[++i] : path.join(process.cwd(), argv[++i]);
    else if (a === "--equivalencia" || a === "--eq") out.eq = path.isAbsolute(argv[i + 1]) ? argv[++i] : path.join(process.cwd(), argv[++i]);
    else if (a === "--top") out.top = Number(argv[++i]) || out.top;
  }
  return out;
}

function canonicalName(rawName) {
  const raw = String(rawName ?? "").trim();
  return FUND_NAME_MAP[raw] ?? raw;
}

function normalizeToCurrentShape(raw, tipusConceptMap) {
  const fons = canonicalName(raw.fons);
  const tipus = resolveConceptFromTipus(raw.tipus, tipusConceptMap) ?? normalizeCapitalCallTipus(raw.tipus);
  const eur = normalizeCapitalCallSignedAmount(tipus, Number(raw.eur));
  const cat = raw.cat ?? inferCapitalCallCategoryFromTipus(tipus, eur);
  const data = String(raw.data ?? "").slice(0, 10);
  const any = Number(data.slice(0, 4)) || null;
  const mes = Number(data.slice(5, 7)) || null;
  const fy = any ? `FY ${any}` : null;
  return {
    fons,
    tipus,
    cat,
    data,
    mes,
    any,
    fy,
    vcpe: raw.vcpe ?? null,
    est: raw.est ?? null,
    divisa: raw.divisa ?? "EUR",
    eur,
  };
}

async function readExcelRows(excelPath, tipusConceptMap) {
  const wb = await XLSX.readFile(excelPath);
  const { fundsRows, companiesRows } = parseSheets(wb);
  const rows = [...fundsRows, ...companiesRows].map((r) => normalizeToCurrentShape(r, tipusConceptMap));
  return rows.filter((r) => r.fons && r.data && Number.isFinite(r.eur) && r.eur !== 0);
}

function readCsvRows(csvPath) {
  // xlsx reads this file with the wrong encoding (it comes out as CompromÃ­s),
  // so parse as UTF-8 ourselves.
  const text = fs.readFileSync(csvPath, "utf8");
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];

  const headers = splitCsvLine(lines[0]).map((h) => String(h ?? "").trim());
  const idx = (key) => headers.indexOf(key);
  const out = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    const row = (k) => cols[idx(k)];
    const fons = canonicalName(row("fons"));
    const tipus = normalizeCapitalCallTipus(row("tipus"));
    const cat = String(row("cat") ?? "").trim() || null;
    const data = String(row("data") ?? "").slice(0, 10);
    const eur = Number(row("eur")) || 0;
    if (!fons || !data || !Number.isFinite(eur) || eur === 0) continue;
    out.push({
      fons,
      tipus,
      cat,
      data,
      mes: Number(row("mes")) || null,
      any: Number(row("any")) || null,
      fy: String(row("fy") ?? "").trim() || null,
      vcpe: String(row("vcpe") ?? "").trim() || null,
      est: String(row("est") ?? "").trim() || null,
      divisa: String(row("divisa") ?? "").trim() || "EUR",
      eur,
    });
  }
  return out;
}

function splitCsvLine(line) {
  const out = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        const next = line[i + 1];
        if (next === '"') { cur += '"'; i++; }
        else inQuotes = false;
      } else {
        cur += ch;
      }
      continue;
    }
    if (ch === '"') { inQuotes = true; continue; }
    if (ch === ",") { out.push(cur); cur = ""; continue; }
    cur += ch;
  }
  out.push(cur);
  return out;
}

function bucketKey(row) {
  // Match current app behavior (2-decimal rounding for dedup-like comparisons)
  return [
    row.fons,
    row.vcpe ?? "",
    row.cat ?? "",
    row.tipus ?? "",
    row.data ?? "",
    Math.round(Number(row.eur || 0) * 100) / 100,
  ].join("|");
}

function kindForVcpe(vcpe) {
  const v = String(vcpe ?? "").trim();
  if (v === "PC" || v === "SF") return "companies";
  if (v === "RE") return "real-estate";
  return "funds";
}

function inCashModel(row) {
  // Only rows that can affect "Compromis" or "Capital cridat (Aportacio)".
  const concept = normalizeCapitalCallTipus(row.tipus);
  if (EXCLUDED_CASH_MODEL_TIPUS.has(concept)) return false;
  if (row.cat === "Compromís") return true;
  if (row.cat === "Capital Call") return concept == null || concept === "Aportació";
  return false;
}

function aggregate(rows) {
  const totals = {
    committed: 0,
    called: 0,
    byName: new Map(), // name -> { committed, called }
  };
  for (const r of rows) {
    if (!inCashModel(r)) continue;
    const name = r.fons;
    if (!totals.byName.has(name)) totals.byName.set(name, { committed: 0, called: 0 });
    const b = totals.byName.get(name);
    if (r.cat === "Compromís") {
      const x = Math.abs(Number(r.eur) || 0);
      totals.committed += x;
      b.committed += x;
    } else if (r.cat === "Capital Call") {
      const x = Math.abs(Number(r.eur) || 0);
      totals.called += x;
      b.called += x;
    }
  }
  return totals;
}

function diffByName(excelAgg, csvAgg) {
  const names = new Set([...excelAgg.byName.keys(), ...csvAgg.byName.keys()]);
  const rows = [];
  for (const name of names) {
    const a = excelAgg.byName.get(name) ?? { committed: 0, called: 0 };
    const b = csvAgg.byName.get(name) ?? { committed: 0, called: 0 };
    rows.push({
      name,
      excelCommitted: a.committed,
      csvCommitted: b.committed,
      dCommitted: a.committed - b.committed,
      excelCalled: a.called,
      csvCalled: b.called,
      dCalled: a.called - b.called,
      dAbs: Math.abs(a.committed - b.committed) + Math.abs(a.called - b.called),
    });
  }
  rows.sort((x, y) => y.dAbs - x.dAbs);
  return rows;
}

function fmtEur(n) {
  const v = Number(n) || 0;
  const abs = Math.abs(v);
  if (abs >= 1e6) return `${(v / 1e6).toFixed(2)}M€`;
  if (abs >= 1e3) return `${(v / 1e3).toFixed(1)}K€`;
  return `${v.toFixed(0)}€`;
}

function printTopDiff(title, rows, top) {
  console.log(`\n== ${title} (top ${top}) ==`);
  console.log("name | Δcommit | Δcalled | excel(commit/call) | csv(commit/call)");
  rows.slice(0, top).forEach((r) => {
    console.log([
      r.name,
      fmtEur(r.dCommitted),
      fmtEur(r.dCalled),
      `${fmtEur(r.excelCommitted)}/${fmtEur(r.excelCalled)}`,
      `${fmtEur(r.csvCommitted)}/${fmtEur(r.csvCalled)}`,
    ].join(" | "));
  });
}

function compareSets(excelRows, csvRows) {
  const excelSet = new Set(excelRows.map(bucketKey));
  const csvSet = new Set(csvRows.map(bucketKey));
  const onlyExcel = [];
  for (const r of excelRows) if (!csvSet.has(bucketKey(r))) onlyExcel.push(r);
  const onlyCsv = [];
  for (const r of csvRows) if (!excelSet.has(bucketKey(r))) onlyCsv.push(r);
  return { onlyExcel, onlyCsv };
}

function topRowsByAbsEur(rows, top = 20) {
  return [...rows]
    .sort((a, b) => Math.abs(Number(b.eur || 0)) - Math.abs(Number(a.eur || 0)))
    .slice(0, top);
}

function printRowList(title, rows, top = 15) {
  console.log(`\n== ${title} (top ${top} by |eur|) ==`);
  console.log("fons | vcpe | cat | tipus | data | eur");
  topRowsByAbsEur(rows, top).forEach((r) => {
    console.log([r.fons, r.vcpe ?? "", r.cat ?? "", r.tipus ?? "", r.data ?? "", fmtEur(r.eur)].join(" | "));
  });
}

function summarize(label, rows) {
  const byKind = { funds: 0, companies: 0, "real-estate": 0, other: 0 };
  rows.forEach((r) => {
    const k = kindForVcpe(r.vcpe);
    byKind[k] = (byKind[k] ?? 0) + 1;
  });
  console.log(`\n== ${label} ==`);
  console.log(`rows: ${rows.length}`);
  console.log(`funds: ${byKind.funds} | companies: ${byKind.companies} | real-estate: ${byKind["real-estate"]}`);
}

function splitByScope(rows) {
  return {
    funds: rows.filter((r) => kindForVcpe(r.vcpe) === "funds"),
    companies: rows.filter((r) => kindForVcpe(r.vcpe) === "companies"),
    realEstate: rows.filter((r) => kindForVcpe(r.vcpe) === "real-estate"),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!fs.existsSync(args.excel)) throw new Error(`Excel not found: ${args.excel}`);
  if (!fs.existsSync(args.csv)) throw new Error(`CSV not found: ${args.csv}`);

  const tipusConceptMap = await buildTipusConceptMap(args.eq, { warn: false });
  const excelRows = await readExcelRows(args.excel, tipusConceptMap);
  const csvRows = readCsvRows(args.csv);

  summarize("Excel", excelRows);
  summarize("CSV current", csvRows);

  const sets = compareSets(excelRows.filter(inCashModel), csvRows.filter(inCashModel));
  console.log(`\nCash-model relevant rows: excel=${excelRows.filter(inCashModel).length} | csv=${csvRows.filter(inCashModel).length}`);
  console.log(`Only-in-excel: ${sets.onlyExcel.length} | Only-in-csv: ${sets.onlyCsv.length}`);
  printRowList("Only in Excel (cash-model relevant)", sets.onlyExcel, 20);
  printRowList("Only in CSV current (cash-model relevant)", sets.onlyCsv, 20);

  const ex = splitByScope(excelRows);
  const cur = splitByScope(csvRows);

  const scopes = [
    ["Funds (PE/VC/etc.)", ex.funds, cur.funds],
    ["Companies (PC/SF)", ex.companies, cur.companies],
    ["Real Estate (RE)", ex.realEstate, cur.realEstate],
  ];

  for (const [label, aRows, bRows] of scopes) {
    const aAgg = aggregate(aRows);
    const bAgg = aggregate(bRows);
    console.log(`\n== ${label} ==`);
    console.log(`Committed: excel=${fmtEur(aAgg.committed)} | csv=${fmtEur(bAgg.committed)} | Δ=${fmtEur(aAgg.committed - bAgg.committed)}`);
    console.log(`Called:     excel=${fmtEur(aAgg.called)} | csv=${fmtEur(bAgg.called)} | Δ=${fmtEur(aAgg.called - bAgg.called)}`);
    const diffs = diffByName(aAgg, bAgg);
    printTopDiff(label, diffs, args.top);
  }
}

main().catch((err) => {
  console.error("compare_cash_model_inputs failed:", err?.stack || err?.message || String(err));
  process.exit(1);
});
