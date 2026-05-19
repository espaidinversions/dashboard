/**
 * Run a SQL migration file directly against Supabase using the service role key.
 * Usage: node scripts/run_migration.mjs <migration.sql>
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
        const v = l.slice(eq + 1).trim().replace(/^["']|["']$/g, "").replace(/\s+#.*$/, "");
        return [k, v];
      })
  );
}

const sqlFile = process.argv[2];
if (!sqlFile) { console.error("Usage: node scripts/run_migration.mjs <file.sql>"); process.exit(1); }

const env = loadEnv(envPath);
const sb = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const sql = fs.readFileSync(sqlFile, "utf8");
console.log(`Running ${sqlFile}...`);
const { error } = await sb.rpc("exec_sql", { sql }).catch(() => ({ error: { message: "exec_sql not available" } }));

if (error?.message?.includes("exec_sql not available") || error?.message?.includes("function exec_sql")) {
  // Fall back: use the REST endpoint directly
  const res = await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: "POST",
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ sql }),
  });
  if (!res.ok) {
    console.error("exec_sql failed:", await res.text());
    console.log("\nRun the SQL manually in the Supabase SQL editor.");
    process.exit(1);
  }
} else if (error) {
  console.error("Error:", error.message);
  process.exit(1);
}

console.log("Done.");
