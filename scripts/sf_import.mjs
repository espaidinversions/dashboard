/**
 * Search Funds import — reads:
 *   - "Logs"   -> capital_calls rows where vcpe = 'SF'
 *   - "Master" -> searchers master data (columns C:W)
 *
 * Usage:
 *   node scripts/sf_import.mjs "260416_Seguiment_SearchFunds.xlsx"
 *   node scripts/sf_import.mjs "260416_Seguiment_SearchFunds.xlsx" --dry-run
 *
 * Strategy:
 *   1. DELETE all capital_calls for vehicles with fund_meta.vehicle_tipus = 'SF', then INSERT parsed log rows
 *      where the resolved entity is kind='vehicle'. Company rows are skipped
 *      (covered by startups_import.mjs / cc_import.mjs).
 *   2. UPSERT searchers master rows by normalized `nom`, preserving non-master
 *      fields such as NIF or valuation fields already stored in the DB.
 *
 * Sheet: "Logs"
 * Columns: 0=Startup, 1=Tipus, 2=#, 3=Data, 4=Import, 5=Divisa, 6=FXrate,
 *          7=Comentaris, 8=Mes, 9=Any, 10=stat, 11=FY, 12=Taula, 13=VC/PE, 14=Afecte
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
const EXCLUDED_SEARCH_FUNDS = new Set(["castelnau capital"]);
const ENTITY_ALIASES = new Map([
  ["finanzarel cabrera", "finanzarel turtle"],
  ["finanzarel espai", "finanzarel turtle"],
]);

// ── SF phase allocation — source: 260416_Seguiment_SearchFunds.xlsx, Snapshot v2 ──
// Normalized fons name → phase config
// "adquisicio": all transactions are post-acquisition (SF Equity Gap deals)
// "search-acq": split by acqDate (search ticket before, equity on/after)
// Fons NOT listed here: classified by masterSearcherMatches() vs "Participada (Altres)"
const SF_FONS_ALLOCATION = new Map([
  ["road capital",                           { phase: "adquisicio" }],
  ["cw group",                               { phase: "adquisicio" }],
  ["lexana",                                 { phase: "adquisicio" }],
  ["project north",                          { phase: "adquisicio" }],
  ["salomonte investor pooling b v hotek",   { phase: "adquisicio" }],
  ["asf pharma alfavet seqos aurica spv",    { phase: "adquisicio" }],
  ["anval capital",                          { phase: "adquisicio" }],
  ["greenfarm omega project",                { phase: "adquisicio" }],
  ["itaca fire coinvest",                    { phase: "adquisicio" }],
  ["pleamar partners",                       { phase: "search-acq", acqDate: "2024-06-25" }],
  ["terra firma capital",                    { phase: "search-acq", acqDate: "2025-07-17" }],
]);

const SF_EST_CERCA      = "Search Fund - Cerca";
const SF_EST_ADQUISICIO = "Search Fund - Participada";

// Overrides for Logs fons names that differ significantly from Master nom
// (prefix matching handles most cases; only truly different names need explicit entries)
const LOGS_TO_MASTER_NORM_OVERRIDES = new Map([
  ["fs sav",         "fortius fs"],
  ["janus capital",  "janus mittelstandnachfolge"],
  ["quo investments","quo inversion"],
  ["wildlynx capital","wild lynx capital"],
]);

// Returns true if a Logs normalized fons name matches any Master searcher norm.
// Uses prefix matching to handle short Master names ("ab1") vs full Logs names ("ab1 capital")
// and Master names with legal suffixes ("aeqor partners") vs stripped Logs names ("aeqor").
function masterSearcherMatches(normalizedFons, masterSearcherNorms) {
  const needle = LOGS_TO_MASTER_NORM_OVERRIDES.get(normalizedFons) ?? normalizedFons;
  if (masterSearcherNorms.has(needle)) return true;
  for (const masterNorm of masterSearcherNorms) {
    if (needle.startsWith(masterNorm) || masterNorm.startsWith(needle)) return true;
  }
  return false;
}

function inferSFEst(normalizedFons, transactionDate, masterSearcherNorms) {
  // Explicit SF acquisitions (Equity Gap + Search→Acq)
  const alloc = SF_FONS_ALLOCATION.get(normalizedFons);
  if (alloc) {
    if (alloc.phase === "adquisicio") return SF_EST_ADQUISICIO;
    if (alloc.phase === "search-acq") {
      return transactionDate >= alloc.acqDate ? SF_EST_ADQUISICIO : SF_EST_CERCA;
    }
  }
  // Known SF searchers (matched against Master sheet, with prefix flexibility)
  if (masterSearcherMatches(normalizedFons, masterSearcherNorms)) return SF_EST_CERCA;
  // Everything else in the Logs = direct investment (not SF)
  return "Participada (Altres)";
}

// ── Category mapping ──────────────────────────────────────────────────────────
const CAT_MAP = {
  "Aportació capital":                                              "Capital Call",
  "Aportació Capital":                                              "Capital Call",
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
  "Devolució Préstec + interessos":                                 "Retorn Capital",
  "Devolució préstec":                                              "Retorn Capital",
  "Devolució Préstec":                                              "Retorn Capital",
  "Devolució Capital":                                              "Retorn Capital",
  "Devolució Venture Debt":                                         "Retorn Capital",
  "Devolució":                                                      "Retorn Capital",
  "Retorn":                                                         "Retorn Capital",
  "Desinversió":                                                    "Retorn Capital",
  "Desinversió ":                                                   "Retorn Capital",
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

function cleanText(value) {
  const text = String(value ?? "").replace(/\r\n/g, "\n").trim();
  return text || null;
}

function toIntOrNull(value) {
  return Number.isFinite(Number(value)) ? Number(value) : null;
}

function toNumberOrNull(value) {
  if (value == null || String(value).trim() === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function normalizeGeo(value) {
  const raw = String(value ?? "").trim().toUpperCase();
  const map = {
    ESP: "ES",
    ES: "ES",
    UK: "EN",
    EN: "EN",
    ITA: "IT",
    IT: "IT",
    DEU: "DE",
    DE: "DE",
    FRA: "FR",
    FR: "FR",
    POR: "PT",
    PT: "PT",
    NED: "NL",
    NL: "NL",
    USA: "US",
    US: "US",
    CHE: "CH",
    CH: "CH",
    SWE: "SE",
    SE: "SE",
    MEX: "MX",
    MX: "MX",
    POL: "PL",
    PL: "PL",
    TUR: "TR",
    TR: "TR",
  };
  return map[raw] ?? (raw || null);
}

function normalizeEntryForm(value) {
  const raw = String(value ?? "").trim().toLowerCase();
  if (!raw) return null;
  if (raw === "search capital") return "Search Capital";
  if (raw === "equity gap") return "Equity Gap";
  return String(value).trim();
}

function normalizeName(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[().,/-]/g, " ")
    .replace(/\b(s\.?l\.?|srl|ltd|limited)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ── Parse Excel ───────────────────────────────────────────────────────────────
function parseExcel(filePath) {
  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets["Logs"];
  if (!ws) throw new Error('Sheet "Logs" not found');

  const raw = XLSX.utils.sheet_to_json(ws, { defval: "", header: 1 });
  // Header at row 0; data from row 1

  const rows = [];
  const skipped = { noCat: new Set(), noDate: 0 };
  let lastFons = "";

  for (let i = 1; i < raw.length; i++) {
    const r = raw[i];

    const fons = String(r[0] ?? "").trim();
    if (fons) lastFons = fons;
    if (!lastFons) continue;
    if (EXCLUDED_SEARCH_FUNDS.has(lastFons.toLowerCase())) continue;

    const tipusRaw = String(r[1] ?? "").trim();
    if (!tipusRaw) continue;

    const cat = CAT_MAP[tipusRaw];
    if (!cat) { skipped.noCat.add(tipusRaw); continue; }

    const dateSerial = r[3];
    if (!dateSerial || typeof dateSerial !== "number") { skipped.noDate++; continue; }
    const data = excelDateToISO(dateSerial);
    if (!data) { skipped.noDate++; continue; }

    const eur    = Number(r[4]) || 0;
    const divisa = String(r[5] || "EUR").trim();
    const mes    = Number(r[8]) || Number(data.slice(5, 7));
    const any    = Number(r[9]) || Number(data.slice(0, 4));
    const fy     = String(r[11] || `FY ${any}`).trim();

    rows.push({ fons: lastFons, tipus: tipusRaw, cat, data, eur, divisa, mes, any, fy });
  }

  if (skipped.noCat.size) console.log("⚠ Skipped unknown categories:", [...skipped.noCat].sort().join(", "));
  if (skipped.noDate)     console.log(`⚠ Skipped ${skipped.noDate} rows with no/invalid date`);

  return rows;
}

function parseMasterSheet(filePath) {
  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets["Master"];
  if (!ws) throw new Error('Sheet "Master" not found');

  const raw = XLSX.utils.sheet_to_json(ws, { defval: null, header: 1 });
  const rowsByName = new Map();

  for (let i = 3; i < raw.length; i++) {
    const r = raw[i] ?? [];
    const nom = cleanText(r[2]);
    if (!nom || EXCLUDED_SEARCH_FUNDS.has(nom.toLowerCase())) continue;

    const databaseIntroDate = typeof r[22] === "number" ? excelDateToISO(r[22]) : cleanText(r[22]);
    rowsByName.set(normalizeName(nom), {
      nom,
      tipus: cleanText(r[3]),
      modalitat: cleanText(r[4]),
      geo: normalizeGeo(r[5]),
      status_screening_code: toIntOrNull(r[6]),
      status_screening: cleanText(r[7]),
      status_cerca_code: toIntOrNull(r[8]),
      status_cerca: cleanText(r[9]),
      status_adquisicio_code: toIntOrNull(r[10]),
      status_adquisicio: cleanText(r[11]),
      form_entrada: normalizeEntryForm(r[12]),
      intro_per: cleanText(r[13]),
      companyia_adquirida: cleanText(r[14]),
      searcher1: cleanText(r[15]),
      searcher2: cleanText(r[16]),
      escola1: cleanText(r[17]),
      escola2: cleanText(r[18]),
      ticket: toNumberOrNull(r[19]),
      web: cleanText(r[20]),
      comentaris: cleanText(r[21]),
      data_inici: databaseIntroDate,
      database_intro_date: databaseIntroDate,
      is_mock: false,
    });
  }

  return [...rowsByName.values()];
}

// ── Build entity maps ─────────────────────────────────────────────────────────
async function buildEntityMaps() {
  const { data, error } = await sb
    .from("private_entities")
    .select("id, canonical_name, kind");
  if (error) throw new Error("Failed to load private_entities: " + error.message);

  const vehicles = new Map();
  const companies = new Map();
  for (const e of data) {
    const key = e.canonical_name.trim().toLowerCase();
    if (e.kind === "vehicle") vehicles.set(key, e.id);
    else companies.set(key, e.id);
  }
  return { vehicles, companies };
}

async function loadExistingSearchers() {
  const { data, error } = await sb
    .from("searchers")
    .select("id, nom");
  if (error) throw new Error("Failed to load searchers: " + error.message);
  return data ?? [];
}

function resolveEntity(fons, vehicles, companies) {
  const rawNeedle = fons.trim().toLowerCase();
  const needle = ENTITY_ALIASES.get(rawNeedle) ?? rawNeedle;

  // Exact vehicle match
  if (vehicles.has(needle)) return { id: vehicles.get(needle), kind: "vehicle" };

  // Partial vehicle match
  for (const [dbName, id] of vehicles) {
    if (dbName.startsWith(needle) || needle.startsWith(dbName.split(" (")[0].toLowerCase())) {
      return { id, kind: "vehicle" };
    }
  }

  // Exact company match
  if (companies.has(needle)) return { id: companies.get(needle), kind: "company" };

  // Partial company match
  for (const [dbName, id] of companies) {
    if (dbName.startsWith(needle) || needle.startsWith(dbName.split(" (")[0].toLowerCase())) {
      return { id, kind: "company" };
    }
  }

  return { id: null, kind: null };
}

// ── Main ──────────────────────────────────────────────────────────────────────
const [,, filePath, flag] = process.argv;
if (!filePath) {
  console.log('Ús: node scripts/sf_import.mjs "260416_Seguiment_SearchFunds.xlsx" [--dry-run]');
  process.exit(1);
}

const absPath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
if (!fs.existsSync(absPath)) { console.error("Fitxer no trobat:", absPath); process.exit(1); }

const dryRun = flag === "--dry-run";
if (dryRun) console.log("🔍 DRY RUN — no changes will be written\n");

const rows = parseExcel(absPath);
console.log(`✓ Parsed ${rows.length} rows from "Logs"`);
const masterRows = parseMasterSheet(absPath);
console.log(`✓ Parsed ${masterRows.length} rows from "Master"`);

const masterSearcherNorms = new Set(masterRows.map(r => normalizeName(r.nom)).filter(Boolean));

console.log("Loading entities from DB...");
const { vehicles, companies } = await buildEntityMaps();

const sfRows = [];
const skippedCompanies = new Set();
const unresolved = new Set();

for (const r of rows) {
  const { id, kind } = resolveEntity(r.fons, vehicles, companies);

  if (kind === "vehicle") {
    const est = inferSFEst(normalizeName(r.fons), r.data, masterSearcherNorms);
    if (est === "Participada (Altres)") {
      // Non-SF direct investments in the Logs are managed by other import sources (cc_import / UI).
      // Importing them here would create duplicates alongside existing vcpe='PC' rows.
      skippedCompanies.add(r.fons);
    } else {
      sfRows.push({
        vehicle_id: id,
        fons: r.fons,
        tipus: r.tipus,
        est,
        cat: r.cat,
        eur: r.eur,
        divisa: r.divisa,
        mes: r.mes,
        year: r.any,
        fy: r.fy,
        data: r.data,
      });
    }
  } else if (kind === "company") {
    skippedCompanies.add(r.fons);
  } else {
    unresolved.add(r.fons);
  }
}

console.log(`  SF vehicle rows: ${sfRows.length}`);
console.log(`  Skipped (non-SF / companies): ${skippedCompanies.size} entities`);
if (unresolved.size) console.log(`  ⚠ Unresolved: ${[...unresolved].join(", ")}`);

if (dryRun) {
  // Check for duplicate rows in parsed data
  const seen = new Map();
  const dupes = [];
  for (const r of sfRows) {
    const key = `${r.vehicle_id}|${r.data}|${r.eur}|${r.cat}`;
    if (seen.has(key)) dupes.push(r);
    else seen.set(key, r);
  }
  if (dupes.length) {
    console.log(`\n⚠ ${dupes.length} duplicate rows detected (same vehicle+date+eur+cat):`);
    dupes.forEach(r => console.log(`  ${r.fons}  ${r.data}  ${r.eur}  ${r.cat}`));
  } else {
    console.log("\n✓ No duplicate rows in parsed data");
  }

  // Show all unique fons → est assignments grouped by est value
  const byEst = new Map();
  for (const r of sfRows) {
    if (!byEst.has(r.est)) byEst.set(r.est, new Set());
    byEst.get(r.est).add(r.fons);
  }
  console.log("\n── Fons → Estratègia assignments ──");
  for (const [est, fonsSet] of [...byEst.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    console.log(`\n  ${est} (${fonsSet.size} fons):`);
    [...fonsSet].sort().forEach(f => console.log(`    • ${f}`));
  }
  console.log(`\nTotal: ${sfRows.length} rows across ${new Set(sfRows.map(r => r.fons)).size} unique fons`);

  process.exit(0);
}

// DELETE existing SF rows and stale PC rows for the same vehicles
// (PC rows may have been entered via UI before the SF import existed)
const sfVehicleIds = [...new Set(sfRows.map(r => r.vehicle_id))];
console.log("\nDeleting existing SF capital calls...");
const { data: sfVehiclesFromMeta } = await sb.from("fund_meta").select("vehicle_id").eq("vehicle_tipus", "SF");
const sfMetaIds = (sfVehiclesFromMeta ?? []).map((r) => r.vehicle_id);
if (sfMetaIds.length) {
  const { error: delErr } = await sb.from("capital_calls").delete().in("vehicle_id", sfMetaIds);
  if (delErr) { console.error("Delete SF failed:", delErr.message); process.exit(1); }
}
const { data: pcVehicles } = await sb.from("fund_meta").select("vehicle_id").eq("vehicle_tipus", "PC");
const pcIds = (pcVehicles ?? []).map((r) => r.vehicle_id);
const pcIdsForSf = pcIds.filter(id => sfVehicleIds.includes(id));
if (pcIdsForSf.length) {
  const { error: delPcErr } = await sb.from("capital_calls").delete().in("vehicle_id", pcIdsForSf);
  if (delPcErr) { console.error("Delete PC failed:", delPcErr.message); process.exit(1); }
}
console.log("✓ Deleted");

// Ensure fund_meta has vehicle_tipus = 'SF' for each SF vehicle
if (sfVehicleIds.length) {
  const sfMetaRows = sfVehicleIds.map(id => {
    const row = sfRows.find(r => r.vehicle_id === id);
    return { vehicle_id: id, vehicle_tipus: "SF" };
  });
  const { error: metaErr } = await sb.from("fund_meta").upsert(sfMetaRows, { onConflict: "vehicle_id" });
  if (metaErr) console.warn("⚠ Could not upsert vehicle_tipus to fund_meta:", metaErr.message);
  else console.log(`✓ Upserted vehicle_tipus=SF for ${sfMetaRows.length} vehicles into fund_meta`);
}

// INSERT in batches
const BATCH = 200;
let inserted = 0;
for (let i = 0; i < sfRows.length; i += BATCH) {
  const batch = sfRows.slice(i, i + BATCH);
  const { error } = await sb.from("capital_calls").insert(batch);
  if (error) { console.error(`Insert batch ${i}-${i + BATCH} failed:`, error.message); process.exit(1); }
  inserted += batch.length;
  process.stdout.write(`\r  Inserted ${inserted}/${sfRows.length}...`);
}
console.log(`\n✓ Import complet: ${inserted} moviments SF`);

console.log("\nSyncing searchers master rows...");
const existingSearchers = await loadExistingSearchers();
const existingByName = new Map(
  existingSearchers
    .map((row) => [normalizeName(row.nom), row])
    .filter(([key]) => key)
);

const toUpdate = [];
const toInsert = [];
for (const row of masterRows) {
  const existing = existingByName.get(normalizeName(row.nom));
  if (existing?.id) toUpdate.push({ id: existing.id, row });
  else toInsert.push(row);
}

let updated = 0;
for (const item of toUpdate) {
  const { error } = await sb
    .from("searchers")
    .update(item.row)
    .eq("id", item.id);
  if (error) {
    console.error(`Update failed for ${item.row.nom}:`, error.message);
    process.exit(1);
  }
  updated += 1;
  process.stdout.write(`\r  Updated ${updated}/${toUpdate.length}...`);
}
if (toUpdate.length) process.stdout.write("\n");

let insertedSearchers = 0;
for (let i = 0; i < toInsert.length; i += BATCH) {
  const batch = toInsert.slice(i, i + BATCH);
  const { error } = await sb.from("searchers").insert(batch);
  if (error) {
    console.error(`Insert searchers batch ${i}-${i + batch.length} failed:`, error.message);
    process.exit(1);
  }
  insertedSearchers += batch.length;
  process.stdout.write(`\r  Inserted ${insertedSearchers}/${toInsert.length} new searchers...`);
}
if (toInsert.length) process.stdout.write("\n");

// Delete stale entries: rows in DB that are no longer in the Master sheet
const masterNormSet = new Set(masterRows.map(r => normalizeName(r.nom)).filter(Boolean));
const toDelete = existingSearchers.filter(row => !masterNormSet.has(normalizeName(row.nom)));
let deleted = 0;
for (const row of toDelete) {
  const { error } = await sb.from("searchers").delete().eq("id", row.id);
  if (error) {
    console.error(`Delete failed for ${row.nom}:`, error.message);
    process.exit(1);
  }
  deleted += 1;
}
if (deleted) console.log(`  Deleted ${deleted} stale searchers: ${toDelete.map(r => r.nom).join(", ")}`);

console.log(`✓ Searchers synced: ${updated} updated, ${insertedSearchers} inserted, ${deleted} deleted`);
