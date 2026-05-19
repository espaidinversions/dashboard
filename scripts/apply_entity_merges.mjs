/**
 * Apply the entity merges from 20260519000000_merge_duplicate_entities.sql
 * using the Supabase JS client.
 *
 * Usage: node scripts/apply_entity_merges.mjs [--dry-run]
 */
import { createClient } from "@supabase/supabase-js";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";

const __dir = path.dirname(fileURLToPath(import.meta.url));

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return {};
  return Object.fromEntries(
    fs.readFileSync(filePath, "utf8")
      .split("\n")
      .filter(l => l.includes("=") && !l.trimStart().startsWith("#"))
      .map(l => {
        const eq = l.indexOf("=");
        const k = l.slice(0, eq).trim();
        const v = l.slice(eq + 1).trim().replace(/^["']|["']$/g, "").replace(/\s+#.*$/, "");
        return [k, v];
      })
  );
}

const MERGES = [
  // [loserId, survivorId, survivorName]
  ["VEHICLE:QUALITUR-CONSULTING-SL-FEEL-AT-HOME",         "B63907869",                                        "Feel at Home"],
  ["VEHICLE:THE-UMAI-GROUP-SUSHI",                        "B01755917",                                        "Umai"],
  ["VEHICLE:SALOMONTE-INVESTOR-POOLING-B-V-HOTEK",        "NLD14901645B",                                     "Hotek"],
  ["VEHICLE:EUROPEAN-SME-OPPORTUNITIES-III-L-P-IRMARFER", "CAN1000362449",                                    "Irmafer"],
  ["VEHICLE:WORKTOGETHER-COLLECTIVE",                     "B67054338",                                        "Collective"],
  ["VEHICLE:ASF-PHARMA-ALFAVET-SEQOS-AURICA-SPV",        "B75554824",                                        "Alfavet"],
  ["VEHICLE:GALDANA-III-FCR",                             "V05376298",                                        "Galdana Ventures III"],
  ["VEHICLE:TACA-FIRE-COINVEST",                          "MOCKNIF:COMPANY:ÍTACA_FIRE_COINVEST",              "Grupo FIRE"],
  ["VEHICLE:ALPHA-NOVA-CAPTAL",                           "MOCKNIF:COMPANY:ALPHA_NOVA_CAPTAL",                "Alpha Nova Capital"],
  ["MOCKNIF:VEHICLE:QUALITAS_FUNDS_DIRECT_III_?_SCR",     "VEHICLE:QUALITAS-FUNDS-DIRECT-III-SCR",            "Qualitas Funds Direct III SCR"],
  ["MOCKNIF:VEHICLE:MAIN-FOUNDATION-III",                 "MOCKNIF:VEHICLE:MAIN_FOUNDATION_III_COÖPERATIEF_U.A.", "Main Foundation III Coöperatief U.A."],
];

const dryRun = process.argv.includes("--dry-run");
if (dryRun) console.log("🔍 DRY RUN — no changes will be written\n");

const env = loadEnv(path.join(__dir, "../.env.local"));
const sb = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

// Verify losers exist in DB
const { data: existing } = await sb.from("private_entities").select("id,canonical_name,match_type,fiscal_name");
const existingIds = new Set(existing.map(e => e.id));

let merged = 0, skipped = 0;
const errors = [];

for (const [loserId, survivorId, survivorName] of MERGES) {
  if (!existingIds.has(loserId)) {
    console.log(`  SKIP ${loserId} — not in DB (already merged or never created)`);
    skipped++;
    continue;
  }
  if (!existingIds.has(survivorId)) {
    console.error(`  ERROR ${survivorId} — survivor not found in DB`);
    errors.push(`Survivor ${survivorId} not found`);
    continue;
  }

  console.log(`  ${loserId}\n    → ${survivorId} ("${survivorName}")`);
  if (dryRun) continue;

  // capital_calls
  const { error: ccErr } = await sb
    .from("capital_calls")
    .update({ vehicle_id: survivorId, fons: survivorName })
    .eq("vehicle_id", loserId);
  if (ccErr) { errors.push(`cc ${loserId}: ${ccErr.message}`); continue; }

  // fund_meta
  const { error: fmErr } = await sb
    .from("fund_meta")
    .update({ vehicle_id: survivorId, fons: survivorName })
    .eq("vehicle_id", loserId);
  if (fmErr) errors.push(`fund_meta ${loserId}: ${fmErr.message}`);

  // portfolio_companies
  const { error: pcErr } = await sb
    .from("portfolio_companies")
    .update({ entity_id: survivorId, nom: survivorName })
    .eq("entity_id", loserId);
  if (pcErr) errors.push(`portfolio_companies ${loserId}: ${pcErr.message}`);

  // delete loser
  const { error: delErr } = await sb.from("private_entities").delete().eq("id", loserId);
  if (delErr) { errors.push(`delete ${loserId}: ${delErr.message}`); continue; }

  merged++;
}

if (dryRun) {
  console.log("\n[DRY RUN — no changes made]");
  process.exit(0);
}

console.log(`\nDone. ${merged} merged, ${skipped} skipped.`);
if (errors.length > 0) {
  console.error(`\n${errors.length} errors:`);
  errors.forEach(e => console.error("  ✗", e));
  process.exit(1);
}
