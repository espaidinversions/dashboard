import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { rowToCapitalCall, rowToFundMeta } from "../src/data/mappers.js";
import { computeFundIrrFromRows } from "../src/data/fundDetailModel.js";

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
const supabase = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const dryRun = process.argv.includes("--dry-run");
const entityMap = new Map();

const [{ data: ccRows, error: ccError }, { data: metaRows, error: metaError }] = await Promise.all([
  supabase.from("capital_calls").select("*").order("vehicle_id").order("data"),
  supabase.from("fund_meta").select("*").order("fons"),
]);

if (ccError || metaError) {
  console.error("Load failed:", ccError?.message || metaError?.message);
  await supabase.realtime.disconnect();
  process.exit(1);
}

const rawCC = (ccRows ?? []).map((row) => rowToCapitalCall(row, entityMap));
const grouped = new Map();
rawCC.forEach((row) => {
  const key = row.id ?? row.fons;
  if (!key) return;
  if (!grouped.has(key)) grouped.set(key, []);
  grouped.get(key).push(row);
});

const updates = (metaRows ?? []).map((row) => {
  const mapped = rowToFundMeta(row, entityMap);
  const fundRows = grouped.get(mapped.id ?? mapped.fons) ?? [];
  const irr = computeFundIrrFromRows(fundRows, mapped.tvpi);
  return {
    vehicle_id: row.vehicle_id,
    fons: row.fons,
    tvpi: row.tvpi ?? null,
    irr,
  };
});

console.log(`fund_meta rows: ${updates.length}`);
console.log(`IRR populated: ${updates.filter((row) => row.irr != null).length}`);

if (dryRun) {
  console.log(JSON.stringify(updates.slice(0, 20), null, 2));
  await supabase.realtime.disconnect();
  process.exit(0);
}

for (const row of updates) {
  const { error } = await supabase
    .from("fund_meta")
    .update({ irr: row.irr })
    .eq("vehicle_id", row.vehicle_id);
  if (error) {
    console.error(`Update failed for ${row.vehicle_id}: ${error.message}`);
    await supabase.realtime.disconnect();
    process.exit(1);
  }
}

console.log("Backfill complete.");
await supabase.realtime.disconnect();
