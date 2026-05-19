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
      .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
  );
}

// ── CLI args ──────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
if (!args[0] || args[0] === "--help") {
  console.log('Ús: node scripts/cc_import_append.mjs <excel.xlsx> [--equivalencia <eq.xlsx>] [--dry-run]');
  process.exit(args[0] === "--help" ? 0 : 1);
}

const excelArg = args[0];
const dryRun = args.includes("--dry-run");
const eqIdx = args.indexOf("--equivalencia");
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

// ── Supabase client ───────────────────────────────────────────────────────────
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
