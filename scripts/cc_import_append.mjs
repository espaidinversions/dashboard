/**
 * Capital Calls append import — reads two sheets from a new Excel and
 * INSERT-only appends rows not already in capital_calls.
 *
 * Usage:
 *   node scripts/cc_import_append.mjs <excel.xlsx> [--equivalencia <eq.xlsx>] [--dry-run]
 */

import { createClient } from "@supabase/supabase-js";
import { createRequire } from "module";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";

import {
  normalizeCapitalCallTipus,
  inferCapitalCallCategoryFromTipus,
  normalizeCapitalCallSignedAmount,
} from "../src/data/capitalCallTipusModel.js";

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
      .map(l => {
        const i = l.indexOf("=");
        const key = l.slice(0, i).trim();
        const val = l.slice(i + 1).trim().replace(/^["']|["']$/g, "").replace(/\s+#.*$/, "");
        return [key, val];
      })
  );
}

// ── Slugify (mirrors capitalCallTipusModel.js) ────────────────────────────────
function slugifyTipus(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ");
}

// ── Parse Equivalència Conceptes ──────────────────────────────────────────────
export function buildTipusConceptMap(filePath) {
  if (!fs.existsSync(filePath)) {
    console.warn("⚠ Equivalència Conceptes not found at", filePath, "— using model fallback only");
    return new Map();
  }
  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json(ws, { defval: "", header: 1 });
  const map = new Map();
  for (const row of raw) {
    const rawType = String(row[0] ?? "").trim();
    const concept = String(row[1] ?? "").trim();
    if (rawType && concept) map.set(slugifyTipus(rawType), concept);
  }
  return map;
}

// Normalize a raw type string using the Equivalència override map first,
// then falling back to the existing model's normalizeCapitalCallTipus.
export function resolveConceptFromTipus(rawTipus, tipusConceptMap) {
  const slug = slugifyTipus(rawTipus);
  if (tipusConceptMap.has(slug)) return tipusConceptMap.get(slug);
  return normalizeCapitalCallTipus(rawTipus);
}

// ── Date conversion ───────────────────────────────────────────────────────────
function excelDateToISO(serial) {
  const d = XLSX.SSF.parse_date_code(serial);
  if (!d || d.y < 2010) return null;
  return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
}

// ── Parse both sheets ─────────────────────────────────────────────────────────
// Both sheets share the "Capital Calls log" column layout (0-based):
//   r[2]=fons, r[3]=tipus, r[5]=dateSerial, r[6]=importLocal,
//   r[7]=divisa, r[13]=vcpe, r[15]=importEur, r[16]=est
// Blank fons cells inherit the previous row's fons (Excel subtable pattern).
// Rows where eur is not a finite non-zero number are skipped.
export function parseSheets(wb) {
  const HEADER_ROW = 7;

  function parseSheet(ws, forceVcpe) {
    const raw = XLSX.utils.sheet_to_json(ws, { defval: "", header: 1 });
    const rows = [];
    let lastFons = "";

    for (let i = HEADER_ROW + 1; i < raw.length; i++) {
      const r = raw[i];

      const cellFons = String(r[2] ?? "").trim();
      if (cellFons) lastFons = cellFons;
      if (!lastFons) continue;

      const eur = Number(r[15]);
      if (!Number.isFinite(eur) || eur === 0) continue;

      const dateSerial = r[5];
      if (!dateSerial || typeof dateSerial !== "number") continue;
      const data = excelDateToISO(dateSerial);
      if (!data) continue;

      const tipus = String(r[3] ?? "").trim();
      const importLocal = Number(r[6]) || 0;
      const divisa = String(r[7] || "EUR").trim();
      const vcpe = forceVcpe ?? String(r[13] ?? "").trim();
      const est = String(r[16] ?? "").trim() || null;

      rows.push({ fons: lastFons, tipus, data, importLocal, divisa, vcpe, eur, est });
    }
    return rows;
  }

  const ws0 = wb.Sheets[wb.SheetNames[0]];
  const ws1 = wb.Sheets[wb.SheetNames[1]];
  return {
    fundsRows: ws0 ? parseSheet(ws0, null) : [],
    companiesRows: ws1 ? parseSheet(ws1, "PC") : [],
  };
}

