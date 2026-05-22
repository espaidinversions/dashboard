/**
 * Startups import — reads "Startups log" sheet and syncs to Supabase.
 *
 * Usage:
 *   node scripts/startups_import.mjs "2022.06.16 Capital Calls.xlsx"
 *   node scripts/startups_import.mjs "2022.06.16 Capital Calls.xlsx" --dry-run
 *
 * Strategy: DELETE all capital_calls for vehicles with fund_meta.vehicle_tipus = 'PC', then INSERT parsed rows.
 * All other vehicle types are left untouched.
 */

import { createClient } from "@supabase/supabase-js";
import { createRequire } from "module";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";

const require = createRequire(import.meta.url);
const XLSX = require("xlsx");

const __dir = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dir, "../.env.local");

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return {};
  return Object.fromEntries(
    fs.readFileSync(filePath, "utf8")
      .split("\n")
      .filter(l => l.includes("=") && !l.startsWith("#"))
      .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
  );
}

const env = loadEnv(envPath);
const SUPABASE_URL = env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── Category mapping ──────────────────────────────────────────────────────────
// Positive amount = outflow (investment), negative = inflow (return)
const CAT_MAP = {
  // Capital calls / investments
  "Aportació Capital":                                              "Capital Call",
  "Aportació capital":                                              "Capital Call",
  "Aportació capital (abans Préstec convertible (The Umai Group))": "Capital Call",
  "Aportació Capital a gestionar (no equity)":                      "Capital Call",
  "Ampliació Capital":                                              "Capital Call",
  "Ampliació capital":                                              "Capital Call",
  "Ampliació":                                                      "Capital Call",
  "Préstec convertible":                                            "Capital Call",
  "Préstec pont":                                                   "Capital Call",
  "Préstec participatiu":                                           "Capital Call",
  "Préstec":                                                        "Capital Call",
  "Aportació":                                                      "Capital Call",
  "Subscripció":                                                    "Capital Call",
  "Equity":                                                         "Capital Call",
  "Inversió":                                                       "Capital Call",
  "Venture Debt":                                                   "Capital Call",
  "Compra participacions":                                          "Capital Call",
  "Prestació accesòria":                                            "Capital Call",
  "Prima Eq.":                                                      "Capital Call",
  "Comissió de subscripció":                                        "Capital Call",
  "Secundari":                                                      "Capital Call",
  "Saldo apertura 2019":                                            "Capital Call",
  "Saldo Tancament 2019":                                           "Capital Call",
  "Compromís":                                                      "Compromís",
  // Returns / distributions
  "Devolució Préstec + interessos":                                 "Retorn Capital",
  "Devolució préstec":                                              "Retorn Capital",
  "Devolució Préstec":                                              "Retorn Capital",
  "Devolució Capital":                                              "Retorn Capital",
  "Devolució Venture Debt":                                         "Retorn Capital",
  "Devolució":                                                      "Retorn Capital",
  "Retorn":                                                         "Retorn Capital",
  "Desinversió":                                                    "Retorn Capital",
  "Venda":                                                          "Retorn Capital",
  "Venda participacions":                                           "Retorn Capital",
  "Venda 14 part.":                                                 "Retorn Capital",
  "Assessorament financer":                                         "Retorn Capital",
  "Management fees":                                                "Retorn Capital",
  "Retrib. Admor. 2024":                                            "Retorn Capital",
  "Retrib. Admor. 2025":                                            "Retorn Capital",
  "Distribució":                                                    "Distribució",
  "Dividends":                                                      "Distribució",
  "Interessos i comissions":                                        "Distribució",
  "Interessos préstec capitalitzat":                                "Distribució",
};

function excelDateToISO(serial) {
  const d = XLSX.SSF.parse_date_code(serial);
  if (!d || d.y < 2010) return null;
  return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
}

