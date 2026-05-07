/**
 * Restore capital_calls.tipus from transaction Excel sources.
 *
 * Strategy:
 *   1. Read 260424_Equivalència_Conceptes.xlsx → "Concepte Antic" → "Concepte Nou" map.
 *   2. Build fons|date|roundedEur → canonicalTipus lookup from two Excel sources:
 *        a) "2022.06.16 Capital Calls.xlsx" — Capital Calls log sheet (most comprehensive)
 *        b) "transaccions_detall_tipus.xlsx" — fallback for any gaps
 *   3. Load DB rows and match them to Excel by fons|date|roundedEur.
 *   4. For each DB row, attempt lookup by (fons, data, eur) key.
 *   5. Matched and different → update tipus with the Excel canonical concept.
 *
 * Usage:
 *   node scripts/restore_capital_call_tipus_from_excel.mjs [--dry-run]
 */

import { createClient } from "@supabase/supabase-js";
import pkg from "xlsx";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const { readFile, utils } = pkg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── env ──────────────────────────────────────────────────────────────────────
function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return {};
  return Object.fromEntries(
    fs.readFileSync(filePath, "utf8")
      .split("\n")
      .filter((l) => l.includes("=") && !l.startsWith("#"))
      .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
  );
}

const env = loadEnv(path.join(__dirname, "../.env.local"));
if (!env.VITE_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const dryRun = process.argv.includes("--dry-run");

// ── key helpers ───────────────────────────────────────────────────────────────
function slugify(s) {
  return String(s ?? "").trim().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function normFons(s) {
  return String(s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function parseDate(v) {
  if (!v) return "";
  if (typeof v === "number") {
    // Excel serial → UTC date
    const d = new Date(Math.round((v - 25569) * 86400 * 1000));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
  }
  const s = String(v).trim();
  const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return s;
}

function roundEur(n) {
  return Math.round(Number(n) * 100) / 100;
}

function makeKey(fons, data, eur) {
  return `${normFons(fons)}|${parseDate(data)}|${roundEur(eur)}`;
}

// ── 1. Load equivalencies: Concepte Antic → Concepte Nou ─────────────────────
const eqPath = path.join(__dirname, "../260424_Equivalència_Conceptes.xlsx");
const eqWb = readFile(eqPath);
const eqWs = eqWb.Sheets[eqWb.SheetNames[0]];
const eqRows = utils.sheet_to_json(eqWs, { header: 1 });

const equivalencies = new Map(); // slugified original → canonical
for (const row of eqRows) {
  const original = String(row[0] ?? "").trim();
  const canonical = String(row[1] ?? "").trim();
  if (!original || !canonical || original === "Concepte Antic") continue;
  equivalencies.set(slugify(original), canonical);
}

console.log(`Loaded ${equivalencies.size} equivalency entries`);

function resolveCanonical(rawTipus) {
  const raw = String(rawTipus ?? "").trim();
  if (!raw) return null;
  return equivalencies.get(slugify(raw)) ?? null;
}

// ── 2. Build lookup from main Capital Calls Excel ────────────────────────────
// Sheet "Capital Calls log": col2=Fons, col3=Tipus, col5=Data, col6=Import, col15=Import en EUR
const lookup = new Map();
const unmappedTypes = new Set();

function addToLookup(fons, rawTipus, data, eur) {
  const canonical = resolveCanonical(rawTipus);
  if (!canonical) {
    if (rawTipus) unmappedTypes.add(String(rawTipus).trim());
    return;
  }
  const key = makeKey(fons, data, eur);
  if (!lookup.has(key)) lookup.set(key, canonical);
}

// Source A: main Capital Calls log
const ccLogPath = path.join(__dirname, "../2022.06.16 Capital Calls.xlsx");
const ccLogWb = readFile(ccLogPath);
const ccLogWs = ccLogWb.Sheets["Capital Calls log"];
const ccLogRows = utils.sheet_to_json(ccLogWs, { header: 1 });
let ccLogCount = 0;

for (let i = 8; i < ccLogRows.length; i++) {
  const r = ccLogRows[i];
  // col[5] must be an Excel date serial (roughly 2010–2035 = serials 40179–49673)
  // col[3] must be a text type label, not a number
  if (!r[2] || typeof r[5] !== "number" || r[5] < 40000 || r[5] > 55000) continue;
  if (typeof r[3] !== "string") continue;
  ccLogCount++;
  // Use Import en EUR (col15) when available; fall back to raw Import (col6)
  const eur = (r[15] !== undefined && r[15] !== "") ? r[15] : r[6];
  addToLookup(r[2], r[3], r[5], eur);
}

console.log(`Main CC log rows scanned: ${ccLogCount} → lookup entries so far: ${lookup.size}`);

// Source B: Startups log (same workbook) — PC company transactions
// col[1]=Startup, col[2]=Tipus, col[4]=Data serial, col[5]=Import EUR
const startupWs = ccLogWb.Sheets["Startups log"];
const startupRows = utils.sheet_to_json(startupWs, { header: 1 });
let startupCount = 0;

for (let i = 8; i < startupRows.length; i++) {
  const r = startupRows[i];
  if (!r[1] || typeof r[2] !== "string") continue;
  if (typeof r[4] !== "number" || r[4] < 40000 || r[4] > 55000) continue;
  startupCount++;
  addToLookup(r[1], r[2], r[4], r[5]);
}

console.log(`Startups log rows scanned: ${startupCount} → lookup entries so far: ${lookup.size}`);

// Source C: transaccions_detall_tipus.xlsx (fills any gaps)
// Header row 0: Vehicle=0, Tipus=1, Data=3, Import(€)=4
const txPath = path.join(__dirname, "../transaccions_detall_tipus.xlsx");
const txWb = readFile(txPath);
const txWs = txWb.Sheets[txWb.SheetNames[0]];
const txRows = utils.sheet_to_json(txWs, { header: 1 });
let txCount = 0;

for (let i = 1; i < txRows.length; i++) {
  const r = txRows[i];
  if (!r[0] && !r[1]) continue;
  txCount++;
  addToLookup(r[0], r[1], r[3], r[4]);
}

console.log(`Transaccions xlsx rows scanned: ${txCount} → lookup entries now: ${lookup.size}`);
if (unmappedTypes.size > 0) {
  console.log(`Raw types not found in equivalencies: ${[...unmappedTypes].join(", ")}`);
}

// ── 3. Load DB rows (paginated) ───────────────────────────────────────────────
let allRows = [];
let from = 0;
const PAGE = 1000;

while (true) {
  const { data, error } = await supabase
    .from("capital_calls")
    .select("id, fons, tipus, data, eur, vcpe, cat")
    .range(from, from + PAGE - 1)
    .order("id");

  if (error) {
    console.error("Failed to load DB rows:", error.message);
    process.exit(1);
  }
  allRows.push(...data);
  if (data.length < PAGE) break;
  from += PAGE;
}

console.log(`\nDB rows loaded: ${allRows.length}`);

// ── 4. Match DB rows against lookup ──────────────────────────────────────────
const updates = [];
const unmatched = [];

for (const row of allRows) {
  const key = makeKey(row.fons, row.data, row.eur);
  // Fallback: try negated amount (sign may have been normalised after the Excel snapshot)
  const keyNeg = makeKey(row.fons, row.data, -Number(row.eur));
  const newTipus = lookup.get(key) ?? lookup.get(keyNeg);
  if (newTipus) {
    if (newTipus !== row.tipus) {
      updates.push({ id: row.id, fons: row.fons, data: row.data, eur: row.eur, vcpe: row.vcpe, oldTipus: row.tipus, newTipus });
    }
  } else {
    unmatched.push(row);
  }
}

// Summary
console.log(`\nRows that will be updated: ${updates.length}`);
const byTipus = {};
updates.forEach((u) => { byTipus[u.newTipus] = (byTipus[u.newTipus] || 0) + 1; });
Object.entries(byTipus).sort((a, b) => b[1] - a[1]).forEach(([t, n]) => console.log(`  "${t}": ${n}`));
if (updates.length <= 30) {
  updates.forEach((u) => console.log(`    id=${u.id} "${u.fons}" ${u.data} ${u.eur}: "${u.oldTipus}" → "${u.newTipus}"`));
}

console.log(`\nRows that could NOT be matched: ${unmatched.length}`);
const byVcpe = {};
unmatched.forEach((r) => { byVcpe[r.vcpe ?? "(null)"] = (byVcpe[r.vcpe ?? "(null)"] || 0) + 1; });
Object.entries(byVcpe).sort((a, b) => b[1] - a[1]).forEach(([v, n]) => console.log(`  vcpe="${v}": ${n} rows`));
if (unmatched.length <= 20) {
  unmatched.forEach((r) => console.log(`    id=${r.id} fons="${r.fons}" data=${r.data} eur=${r.eur} cat="${r.cat}"`));
}

if (dryRun) {
  console.log("\nDry run — no changes written.");
  process.exit(0);
}

if (updates.length === 0) {
  console.log("\nNothing to update.");
  process.exit(0);
}

// ── 5. Apply updates ──────────────────────────────────────────────────────────
let ok = 0;
for (const { id, newTipus } of updates) {
  const { error } = await supabase
    .from("capital_calls")
    .update({ tipus: newTipus })
    .eq("id", id);
  if (error) {
    console.error(`Failed updating id=${id}:`, error.message);
    process.exit(1);
  }
  ok++;
}

console.log(`\nUpdated ${ok} rows.`);
if (unmatched.length > 0) {
  console.log(`${unmatched.length} rows were not matched to the Excel lookup and were left unchanged.`);
}
process.exit(0);
