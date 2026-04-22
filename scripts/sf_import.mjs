/**
 * Search Funds import — reads "Logs" sheet from the SF Excel and syncs vcpe=SF rows.
 *
 * Usage:
 *   node scripts/sf_import.mjs "260416_Seguiment_SearchFunds.xlsx"
 *   node scripts/sf_import.mjs "260416_Seguiment_SearchFunds.xlsx" --dry-run
 *
 * Strategy: DELETE all capital_calls WHERE vcpe = 'SF', then INSERT parsed rows
 * where the resolved entity is kind='vehicle'. Company rows are skipped (covered
 * by startups_import.mjs / cc_import.mjs).
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

function resolveEntity(fons, vehicles, companies) {
  const needle = fons.trim().toLowerCase();

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

console.log("Loading entities from DB...");
const { vehicles, companies } = await buildEntityMaps();

const sfRows = [];
const skippedCompanies = new Set();
const unresolved = new Set();

for (const r of rows) {
  const { id, kind } = resolveEntity(r.fons, vehicles, companies);

  if (kind === "vehicle") {
    sfRows.push({
      vehicle_id: id,
      fons: r.fons,
      tipus: r.tipus,
      vcpe: "SF",
      est: "SF",
      cat: r.cat,
      eur: r.eur,
      divisa: r.divisa,
      mes: r.mes,
      year: r.any,
      fy: r.fy,
      data: r.data,
    });
  } else if (kind === "company") {
    skippedCompanies.add(r.fons);
  } else {
    unresolved.add(r.fons);
  }
}

console.log(`  SF vehicle rows: ${sfRows.length}`);
console.log(`  Skipped (companies): ${skippedCompanies.size} entities`);
if (unresolved.size) console.log(`  ⚠ Unresolved: ${[...unresolved].join(", ")}`);

if (dryRun) {
  console.log("\nSample SF rows:");
  sfRows.slice(0, 5).forEach(r => console.log(" ", JSON.stringify(r)));
  process.exit(0);
}

// DELETE existing SF rows
console.log("\nDeleting existing SF capital calls...");
const { error: delErr } = await sb.from("capital_calls").delete().eq("vcpe", "SF");
if (delErr) { console.error("Delete failed:", delErr.message); process.exit(1); }
console.log("✓ Deleted");

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
