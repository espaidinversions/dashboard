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
