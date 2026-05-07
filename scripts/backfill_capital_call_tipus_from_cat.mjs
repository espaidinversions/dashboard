/**
 * Backfill capital_calls.tipus for rows where it is missing or contains a
 * vcpe code (PC, SF, PE, VC, RE, SPV, …) instead of a proper transaction concept.
 *
 * Strategy: derive tipus from the existing cat value.
 *   Capital Call        → "Aportació"
 *   Compromís           → "Compromís"
 *   Distribució         → "Distribució"
 *   Retorn Capital      → "Retorn Capital"
 *   Distribució Retinguda → "Distribució Retinguda"
 *
 * Rows that already have a valid tipus are left untouched.
 *
 * Usage:
 *   node scripts/backfill_capital_call_tipus_from_cat.mjs [--dry-run]
 */

import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

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

// Codes that should NEVER appear in the tipus field — they belong in vcpe
const VCPE_CODES = new Set(["PE", "VC", "RE", "SF", "PC", "SPV"]);

// Derive a canonical tipus from the category
function tipusFromCat(cat) {
  switch (cat) {
    case "Capital Call":          return "Aportació";
    case "Compromís":             return "Compromís";
    case "Distribució":           return "Distribució";
    case "Retorn Capital":        return "Retorn Capital";
    case "Distribució Retinguda": return "Distribució Retinguda";
    default:                      return null; // can't infer — leave as null
  }
}

// Load all rows where tipus needs fixing:
//   - null
//   - the string "null"
//   - a vcpe code
const { data, error } = await supabase
  .from("capital_calls")
  .select("id, fons, tipus, cat, vcpe");

if (error) {
  console.error("Failed to load capital_calls:", error.message);
  process.exit(1);
}

const needsFix = data.filter((row) => {
  const t = row.tipus ?? "";
  return t === "" || t === "null" || VCPE_CODES.has(t);
});

console.log(`Total rows loaded: ${data.length}`);
console.log(`Rows with invalid tipus: ${needsFix.length}`);

const updates = needsFix
  .map((row) => {
    const newTipus = tipusFromCat(row.cat);
    if (!newTipus) return null; // can't infer
    return { id: row.id, fons: row.fons, oldTipus: row.tipus, cat: row.cat, newTipus };
  })
  .filter(Boolean);

const cannotInfer = needsFix.filter((row) => !tipusFromCat(row.cat));

console.log(`\nRows that will be updated: ${updates.length}`);
if (updates.length > 0) {
  const byNewTipus = {};
  updates.forEach((u) => { byNewTipus[u.newTipus] = (byNewTipus[u.newTipus] || 0) + 1; });
  Object.entries(byNewTipus).forEach(([t, n]) => console.log(`  → "${t}": ${n} rows`));
}
if (cannotInfer.length > 0) {
  console.log(`\nRows that cannot be inferred (cat unknown): ${cannotInfer.length}`);
  cannotInfer.forEach((r) => console.log(`  id=${r.id} fons="${r.fons}" cat="${r.cat}" vcpe="${r.vcpe}"`));
}

if (dryRun) {
  console.log("\nDry run — no changes written.");
  process.exit(0);
}

if (updates.length === 0) {
  console.log("Nothing to update.");
  process.exit(0);
}

let ok = 0;
for (const { id, newTipus } of updates) {
  const { error: err } = await supabase
    .from("capital_calls")
    .update({ tipus: newTipus })
    .eq("id", id);
  if (err) {
    console.error(`Failed updating id=${id}:`, err.message);
    process.exit(1);
  }
  ok++;
}

console.log(`\nUpdated ${ok} rows.`);
process.exit(0);
