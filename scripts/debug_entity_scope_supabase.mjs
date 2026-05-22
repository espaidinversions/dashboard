/**
 * Quick debug helper to inspect a handful of ids across tables.
 *
 * Usage:
 *   node scripts/debug_entity_scope_supabase.mjs A06876742 B09745837
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
  const ids = process.argv.slice(2).filter(Boolean);
  if (!ids.length) throw new Error("Pass at least one id");

  const env = loadEnv(envPath);
  const sb = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  for (const id of ids) {
    const [pe, fm, co, se] = await Promise.all([
      sb.from("private_entities").select("id, kind, canonical_name").eq("id", id).maybeSingle(),
      sb.from("fund_meta").select("vehicle_id, fons").eq("vehicle_id", id).maybeSingle(),
      sb.from("portfolio_companies").select("id, nom, tipus").eq("id", id).maybeSingle(),
      sb.from("searchers").select("nif, nom").eq("nif", id).maybeSingle(),
    ]);
    console.log(JSON.stringify({
      id,
      private_entity: pe.data ?? null,
      fund_meta: fm.data ?? null,
      portfolio_company: co.data ?? null,
      searcher: se.data ?? null,
    }, null, 2));
  }
}

main().catch((err) => {
  console.error("debug_entity_scope_supabase failed:", err?.message || String(err));
  process.exit(1);
});

