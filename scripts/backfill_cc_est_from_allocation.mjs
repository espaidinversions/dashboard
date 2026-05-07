/**
 * Update capital_calls.est with vehicle type labels derived from
 * 260120_Allocation_Fons.xlsx (Matrius sheet).
 *
 * Replaces "Fons Primari" / "Fons de Fons" with the proper vehicle type
 * per fund: Primari | FoF | Secundari | Co-inversió
 *
 * Usage:
 *   node scripts/backfill_cc_est_from_allocation.mjs [--dry-run]
 */

import { createClient } from "@supabase/supabase-js";
import pkg from "xlsx";
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

// ── normalise name for fuzzy matching ─────────────────────────────────────────
function norm(s) {
  return String(s ?? "").toLowerCase().replace(/\s+/g, " ").trim()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

// ── parse Matrius sheet → fund → vehicle type ─────────────────────────────────
function parseFundVehicleTypes() {
  const xlsxPath = path.join(__dirname, "../260120_Allocation_Fons.xlsx");
  const wb = readFile(xlsxPath);
  const ws = wb.Sheets["Matrius"];
  const rows = utils.sheet_to_json(ws, { header: 1 });

  const fundStarts = [];
  for (let i = 0; i < rows.length; i++) {
    if (rows[i][0] === "x" && typeof rows[i][1] === "number" && rows[i][2]) {
      fundStarts.push({ i, name: String(rows[i][2]).trim() });
    }
  }

  const result = new Map(); // normName → vehicle type
  for (let fi = 0; fi < fundStarts.length; fi++) {
    const { i: start, name } = fundStarts[fi];
    const nextStart = fi + 1 < fundStarts.length ? fundStarts[fi + 1].i : rows.length;

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
    if (max === primaris)    type = "Fons Primari";
    else if (max === fof)    type = "Fons de Fons";
    else if (max === sec)    type = "Fons de Secundaris";
    else                     type = "Fons de Coinversió";

    result.set(norm(name), type);
  }
  return result;
}

const vehicleMap = parseFundVehicleTypes();
console.log(`Parsed ${vehicleMap.size} fund vehicle types from Allocation Excel`);

// ── load all capital_calls rows ───────────────────────────────────────────────
let all = [];
let from = 0;
while (true) {
  const { data, error } = await supabase
    .from("capital_calls")
    .select("id, fons, est")
    .range(from, from + 999)
    .order("id");
  if (error) { console.error("Failed to load capital_calls:", error.message); process.exit(1); }
  all.push(...data);
  if (data.length < 1000) break;
  from += 1000;
}
console.log(`Loaded ${all.length} capital_calls rows`);

// ── match and plan updates ────────────────────────────────────────────────────
const updates = [];
const unmatched = new Set();

for (const row of all) {
  const newEst = vehicleMap.get(norm(row.fons));
  if (!newEst) {
    unmatched.add(row.fons);
    continue;
  }
  if (newEst === row.est) continue; // already correct
  updates.push({ id: row.id, fons: row.fons, oldEst: row.est, newEst });
}

console.log(`\nRows to update: ${updates.length}`);
const byTransition = {};
updates.forEach((u) => {
  const k = `"${u.oldEst}" → "${u.newEst}"`;
  byTransition[k] = (byTransition[k] || 0) + 1;
});
Object.entries(byTransition).sort((a, b) => b[1] - a[1]).forEach(([t, n]) => console.log(`  ${n}  ${t}`));

if (unmatched.size > 0) {
  console.log(`\nFunds not found in Allocation Excel (${unmatched.size}):`);
  [...unmatched].sort().forEach((f) => console.log(`  ${f}`));
}

if (dryRun) {
  console.log("\nDry run — no changes written.");
  process.exit(0);
}

if (updates.length === 0) {
  console.log("\nNothing to update.");
  process.exit(0);
}

let ok = 0;
for (const { id, newEst } of updates) {
  const { error } = await supabase
    .from("capital_calls")
    .update({ est: newEst })
    .eq("id", id);
  if (error) { console.error(`Failed updating id=${id}:`, error.message); process.exit(1); }
  ok++;
}

console.log(`\nUpdated ${ok} rows.`);
process.exit(0);
