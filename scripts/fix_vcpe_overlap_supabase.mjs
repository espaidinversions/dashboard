/**
 * Enforce mutual exclusivity between companies (PC/SF) and funds (PE/VC/RE/...) WITHOUT changing vehicle_id.
 *
 * For each vehicle_id that appears with both company-scope and fund-scope vcpe values:
 *  1) Decide canonical scope:
 *     - If in fund_meta => fund
 *     - Else if in portfolio_companies or searchers(nif) => company
 *     - Else fallback to private_entities.kind, else vcpe evidence
 *  2) Update mismatched capital_calls rows to the canonical vcpe family:
 *     - canonical=fund: set vcpe of mismatched rows to the most common fund vcpe for that id (PE/VC/RE), else "PE"
 *     - canonical=company: set vcpe of mismatched rows to the most common company vcpe for that id (PC/SF), else "PC"
 *
 * Dry-run by default.
 *
 * Usage:
 *   node scripts/fix_vcpe_overlap_supabase.mjs --dry-run
 *   node scripts/fix_vcpe_overlap_supabase.mjs --apply
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

function isFundVcpe(vcpe) {
  const v = String(vcpe ?? "").trim();
  return v && v !== "PC" && v !== "SF";
}

function isCompanyVcpe(vcpe) {
  const v = String(vcpe ?? "").trim();
  return v === "PC" || v === "SF";
}

function mostCommon(values) {
  const counts = new Map();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best = null;
  let bestN = -1;
  for (const [k, n] of counts.entries()) {
    if (n > bestN) { best = k; bestN = n; }
  }
  return best;
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

  const [fundMeta, companies, searchers, entities, cc] = await Promise.all([
    fetchAll(sb, "fund_meta", "vehicle_id", "vehicle_id"),
    fetchAll(sb, "portfolio_companies", "id", "id"),
    fetchAll(sb, "searchers", "nif", "nif"),
    fetchAll(sb, "private_entities", "id, kind", "id"),
    fetchAll(sb, "capital_calls", "id, vehicle_id, vcpe, fons, data", "data"),
  ]);

  const fundMetaIds = new Set((fundMeta ?? []).map((r) => String(r.vehicle_id)).filter(Boolean));
  const companyIds = new Set((companies ?? []).map((r) => String(r.id)).filter(Boolean));
  const searcherIds = new Set((searchers ?? []).map((r) => String(r.nif)).filter(Boolean));
  const entityById = new Map((entities ?? []).map((r) => [String(r.id), r]));

  const byVehicle = new Map(); // id -> { rows, companyVcpes, fundVcpes }
  for (const r of cc) {
    const vehicleId = r.vehicle_id ? String(r.vehicle_id) : "";
    if (!vehicleId) continue;
    if (!byVehicle.has(vehicleId)) byVehicle.set(vehicleId, { rows: [], companyVcpes: [], fundVcpes: [] });
    const cur = byVehicle.get(vehicleId);
    cur.rows.push(r);
    if (isCompanyVcpe(r.vcpe)) cur.companyVcpes.push(String(r.vcpe).trim());
    if (isFundVcpe(r.vcpe)) cur.fundVcpes.push(String(r.vcpe).trim());
  }

  const updates = []; // { id, vcpe }
  let conflictCount = 0;
  for (const [vehicleId, meta] of byVehicle.entries()) {
    if (!meta.companyVcpes.length || !meta.fundVcpes.length) continue;
    conflictCount++;

    const existingEntity = entityById.get(vehicleId) ?? null;
    // Canonical scope priority:
    //  1) Majority vote by vcpe scope across rows for this id
    //  2) Explicit presence in portfolio_companies/searchers => company
    //  3) fund_meta presence => fund (tie-break; still imperfect but better than kind here)
    //  4) private_entities.kind if present (company/vehicle)
    //  5) default fund
    const rowCompanyCount = meta.companyVcpes.length;
    const rowFundCount = meta.fundVcpes.length;
    const majority = rowCompanyCount > rowFundCount ? "company" : "fund";

    const canonicalScope =
      (rowCompanyCount !== rowFundCount)
        ? majority
        : (companyIds.has(vehicleId) || searcherIds.has(vehicleId))
          ? "company"
          : fundMetaIds.has(vehicleId)
            ? "fund"
            : existingEntity?.kind === "company"
              ? "company"
              : existingEntity?.kind === "vehicle"
                ? "fund"
                : "fund";

    const desiredVcpe =
      canonicalScope === "fund"
        ? (mostCommon(meta.fundVcpes) ?? "PE")
        : (mostCommon(meta.companyVcpes) ?? "PC");

    for (const row of meta.rows) {
      const rowScope = scopeOfVcpe(row.vcpe);
      if (rowScope !== canonicalScope) {
        updates.push({ id: row.id, vcpe: desiredVcpe, vehicle_id: vehicleId, from: row.vcpe, to: desiredVcpe, fons: row.fons, data: row.data });
      }
    }
  }

  console.log(`conflicting vehicle_id count: ${conflictCount}`);
  console.log(`planned capital_calls vcpe updates: ${updates.length}`);
  if (updates.length) {
    console.log("sample (first 20): vehicle_id | date | fons | vcpe from -> to");
    updates.slice(0, 20).forEach((u) => {
      console.log(`${u.vehicle_id} | ${String(u.data ?? "").slice(0, 10)} | ${u.fons ?? ""} | ${u.from ?? ""} -> ${u.to}`);
    });
  }

  if (dryRun) {
    console.log("\nDRY RUN: no changes applied.");
    return;
  }

  const BATCH = 200;
  for (let i = 0; i < updates.length; i += BATCH) {
    const batch = updates.slice(i, i + BATCH);
    for (const u of batch) {
      const { error } = await sb.from("capital_calls").update({ vcpe: u.vcpe }).eq("id", u.id);
      if (error) throw error;
    }
    process.stdout.write(`\rUpdated ${Math.min(i + BATCH, updates.length)}/${updates.length}...`);
  }
  console.log("\nDone.");
}

main().catch((err) => {
  console.error("fix_vcpe_overlap_supabase failed:", err?.message || String(err));
  process.exit(1);
});
