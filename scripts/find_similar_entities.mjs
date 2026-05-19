/**
 * Diagnostic: list all private_entities sorted by name, with nif/fiscal_name/match_type,
 * and flag pairs that look like duplicates (same words, prefix overlap, etc.)
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

function norm(s) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim().replace(/\s+/g, " ");
}

const env = loadEnv(envPath);
const sb = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const { data: entities, error } = await sb.from("private_entities").select("id,kind,canonical_name,nif,fiscal_name,match_type").order("canonical_name");
if (error) { console.error(error.message); process.exit(1); }

console.log(`\n=== All ${entities.length} entities ===\n`);
for (const e of entities) {
  const flag = (e.id.startsWith("VEHICLE:") || e.id.startsWith("COMPANY:")) ? " [PLACEHOLDER]" : "";
  console.log(`${e.id.padEnd(40)} ${e.canonical_name.padEnd(55)} nif=${(e.nif??"-").padEnd(15)} fiscal=${e.fiscal_name??"null"}${flag}`);
}

// Find near-duplicates: pairs where norm(a) starts with norm(b) or vice versa, or share 3+ words
console.log(`\n=== Potential near-duplicates ===\n`);
const pairs = [];
for (let i = 0; i < entities.length; i++) {
  for (let j = i + 1; j < entities.length; j++) {
    const a = entities[i], b = entities[j];
    const na = norm(a.canonical_name), nb = norm(b.canonical_name);
    if (na === nb) { pairs.push([a, b, "EXACT_NORM"]); continue; }
    if (na.startsWith(nb) || nb.startsWith(na)) { pairs.push([a, b, "PREFIX"]); continue; }
    const wa = new Set(na.split(" ")), wb = new Set(nb.split(" "));
    const shared = [...wa].filter(w => w.length > 3 && wb.has(w));
    const minWords = Math.min(wa.size, wb.size);
    if (shared.length >= 3 && shared.length >= minWords - 1) { pairs.push([a, b, `WORDS(${shared.join(",")})`]); }
  }
}

if (pairs.length === 0) {
  console.log("None found.");
} else {
  for (const [a, b, reason] of pairs) {
    console.log(`[${reason}]`);
    console.log(`  A: ${a.id.padEnd(40)} "${a.canonical_name}"  nif=${a.nif??"-"} fiscal=${a.fiscal_name??"null"} match=${a.match_type}`);
    console.log(`  B: ${b.id.padEnd(40)} "${b.canonical_name}"  nif=${b.nif??"-"} fiscal=${b.fiscal_name??"null"} match=${b.match_type}`);
  }
}
