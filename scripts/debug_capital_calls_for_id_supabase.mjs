/**
 * Dump vcpe distribution for a vehicle_id in Supabase capital_calls.
 *
 * Usage:
 *   node scripts/debug_capital_calls_for_id_supabase.mjs A06876742
 */

import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dir = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dir, "../.env.local");

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return {};
  return Object.fromEntries(
    fs.readFileSync(filePath, "utf8")
      .split(/\r?\n/)
      .filter((l) => l.includes("=") && !l.startsWith("#"))
      .map((l) => {
        const i = l.indexOf("=");
        const key = l.slice(0, i).trim();
        const val = l.slice(i + 1).trim().replace(/^["']|["']$/g, "").replace(/\s+#.*$/, "");
        return [key, val];
      }),
  );
}

async function main() {
  const vehicleId = process.argv[2];
  if (!vehicleId) throw new Error("Pass a vehicle_id");
  const env = loadEnv(envPath);
  const sb = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  const { data, error } = await sb
    .from("capital_calls")
    .select("id, vehicle_id, fons, vcpe, cat, tipus, eur, data")
    .eq("vehicle_id", vehicleId)
    .order("data");
  if (error) throw error;
  const rows = data ?? [];

  const counts = new Map();
  for (const r of rows) {
    const k = String(r.vcpe ?? "").trim() || "(null)";
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  console.log(`rows: ${rows.length}`);
  console.log("vcpe counts:", [...counts.entries()].sort((a, b) => b[1] - a[1]));
  console.log("sample (first 12):");
  rows.slice(0, 12).forEach((r) => {
    console.log(`${r.data} | ${r.vcpe ?? ""} | ${r.cat ?? ""} | ${r.tipus ?? ""} | ${r.eur}`);
  });
}

main().catch((err) => {
  console.error("debug_capital_calls_for_id_supabase failed:", err?.message || String(err));
  process.exit(1);
});

