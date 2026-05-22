/**
 * Check overlap between "companies" (vcpe PC/SF) and "fund vehicles" (everything else)
 * in current Supabase data.
 *
 * Overlap signals:
 *  1) Same vehicle_id appears with both company and fund vcpe codes.
 *  2) Same canonical_name appears as both kind=company and kind=vehicle in private_entities.
 *
 * Usage:
 *   node scripts/check_company_fund_overlap_supabase.mjs
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

function scopeOfVcpe(vcpe) {
  const v = String(vcpe ?? "").trim();
  if (v === "PC" || v === "SF") return "company";
  return "fund";
}

async function fetchAll(sb, table, select) {
  const PAGE = 1000;
  const all = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb
      .from(table)
      .select(select)
      .order(table === "capital_calls" ? "data" : "id")
      .range(from, from + PAGE - 1);
    if (error) throw error;
    all.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return all;
}

async function main() {
  const env = loadEnv(envPath);
  const url = env.VITE_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  const sb = createClient(url, key, { auth: { persistSession: false } });

  const cc = await fetchAll(sb, "capital_calls", "vehicle_id, vcpe, fons");
  const byId = new Map(); // id -> { scopes:Set, vcpes:Set, names:Set }
  for (const r of cc) {
    const id = r.vehicle_id ? String(r.vehicle_id) : "";
    if (!id) continue;
    if (!byId.has(id)) byId.set(id, { scopes: new Set(), vcpes: new Set(), names: new Set() });
    const cur = byId.get(id);
    cur.scopes.add(scopeOfVcpe(r.vcpe));
    if (r.vcpe) cur.vcpes.add(String(r.vcpe).trim());
    if (r.fons) cur.names.add(String(r.fons).trim());
  }

  const idOverlaps = [];
  for (const [id, meta] of byId.entries()) {
    if (meta.scopes.size > 1) {
      idOverlaps.push({
        id,
        vcpes: [...meta.vcpes].sort().join(","),
        names: [...meta.names].slice(0, 3).join(" | "),
      });
    }
  }
  idOverlaps.sort((a, b) => a.id.localeCompare(b.id));

  const entities = await fetchAll(sb, "private_entities", "id, kind, canonical_name");
  const byName = new Map(); // nameLower -> { kinds:Set, ids:Set }
  for (const e of entities) {
    const name = String(e.canonical_name ?? "").trim();
    if (!name) continue;
    const keyName = name.toLowerCase();
    if (!byName.has(keyName)) byName.set(keyName, { name, kinds: new Set(), ids: new Set() });
    const cur = byName.get(keyName);
    cur.kinds.add(String(e.kind ?? "").trim() || "unknown");
    cur.ids.add(String(e.id));
  }

  const nameOverlaps = [];
  for (const meta of byName.values()) {
    if (meta.kinds.has("company") && meta.kinds.has("vehicle")) {
      nameOverlaps.push({
        name: meta.name,
        ids: [...meta.ids].slice(0, 6).join(", "),
      });
    }
  }
  nameOverlaps.sort((a, b) => a.name.localeCompare(b.name));

  console.log(`capital_calls rows scanned: ${cc.length}`);
  console.log(`private_entities scanned:   ${entities.length}`);
  console.log("");
  console.log(`Overlap by vehicle_id (same id used for both company and fund vcpe): ${idOverlaps.length}`);
  if (idOverlaps.length) {
    console.log("id | vcpes | sample names");
    idOverlaps.slice(0, 50).forEach((r) => console.log(`${r.id} | ${r.vcpes} | ${r.names}`));
    if (idOverlaps.length > 50) console.log(`... (${idOverlaps.length - 50} more)`);
  }
  console.log("");
  console.log(`Overlap by canonical_name in private_entities (same name used for both kind=company and kind=vehicle): ${nameOverlaps.length}`);
  if (nameOverlaps.length) {
    console.log("name | ids");
    nameOverlaps.slice(0, 50).forEach((r) => console.log(`${r.name} | ${r.ids}`));
    if (nameOverlaps.length > 50) console.log(`... (${nameOverlaps.length - 50} more)`);
  }
}

main().catch((err) => {
  console.error("check_company_fund_overlap_supabase failed:", err?.message || String(err));
  process.exit(1);
});

