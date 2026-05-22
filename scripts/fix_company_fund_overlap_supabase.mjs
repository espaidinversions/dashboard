/**
 * Fix overlap where the same vehicle_id is used for both companies (PC/SF) and funds (PE/VC/RE/etc.)
 * by migrating the out-of-scope rows to a new private_entities id.
 *
 * Strategy:
 *  1) Determine the canonical scope of each conflicting vehicle_id:
 *     - If portfolio_companies contains id => scope=company
 *     - Else if private_entities.kind exists: company => scope=company, vehicle => scope=fund
 *     - Else fallback: scope=company if any PC/SF rows exist, otherwise fund
 *  2) For rows whose vcpe scope mismatches the canonical scope:
 *     - Create a new private_entities row with id = "VEHICLE:<slug>" or "COMPANY:<slug>" as needed
 *     - Update capital_calls rows: vehicle_id -> new id
 *
 * Dry run by default.
 *
 * Usage:
 *   node scripts/fix_company_fund_overlap_supabase.mjs --dry-run
 *   node scripts/fix_company_fund_overlap_supabase.mjs --apply
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

function slug(value) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function fetchAll(sb, table, select, orderCol = "id") {
  const PAGE = 1000;
  const all = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb
      .from(table)
      .select(select)
      .order(orderCol)
      .range(from, from + PAGE - 1);
    if (error) throw error;
    all.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return all;
}

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const dryRun = !apply || args.includes("--dry-run");

  const env = loadEnv(envPath);
  const url = env.VITE_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  const sb = createClient(url, key, { auth: { persistSession: false } });

  // Data needed to decide canonical scope.
  const companies = await fetchAll(sb, "portfolio_companies", "id", "id");
  const companyIds = new Set((companies ?? []).map((r) => String(r.id)).filter(Boolean));
  const searchers = await fetchAll(sb, "searchers", "nif", "nif");
  const searcherIds = new Set((searchers ?? []).map((r) => String(r.nif)).filter(Boolean));
  const fundMeta = await fetchAll(sb, "fund_meta", "vehicle_id", "vehicle_id");
  const fundMetaIds = new Set((fundMeta ?? []).map((r) => String(r.vehicle_id)).filter(Boolean));
  const entities = await fetchAll(sb, "private_entities", "id, kind, canonical_name", "id");
  const entityById = new Map(entities.map((r) => [String(r.id), r]));

  const cc = await fetchAll(sb, "capital_calls", "id, vehicle_id, fons, vcpe, cat, tipus, eur, data", "data");

  const byVehicle = new Map();
  for (const r of cc) {
    const vehicleId = r.vehicle_id ? String(r.vehicle_id) : "";
    if (!vehicleId) continue;
    if (!byVehicle.has(vehicleId)) byVehicle.set(vehicleId, { rows: [], scopes: new Set(), vcpes: new Set(), names: new Set() });
    const cur = byVehicle.get(vehicleId);
    cur.rows.push(r);
    cur.scopes.add(scopeOfVcpe(r.vcpe));
    if (r.vcpe) cur.vcpes.add(String(r.vcpe).trim());
    if (r.fons) cur.names.add(String(r.fons).trim());
  }

  const conflicts = [];
  for (const [vehicleId, meta] of byVehicle.entries()) {
    if (meta.scopes.size <= 1) continue;
    conflicts.push({
      vehicleId,
      vcpes: [...meta.vcpes].sort(),
      names: [...meta.names],
      rows: meta.rows,
    });
  }
  conflicts.sort((a, b) => a.vehicleId.localeCompare(b.vehicleId));

  console.log(`conflicting vehicle_id count: ${conflicts.length}`);
  if (!conflicts.length) return;

  const plannedEntityUpserts = [];
  const plannedCapitalCallUpdates = []; // { id, vehicle_id }

  for (const c of conflicts) {
    const existingEntity = entityById.get(c.vehicleId) ?? null;
    // Canonical scope priority:
    //  1) Explicit presence in fund_meta => fund
    //  2) Explicit presence in portfolio_companies/searchers => company
    //  3) private_entities.kind if present
    //  4) fallback to vcpe evidence
    const canonicalScope =
      fundMetaIds.has(c.vehicleId)
        ? "fund"
        : (companyIds.has(c.vehicleId) || searcherIds.has(c.vehicleId))
          ? "company"
          : existingEntity?.kind === "company"
            ? "company"
            : existingEntity?.kind === "vehicle"
              ? "fund"
              : c.vcpes.some((v) => v === "PC" || v === "SF")
                ? "company"
                : "fund";

    // Migrate rows that do not match canonicalScope.
    const mismatched = c.rows.filter((r) => scopeOfVcpe(r.vcpe) !== canonicalScope);
    if (!mismatched.length) continue;

    // Choose a stable new id based on name family.
    const nameHint = mismatched.find((r) => r.fons)?.fons ?? c.names[0] ?? c.vehicleId;
    // The new id should represent the *mismatched* side, not the canonical side.
    // Use "fund" as a scope label, but store in private_entities.kind as "vehicle".
    const newScope = canonicalScope === "company" ? "fund" : "company";
    const newId = `${newScope === "company" ? "COMPANY" : "VEHICLE"}:${slug(nameHint) || slug(c.vehicleId)}`;

    if (!entityById.has(newId)) {
      plannedEntityUpserts.push({
        id: newId,
        kind: newScope === "company" ? "company" : "vehicle",
        canonical_name: String(nameHint ?? "").trim() || newId,
        source_name: String(nameHint ?? "").trim() || newId,
        match_type: "overlap_fix",
      });
      entityById.set(newId, { id: newId, kind: newScope === "company" ? "company" : "vehicle", canonical_name: nameHint, source_name: nameHint });
    }

    for (const r of mismatched) {
      plannedCapitalCallUpdates.push({ id: r.id, vehicle_id: newId });
    }

    console.log(`\n${c.vehicleId} vcpes=[${c.vcpes.join(",")}] canonical=${canonicalScope} migrate_rows=${mismatched.length} -> ${newId}`);
  }

  console.log(`\nPlanned private_entities upserts: ${plannedEntityUpserts.length}`);
  console.log(`Planned capital_calls updates:     ${plannedCapitalCallUpdates.length}`);

  if (dryRun) {
    console.log("\nDRY RUN: no changes applied.");
    return;
  }

  if (plannedEntityUpserts.length) {
    const { error } = await sb.from("private_entities").upsert(plannedEntityUpserts, { onConflict: "id" });
    if (error) throw error;
  }

  // Update in small batches.
  const BATCH = 200;
  for (let i = 0; i < plannedCapitalCallUpdates.length; i += BATCH) {
    const batch = plannedCapitalCallUpdates.slice(i, i + BATCH);
    // Supabase doesn't support bulk update by different values easily; do RPC-less sequential updates.
    for (const upd of batch) {
      const { error } = await sb.from("capital_calls").update({ vehicle_id: upd.vehicle_id }).eq("id", upd.id);
      if (error) throw error;
    }
    process.stdout.write(`\rUpdated ${Math.min(i + BATCH, plannedCapitalCallUpdates.length)}/${plannedCapitalCallUpdates.length}...`);
  }
  console.log("\nDone.");
}

main().catch((err) => {
  console.error("fix_company_fund_overlap_supabase failed:", err?.message || String(err));
  process.exit(1);
});
