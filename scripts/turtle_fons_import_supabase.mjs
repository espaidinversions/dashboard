/**
 * Imports turtle fons model prospective cash forecasts into Supabase.
 *
 * Usage:
 *   node scripts/turtle_fons_import_supabase.mjs [--dry-run]
 *
 * - Reads TURTLE_FONS_MODEL from src/generated/dashboard/turtleFonsModel.js
 * - Fetches distinct fons→vehicle_id map from capital_calls table
 * - Inserts rows for years >= 2026 into prospective_cash_forecasts
 * - Uses replace_prospective_cash_forecasts RPC (atomic delete+insert)
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

import { createClient } from "@supabase/supabase-js";
import { fileURLToPath, pathToFileURL } from "url";
import path from "path";
import fs from "fs";

const __dir = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dir, "..");

const dryRun = process.argv.includes("--dry-run");

// ── Env ───────────────────────────────────────────────────────────────────────
const envPath = path.join(ROOT, ".env.local");
const env = Object.fromEntries(
  fs.readFileSync(envPath, "utf8")
    .split("\n")
    .filter(l => l.includes("=") && !l.startsWith("#"))
    .map(l => {
      const i = l.indexOf("=");
      const key = l.slice(0, i).trim();
      const raw = l.slice(i + 1).trim();
      const value = raw.replace(/^["']|["']$/g, "");
      return [key, value];
    })
);

const SUPABASE_URL = env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_SERVICE_ROLE_KEY or VITE_SUPABASE_URL in .env.local");
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── Load turtle model ─────────────────────────────────────────────────────────
const { TURTLE_FONS_MODEL } = await import(
  pathToFileURL(path.join(ROOT, "src/generated/dashboard/turtleFonsModel.js")).href
);
const { years: allYears, funds } = TURTLE_FONS_MODEL;
const prospectiveYears = allYears.filter(y => y >= 2026);

console.log(`Turtle model: ${Object.keys(funds).length} funds, prospective years: ${prospectiveYears.join(", ")}`);

// ── Fetch vehicle_id map from capital_calls ───────────────────────────────────
console.log("Fetching fons→vehicle_id map from capital_calls...");
const { data: ccRows, error: ccError } = await sb
  .from("capital_calls")
  .select("fons, vehicle_id")
  .not("vehicle_id", "is", null);

if (ccError) {
  console.error("Failed to fetch capital_calls:", ccError.message);
  process.exit(1);
}

// Deduplicate: one vehicle_id per fons name
const vehicleIdMap = {};
for (const row of ccRows ?? []) {
  if (row.fons && row.vehicle_id && !vehicleIdMap[row.fons]) {
    vehicleIdMap[row.fons] = row.vehicle_id;
  }
}

console.log(`vehicle_id map: ${Object.keys(vehicleIdMap).length} distinct funds`);

// ── Build forecast rows ───────────────────────────────────────────────────────
const rows = [];
const matched = [];
const skipped = [];

for (const [fundName, fundData] of Object.entries(funds)) {
  const vehicleId = vehicleIdMap[fundName];
  if (!vehicleId) {
    skipped.push(fundName);
    continue;
  }
  matched.push(fundName);

  for (const year of prospectiveYears) {
    const callAmt = fundData.model_calls?.[year] ?? fundData.model_calls?.[String(year)];
    const distAmt = fundData.model_dist?.[year] ?? fundData.model_dist?.[String(year)];

    if (callAmt > 0) {
      rows.push({ vehicle_id: vehicleId, fons: fundName, flow_type: "call", year, amount: callAmt });
    }
    if (distAmt > 0) {
      rows.push({ vehicle_id: vehicleId, fons: fundName, flow_type: "distribution", year, amount: distAmt });
    }
  }
}

console.log(`\nMatched: ${matched.length} funds → ${rows.length} forecast rows`);
console.log(`Skipped (no vehicle_id): ${skipped.length} funds`);
if (skipped.length > 0) {
  console.log("  Skipped funds:", skipped.join(", "));
}

if (rows.length === 0) {
  console.log("No rows to insert. Exiting.");
  process.exit(0);
}

if (dryRun) {
  console.log("\n--dry-run: skipping Supabase write.");
  console.log("Sample rows:", rows.slice(0, 5));
  process.exit(0);
}

// ── Call RPC ──────────────────────────────────────────────────────────────────
const vehicleIds = [...new Set(rows.map(r => r.vehicle_id))];
console.log(`\nCalling replace_prospective_cash_forecasts for ${vehicleIds.length} vehicles...`);

const { error: rpcError } = await sb.rpc("replace_prospective_cash_forecasts", {
  p_vehicle_ids: vehicleIds,
  p_rows: rows.map(({ vehicle_id, fons, flow_type, year, amount }) => ({
    vehicle_id, fons, flow_type, year, amount,
  })),
});

if (rpcError) {
  console.error("RPC error:", rpcError.message);
  process.exit(1);
}

console.log(`Done. Inserted ${rows.length} rows for ${matched.length} funds.`);
