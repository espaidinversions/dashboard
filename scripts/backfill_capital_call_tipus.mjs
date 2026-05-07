import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { normalizeCapitalCallTipus } from "../src/data/capitalCallTipusModel.js";

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
  try {
    await supabase.realtime.disconnect();
  } catch {}
  process.exit(code);
}

const { data, error } = await supabase
  .from("capital_calls")
  .select("id, tipus, eur, cat")
  .order("id");

if (error) {
  console.error("Failed to load capital_calls:", error.message);
  await finish(1);
}

const updates = (data ?? [])
  .map((row) => {
    const normalized = normalizeCapitalCallTipus(row.tipus);
    if (!normalized || normalized === row.tipus) return null;
    return {
      id: row.id,
      tipus: row.tipus,
      normalized,
      eur: row.eur,
      cat: row.cat,
    };
  })
  .filter(Boolean);

console.log(`Loaded ${data?.length ?? 0} capital call rows`);
console.log(`Rows needing tipus backfill: ${updates.length}`);

if (updates.length === 0) {
  await finish(0);
}

const byTransition = Object.entries(
  updates.reduce((acc, row) => {
    const key = `${row.tipus} => ${row.normalized}`;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {}),
).sort((a, b) => b[1] - a[1]);

console.log("Top mappings:");
byTransition.slice(0, 25).forEach(([label, count]) => {
  console.log(`  ${count}  ${label}`);
});

const equalisationRows = updates.filter((row) => row.normalized === "Prima d'Equalització");
if (equalisationRows.length > 0) {
  const positive = equalisationRows.filter((row) => Number(row.eur) > 0).length;
  const negative = equalisationRows.filter((row) => Number(row.eur) < 0).length;
  console.log(`Prima d'Equalització rows to rename: ${equalisationRows.length} (${positive} positive, ${negative} negative)`);
}

if (dryRun) {
  console.log("Dry run only. No rows updated.");
  await finish(0);
}

for (const row of updates) {
  const { error: updateError } = await supabase
    .from("capital_calls")
    .update({ tipus: row.normalized })
    .eq("id", row.id);

  if (updateError) {
    console.error(`Failed updating row ${row.id}:`, updateError.message);
    await finish(1);
  }
}

console.log(`Updated ${updates.length} capital call rows.`);
console.log("EUR signs and categories were left unchanged.");
await finish(0);
