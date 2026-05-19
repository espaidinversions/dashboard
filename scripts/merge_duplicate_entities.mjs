/**
 * Find and merge duplicate private_entities that share the same (or near-same)
 * canonical_name. Preserves the entity with a real NIF + fiscal_name; reassigns
 * all capital_calls / fund_meta / portfolio_companies references then deletes the
 * loser.
 *
 * Usage:
 *   node scripts/merge_duplicate_entities.mjs [--dry-run]
 */

import { createClient } from "@supabase/supabase-js";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";

const __dir = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dir, "../.env.local");

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return {};
  return Object.fromEntries(
    fs.readFileSync(filePath, "utf8")
      .split("\n")
      .filter(l => l.includes("=") && !l.trimStart().startsWith("#"))
      .map(l => {
        const eq = l.indexOf("=");
        const k = l.slice(0, eq).trim();
        const v = l.slice(eq + 1).trim()
          .replace(/^["']|["']$/g, "")
          .replace(/\s+#.*$/, "");
        return [k, v];
      })
  );
}

function normalize(name) {
  return name
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().trim()
    .replace(/\s+/g, " ");
}

function isFallback(entity) {
  return (
    entity.match_type === "fallback" ||
    entity.id.startsWith("VEHICLE:") ||
    entity.id.startsWith("COMPANY:")
  );
}

function hasRealNif(entity) {
  return entity.nif && entity.nif.trim() !== "" && !isFallback(entity);
}

// Pick the survivor of a group: prefer non-fallback with nif+fiscal_name,
// then non-fallback, then longest id (arbitrary tiebreak).
function pickSurvivor(group) {
  const withAll = group.filter(e => hasRealNif(e) && e.fiscal_name);
  if (withAll.length > 0) return withAll[0];
  const withNif = group.filter(e => hasRealNif(e));
  if (withNif.length > 0) return withNif[0];
  const nonFallback = group.filter(e => !isFallback(e));
  if (nonFallback.length > 0) return nonFallback[0];
  return group[0];
}

const dryRun = process.argv.includes("--dry-run");
if (dryRun) console.log("🔍 DRY RUN — no changes will be written\n");

const env = loadEnv(envPath);
const supabaseUrl = env.VITE_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error("Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const sb = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

// --- 1. Fetch all entities ---
const { data: entities, error: entErr } = await sb.from("private_entities").select("*");
if (entErr) { console.error("Failed to fetch private_entities:", entErr.message); process.exit(1); }

// --- 2. Group by normalized canonical_name ---
const groups = new Map();
for (const e of entities) {
  const key = normalize(e.canonical_name);
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(e);
}

const duplicateGroups = [...groups.values()].filter(g => g.length > 1);
console.log(`Total entities: ${entities.length}`);
console.log(`Duplicate name groups: ${duplicateGroups.length}\n`);

if (duplicateGroups.length === 0) {
  console.log("No duplicates found.");
  process.exit(0);
}

// --- 3. For each group, identify survivor and losers ---
const merges = [];
for (const group of duplicateGroups) {
  const survivor = pickSurvivor(group);
  const losers = group.filter(e => e.id !== survivor.id);
  merges.push({ survivor, losers });
}

// Print plan
console.log("Merge plan:");
for (const { survivor, losers } of merges) {
  console.log(`\n  KEEP  ${survivor.id} — "${survivor.canonical_name}"`);
  console.log(`        nif=${survivor.nif ?? "null"} fiscal_name=${survivor.fiscal_name ?? "null"} match_type=${survivor.match_type}`);
  for (const l of losers) {
    console.log(`  DROP  ${l.id} — "${l.canonical_name}"`);
    console.log(`        nif=${l.nif ?? "null"} fiscal_name=${l.fiscal_name ?? "null"} match_type=${l.match_type}`);
  }
}

if (dryRun) {
  console.log("\n[DRY RUN — no changes made]");
  process.exit(0);
}

// --- 4. Apply merges ---
let totalReassigned = 0;
let totalDeleted = 0;
const errors = [];

for (const { survivor, losers } of merges) {
  for (const loser of losers) {
    // Reassign capital_calls
    const { error: ccErr, count: ccCount } = await sb
      .from("capital_calls")
      .update({ vehicle_id: survivor.id, fons: survivor.canonical_name })
      .eq("vehicle_id", loser.id);
    if (ccErr) { errors.push(`cc update ${loser.id}: ${ccErr.message}`); continue; }

    // Reassign fund_meta
    const { error: fmErr } = await sb
      .from("fund_meta")
      .update({ vehicle_id: survivor.id, fons: survivor.canonical_name })
      .eq("vehicle_id", loser.id);
    if (fmErr) errors.push(`fund_meta update ${loser.id}: ${fmErr.message}`);

    // Reassign portfolio_companies
    const { error: pcErr } = await sb
      .from("portfolio_companies")
      .update({ entity_id: survivor.id, nom: survivor.canonical_name })
      .eq("entity_id", loser.id);
    if (pcErr) errors.push(`portfolio_companies update ${loser.id}: ${pcErr.message}`);

    // Delete loser
    const { error: delErr } = await sb.from("private_entities").delete().eq("id", loser.id);
    if (delErr) {
      errors.push(`delete ${loser.id}: ${delErr.message}`);
    } else {
      totalDeleted++;
      totalReassigned++;
      console.log(`  ✓ merged ${loser.id} → ${survivor.id}`);
    }
  }
}

console.log(`\nDone. ${totalDeleted} entities deleted, ${totalReassigned} references reassigned.`);
if (errors.length > 0) {
  console.error(`\n${errors.length} errors:`);
  errors.forEach(e => console.error("  ✗", e));
  process.exit(1);
}
