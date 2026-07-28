/**
 * Populate fund_meta.geography and fund_meta.sector with normalized weight maps
 * derived from 260120_Allocation_Fons.xlsx (Matrius sheet).
 *
 * Each fund block in Matrius holds a sector x geography matrix (fractions of the
 * fund commitment). We reduce it to two marginal distributions, each normalized
 * to sum 1.0:
 *   geography = column-wise sum over sector rows (cols 7..11)
 *   sector    = per-sector-row fraction (col 12)
 *
 * These feed the "per Sector" / "per Geografia" donuts on Alternatius > Resum,
 * where each capital call is distributed by its fund's mix (same methodology as
 * the workbook's "Called by Geography / by Vertical" blocks).
 *
 * Usage:
 *   node scripts/backfill_fund_allocation_from_excel.mjs [--dry-run]
 */

import { createClient } from "@supabase/supabase-js";
import pkg from "./lib/xlsx_compat.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const { readFile, utils } = pkg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return {};
  return Object.fromEntries(
    fs.readFileSync(filePath, "utf8")
      .split("\n")
      .filter((l) => l.includes("=") && !l.startsWith("#"))
      .map((l) => {
        const i = l.indexOf("=");
        const key = l.slice(0, i).trim();
        const val = l.slice(i + 1).trim().replace(/\r$/, "").replace(/^["']|["']$/g, "");
        return [key, val];
      }),
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

// ── column layout in the Matrius sheet (0-based, header:1) ────────────────────
const GEO_COLS = [
  { key: "Nord America", col: 7 },
  { key: "Nord d'Europa", col: 8 },
  { key: "Sud d'Europa", col: 9 },
  { key: "Asia", col: 10 },
  { key: "LatAm", col: 11 },
];
const SECTOR_NAME_COL = 6;
const SECTOR_FRAC_COL = 12;

// ── normalise name for fuzzy matching (same as est backfill) ──────────────────
function norm(s) {
  return String(s ?? "").toLowerCase().replace(/\s+/g, " ").trim()
    .normalize("NFD").replace(/[̀-ͯ]/g, "");
}

// DB fons → Allocation-Excel fons, for funds whose DB name differs from the
// workbook. Exact aliases (same fund, renamed) plus successor/feeder funds that
// inherit their family's target mix (estimates — replace if real splits appear
// in the Matrius sheet). Keys and values are pre-normalised (see norm()).
const FONS_ALIASES = {
  "galdana ventures iii": "galdana iii fcr",                         // exact alias
  "acp secondaries 5": "acp secondaries 5 fcr",                      // exact alias
  "arcano earth 2021 scr": "arcano earth ii 2021 scr",              // exact alias
  "qualitas funds direct iii scr": "qualitas funds direct ii a scr", // sibling estimate
  "rcp fund xx (eu) scsp": "rcp fund xix (eu) scsp",                // sibling estimate
  "ik dc ii fund": "ik small cap iv fund",                          // sibling estimate
};

// Normalise a weight map to sum 1.0; drop zero/empty entries. Returns null if
// there is no signal at all (so we don't overwrite with an empty object).
function normalizeMap(raw) {
  const entries = Object.entries(raw).filter(([, v]) => Number(v) > 0);
  const total = entries.reduce((s, [, v]) => s + Number(v), 0);
  if (total <= 0 || entries.length === 0) return null;
  const out = {};
  for (const [k, v] of entries) out[k] = +(Number(v) / total).toFixed(6);
  return out;
}

// ── parse Matrius sheet → fund → { geography, sector } ────────────────────────
async function parseFundAllocations() {
  const xlsxPath = path.join(__dirname, "../data/260120_Allocation_Fons.xlsx");
  const wb = await readFile(xlsxPath);
  const ws = wb.Sheets["Matrius"];
  const rows = utils.sheet_to_json(ws, { header: 1 });

  const fundStarts = [];
  for (let i = 0; i < rows.length; i++) {
    if (rows[i][0] === "x" && typeof rows[i][1] === "number" && rows[i][2]) {
      fundStarts.push({ i, name: String(rows[i][2]).trim() });
    }
  }

  const result = new Map(); // normName → { name, geography, sector }
  for (let fi = 0; fi < fundStarts.length; fi++) {
    const { i: start, name } = fundStarts[fi];
    const nextStart = fi + 1 < fundStarts.length ? fundStarts[fi + 1].i : rows.length;

    const geoRaw = Object.fromEntries(GEO_COLS.map((g) => [g.key, 0]));
    const sectorRaw = {};

    for (let r = start; r < nextStart; r++) {
      const row = rows[r] || [];
      const sectorName = typeof row[SECTOR_NAME_COL] === "string" ? row[SECTOR_NAME_COL].trim() : "";
      const sectorFrac = Number(row[SECTOR_FRAC_COL]) || 0;
      if (sectorName && sectorFrac > 0) {
        sectorRaw[sectorName] = (sectorRaw[sectorName] || 0) + sectorFrac;
      }
      // A sector row carries the geography split for that sector; sum column-wise.
      // Only accumulate from rows that name a sector (skip the block's total row,
      // which would otherwise double-count the marginal).
      if (sectorName) {
        for (const g of GEO_COLS) geoRaw[g.key] += Number(row[g.col]) || 0;
      }
    }

    const geography = normalizeMap(geoRaw);
    const sector = normalizeMap(sectorRaw);
    if (!geography && !sector) continue;
    result.set(norm(name), { name, geography, sector });
  }
  return result;
}

const allocMap = await parseFundAllocations();
console.log(`Parsed allocation for ${allocMap.size} funds from Allocation Excel`);

// ── load fund_meta rows ───────────────────────────────────────────────────────
const { data: metaRows, error: metaErr } = await supabase
  .from("fund_meta")
  .select("vehicle_id, fons, geography, sector");
if (metaErr) { console.error("Failed to load fund_meta:", metaErr.message); process.exit(1); }
console.log(`Loaded ${metaRows.length} fund_meta rows`);

// ── match and plan updates ────────────────────────────────────────────────────
const sameMap = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

const updates = [];
const metaUnmatched = [];
for (const row of metaRows) {
  const nkey = norm(row.fons);
  const alloc = allocMap.get(nkey) || allocMap.get(FONS_ALIASES[nkey]);
  if (!alloc) { metaUnmatched.push(row.fons); continue; }
  if (sameMap(row.geography, alloc.geography) && sameMap(row.sector, alloc.sector)) continue;
  updates.push({ vehicle_id: row.vehicle_id, fons: row.fons, geography: alloc.geography, sector: alloc.sector });
}

// Funds present in the Excel but never matched to a fund_meta row.
const matchedNorms = new Set(metaRows.map((r) => norm(r.fons)));
const excelUnmatched = [...allocMap.values()].filter((a) => !matchedNorms.has(norm(a.name)));

console.log(`\nRows to update: ${updates.length}`);
if (metaUnmatched.length) {
  console.log(`\nfund_meta funds with NO allocation in Excel (${metaUnmatched.length}):`);
  metaUnmatched.sort().forEach((f) => console.log(`  ${f}`));
}
if (excelUnmatched.length) {
  console.log(`\nExcel funds with NO fund_meta row (${excelUnmatched.length}):`);
  excelUnmatched.map((a) => a.name).sort().forEach((f) => console.log(`  ${f}`));
}

if (dryRun) {
  console.log("\nSample (first 3 updates):");
  updates.slice(0, 3).forEach((u) => console.log(`  ${u.fons}`, JSON.stringify({ geography: u.geography, sector: u.sector })));
  console.log("\nDry run — no changes written.");
  process.exit(0);
}

if (updates.length === 0) { console.log("\nNothing to update."); process.exit(0); }

let ok = 0;
for (const { vehicle_id, geography, sector } of updates) {
  const { error } = await supabase
    .from("fund_meta")
    .update({ geography, sector })
    .eq("vehicle_id", vehicle_id);
  if (error) { console.error(`Failed updating vehicle_id=${vehicle_id}:`, error.message); process.exit(1); }
  ok++;
}
console.log(`\nUpdated ${ok} fund_meta rows.`);
process.exit(0);