// ── Parse Excel ───────────────────────────────────────────────────────────────
function parseExcel(filePath) {
  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets["Startups log"];
  if (!ws) throw new Error('Sheet "Startups log" not found');

  const raw = XLSX.utils.sheet_to_json(ws, { defval: "", header: 1 });
  // Header at row 7; data from row 8
  // Col 1=Startup, 2=Tipus, 3=#, 4=Data, 5=Import, 6=Divisa, 7=FXrate,
  // 8=Comentaris, 9=Mes, 10=Any, 11=stat, 12=FY, 13=Taula, 14=VC/PE, 15=Afecte

  const rows = [];
  const skipped = { noCat: new Set(), noDate: 0 };
  let lastFons = "";

  for (let i = 8; i < raw.length; i++) {
    const r = raw[i];

    const fons = String(r[1] ?? "").trim();
    if (fons) lastFons = fons;
    if (!lastFons) continue;

    const tipusRaw = String(r[2] ?? "").trim();
    if (!tipusRaw) continue;

    const cat = CAT_MAP[tipusRaw];
    if (!cat) { skipped.noCat.add(tipusRaw); continue; }

    const dateSerial = r[4];
    if (!dateSerial || typeof dateSerial !== "number") { skipped.noDate++; continue; }
    const data = excelDateToISO(dateSerial);
    if (!data) { skipped.noDate++; continue; }

    const eur    = Number(r[5]) || 0;
    const divisa = String(r[6] || "EUR").trim();
    const mes    = Number(r[9]) || Number(data.slice(5, 7));
    const any    = Number(r[10]) || Number(data.slice(0, 4));
    const fy     = String(r[12] || `FY ${any}`).trim();

    rows.push({ fons: lastFons, cat, data, eur, divisa, est: "PC", tipus: tipusRaw || "PC", mes, any, fy });
  }

  if (skipped.noCat.size) console.log("⚠ Skipped unknown categories:", [...skipped.noCat].sort().join(", "));
  if (skipped.noDate)    console.log(`⚠ Skipped ${skipped.noDate} rows with no/invalid date`);

  return rows;
}

// ── Resolve entity_id from company name ───────────────────────────────────────
async function buildCompanyEntityMap() {
  const { data, error } = await sb
    .from("private_entities")
    .select("id, canonical_name, kind")
    .eq("kind", "company");
  if (error) throw new Error("Failed to load private_entities: " + error.message);

  const map = new Map();
  for (const e of data) {
    map.set(e.canonical_name.trim().toLowerCase(), e.id);
  }
  return map;
}

function resolveCompanyId(fons, entityMap) {
  const needle = fons.trim().toLowerCase();
  if (entityMap.has(needle)) return entityMap.get(needle);
  // Partial match
  for (const [dbName, id] of entityMap) {
    if (dbName.startsWith(needle) || needle.startsWith(dbName.split(" (")[0].toLowerCase())) {
      return id;
    }
  }
  return `MOCKNIF:COMPANY:${fons.toUpperCase().replace(/\s+/g, "_").slice(0, 60)}`;
}

function makeDuplicateKey(row) {
  return [
    row.vehicle_id ?? "",
    row.data ?? "",
    row.cat ?? "",
    Number(row.eur ?? 0).toFixed(2),
  ].join("|");
}

// ── Main ──────────────────────────────────────────────────────────────────────
const [,, filePath, flag] = process.argv;
if (!filePath) {
  console.log('Ús: node scripts/startups_import.mjs "2022.06.16 Capital Calls.xlsx" [--dry-run]');
  process.exit(1);
}

const absPath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
if (!fs.existsSync(absPath)) { console.error("Fitxer no trobat:", absPath); process.exit(1); }

const dryRun = flag === "--dry-run";
if (dryRun) console.log("🔍 DRY RUN — no changes will be written\n");

const rows = parseExcel(absPath);
console.log(`✓ Parsed ${rows.length} rows from "Startups log"`);
console.log(`  Startups: ${[...new Set(rows.map(r => r.fons))].length}`);

// Resolve entity IDs
console.log("Loading company entities from DB...");
const entityMap = await buildCompanyEntityMap();

let mockCount = 0;
const mappedRows = rows.map(r => {
  const vehicle_id = resolveCompanyId(r.fons, entityMap);
  if (vehicle_id.startsWith("MOCKNIF:")) mockCount++;
  return { vehicle_id, fons: r.fons, tipus: r.tipus, est: r.est, cat: r.cat, eur: r.eur, divisa: r.divisa, mes: r.mes, year: r.any, fy: r.fy, data: r.data };
});

