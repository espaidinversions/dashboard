import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { inferCapitalCallCategoryFromTipus, normalizeCapitalCallSignedAmount, normalizeCapitalCallTipus } from "../src/data/capitalCallTipusModel.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, "../.env.local");

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return {};
  return Object.fromEntries(
    fs.readFileSync(filePath, "utf8")
      .split("\n")
      .filter((line) => line.includes("=") && !line.startsWith("#"))
      .map((line) => {
        const index = line.indexOf("=");
        return [line.slice(0, index).trim(), line.slice(index + 1).trim()];
      }),
  );
}

const env = loadEnv(envPath);
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

async function finish(code) {
  process.exit(code);
}

const { data, error } = await supabase
  .from("capital_calls")
  .select("id, tipus, eur, amount_native, cat, divisa")
  .order("id");

if (error) {
  console.error("Failed to load capital_calls:", error.message);
  await finish(1);
}

const updates = (data ?? [])
  .map((row) => {
    const tipus = normalizeCapitalCallTipus(row.tipus);
    const eur = normalizeCapitalCallSignedAmount(tipus, row.eur);
    const amountNative = row.amount_native == null ? null : normalizeCapitalCallSignedAmount(tipus, row.amount_native);
    const cat = row.cat ?? inferCapitalCallCategoryFromTipus(tipus, eur);
    const eurChanged = Number(eur) !== Number(row.eur);
    const nativeChanged = amountNative != null && Number(amountNative) !== Number(row.amount_native);
    const catChanged = cat !== row.cat;
    if (!eurChanged && !nativeChanged && !catChanged) return null;
    return {
      id: row.id,
      tipus,
      oldEur: row.eur,
      eur,
      oldAmountNative: row.amount_native,
      amountNative,
      oldCat: row.cat,
      cat,
      divisa: row.divisa,
    };
  })
  .filter(Boolean);

console.log(`Loaded ${data?.length ?? 0} capital call rows`);
console.log(`Rows needing sign/category backfill: ${updates.length}`);

if (!updates.length) {
  await finish(0);
}

const signFlips = updates.filter((row) => Math.sign(Number(row.oldEur) || 0) !== Math.sign(Number(row.eur) || 0)).length;
console.log(`Rows with EUR sign changes: ${signFlips}`);

if (dryRun) {
  console.log("Dry run only. No rows updated.");
  await finish(0);
}

for (const row of updates) {
  const payload = {
    eur: row.eur,
    cat: row.cat,
  };
  if (row.amountNative != null) payload.amount_native = row.amountNative;

  const { error: updateError } = await supabase
    .from("capital_calls")
    .update(payload)
    .eq("id", row.id);

  if (updateError) {
    console.error(`Failed updating row ${row.id}:`, updateError.message);
    await finish(1);
  }
}

console.log(`Updated ${updates.length} capital call rows.`);
await finish(0);
