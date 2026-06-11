/**
 * Backfill fund_meta.vehicle_tipus from the Allocation Fons Excel file.
 *
 * Usage:
 *   node scripts/backfill_vehicle_tipus.mjs [--dry-run]
 *
 * What it does:
 *   1. Reads 260120_Allocation_Fons.xlsx → Matrius sheet
 *   2. For each fund, determines the dominant vehicle type:
 *      Primari / FoF / Secundari / Co-inversió
 *      based on which of the four Primaris/FoF/Secundaris/Co-inversions
 *      allocation fractions is largest.
 *   3. Adds the vehicle_tipus column to fund_meta if it doesn't exist.
 *   4. Matches fund names against fund_meta.fons (exact, then normalised).
 *   5. UPSERTs vehicle_tipus for all matched rows.
 */

import { createClient } from "@supabase/supabase-js";
import pkg from "./lib/xlsx_compat.mjs";
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
      .map((l) => {
        const i = l.indexOf("=");
        return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
      }),
  );
}

const env = loadEnv(path.join(__dirname, "../.env.local"));
const SUPABASE_URL = env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const dryRun = process.argv.includes("--dry-run");

// ── parse Excel ───────────────────────────────────────────────────────────────
async function parseFundVehicleTypes() {
  const xlsxPath = path.join(__dirname, "../260120_Allocation_Fons.xlsx");
  const wb = await readFile(xlsxPath);
  const ws = wb.Sheets["Matrius"];
  const rows = utils.sheet_to_json(ws, { header: 1 });

  // Per-fund header row (row 14 in sheet) establishes:
  //   col 15 = Primaris, col 16 = FoF, col 17 = Secundaris, col 18 = Co-inversions
  // Each fund block starts with ["x", number, fundName].
  // The total row is the last non-empty row before the next fund block (or end).

  const fundStarts = [];
  for (let i = 0; i < rows.length; i++) {
    if (rows[i][0] === "x" && typeof rows[i][1] === "number" && rows[i][2]) {
      fundStarts.push({ i, name: String(rows[i][2]).trim() });
    }
  }

  const result = new Map(); // name → vehicle_tipus

  for (let fi = 0; fi < fundStarts.length; fi++) {
    const { i: start, name } = fundStarts[fi];
    const nextStart = fi + 1 < fundStarts.length ? fundStarts[fi + 1].i : rows.length;

    // Last non-empty row in this block is the totals row
    let totalRow = null;
    for (let r = nextStart - 1; r > start; r--) {
      if (rows[r].some((v) => v != null && v !== 0 && v !== "")) {
        totalRow = rows[r];
        break;
      }
    }
    if (!totalRow) continue;

    const primaris = Number(totalRow[15]) || 0;
    const fof      = Number(totalRow[16]) || 0;
    const sec      = Number(totalRow[17]) || 0;
    const coinv    = Number(totalRow[18]) || 0;
    const total    = primaris + fof + sec + coinv;
    if (total === 0) continue;

    const max = Math.max(primaris, fof, sec, coinv);
    let type;
    if (max === primaris)    type = "Primari";
    else if (max === fof)    type = "FoF";
    else if (max === sec)    type = "Secundari";
    else                     type = "Co-inversió";

    result.set(name, type);
  }

  return result;
}

// ── normalise name for fuzzy matching ────────────────────────────────────────
function norm(s) {
  return String(s ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

// ── main ─────────────────────────────────────────────────────────────────────
const excelMap = await parseFundVehicleTypes();
console.log(`Parsed ${excelMap.size} fund vehicle types from Excel`);

// Load existing fund_meta rows
const { data: metaRows, error: fetchError } = await supabase
  .from("fund_meta")
  .select("vehicle_id, fons, vehicle_tipus");

if (fetchError) {
  if (fetchError.message?.includes("vehicle_tipus")) {
    console.error(
      "Column vehicle_tipus does not exist yet.\n" +
      "Apply the migration first:\n" +
      "  supabase/migrations/20260504000000_fund_meta_vehicle_tipus.sql\n" +
      "via the Supabase dashboard SQL editor, then re-run this script."
    );
  } else {
    console.error("Failed to load fund_meta:", fetchError.message);
  }
  process.exit(1);
}

console.log(`Loaded ${metaRows.length} fund_meta rows from DB`);

// Build normalised lookup for DB rows
const dbByNorm = new Map();
for (const row of metaRows) {
  dbByNorm.set(norm(row.fons ?? ""), row);
}

// Match Excel funds → DB rows
const updates = [];
const unmatched = [];

for (const [excelName, type] of excelMap) {
  const normName = norm(excelName);
  const dbRow = dbByNorm.get(normName);
  if (!dbRow) {
    unmatched.push(excelName);
    continue;
  }
  if (dbRow.vehicle_tipus === type) continue; // already correct
  updates.push({ vehicle_id: dbRow.vehicle_id, vehicle_tipus: type, fons: dbRow.fons });
}

console.log(`\nRows to update: ${updates.length}`);
if (updates.length > 0) {
  updates.forEach((u) => console.log(`  ${u.fons}: → ${u.vehicle_tipus}`));
}
if (unmatched.length > 0) {
  console.log(`\nUnmatched Excel funds (no DB row): ${unmatched.length}`);
  unmatched.forEach((n) => console.log(`  ${n}`));
}

if (dryRun) {
  console.log("\nDry run — no changes written.");
  process.exit(0);
}

if (updates.length === 0) {
  console.log("Nothing to update.");
  process.exit(0);
}

for (const { vehicle_id, vehicle_tipus } of updates) {
  const { error } = await supabase
    .from("fund_meta")
    .update({ vehicle_tipus })
    .eq("vehicle_id", vehicle_id);
  if (error) {
    console.error(`Failed updating ${vehicle_id}:`, error.message);
    process.exit(1);
  }
}

console.log(`\nUpdated ${updates.length} rows.`);
process.exit(0);
