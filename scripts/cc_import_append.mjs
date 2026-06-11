/**
 * Capital Calls append import — reads two sheets from a new Excel and
 * INSERT-only appends rows not already in capital_calls.
 *
 * Usage:
 *   node scripts/cc_import_append.mjs <excel.xlsx> [--equivalencia <eq.xlsx>] [--dry-run]
 */

import { createClient } from "@supabase/supabase-js";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";

import {
  normalizeCapitalCallTipus,
  inferCapitalCallCategoryFromTipus,
  normalizeCapitalCallSignedAmount,
} from "../src/data/capitalCallTipusModel.js";

import XLSX from "./lib/xlsx_compat.mjs";

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
export async function buildTipusConceptMap(filePath, { warn = false } = {}) {
  if (!fs.existsSync(filePath)) {
    if (warn) console.warn("⚠ Equivalència Conceptes not found at", filePath, "— using model fallback only");
    return new Map();
  }
  const wb = await XLSX.readFile(filePath);
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

// Column configs (0-based) for each sheet type.
// "Capital Calls log": fons=r[2], tipus=r[3], date=r[5], importLocal=r[6],
//   divisa=r[7], eur=r[15], est=r[16]
// "Startups log": fons=r[1], tipus=r[2], date=r[4], importLocal=r[5],
//   divisa=r[6], eur=r[5] (no separate EUR col), est=null
const FUNDS_COLS   = { fons: 2, tipus: 3, date: 5, importLocal: 6, divisa: 7, eur: 15, est: 16 };
const STARTUP_COLS = { fons: 1, tipus: 2, date: 4, importLocal: 5, divisa: 6, eur: 5,  est: null };

// ── Parse both sheets ─────────────────────────────────────────────────────────
// Blank fons cells inherit the previous row's fons (Excel subtable pattern).
// Rows where eur is not finite/non-zero are skipped.
export function parseSheets(wb) {
  const HEADER_ROW = 7;

  function parseSheet(ws, cols) {
    const raw = XLSX.utils.sheet_to_json(ws, { defval: "", header: 1 });
    const rows = [];
    let lastFons = "";

    for (let i = HEADER_ROW + 1; i < raw.length; i++) {
      const r = raw[i];

      const cellFons = String(r[cols.fons] ?? "").trim();
      if (cellFons) lastFons = cellFons;
      if (!lastFons) continue;

      const eur = Number(r[cols.eur]);
      if (!Number.isFinite(eur) || eur === 0) continue;

      const dateSerial = r[cols.date];
      if (!dateSerial || typeof dateSerial !== "number") continue;
      const data = excelDateToISO(dateSerial);
      if (!data) continue;

      const tipus = String(r[cols.tipus] ?? "").trim();
      const importLocal = Number(r[cols.importLocal]) || 0;
      const divisa = String(r[cols.divisa] || "EUR").trim();
      const est = cols.est != null ? (String(r[cols.est] ?? "").trim() || null) : null;

      rows.push({ fons: lastFons, tipus, data, importLocal, divisa, eur, est });
    }
    return rows;
  }

  const fundsSheet    = wb.Sheets["Capital Calls log"] ?? wb.Sheets[wb.SheetNames[0]];
  const startupsSheet = wb.Sheets["Startups log"]      ?? wb.Sheets[wb.SheetNames[1]];
  const fundsRows     = fundsSheet    ? parseSheet(fundsSheet,    FUNDS_COLS)   : [];
  const companiesRows = startupsSheet ? parseSheet(startupsSheet, STARTUP_COLS) : [];
  // Tag rows with their source sheet so the kind derivation block can distinguish them
  for (const r of fundsRows)     r._sourceSheet = "funds";
  for (const r of companiesRows) r._sourceSheet = "companies";
  return { fundsRows, companiesRows };
}

async function parseSheetsFromFile(filePath) {
  let wb;
  try {
    wb = await XLSX.readFile(filePath);
  } catch (err) {
    console.error("No s'ha pogut llegir l'Excel:", err.message);
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
  const mes  = Number(raw.data?.slice(5, 7)) || null;
  const year = Number(raw.data?.slice(0, 4)) || null;
  const fy   = year ? `FY ${year}` : null;
  return {
    vehicle_id: vehicleId,
    fons: raw.fons,
    tipus: resolvedTipus,
    cat,
    est: raw.est || null,
    divisa: raw.divisa || "EUR",
    data: raw.data,
    mes,
    year,
    fy,
    eur: signedEur,
    amount_native: signedNative,
    fx_rate: null,
    fx_source: null,
  };
}

// ── Deduplication ─────────────────────────────────────────────────────────────
export function buildDedupKey(row) {
  return `${row.vehicle_id}|${row.tipus}|${row.data}|${Math.round(row.eur * 100)}`;
}

export function buildDedupSet(existingRows) {
  return new Set(existingRows.map(buildDedupKey));
}

async function fetchExistingDedupSet(supabase) {
  const PAGE = 1000;
  const all = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("capital_calls")
      .select("vehicle_id, tipus, data, eur")
      .order("data")
      .range(from, from + PAGE - 1);
    if (error) throw new Error("Failed to load capital_calls: " + error.message);
    all.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return buildDedupSet(all);
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
  const listNew = args.includes("--list-new");
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

  if (dryRun) console.log("🔍 DRY RUN — no changes will be written\n");

  // 1. Parse Equivalència Conceptes
  const tipusConceptMap = await buildTipusConceptMap(absEqPath, { warn: true });
  console.log(`✓ Loaded ${tipusConceptMap.size} type mappings from Equivalència Conceptes`);

  // 2. Parse Excel sheets
  console.log("\nReading sheets...");
  const { fundsRows, companiesRows } = await parseSheetsFromFile(absExcelPath);
  console.log(`  funds:     ${String(fundsRows.length).padStart(4)} rows`);
  console.log(`  companies: ${String(companiesRows.length).padStart(4)} rows`);
  const allRaw = [...fundsRows, ...companiesRows];

  // 3. Resolve entity names — create fallback placeholders for unmatched
  console.log("\nResolving names...");
  const { exactMap, entities } = await buildNameToIdMap(sb);

  // First pass: collect unmatched raw rows grouped by name
  const unmatchedRawByName = new Map();
  const resolvedRows = [];
  for (const raw of allRaw) {
    const vehicleId = resolveEntityId(raw.fons, exactMap, entities);
    if (!vehicleId) {
      if (!unmatchedRawByName.has(raw.fons)) unmatchedRawByName.set(raw.fons, []);
      unmatchedRawByName.get(raw.fons).push(raw);
    } else {
      resolvedRows.push(normalizeRow(raw, vehicleId, tipusConceptMap));
    }
  }

  // Create placeholder private_entities for unmatched names.
  // kind is determined by looking up fund_meta.vehicle_tipus:
  //   SF or PC → company; otherwise → vehicle.
  // Since we don't have a vehicle_id yet, we default to "vehicle" for placeholders;
  // the import scripts (sf_import / startups_import) handle company-kind entities separately.
  if (unmatchedRawByName.size > 0) {
    const placeholders = [];
    for (const [name, rows] of unmatchedRawByName) {
      // Derive kind from source sheet: companies/startups sheet → company, funds sheet → vehicle
      const isCompany = rows.some(r => r._sourceSheet === "companies");
      const kind = isCompany ? "company" : "vehicle";
      const prefix = isCompany ? "MOCKNIF:COMPANY" : "VEHICLE";
      const slug = name.toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "");
      const id = `${prefix}:${slug}`;
      placeholders.push({ id, kind, canonical_name: name, source_name: name, match_type: "fallback" });
    }
    if (!dryRun) {
      const { error: upsertErr } = await sb.from("private_entities").upsert(placeholders, { onConflict: "id" });
      if (upsertErr) {
        console.error("⚠ Could not create placeholder entities:", upsertErr.message);
      } else {
        console.log(`  ✓ created ${placeholders.length} placeholder entities`);
      }
    } else {
      console.log(`  [DRY RUN] Would create ${placeholders.length} placeholder entities`);
    }
    // Add placeholders to the lookup maps so we can resolve their rows
    for (const p of placeholders) {
      exactMap.set(p.canonical_name.trim().toLowerCase(), p.id);
      entities.push(p);
    }
    // Second pass: resolve previously unmatched rows
    for (const [, rows] of unmatchedRawByName) {
      for (const raw of rows) {
        const vehicleId = resolveEntityId(raw.fons, exactMap, entities);
        if (vehicleId) resolvedRows.push(normalizeRow(raw, vehicleId, tipusConceptMap));
      }
    }
  }

  console.log(`  ✓ matched ${resolvedRows.length} / ${allRaw.length} rows`);
  if (unmatchedRawByName.size > 0) {
    console.log(`  + ${unmatchedRawByName.size} new placeholder entities created for:`);
    for (const name of unmatchedRawByName.keys()) console.log(`      "${name}"`);
  }

  // 4. Deduplicate
  console.log("\nDeduplicating against existing rows...");
  const dedupSet = await fetchExistingDedupSet(sb);
  console.log(`  Deduplicating against ${dedupSet.size.toLocaleString()} existing rows...`);

  const newRows = resolvedRows.filter(row => !dedupSet.has(buildDedupKey(row)));
  const dupCount = resolvedRows.length - newRows.length;
  console.log(`  new: ${newRows.length} / duplicate: ${dupCount}`);

  if (dryRun) {
    console.log(`\n[DRY RUN — no changes made]`);
    console.log(`  Would insert: ${newRows.length} rows`);
    if (newRows.length > 0 && listNew) {
      console.log("\nNew rows:");
      console.log("vehicle_id | fons | cat | tipus | data | eur");
      newRows.forEach((r) => {
        console.log([r.vehicle_id, r.fons ?? "", r.cat ?? "", r.tipus ?? "", r.data ?? "", r.eur].join(" | "));
      });
    } else if (newRows.length > 0) {
      console.log("\nSample rows (first 3):");
      newRows.slice(0, 3).forEach(r => console.log(" ", JSON.stringify(r)));
    }
    console.log(`\nSummary: ${allRaw.length} read · ${unmatchedRawByName.size} placeholder · ${dupCount} duplicate · ${newRows.length} would insert`);
    process.exit(0);
  }

  // 5. Insert in batches of 200
  if (newRows.length === 0) {
    console.log("\nNo new rows to insert.");
    console.log(`Summary: ${allRaw.length} read · ${unmatchedRawByName.size} placeholder · ${dupCount} duplicate · 0 inserted`);
    process.exit(0);
  }

  console.log(`\nInserting ${newRows.length} rows...`);
  const BATCH = 200;
  let inserted = 0;
  let failed = 0;
  for (let i = 0; i < newRows.length; i += BATCH) {
    const batch = newRows.slice(i, i + BATCH);
    const { error } = await sb.from("capital_calls").insert(batch);
    if (error) {
      console.error(`  ✗ Batch ${i}-${i + batch.length} failed: ${error.message}`);
      failed += batch.length;
    } else {
      inserted += batch.length;
    }
    process.stdout.write(`\r  ${inserted + failed}/${newRows.length}...`);
  }
  console.log(" done.");

  console.log(`\nSummary: ${allRaw.length} read · ${unmatchedRawByName.size} placeholder · ${dupCount} duplicate · ${inserted} inserted${failed ? ` · ${failed} failed` : ""}`);
  if (failed > 0) process.exit(1);
}
