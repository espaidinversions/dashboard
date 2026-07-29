/**
 * Populate fund_meta.geography, fund_meta.sector and fund_meta.strategy with
 * normalized weight maps derived from 260120_Allocation_Fons.xlsx (Matrius sheet).
 *
 * Each fund block in Matrius holds a sector x geography matrix plus a strategy x
 * vehicle-class matrix (all fractions of the fund commitment). We reduce them to
 * three marginal distributions, each normalized to sum 1.0:
 *   geography = column-wise sum over sector rows (cols 7..11)
 *   sector    = per-sector-row fraction (col 12)
 *   strategy  = per-strategy-row total over the vehicle-class sub-matrix (cols 15..18, col 19 fallback)
 *
 * These feed the "per Sector" / "per Geografia" donuts and the Asset Allocation
 * view, where each capital call / commitment is distributed by its fund's mix
 * (same methodology as the workbook's "by Geography / by Vertical / by Fund Type" blocks).
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
        const val = l.slice(i + 1).trim().replace(/\r$/, "").replace(/^["']|["']$/g, "").replace(/\\n$/, "");
        return [key, val];
      }),
  );
}

const envFile = process.env.ALLOCATION_ENV_FILE
  ? path.resolve(process.cwd(), process.env.ALLOCATION_ENV_FILE)
  : path.join(__dirname, "../.env.local");
const env = loadEnv(envFile);
if (!env.VITE_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error(`Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in ${envFile}`);
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

// Strategy / fund-type: each fund block has a fixed 7-row strategy ladder in
// col 14 (Small/Mid/Large Buyout, Growth, VC, Turnaround, RE&Infra). The
// strategy weight is the row total across the vehicle-class sub-matrix
// (Primaris/FoF/Secundaris/Co-inversions), cols 15..18, with col 19 as the
// pre-summed total fallback.
const STRATEGY_NAME_COL = 14;
const STRATEGY_WEIGHT_COLS = [15, 16, 17, 18];
const STRATEGY_TOTAL_COL = 19;

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

// ── parse Matrius sheet → fund → { geography, sector, strategy } ──────────────
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

  const result = new Map(); // normName → { name, geography, sector, strategy }
  for (let fi = 0; fi < fundStarts.length; fi++) {
    const { i: start, name } = fundStarts[fi];
    const nextStart = fi + 1 < fundStarts.length ? fundStarts[fi + 1].i : rows.length;

    const geoRaw = Object.fromEntries(GEO_COLS.map((g) => [g.key, 0]));
    const sectorRaw = {};
    const strategyRaw = {};

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
      // A strategy row (col 14) carries the fund's weight in that fund-type,
      // summed across the vehicle-class sub-matrix (cols 15..18), falling back to
      // the pre-summed total (col 19).
      const strategyName = typeof row[STRATEGY_NAME_COL] === "string" ? row[STRATEGY_NAME_COL].trim() : "";
      if (strategyName) {
        let w = STRATEGY_WEIGHT_COLS.reduce((s, c) => s + (Number(row[c]) || 0), 0);
        if (w <= 0) w = Number(row[STRATEGY_TOTAL_COL]) || 0;
        if (w > 0) strategyRaw[strategyName] = (strategyRaw[strategyName] || 0) + w;
      }
    }

    const geography = normalizeMap(geoRaw);
    const sector = normalizeMap(sectorRaw);
    const strategy = normalizeMap(strategyRaw);
    if (!geography && !sector && !strategy) continue;
    result.set(norm(name), { name, geography, sector, strategy });
  }
  return result;
}

const allocMap = await parseFundAllocations();
console.log(`Parsed allocation for ${allocMap.size} funds from Allocation Excel`);

// ── load fund_meta rows ───────────────────────────────────────────────────────
const { data: metaRows, error: metaErr } = await supabase
  .from("fund_meta")
  .select("vehicle_id, fons, geography, sector, strategy");
if (metaErr) { console.error("Failed to load fund_meta:", metaErr.message); process.exit(1); }
console.log(`Loaded ${metaRows.length} fund_meta rows`);

// ── match and plan updates ────────────────────────────────────────────────────
function stableJson(value) {
  if (value == null) return "null";
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

const sameMap = (a, b) => stableJson(a ?? null) === stableJson(b ?? null);

const updates = [];
const metaUnmatched = [];
for (const row of metaRows) {
  const nkey = norm(row.fons);
  const alloc = allocMap.get(nkey) || allocMap.get(FONS_ALIASES[nkey]);
  if (!alloc) { metaUnmatched.push(row.fons); continue; }
  if (
    sameMap(row.geography, alloc.geography) &&
    sameMap(row.sector, alloc.sector) &&
    sameMap(row.strategy, alloc.strategy)
  ) continue;
  updates.push({
    vehicle_id: row.vehicle_id,
    fons: row.fons,
    geography: alloc.geography,
    sector: alloc.sector,
    strategy: alloc.strategy,
  });
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
  updates.slice(0, 3).forEach((u) => console.log(`  ${u.fons}`, JSON.stringify({ geography: u.geography, sector: u.sector, strategy: u.strategy })));
  console.log("\nDry run — no changes written.");
} else if (updates.length === 0) {
  console.log("\nNothing to update.");
} else {
  let ok = 0;
  for (const { vehicle_id, geography, sector, strategy } of updates) {
    const { error } = await supabase
      .from("fund_meta")
      .update({ geography, sector, strategy })
      .eq("vehicle_id", vehicle_id);
    if (error) { console.error(`Failed updating vehicle_id=${vehicle_id}:`, error.message); process.exit(1); }
    ok++;
  }
  console.log(`\nUpdated ${ok} fund_meta rows.`);
}

supabase.realtime?.disconnect?.();