function parseSheetsFromFile(filePath) {
  let wb;
  try {
    wb = XLSX.readFile(filePath);
  } catch (err) {
    console.error("No s'ha pogut llegir l'Excel:", err.message);
    process.exit(1);
  }
  if (wb.SheetNames.length < 2) {
    console.error(`L'Excel ha de tenir almenys 2 fulles. Trobades: ${wb.SheetNames.join(", ")}`);
    process.exit(1);
  }
  return parseSheets(wb);
}

// ── Name resolution ───────────────────────────────────────────────────────────
export function resolveEntityId(fons, exactMap, entities) {
  const needle = fons.trim().toLowerCase();
  if (exactMap.has(needle)) return exactMap.get(needle);
  for (const e of entities) {
    const dbName = e.canonical_name.trim().toLowerCase();
    const dbBase = dbName.split(" (")[0];
    if (dbName.startsWith(needle) || needle.startsWith(dbBase)) return e.id;
  }
  return null;
}

async function buildNameToIdMap(supabase) {
  const { data, error } = await supabase
    .from("private_entities")
    .select("id, canonical_name");
  if (error) throw new Error("Failed to load private_entities: " + error.message);
  const exactMap = new Map();
  for (const e of data) {
    exactMap.set(e.canonical_name.trim().toLowerCase(), e.id);
  }
  return { exactMap, entities: data };
}

// ── Row normalization ─────────────────────────────────────────────────────────
export function normalizeRow(raw, vehicleId, tipusConceptMap) {
  const resolvedTipus = resolveConceptFromTipus(raw.tipus, tipusConceptMap) ?? raw.tipus;
  const signedEur = normalizeCapitalCallSignedAmount(resolvedTipus, raw.eur);
  const signedNative = normalizeCapitalCallSignedAmount(resolvedTipus, raw.importLocal);
  const cat = inferCapitalCallCategoryFromTipus(resolvedTipus, signedEur);
  return {
    vehicle_id: vehicleId,
    fons: raw.fons,
    tipus: resolvedTipus,
    cat,
    vcpe: raw.vcpe || null,
    est: raw.est || null,
    divisa: raw.divisa || "EUR",
    data: raw.data,
    eur: signedEur,
    amountNative: signedNative,
    fxRate: null,
    fxSource: null,
  };
}

// ── Main (only runs when executed directly, not when imported) ────────────────
const isMain = process.argv[1]?.endsWith("cc_import_append.mjs");

if (isMain) {
  // ── CLI args ──────────────────────────────────────────────────────────────
  const args = process.argv.slice(2);
  if (!args[0] || args[0] === "--help") {
    console.log('Ús: node scripts/cc_import_append.mjs <excel.xlsx> [--equivalencia <eq.xlsx>] [--dry-run]');
    process.exit(args[0] === "--help" ? 0 : 1);
  }

  const excelArg = args[0];
  const dryRun = args.includes("--dry-run");
  const eqIdx = args.indexOf("--equivalencia");
  if (eqIdx !== -1 && (!args[eqIdx + 1] || args[eqIdx + 1].startsWith("--"))) {
    console.error("--equivalencia requereix un argument de ruta");
    process.exit(1);
  }
  const equivalenciaArg = eqIdx !== -1 ? args[eqIdx + 1] : null;

  const absExcelPath = path.isAbsolute(excelArg) ? excelArg : path.join(process.cwd(), excelArg);
  if (!fs.existsSync(absExcelPath)) {
    console.error("Fitxer no trobat:", absExcelPath);
    process.exit(1);
  }

  const defaultEqPath = path.join(__dir, "../260424_Equivalència_Conceptes.xlsx");
  const absEqPath = equivalenciaArg
    ? (path.isAbsolute(equivalenciaArg) ? equivalenciaArg : path.join(process.cwd(), equivalenciaArg))
    : defaultEqPath;
  if (equivalenciaArg && !fs.existsSync(absEqPath)) {
    console.error("Fitxer equivalència no trobat:", absEqPath);
    process.exit(1);
  }

  // ── Supabase client ─────────────────────────────────────────────────────────
  const env = loadEnv(envPath);
  const SUPABASE_URL = env.VITE_SUPABASE_URL;
  const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error("Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }

  const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
