/**
 * Populate portfolio_companies from capital_calls (DB) + Summary_Q4 (SF Excel).
 *
 * For each is_mock=true company:
 *   - ticket:     sum of positive capital_calls (cat='Capital Call') from DB
 *   - data_compr: first investment date from DB
 *   - dpi_eur:    DPI × ticket  (DPI from Summary_Q4)
 *   - rvpi_eur:   0 for Sold, null for Operating (valuation unknown)
 *   - tvpi:       dpi_eur / ticket for Sold; null for Operating
 *   - tipus:      'SF' if entity is also an SF vehicle, else 'PC'
 *
 * Usage:
 *   node scripts/populate_participades.mjs "260416_Seguiment_SearchFunds.xlsx"
 *   node scripts/populate_participades.mjs "260416_Seguiment_SearchFunds.xlsx" --dry-run
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

function loadEnv(f) {
  if (!fs.existsSync(f)) return {};
  return Object.fromEntries(
    fs.readFileSync(f, "utf8").split("\n")
      .filter(l => l.includes("=") && !l.startsWith("#"))
      .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
  );
}

const env = loadEnv(envPath);
const sb = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function excelDateToISO(serial) {
  if (!serial || typeof serial !== "number") return null;
  const d = XLSX.SSF.parse_date_code(serial);
  if (!d || d.y < 2010) return null;
  return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
}

// ── Parse Summary_Q4 ──────────────────────────────────────────────────────────
function parseSummaryQ4(filePath) {
  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets["Summary_Q4"];
  if (!ws) throw new Error('Sheet "Summary_Q4" not found');
  const raw = XLSX.utils.sheet_to_json(ws, { defval: "", header: 1 });

  const map = {};
  let nextIsFirstRow = false;

  for (const r of raw) {
    if (r[1] === "Startup" && r[2] === "Tipus") {
      nextIsFirstRow = true;
      continue;
    }
    if (nextIsFirstRow && r[1]) {
      const name = String(r[1]).trim();
      map[name.toLowerCase()] = {
        name,
        status: String(r[7] || "").trim(),       // "Operating" | "Sold"
        irr:    typeof r[9]  === "number" ? r[9]  : null,
        dpi:    typeof r[10] === "number" ? r[10] : null,
      };
      nextIsFirstRow = false;
    }
  }
  return map;
}

// ── Fuzzy match company name to Summary_Q4 map ───────────────────────────────
function matchToSummary(nom, summaryMap) {
  const needle = nom.toLowerCase();
  if (summaryMap[needle]) return summaryMap[needle];
  for (const [key, val] of Object.entries(summaryMap)) {
    // Match if names share a significant prefix (first 10 chars)
    const prefix = Math.min(needle.length, key.length, 10);
    if (prefix >= 5 && needle.slice(0, prefix) === key.slice(0, prefix)) return val;
    // Match if either contains the other's first word
    const w1 = needle.split(/[\s,(]/)[0];
    const w2 = key.split(/[\s,(]/)[0];
    if (w1.length > 4 && (key.includes(w1) || needle.includes(w2))) return val;
  }
  return null;
}

// ── Main ──────────────────────────────────────────────────────────────────────
const [,, filePath, flag] = process.argv;
if (!filePath) {
  console.log('Ús: node scripts/populate_participades.mjs "260416_Seguiment_SearchFunds.xlsx" [--dry-run]');
  process.exit(1);
}

const absPath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
if (!fs.existsSync(absPath)) { console.error("Fitxer no trobat:", absPath); process.exit(1); }

const dryRun = flag === "--dry-run";
if (dryRun) console.log("🔍 DRY RUN — no changes will be written\n");

const summaryMap = parseSummaryQ4(absPath);
console.log(`✓ Parsed ${Object.keys(summaryMap).length} companies from Summary_Q4`);

// Load mock portfolio_companies
const { data: mockCompanies, error: e1 } = await sb
  .from("portfolio_companies")
  .select("*")
  .eq("is_mock", true);
if (e1) { console.error(e1.message); process.exit(1); }
console.log(`✓ Loaded ${mockCompanies.length} mock portfolio_companies`);

// Load capital_calls (PC + SF) for all entity_ids
const entityIds = mockCompanies.map(c => c.entity_id).filter(Boolean);
const { data: allCalls, error: e2 } = await sb
  .from("capital_calls")
  .select("vehicle_id, cat, eur, data, vcpe")
  .in("vehicle_id", entityIds)
  .in("vcpe", ["PC", "SF"]);
if (e2) { console.error(e2.message); process.exit(1); }

// Compute per-entity aggregates from capital_calls
const callsByEntity = {};
for (const c of allCalls) {
  if (!callsByEntity[c.vehicle_id]) callsByEntity[c.vehicle_id] = [];
  callsByEntity[c.vehicle_id].push(c);
}

// SF vehicle entity_ids (to tag as tipus='SF')
const { data: sfVehicles } = await sb
  .from("capital_calls")
  .select("vehicle_id")
  .eq("vcpe", "SF");
const sfVehicleIds = new Set((sfVehicles || []).map(r => r.vehicle_id));

// Build updates
const updates = [];
let matchedSummary = 0, noSummary = 0, noCalls = 0;

for (const company of mockCompanies) {
  const calls = callsByEntity[company.entity_id] || [];

  // Ticket: sum of positive Capital Call amounts
  const capitalCallRows = calls.filter(c => c.cat === "Capital Call" && c.eur > 0);
  const ticket = capitalCallRows.length > 0
    ? Math.round(capitalCallRows.reduce((s, c) => s + c.eur, 0))
    : null;

  // First investment date
  const sortedDates = capitalCallRows
    .map(c => c.data)
    .filter(Boolean)
    .sort();
  const dataCompr = sortedDates[0] ?? null;

  if (!ticket) noCalls++;

  // Match to Summary_Q4
  const sfData = matchToSummary(company.nom, summaryMap);
  let dpiEur = null, rvpiEur = null, tvpi = null, tipus = company.tipus;

  if (sfData) {
    matchedSummary++;
    const dpiMult = sfData.dpi ?? 0;
    dpiEur   = ticket ? Math.round(dpiMult * ticket) : null;
    rvpiEur  = sfData.status === "Sold" ? 0 : null;
    tvpi     = (sfData.status === "Sold" && ticket)
               ? Math.round(dpiMult * 100) / 100
               : null;
  } else {
    noSummary++;
  }

  // Override tipus for SF vehicles
  if (sfVehicleIds.has(company.entity_id)) tipus = "SF";

  const update = {
    id:          company.id,
    nom:         company.nom,
    ticket:      ticket ?? company.ticket,
    data_compr:  dataCompr ?? company.data_compr,
    dpi_eur:     dpiEur   ?? company.dpi_eur,
    rvpi_eur:    rvpiEur  !== null ? rvpiEur : company.rvpi_eur,
    tvpi:        tvpi     ?? company.tvpi,
    tipus,
    is_mock:     false,
  };

  updates.push(update);

  if (dryRun) {
    const sfLabel = sfData ? `${sfData.status} DPI=${sfData.dpi?.toFixed(2)}` : "no summary match";
    console.log(`  ${company.nom}`);
    console.log(`    ticket=${ticket ?? "–"} | data_compr=${dataCompr ?? "–"} | ${sfLabel}`);
    console.log(`    → dpi_eur=${dpiEur ?? "–"} | rvpi_eur=${rvpiEur ?? "–"} | tvpi=${tvpi ?? "–"} | tipus=${tipus}`);
  }
}

console.log(`\n  Matched Summary_Q4: ${matchedSummary} | No match: ${noSummary} | No capital calls: ${noCalls}`);

if (dryRun) { process.exit(0); }

// Upsert in batches
const BATCH = 50;
let updated = 0;
for (let i = 0; i < updates.length; i += BATCH) {
  const batch = updates.slice(i, i + BATCH);
  const { error } = await sb.from("portfolio_companies").upsert(batch, { onConflict: "id" });
  if (error) { console.error(`Upsert failed at ${i}:`, error.message); process.exit(1); }
  updated += batch.length;
}
console.log(`✓ Updated ${updated} portfolio_companies`);
