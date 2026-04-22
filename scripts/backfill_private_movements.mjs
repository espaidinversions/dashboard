/**
 * Backfill missing SF/PC commitment + capital call rows into capital_calls.
 *
 * This makes capital_calls the single source of truth for private movements:
 * charts and transaction tables can then read one table consistently.
 *
 * Usage:
 *   node scripts/backfill_private_movements.mjs --dry-run
 *   node scripts/backfill_private_movements.mjs
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

import { createClient } from "@supabase/supabase-js";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";

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

const dryRun = process.argv.includes("--dry-run");
const CAPITAL_CALLS_PAGE_SIZE = 1000;

function isoDate(value) {
  const date = String(value ?? "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
}

function dateParts(data) {
  const [year, month] = String(data).split("-").map(Number);
  return { mes: month, year, fy: `FY ${year}` };
}

function makeExactKey(row) {
  return [
    row.vehicle_id ?? "",
    row.fons ?? "",
    row.data ?? "",
    row.cat ?? "",
    Number(row.eur ?? 0),
    row.vcpe ?? "",
  ].join("|");
}

function makeSfDuplicateKey(row) {
  return [
    row.vehicle_id ?? "",
    row.data ?? "",
    row.cat ?? "",
    Number(row.eur ?? 0).toFixed(2),
  ].join("|");
}

function makeCoarseKey(row) {
  return [
    row.vehicle_id ?? "",
    row.fons ?? "",
    row.data ?? "",
    row.cat ?? "",
    row.vcpe ?? "",
  ].join("|");
}

function buildCandidateRows(searchers, companies) {
  const rows = [];

  (Array.isArray(searchers) ? searchers : []).forEach((row) => {
    if (row?.status_screening !== "Invertit en fase de cerca") return;
    const data = isoDate(row?.data_compr);
    const eur = Number(row?.ticket ?? 0);
    const vehicleId = String(row?.nif ?? "").trim();
    if (!data || !Number.isFinite(eur) || eur <= 0 || !vehicleId) return;
    const { mes, year, fy } = dateParts(data);
    const base = {
      vehicle_id: vehicleId,
      fons: row.nom,
      tipus: row.form_entrada || "Search Capital",
      data,
      mes,
      year,
      fy,
      vcpe: "SF",
      est: null,
      eur,
      divisa: "EUR",
    };
    rows.push({ ...base, cat: "Compromís" });
    rows.push({ ...base, cat: "Capital Call" });
  });

  (Array.isArray(companies) ? companies : []).forEach((row) => {
    const data = isoDate(row?.data_compr);
    const eur = Number(row?.ticket ?? 0);
    const vehicleId = String(row?.entity_id ?? "").trim();
    if (!data || !Number.isFinite(eur) || eur <= 0 || !vehicleId) return;
    const { mes, year, fy } = dateParts(data);
    const base = {
      vehicle_id: vehicleId,
      fons: row.nom,
      tipus: row.tipus || "Participada",
      data,
      mes,
      year,
      fy,
      vcpe: "PC",
      est: null,
      eur,
      divisa: "EUR",
    };
    rows.push({ ...base, cat: "Compromís" });
    rows.push({ ...base, cat: "Capital Call" });
  });

  return rows;
}

async function fetchAllCapitalCalls() {
  const rows = [];
  for (let from = 0; ; from += CAPITAL_CALLS_PAGE_SIZE) {
    const to = from + CAPITAL_CALLS_PAGE_SIZE - 1;
    const { data, error } = await sb
      .from("capital_calls")
      .select("id, vehicle_id, fons, data, cat, eur, vcpe, tipus")
      .order("data")
      .range(from, to);
    if (error) return { data: null, error };
    rows.push(...(data ?? []));
    if (!data || data.length < CAPITAL_CALLS_PAGE_SIZE) break;
  }
  return { data: rows, error: null };
}

console.log(dryRun ? "DRY RUN\n" : "Backfilling private movements into capital_calls\n");

const [existingCC, searchers, companies] = await Promise.all([
  fetchAllCapitalCalls(),
  sb.from("searchers").select("nom, status_screening, form_entrada, ticket, data_compr, nif"),
  sb.from("portfolio_companies").select("entity_id, nom, tipus, ticket, data_compr"),
]);

if (existingCC.error) {
  console.error("Failed to load capital_calls:", existingCC.error.message);
  process.exit(1);
}
if (searchers.error) {
  console.error("Failed to load searchers:", searchers.error.message);
  process.exit(1);
}
if (companies.error) {
  console.error("Failed to load portfolio_companies:", companies.error.message);
  process.exit(1);
}

const exactKeys = new Set(existingCC.data.map(makeExactKey));
const coarseKeys = new Set(existingCC.data.map(makeCoarseKey));
const sfDuplicateKeys = new Set(
  existingCC.data
    .filter((row) => row?.vcpe === "SF")
    .map(makeSfDuplicateKey),
);
const candidates = buildCandidateRows(searchers.data, companies.data);
const currentByCoarseKey = new Map(existingCC.data.map((row) => [makeCoarseKey(row), row]));
const inserts = candidates.filter((row) => {
  if (exactKeys.has(makeExactKey(row))) return false;
  if (coarseKeys.has(makeCoarseKey(row))) return false;
  if (row.vcpe === "PC" && sfDuplicateKeys.has(makeSfDuplicateKey(row))) return false;
  return true;
});
const updates = candidates
  .map((row) => {
    const current = currentByCoarseKey.get(makeCoarseKey(row));
    if (!current?.id) return null;
    if (String(current.tipus ?? "").trim()) return null;
    if (!String(row.tipus ?? "").trim()) return null;
    return { id: current.id, tipus: row.tipus };
  })
  .filter(Boolean)
  .filter((row, index, arr) => arr.findIndex((candidate) => candidate.id === row.id) === index);

const byVcpe = inserts.reduce((acc, row) => {
  acc[row.vcpe] = (acc[row.vcpe] ?? 0) + 1;
  return acc;
}, {});

console.log(`Existing capital_calls rows: ${existingCC.data.length}`);
console.log(`Candidate synthetic rows:    ${candidates.length}`);
console.log(`Missing rows to insert:      ${inserts.length}`);
console.log(`Existing rows to enrich:     ${updates.length}`);
console.log(`Breakdown: ${JSON.stringify(byVcpe)}`);

if (inserts.length) {
  console.log("\nSample rows:");
  inserts.slice(0, 10).forEach((row) => console.log(" ", JSON.stringify(row)));
}

if (dryRun || (inserts.length === 0 && updates.length === 0)) process.exit(0);

let updated = 0;
for (const row of updates) {
  const { error } = await sb.from("capital_calls").update({ tipus: row.tipus }).eq("id", row.id);
  if (error) {
    console.error(`Update row ${row.id} failed:`, error.message);
    process.exit(1);
  }
  updated += 1;
}

const BATCH = 200;
let inserted = 0;
for (let i = 0; i < inserts.length; i += BATCH) {
  const batch = inserts.slice(i, i + BATCH);
  const { error } = await sb.from("capital_calls").insert(batch);
  if (error) {
    console.error(`Insert batch ${i}-${i + BATCH} failed:`, error.message);
    process.exit(1);
  }
  inserted += batch.length;
  process.stdout.write(`\rInserted ${inserted}/${inserts.length}...`);
}

console.log(`\nDone. Updated ${updated} rows and inserted ${inserted} rows into capital_calls.`);
