/**
 * Imports the generated fund cashflow forecast model into Supabase.
 *
 * Usage:
 *   node scripts/turtle_fons_import_supabase.mjs [--dry-run] [--min-year 2026]
 *
 * - Reads TURTLE_FONS_MODEL from src/generated/dashboard/turtleFonsModel.js
 * - Uses Roberto/Turtle model rows for years >= min-year by default
 * - Resolves vehicle_id from fund_meta, capital_calls, private_entities,
 *   current forecasts, and local private entity workbook fallbacks
 * - Uses replace_prospective_cash_forecasts RPC for an atomic delete + insert
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

import { createClient } from "@supabase/supabase-js";
import { fileURLToPath, pathToFileURL } from "url";
import path from "path";
import fs from "fs";

import { FUND_NAME_MAP } from "../src/data/fundNameMap.js";
import { PRIVATE_ENTITIES_WORKBOOK } from "../src/generated/dashboard/privateEntitiesWorkbook.js";

const __dir = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dir, "..");

export const ROBERTO_NAME_ALIASES = {
  "Altamar $ MidMarket": ["Altamar MidMarket", "Altamar X Midmarket", "Altamar X Global Buyout Midmarket US$ FCR"],
  "Capytal Dynamics Mid-Market": ["Cap. Dynamics MM V", "Capital Dynamics Mid-Market Direct V"],
  "Capital Dynamics Mid Market VI": ["Cap. Dynamics MM VI", "Capital Dynamics Mid-Market Direct VI SCA"],
  "Capital Dynamics GSEC VI": ["Cap. Dynamics Sec. VI", "Capital Dynamics Secondaries VI"],
  "Galdana Ventures Asia I": ["Galdana Asia", "Galdana Asia I"],
  "Pictet MRV": ["Pictet Monte Rosa V"],
  "Pictet MR VI": ["Pictet Monte Rosa VI", "Pictet Monte Rosa VI FCR"],
  "Pantheon Co-inversio": ["Pantheon Co-Inv", "Pantheon Co-inv"],
  "Pantheon Co-inversió": ["Pantheon Co-Inv", "Pantheon Co-inv"],
  "T2 Energy Fund B.March": ["T2 Energy B.March", "T2 Energy-B.March"],
  "Lee Equity": ["Lee Equity IV", "Lee Equity Partners Fund IV, LP"],
  "Committed Advisors V": ["Committed Advisors Secondary Fund V, SLP"],
  "Arcano Earth II": ["Arcano Earth II 2021 SCR", "ARCANO EARTH 2021 SCR SA"],
  "IK Small Caps IV": ["IK Small Cap IV", "IK Small Cap IV Fund"],
  "Qualitas PE Program IV": ["Qualitas PE Prog. IV", "Qualitas Mutual PE Program IV"],
  "Qualitas PE Program V": ["Qualitas PE Prog. V", "Qualitas Funds V A SCR"],
  "Qualitas PE Program VI": ["Qualitas PE Prog. VI", "Qualitas Funds VI SCR A"],
  "Qualitas Direct III SCR": ["Qualitas Direct III"],
  "Qualitas Secondary Opps I SCR": ["Qualitas Secondary Opps I"],
};

function parseArgs(argv) {
  const out = { dryRun: false, minYear: 2026 };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--dry-run") out.dryRun = true;
    else if (arg === "--include-past") out.minYear = 0;
    else if (arg === "--min-year") out.minYear = Number(argv[++i]) || out.minYear;
  }
  return out;
}

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return {};
  return Object.fromEntries(
    fs.readFileSync(filePath, "utf8")
      .split("\n")
      .filter((line) => line.includes("=") && !line.trim().startsWith("#"))
      .map((line) => {
        const i = line.indexOf("=");
        const key = line.slice(0, i).trim();
        const value = line.slice(i + 1).trim().replace(/^["']|["']$/g, "").replace(/\\n$/g, "").replace(/\s+#.*$/, "");
        return [key, value];
      }),
  );
}

export function slugify(value) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function nameKey(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/capytal/g, "capital")
    .replace(/co[- ]?inversio/g, "co inv")
    .replace(/co[- ]?invest/g, "co inv")
    .replace(/\$/g, " usd ")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function amount(value) {
  const n = Number(value) || 0;
  return Math.round(n * 100) / 100;
}

function addCandidate(map, rawName, id, source, priority) {
  const name = String(rawName ?? "").trim();
  const vehicleId = String(id ?? "").trim();
  if (!name || !vehicleId) return;
  const names = [name];
  const mapped = FUND_NAME_MAP[name];
  if (mapped) names.push(mapped);
  for (const n of names) {
    const key = nameKey(n);
    const existing = map.get(key);
    if (!existing || priority < existing.priority) {
      map.set(key, { id: vehicleId, name: n, source, priority, ambiguous: false });
    } else if (existing.priority === priority && existing.id !== vehicleId) {
      map.set(key, { ...existing, ambiguous: true });
    }
  }
}

function addRowNameCandidates(map, row, id, source, priority) {
  [row?.fons, row?.canonical_name, row?.source_name, row?.workbook_name, row?.fiscal_name, row?.workbookName]
    .forEach((name) => addCandidate(map, name, id, source, priority));
}

function applyAliasCandidates(map) {
  for (const [target, aliases] of Object.entries(ROBERTO_NAME_ALIASES)) {
    for (const alias of aliases) {
      const match = map.get(nameKey(alias));
      if (match && !match.ambiguous) addCandidate(map, target, match.id, `alias:${match.source}`, match.priority + 0.1);
    }
  }
}

export function buildForecastRows(model, resolver, { minYear = 2026 } = {}) {
  const rows = [];
  const matched = [];
  const unmatched = [];
  const oldVehicleIds = new Set();

  const years = (model.years ?? []).filter((year) => Number(year) >= minYear);
  for (const [fundName, fundData] of Object.entries(model.funds ?? {})) {
    const resolved = resolver(fundName);
    if (!resolved?.id) {
      unmatched.push(fundName);
      continue;
    }
    matched.push({ fons: fundName, vehicle_id: resolved.id, source: resolved.source });
    for (const id of resolved.oldVehicleIds ?? []) oldVehicleIds.add(id);

    for (const year of years) {
      const callAmt = amount(fundData.model_calls?.[year] ?? fundData.model_calls?.[String(year)]);
      const distAmt = amount(fundData.model_dist?.[year] ?? fundData.model_dist?.[String(year)]);
      if (callAmt > 0) rows.push({ vehicle_id: resolved.id, fons: fundName, flow_type: "calls", year, amount: callAmt });
      if (distAmt > 0) rows.push({ vehicle_id: resolved.id, fons: fundName, flow_type: "dist", year, amount: distAmt });
    }
  }

  return { rows, matched, unmatched, oldVehicleIds: [...oldVehicleIds] };
}

async function fetchAll(sb, table, select, order = null) {
  const PAGE = 1000;
  const all = [];
  for (let from = 0; ; from += PAGE) {
    let q = sb.from(table).select(select).range(from, from + PAGE - 1);
    if (order) q = q.order(order);
    const { data, error } = await q;
    if (error) throw new Error(`Failed to load ${table}: ${error.message}`);
    all.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return all;
}

async function buildResolver(sb) {
  const [forecasts, fundMeta, capitalCalls, privateEntities] = await Promise.all([
    fetchAll(sb, "prospective_cash_forecasts", "vehicle_id, fons"),
    fetchAll(sb, "fund_meta", "vehicle_id, fons"),
    fetchAll(sb, "capital_calls", "vehicle_id, fons"),
    fetchAll(sb, "private_entities", "id, canonical_name, source_name, workbook_name, fiscal_name"),
  ]);

  const candidates = new Map();
  const knownEntityIds = new Set(privateEntities.map((row) => String(row.id ?? "").trim()).filter(Boolean));
  const currentForecastIdsByName = new Map();

  for (const row of privateEntities) addRowNameCandidates(candidates, row, row.id, "private_entities", 1);
  for (const row of fundMeta) addRowNameCandidates(candidates, row, row.vehicle_id, "fund_meta", 2);
  for (const row of capitalCalls) addRowNameCandidates(candidates, row, row.vehicle_id, "capital_calls", 3);
  for (const row of forecasts) {
    addRowNameCandidates(candidates, row, row.vehicle_id, "current_forecast", 9);
    const key = nameKey(row.fons);
    if (!currentForecastIdsByName.has(key)) currentForecastIdsByName.set(key, new Set());
    currentForecastIdsByName.get(key).add(row.vehicle_id);
  }
  for (const row of PRIVATE_ENTITIES_WORKBOOK) addRowNameCandidates(candidates, row, row.id, "local_private_entities", 8);

  applyAliasCandidates(candidates);

  function resolver(fundName) {
    const key = nameKey(fundName);
    const match = candidates.get(key);
    const oldVehicleIds = currentForecastIdsByName.get(key) ? [...currentForecastIdsByName.get(key)] : [];
    if (!match || match.ambiguous) {
      const id = `MOCKNIF:VEHICLE:${slugify(fundName)}`;
      return { id, source: match?.ambiguous ? "placeholder_ambiguous" : "placeholder_missing", oldVehicleIds, placeholder: true };
    }
    return { ...match, oldVehicleIds, placeholder: !knownEntityIds.has(match.id) };
  }

  return { resolver, knownEntityIds };
}

async function replaceForecastsDirect(sb, vehicleIds, rows) {
  const ID_BATCH = 100;
  for (let i = 0; i < vehicleIds.length; i += ID_BATCH) {
    const batch = vehicleIds.slice(i, i + ID_BATCH);
    const { error } = await sb.from("prospective_cash_forecasts").delete().in("vehicle_id", batch);
    if (error) throw new Error(`Direct forecast delete failed: ${error.message}`);
  }

  const ROW_BATCH = 500;
  for (let i = 0; i < rows.length; i += ROW_BATCH) {
    const batch = rows.slice(i, i + ROW_BATCH);
    const { error } = await sb.from("prospective_cash_forecasts").insert(batch);
    if (error) throw new Error(`Direct forecast insert failed: ${error.message}`);
  }
}
async function main() {
  const args = parseArgs(process.argv.slice(2));
  const env = loadEnv(path.join(ROOT, ".env.local"));
  const SUPABASE_URL = env.VITE_SUPABASE_URL;
  const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error("Missing SUPABASE_SERVICE_ROLE_KEY or VITE_SUPABASE_URL in .env.local");
    process.exit(1);
  }

  const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { TURTLE_FONS_MODEL } = await import(pathToFileURL(path.join(ROOT, "src/generated/dashboard/turtleFonsModel.js")).href);
  const years = (TURTLE_FONS_MODEL.years ?? []).filter((year) => Number(year) >= args.minYear);
  console.log(`Forecast model: ${Object.keys(TURTLE_FONS_MODEL.funds ?? {}).length} funds, import years: ${years.join(", ")}`);

  const { resolver, knownEntityIds } = await buildResolver(sb);
  const result = buildForecastRows(TURTLE_FONS_MODEL, resolver, { minYear: args.minYear });

  const vehicleIds = [...new Set([...result.rows.map((row) => row.vehicle_id), ...result.oldVehicleIds])];
  const placeholderRows = [...new Map(
    result.matched
      .filter((row) => !knownEntityIds.has(row.vehicle_id))
      .map((row) => [row.vehicle_id, {
        id: row.vehicle_id,
        kind: "vehicle",
        canonical_name: row.fons,
        source_name: row.fons,
        match_type: row.source?.startsWith("placeholder") ? "fallback" : "forecast_import",
      }]),
  ).values()];

  const bySource = new Map();
  for (const row of result.matched) bySource.set(row.source, (bySource.get(row.source) ?? 0) + 1);

  console.log(`Matched funds: ${result.matched.length}`);
  console.log(`Forecast rows: ${result.rows.length}`);
  console.log(`Vehicle IDs to replace: ${vehicleIds.length}`);
  console.log(`Placeholder/private_entities upserts: ${placeholderRows.length}`);
  console.log("Match sources:");
  [...bySource.entries()].sort((a, b) => b[1] - a[1]).forEach(([source, count]) => console.log(`  ${count} ${source}`));

  if (result.unmatched.length) {
    console.log("Unmatched funds:");
    result.unmatched.forEach((name) => console.log(`  ${name}`));
  }

  if (args.dryRun) {
    console.log("\n--dry-run: no Supabase writes.");
    console.log("Sample rows:", result.rows.slice(0, 5));
    if (placeholderRows.length) console.log("Placeholder sample:", placeholderRows.slice(0, 5));
    return;
  }

  if (placeholderRows.length) {
    const { error } = await sb.from("private_entities").upsert(placeholderRows, { onConflict: "id" });
    if (error) {
      console.error("private_entities upsert failed:", error.message);
      process.exit(1);
    }
  }

  const { error: rpcError } = await sb.rpc("replace_prospective_cash_forecasts", {
    p_vehicle_ids: vehicleIds,
    p_rows: result.rows.map(({ vehicle_id, fons, flow_type, year, amount }) => ({ vehicle_id, fons, flow_type, year, amount })),
  });

  if (rpcError) {
    if (String(rpcError.message ?? "").includes("Forbidden")) {
      console.warn("RPC returned Forbidden; falling back to direct service-key delete/insert.");
      try {
        await replaceForecastsDirect(sb, vehicleIds, result.rows);
      } catch (err) {
        console.error(err?.message || String(err));
        process.exit(1);
      }
    } else {
      console.error("RPC error:", rpcError.message);
      process.exit(1);
    }
  }

  console.log(`Done. Inserted ${result.rows.length} rows for ${result.matched.length} funds.`);
}

if (process.argv[1]?.endsWith("turtle_fons_import_supabase.mjs")) {
  main().catch((err) => {
    console.error("turtle_fons_import_supabase failed:", err?.stack || err?.message || String(err));
    process.exit(1);
  });
}
