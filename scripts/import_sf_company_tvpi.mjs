/**
 * Import Search Fund company TVPI values from the Search Funds workbook.
 *
 * Source workbook:
 *   - Master: maps search fund -> acquired company / entry form
 *   - Snapshot 25Q4: provides status + TVPI for each search fund
 *
 * We update portfolio_companies rows by matching the search-fund vehicle_id
 * onto company.entity_id. This works because acquired-via-SF companies share
 * the canonical entity id with the corresponding SF vehicle in this DB model.
 *
 * Usage:
 *   node scripts/import_sf_company_tvpi.mjs "260416_Seguiment_SearchFunds.xlsx"
 *   node scripts/import_sf_company_tvpi.mjs "260416_Seguiment_SearchFunds.xlsx" --dry-run
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
      .filter((line) => line.includes("=") && !line.startsWith("#"))
      .map((line) => {
        const idx = line.indexOf("=");
        return [line.slice(0, idx).trim(), line.slice(idx + 1).trim()];
      }),
  );
}

// Explicit workbook-name → canonical-name overrides for cases where
// normalization alone can't reconcile the names.
const WORKBOOK_ALIASES = new Map(
  Object.entries({
    // Add entries as: "normalized workbook name": "normalized canonical name"
    // e.g. "december transmission": "december transmission capital",
  }),
);

function normalizeName(value) {
  return String(value ?? "")
    .replace(/([a-z])([A-Z])/g, "$1 $2") // split CamelCase: "TerraFirma" → "Terra Firma"
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[().,/-]/g, " ")
    .replace(/\b(s\.?l\.?|srl|ltd|limited|partners?|capital|fund|holdings?)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function canonicalEntryForm(value) {
  const normalized = normalizeName(value);
  if (normalized === "equity gap") return "Equity Gap";
  if (normalized === "search") return "Search Capital";
  if (normalized === "search capital") return "Search Capital";
  return String(value ?? "").trim() || null;
}

function isSearchFundShell(company) {
  if (company?.tipus !== "SF") return false;
  const ticket = Number(company?.ticket ?? 0);
  return Number.isFinite(ticket) && ticket > 0 && ticket < 100000;
}

function parseMasterSheet(wb) {
  const ws = wb.Sheets["Master"];
  if (!ws) throw new Error('Sheet "Master" not found');
  const raw = XLSX.utils.sheet_to_json(ws, { defval: "", header: 1 });
  const rows = [];
  for (let i = 3; i < raw.length; i++) {
    const row = raw[i];
    const searchFund = String(row?.[2] ?? "").trim();
    if (!searchFund) continue;
    rows.push({
      searchFund,
      entryForm: canonicalEntryForm(row?.[12]),
      acquiredCompany: String(row?.[14] ?? "").trim() || null,
    });
  }
  return rows;
}

function parseSnapshotSheet(wb) {
  const ws = wb.Sheets["Snapshot 25Q4"];
  if (!ws) throw new Error('Sheet "Snapshot 25Q4" not found');
  const raw = XLSX.utils.sheet_to_json(ws, { defval: "", header: 1 });
  const rows = [];
  for (let i = 3; i < raw.length; i++) {
    const row = raw[i];
    const searchFund = String(row?.[2] ?? "").trim();
    const status = String(row?.[3] ?? "").trim();
    const tvpi = Number(row?.[25]);
    if (!searchFund || !status) continue;
    rows.push({
      searchFund,
      status,
      tvpi: Number.isFinite(tvpi) ? tvpi : null,
    });
  }
  return rows;
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

const [,, filePath, flag] = process.argv;
if (!filePath) {
  console.log('Ús: node scripts/import_sf_company_tvpi.mjs "260416_Seguiment_SearchFunds.xlsx" [--dry-run]');
  process.exit(1);
}

const absPath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
if (!fs.existsSync(absPath)) {
  console.error("Fitxer no trobat:", absPath);
  process.exit(1);
}

const dryRun = flag === "--dry-run";
if (dryRun) console.log("🔍 DRY RUN — no changes will be written\n");

const wb = await XLSX.readFile(absPath);
const masterRows = parseMasterSheet(wb);
const snapshotRows = parseSnapshotSheet(wb);

const masterBySearchFund = new Map(masterRows.map((row) => [normalizeName(row.searchFund), row]));

const [{ data: vehicles, error: vehiclesErr }, { data: companies, error: companiesErr }] = await Promise.all([
  sb.from("private_entities").select("id, canonical_name, source_name, workbook_name").eq("kind", "vehicle"),
  sb.from("portfolio_companies").select("id, entity_id, nom, tipus, origen, ticket, tvpi"),
]);

if (vehiclesErr) {
  console.error("Failed to load private_entities:", vehiclesErr.message);
  process.exit(1);
}
if (companiesErr) {
  console.error("Failed to load portfolio_companies:", companiesErr.message);
  process.exit(1);
}

const vehicleMap = new Map();
for (const vehicle of vehicles ?? []) {
  [vehicle.canonical_name, vehicle.source_name, vehicle.workbook_name].forEach((name) => {
    const key = normalizeName(name);
    if (key && !vehicleMap.has(key)) vehicleMap.set(key, vehicle.id);
  });
}

function resolveVehicleId(searchFund) {
  const needle = normalizeName(searchFund);
  // 1. Exact normalized match
  if (vehicleMap.has(needle)) return vehicleMap.get(needle);
  // 2. Explicit alias override
  const aliased = WORKBOOK_ALIASES.get(needle);
  if (aliased && vehicleMap.has(aliased)) return vehicleMap.get(aliased);
  // 3. Prefix match (handles abbreviated names)
  for (const [name, id] of vehicleMap) {
    if (name.startsWith(needle) || needle.startsWith(name)) return id;
  }
  // 4. Token overlap: all needle tokens must appear in the vehicle name
  const needleTokens = needle.split(" ").filter(Boolean);
  if (needleTokens.length >= 2) {
    for (const [name, id] of vehicleMap) {
      const nameTokens = new Set(name.split(" ").filter(Boolean));
      if (needleTokens.every((t) => nameTokens.has(t))) return id;
    }
  }
  return null;
}

const actualCompanies = (companies ?? []).filter((company) => !isSearchFundShell(company));
const companyByEntityId = new Map(actualCompanies.map((company) => [company.entity_id, company]));

const updates = [];
const skipped = { noVehicle: [], noCompany: [], noTvpi: [], nonMaterialized: [] };

for (const snapshot of snapshotRows) {
  if (!["Operating", "Sold"].includes(snapshot.status)) {
    skipped.nonMaterialized.push(snapshot.searchFund);
    continue;
  }
  if (!Number.isFinite(snapshot.tvpi)) {
    skipped.noTvpi.push(snapshot.searchFund);
    continue;
  }
  const vehicleId = resolveVehicleId(snapshot.searchFund);
  if (!vehicleId) {
    skipped.noVehicle.push(snapshot.searchFund);
    continue;
  }
  const company = companyByEntityId.get(vehicleId);
  if (!company) {
    skipped.noCompany.push(snapshot.searchFund);
    continue;
  }
  const master = masterBySearchFund.get(normalizeName(snapshot.searchFund)) ?? null;
  updates.push({
    id: company.id,
    entity_id: company.entity_id,
    tvpi: snapshot.tvpi,
    tipus: "SF",
    origen: master?.entryForm ?? company.origen ?? null,
  });
}

console.log(`✓ Snapshot rows parsed: ${snapshotRows.length}`);
console.log(`✓ Company TVPI updates: ${updates.length}`);
if (skipped.nonMaterialized.length) console.log(`  Skipped (non-Operating/Sold): ${skipped.nonMaterialized.length}`);
if (skipped.noTvpi.length) console.log(`  Skipped (no TVPI): ${skipped.noTvpi.join(", ")}`);
if (skipped.noVehicle.length) {
  const unique = [...new Set(skipped.noVehicle)];
  console.log(`⚠ No vehicle match (${unique.length}): add these to private_entities or WORKBOOK_ALIASES`);
  unique.forEach((name) => console.log(`    "${name}" → normalized: "${normalizeName(name)}"`));
}
if (skipped.noCompany.length) {
  const unique = [...new Set(skipped.noCompany)];
  console.log(`⚠ Vehicle found but no portfolio_companies row (${unique.length}): add portfolio_companies rows`);
  unique.forEach((name) => console.log(`    "${name}"`));
}

if (dryRun) {
  console.log("\nSample updates:");
  updates.slice(0, 10).forEach((row) => console.log(" ", JSON.stringify(row)));
  process.exit(0);
}

for (const update of updates) {
  const { error } = await sb
    .from("portfolio_companies")
    .update({ tvpi: update.tvpi, tipus: update.tipus, origen: update.origen })
    .eq("id", update.id);
  if (error) {
    console.error(`Update failed for company ${update.id}:`, error.message);
    process.exit(1);
  }
}

console.log(`✓ Updated ${updates.length} portfolio_companies rows`);