// Load SF vehicle IDs from fund_meta, then fetch their capital_calls for dedup
const { data: sfVehiclesFromMeta } = await sb.from("fund_meta").select("vehicle_id").eq("vehicle_tipus", "SF");
const sfVehicleIds = (sfVehiclesFromMeta ?? []).map((r) => r.vehicle_id);
const { data: sfRows, error: sfErr } = sfVehicleIds.length
  ? await sb.from("capital_calls").select("vehicle_id, data, cat, eur").in("vehicle_id", sfVehicleIds)
  : { data: [], error: null };
if (sfErr) {
  console.error("Failed to load existing SF rows:", sfErr.message);
  process.exit(1);
}

const sfDuplicateKeys = new Set((sfRows ?? []).map(makeDuplicateKey));
const dbRows = mappedRows.filter((row) => !sfDuplicateKeys.has(makeDuplicateKey(row)));

if (mockCount) {
  console.log(`⚠ ${mockCount} rows will use mock vehicle_id`);
  const mockNames = [...new Set(dbRows.filter(r => r.vehicle_id.startsWith("MOCKNIF:")).map(r => r.fons))];
  console.log("  Unresolved startups:", mockNames.join(", "));
}

const skippedDuplicates = mappedRows.length - dbRows.length;
if (skippedDuplicates) {
  console.log(`⚠ Skipped ${skippedDuplicates} PC rows duplicated by existing SF movements`);
}

if (dryRun) {
  console.log("\nSample rows:");
  dbRows.slice(0, 5).forEach(r => console.log(" ", JSON.stringify(r)));
  process.exit(0);
}

// Upsert missing mock company entities
const mockRows = dbRows.filter(r => r.vehicle_id.startsWith("MOCKNIF:"));
if (mockRows.length) {
  const mockEntities = [...new Map(mockRows.map(r => [r.vehicle_id, {
    id: r.vehicle_id, kind: "company", canonical_name: r.fons, match_type: "mock", country: null,
  }])).values()];
  const { error: upsertErr } = await sb.from("private_entities").upsert(mockEntities, { onConflict: "id" });
  if (upsertErr) console.warn("⚠ Could not upsert mock entities:", upsertErr.message);
  else console.log(`✓ Upserted ${mockEntities.length} mock company entities`);
}

// DELETE existing PC rows (via fund_meta.vehicle_tipus)
console.log("\nDeleting existing PC capital calls...");
const { data: pcVehicles } = await sb.from("fund_meta").select("vehicle_id").eq("vehicle_tipus", "PC");
const pcIds = (pcVehicles ?? []).map((r) => r.vehicle_id);
if (pcIds.length) {
  const { error: delErr } = await sb.from("capital_calls").delete().in("vehicle_id", pcIds);
  if (delErr) { console.error("Delete failed:", delErr.message); process.exit(1); }
}
console.log("✓ Deleted");

// Ensure fund_meta has vehicle_tipus = 'PC' for each company vehicle
const pcVehicleIds = [...new Set(dbRows.map(r => r.vehicle_id))];
if (pcVehicleIds.length) {
  const pcMetaRows = pcVehicleIds.map(id => {
    const row = dbRows.find(r => r.vehicle_id === id);
    return { vehicle_id: id, fons: row?.fons ?? id, vehicle_tipus: "PC" };
  });
  const { error: metaErr } = await sb.from("fund_meta").upsert(pcMetaRows, { onConflict: "vehicle_id" });
  if (metaErr) console.warn("⚠ Could not upsert vehicle_tipus to fund_meta:", metaErr.message);
  else console.log(`✓ Upserted vehicle_tipus=PC for ${pcMetaRows.length} vehicles into fund_meta`);
}

// INSERT in batches
const BATCH = 200;
let inserted = 0;
for (let i = 0; i < dbRows.length; i += BATCH) {
  const batch = dbRows.slice(i, i + BATCH);
  const { error } = await sb.from("capital_calls").insert(batch);
  if (error) { console.error(`Insert batch ${i}-${i + BATCH} failed:`, error.message); process.exit(1); }
  inserted += batch.length;
  process.stdout.write(`\r  Inserted ${inserted}/${dbRows.length}...`);
}
console.log(`\n✓ Import complet: ${inserted} moviments de startups`);
