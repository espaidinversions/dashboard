/**
 * Capital Calls import — reads "Capital Calls log" sheet and syncs to Supabase.
 *
 * Usage:
 *   node scripts/cc_import.mjs "2022.06.16 Capital Calls.xlsx"
 *   node scripts/cc_import.mjs "2022.06.16 Capital Calls.xlsx" --dry-run
 *
 * Strategy: DELETE all capital_calls for vehicles with fund_meta.vehicle_tipus IN ('PE','VC','RE'),
 * then INSERT the parsed rows. SF rows (added via UI) are left untouched.
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

import { createClient } from "@supabase/supabase-js";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";

import XLSX from "./lib/xlsx_compat.mjs";

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
const CAT_MAP = {
  // Capital calls
  "Aportació":                          "Capital Call",
  "aportació":                          "Capital Call",
  "Aportació no capital":               "Capital Call",
  "Brokerage Fees":                     "Capital Call",
  "Close Interest":                     "Capital Call",
  "Closing Notional Interest":          "Capital Call",
  "Compensació":                        "Capital Call",
  "Compensació tancament":              "Capital Call",
  "Equalisation Premium":               "Capital Call",
  "Equalisation Payment":               "Capital Call",
  "Late Closing Interest":              "Capital Call",
  "Late Closing Interest (payable-receivable)": "Capital Call",
  "Origination Fee":                    "Capital Call",
  "Prima":                              "Capital Call",
  "Prima Act.":                         "Capital Call",
  "Prima Ecualización":                 "Capital Call",
  "Subscription Fee":                   "Capital Call",
  "Subscription Premium":               "Capital Call",
  "Comissió de subscripció":            "Capital Call",
  "Distribución EQ Fee":                "Capital Call",
  "Compensation Indmen.":               "Capital Call",
  "Interessos":                         "Capital Call",
  // Commitments
  "Compromís":                          "Compromís",
  // Distributions
  "Distribució":                        "Distribució",
  "Distribució PE":                     "Distribució",
  "Distribució temporal":               "Distribució",
  "Distribució no dinerària":           "Distribució",
  "Tax distribution":                   "Distribució",
  "Dividends":                          "Distribució",
  "Dividendos":                         "Distribució",
  // Capital returns
  "Devol. Capital":                     "Retorn Capital",
  "Devolució":                          "Retorn Capital",
  "Devolució retinguda":                "Retorn Capital",
  "Devolució capital temporal":         "Retorn Capital",
  "Desinversió":                        "Retorn Capital",
  "Transmissió/Conversió":              "Retorn Capital",
};

const VCPE_SET = new Set(["PE", "VC", "RE"]);
const VEHICLE_OVERRIDES = {
  "meridia real estate fund v ficc": { vcpe: "RE", est: "Fons Primari" },
  "tectum iii": { vcpe: "RE", est: "Fons Primari" },
};
const EXCLUDED_VEHICLES = new Set(["castelnau capital"]);

function excelDateToISO(serial) {
  const d = XLSX.SSF.parse_date_code(serial);
  if (!d || d.y < 2010) return null;
  return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
}

async function parseFundMetaExcel(filePath) {
  const wb = await XLSX.readFile(filePath);
  const ws = wb.Sheets["Valoracions"];
  if (!ws) throw new Error('Sheet "Valoracions" not found');

  const raw = XLSX.utils.sheet_to_json(ws, { defval: "", header: 1 });
  const NAME_COL = 3;
  const TVPI_COL = 15; // "Múltiplo Total (MOIC)" in the first block
  const firstBlockRows = [];

  for (let i = 8; i < raw.length; i++) {
    const row = raw[i];
    const fons = String(row?.[NAME_COL] ?? "").trim();
    const tvpi = Number(row?.[TVPI_COL]);
    if (!fons || !Number.isFinite(tvpi) || tvpi <= 0) continue;
    if (EXCLUDED_VEHICLES.has(fons.toLowerCase())) continue;
    // Skip aggregate rows such as "Fons de Fons"
    if (/^(fons de fons|grand total|total|\d{4})$/i.test(fons)) continue;
    firstBlockRows.push({ fons, tvpi });
  }

  const deduped = new Map();
  firstBlockRows.forEach((row) => {
    if (!deduped.has(row.fons.toLowerCase())) deduped.set(row.fons.toLowerCase(), row);
  });
  return [...deduped.values()];
}

// ── Parse Excel ───────────────────────────────────────────────────────────────
async function parseExcel(filePath) {
  const wb = await XLSX.readFile(filePath);
  const ws = wb.Sheets["Capital Calls log"];
  if (!ws) throw new Error('Sheet "Capital Calls log" not found');

  const raw = XLSX.utils.sheet_to_json(ws, { defval: "", header: 1 });
  // Header is at row index 7; data starts at 8
  const HEADER_ROW = 7;

  const rows = [];
  const skipped = { noCat: new Set(), noDate: 0, noVcpe: 0 };
  let lastFons = "";

  for (let i = HEADER_ROW + 1; i < raw.length; i++) {
    const r = raw[i];

    const fons = String(r[2] ?? "").trim();
    if (fons) lastFons = fons;
    if (EXCLUDED_VEHICLES.has(lastFons.trim().toLowerCase())) continue;

    const rawVcpe = String(r[13] ?? "").trim();
    const override = VEHICLE_OVERRIDES[lastFons.trim().toLowerCase()] ?? null;
    const vcpe = override?.vcpe ?? rawVcpe;
    if (!VCPE_SET.has(vcpe)) { skipped.noVcpe++; continue; }

    const tipusRaw = r[3];
    if (typeof tipusRaw !== "string") continue;
    const tipus = tipusRaw.trim();

    const cat = CAT_MAP[tipus];
    if (!cat) { skipped.noCat.add(tipus); continue; }

    const dateSerial = r[5];
    if (!dateSerial || typeof dateSerial !== "number") { skipped.noDate++; continue; }
    const data = excelDateToISO(dateSerial);
    if (!data) { skipped.noDate++; continue; }

    const importLocal = Number(r[6]) || 0;
    const importEur   = Number(r[15]);                          // "Import en EUR" column
    const divisa      = String(r[7] || "EUR").trim();
    const eur         = divisa === "EUR" ? importLocal : (importEur || importLocal);
    const est         = override?.est ?? (String(r[16] ?? "").trim() || null);

    const mes = Number(r[10]) || Number(data.slice(5, 7));
    const any = Number(r[11]) || Number(data.slice(0, 4));
    const fy  = String(r[12] || `FY ${any}`).trim();

    rows.push({
      fons:   lastFons,
      cat,
      data,
      eur,
      divisa,
      vcpe,
      est,
      tipus,
      mes,
      any,
      fy,
    });
  }

  if (skipped.noCat.size) console.log("⚠ Skipped unknown categories:", [...skipped.noCat].sort().join(", "));
  if (skipped.noDate)    console.log(`⚠ Skipped ${skipped.noDate} rows with no/invalid date`);

  return rows;
}

// ── Resolve vehicle_id from fund name via private_entities ────────────────────
async function buildFundNifMap() {
  const { data, error } = await sb
    .from("private_entities")
    .select("id, canonical_name, kind")
    .eq("kind", "vehicle");
  if (error) throw new Error("Failed to load private_entities: " + error.message);

  const map = new Map(); // canonical_name.toLowerCase() → id
  for (const e of data) {
    map.set(e.canonical_name.trim().toLowerCase(), e.id);
  }
  return map;
}

function resolveVehicleId(fons, fundNifMap) {
  const needle = fons.trim().toLowerCase();
  if (fundNifMap.has(needle)) return fundNifMap.get(needle);
  // Partial match: DB name starts with Excel name (e.g. "Altamar X" → "Altamar X (...)")
  for (const [dbName, id] of fundNifMap) {
    if (dbName.startsWith(needle) || needle.startsWith(dbName.split(" (")[0].toLowerCase())) {
      return id;
    }
  }
  return `MOCKNIF:VEHICLE:${fons.toUpperCase().replace(/\s+/g, "_")}`;
}

// ── Main ──────────────────────────────────────────────────────────────────────
const [,, filePath, flag] = process.argv;
if (!filePath) {
  console.log('Ús: node scripts/cc_import.mjs "2022.06.16 Capital Calls.xlsx" [--dry-run]');
  process.exit(1);
}

const absPath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
if (!fs.existsSync(absPath)) { console.error("Fitxer no trobat:", absPath); process.exit(1); }

const dryRun = flag === "--dry-run";
if (dryRun) console.log("🔍 DRY RUN — no changes will be written\n");

const rows = await parseExcel(absPath);
console.log(`✓ Parsed ${rows.length} rows from Excel`);
const fundMetaRows = await parseFundMetaExcel(absPath);
console.log(`✓ Parsed ${fundMetaRows.length} TVPI rows from Valoracions`);

// Summary by fund
const fundCounts = new Map();
rows.forEach(r => fundCounts.set(r.fons, (fundCounts.get(r.fons) ?? 0) + 1));
console.log(`  Funds: ${fundCounts.size}`);

// Resolve vehicle IDs
console.log("Loading vehicle NIFs from DB...");
const fundNifMap = await buildFundNifMap();

let mockCount = 0;
const dbRows = rows.map(r => {
  const vehicle_id = resolveVehicleId(r.fons, fundNifMap);
  if (vehicle_id.startsWith("MOCKNIF:")) mockCount++;
  return { vehicle_id, fons: r.fons, tipus: r.tipus, est: r.est, cat: r.cat, eur: r.eur, divisa: r.divisa, mes: r.mes, year: r.any, fy: r.fy, data: r.data, _vehicleTipus: r.vcpe };
});
const fundMetaDbRows = fundMetaRows.map((row) => ({
  vehicle_id: resolveVehicleId(row.fons, fundNifMap),
  fons: row.fons,
  tvpi: row.tvpi,
}));

if (mockCount) console.log(`⚠ ${mockCount} rows will use mock vehicle_id (fund name not found in DB)`);

// Show mock funds
const mockFunds = [...new Set(dbRows.filter(r => r.vehicle_id.startsWith("MOCKNIF:")).map(r => r.fons))];
if (mockFunds.length) console.log("  Mock funds:", mockFunds.join(", "));

if (dryRun) {
  console.log("\nSample rows (last 5):");
  dbRows.slice(-5).forEach(r => console.log(" ", JSON.stringify(r)));
  console.log("\nSample TVPI rows (last 5):");
  fundMetaDbRows.slice(-5).forEach(r => console.log(" ", JSON.stringify(r)));
  process.exit(0);
}

// Upsert any missing vehicle entities (mock) so FK constraint doesn't fail
const mockRows = [...dbRows, ...fundMetaDbRows].filter(r => r.vehicle_id.startsWith("MOCKNIF:"));
if (mockRows.length) {
  const mockEntities = [...new Map(mockRows.map(r => [r.vehicle_id, { id: r.vehicle_id, kind: "vehicle", canonical_name: r.fons, match_type: "mock", country: null }])).values()];
  const { error: upsertErr } = await sb.from("private_entities").upsert(mockEntities, { onConflict: "id" });
  if (upsertErr) console.warn("⚠ Could not upsert mock entities:", upsertErr.message);
  else console.log(`✓ Upserted ${mockEntities.length} mock vehicle entities`);
}

// DELETE PE/VC/RE rows (via fund_meta.vehicle_tipus)
console.log("\nDeleting existing PE/VC/RE capital calls...");
const { data: fundVehicles } = await sb
  .from("fund_meta")
  .select("vehicle_id")
  .in("vehicle_tipus", ["PE", "VC", "RE"]);
const fundIds = (fundVehicles ?? []).map((r) => r.vehicle_id);
if (fundIds.length) {
  const { error: delErr } = await sb.from("capital_calls").delete().in("vehicle_id", fundIds);
  if (delErr) { console.error("Delete failed:", delErr.message); process.exit(1); }
}
console.log("✓ Deleted");

// Ensure fund_meta has vehicle_tipus for each vehicle
const metaRows = [...new Map(dbRows.map(r => [r.vehicle_id, { vehicle_id: r.vehicle_id, vehicle_tipus: r._vehicleTipus }])).values()];
const { error: metaErr } = await sb.from("fund_meta").upsert(metaRows, { onConflict: "vehicle_id" });
if (metaErr) console.warn("⚠ Could not upsert vehicle_tipus to fund_meta:", metaErr.message);
else console.log(`✓ Upserted vehicle_tipus for ${metaRows.length} vehicles into fund_meta`);

// Strip internal _vehicleTipus field before insert
const ccRows = dbRows.map(({ _vehicleTipus, ...r }) => r);

// INSERT in batches of 200
const BATCH = 200;
let inserted = 0;
for (let i = 0; i < ccRows.length; i += BATCH) {
  const batch = ccRows.slice(i, i + BATCH);
  const { error } = await sb.from("capital_calls").insert(batch);
  if (error) { console.error(`Insert batch ${i}-${i+BATCH} failed:`, error.message); process.exit(1); }
  inserted += batch.length;
  process.stdout.write(`\r  Inserted ${inserted}/${ccRows.length}...`);
}
console.log(`\n✓ Import complet: ${inserted} moviments`);

// Upsert Fund Meta TVPI values parsed from Valoracions
if (fundMetaDbRows.length) {
  const { error: fmErr } = await sb.from("fund_meta").upsert(fundMetaDbRows, { onConflict: "vehicle_id" });
  if (fmErr) {
    console.error("Fund Meta upsert failed:", fmErr.message);
    process.exit(1);
  }
  console.log(`✓ Upserted ${fundMetaDbRows.length} TVPI rows into fund_meta`);
}
