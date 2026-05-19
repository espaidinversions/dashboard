import { createClient } from "@supabase/supabase-js";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";

const __dir = path.dirname(fileURLToPath(import.meta.url));

function loadEnv(f) {
  return Object.fromEntries(
    fs.readFileSync(f, "utf8").split("\n")
      .filter(l => l.includes("=") && !l.trimStart().startsWith("#"))
      .map(l => { const eq = l.indexOf("="); return [l.slice(0,eq).trim(), l.slice(eq+1).trim().replace(/^["']|["']$/g,"").replace(/\s+#.*$/,"")]; })
  );
}

const env = loadEnv(path.join(__dir, "../.env.local"));
const sb = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

// Fetch all rows with pagination (Supabase caps at 1000 per call)
let all = [], offset = 0;
while (true) {
  const { data, error } = await sb.from("capital_calls")
    .select("id,vehicle_id,fons,tipus,data,eur")
    .order("vehicle_id").order("data")
    .range(offset, offset + 999);
  if (error) { console.error(error.message); process.exit(1); }
  all = all.concat(data);
  if (data.length < 1000) break;
  offset += 1000;
}
const data = all;

const seen = new Map();
const dups = [];
for (const r of data) {
  const key = `${r.vehicle_id}|${r.tipus}|${r.data}|${Math.round(r.eur * 100)}`;
  if (seen.has(key)) {
    dups.push({ key, keepId: seen.get(key).id, dropId: r.id, fons: r.fons, tipus: r.tipus, data: r.data, eur: r.eur });
  } else {
    seen.set(key, r);
  }
}

const dryRun = process.argv.includes("--dry-run");
if (dryRun) console.log("🔍 DRY RUN — no changes will be written\n");

console.log(`Total rows: ${data.length}`);
console.log(`Duplicate keys: ${dups.length}\n`);
dups.forEach(d => console.log(`  ${d.fons} | ${d.tipus} | ${d.data} | €${d.eur}  keep=${d.keepId} drop=${d.dropId}`));

if (dups.length === 0) process.exit(0);
if (dryRun) { console.log("\n[DRY RUN — no changes made]"); process.exit(0); }

const dropIds = dups.map(d => d.dropId);
console.log(`\nDeleting ${dropIds.length} duplicate rows...`);

const BATCH = 200;
let deleted = 0;
for (let i = 0; i < dropIds.length; i += BATCH) {
  const batch = dropIds.slice(i, i + BATCH);
  const { error: delErr } = await sb.from("capital_calls").delete().in("id", batch);
  if (delErr) { console.error(`Batch ${i}: ${delErr.message}`); process.exit(1); }
  deleted += batch.length;
}
console.log(`Done. ${deleted} rows deleted. Remaining: ${data.length - deleted}`);
