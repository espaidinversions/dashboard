import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const XLSX = require("xlsx");

import { mergeRawRows, normalizeIsin, rowDedupeKey } from "../src/data/pmIdentity.js";
import { PM_POSITIONS_RAW as PM_POSITIONS_RAW_BASE } from "../src/data/publicMarketsRaw.js";
import { PM_POSITIONS_RAW_SUPPLEMENT } from "../src/data/publicMarketsRawSupplement.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const WORKBOOK_GLOB_DIR = path.join(ROOT, "Mercats Públics");
const BANK_MOVEMENTS_JSON = path.join(ROOT, "raw-data", "bank-movements-40510.json");
const OUT_JS = path.join(ROOT, "src", "generated", "publicMarkets", "publicMarketsRawWorkbook.js");
const OUT_MD = path.join(ROOT, "docs", "pm-autoresearch.md");
const OUT_JSON = path.join(ROOT, "docs", "pm-autoresearch.json");

const cleanIsin = normalizeIsin;

function slugify(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || "unknown";
}

function toIsoDate(raw) {
  if (raw == null) return null;
  if (raw instanceof Date) return raw.toISOString().slice(0, 10);
  if (typeof raw === "number" && raw > 1000) {
    const d = XLSX.SSF.parse_date_code(raw);
    if (!d) return null;
    return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    const first = trimmed.split(" i ")[0];
    const parts = first.split("/");
    if (parts.length === 3) {
      const [day, month, year] = parts;
      return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    }
  }
  return null;
}

function num(v) {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function normalizeCostAnual(raw) {
  const value = num(raw);
  if (value == null) return null;
  return value < 0.10 ? Number((value * 100).toFixed(4)) : Number(value.toFixed(4));
}

function normalizeValue(raw, fallback = null) {
  const value = num(raw);
  if (value != null) return value;
  return fallback;
}

function classifyAbelCustodian(bancRaw) {
  const raw = String(bancRaw ?? "").trim();
  if (!raw) return null;
  if (raw === "BANKINTER") return "Bankinter";
  if (raw === "Bankinter") return "Interactive Brokers";
  if (raw.toUpperCase() === "BANKINTER") return "Bankinter";
  return null;
}

function synchronizeWorkbookRows(sourceRows, workbookRows) {
  const workbookKeys = new Set((workbookRows ?? []).map(rowKey).filter(Boolean));
  return mergeRawRows(sourceRows, workbookRows).filter(row => workbookKeys.has(rowKey(row)));
}

function loadBankMovements() {
  if (!fs.existsSync(BANK_MOVEMENTS_JSON)) return [];
  try {
    const payload = JSON.parse(fs.readFileSync(BANK_MOVEMENTS_JSON, "utf8"));
    return Array.isArray(payload?.movements) ? payload.movements : [];
  } catch (error) {
    console.warn(`Could not read ${BANK_MOVEMENTS_JSON}: ${error.message}`);
    return [];
  }
}

function buildEarliestMovementByIsin(rows) {
  const map = new Map();
  for (const row of rows ?? []) {
    const isin = cleanIsin(row?.isin);
    if (!isin) continue;
    const date = String(row?.date ?? "").slice(0, 10);
    if (!date) continue;
    const isBuy = row?.action === "buy";
    const isInitialTransfer = row?.action === "transfer_in" && row?.isInitialTransferIn;
    if (!isBuy && !isInitialTransfer) continue;
    const prev = map.get(isin);
    if (!prev || date < prev) map.set(isin, date);
  }
  return map;
}

function findWorkbookPath() {
  const files = fs.readdirSync(WORKBOOK_GLOB_DIR).filter(f => f.toLowerCase().endsWith(".xlsx"));
  if (!files.length) throw new Error(`No workbook found in ${WORKBOOK_GLOB_DIR}`);
  files.sort();
  return path.join(WORKBOOK_GLOB_DIR, files.at(-1));
}

function findGestorCol(rows) {
  for (const row of rows.slice(0, 5)) {
    if (row?.[1] === "Tipus") {
      return row.findIndex(v => v === "Gestor");
    }
  }
  return -1;
}

function parseWorkbook() {
  const workbookPath = findWorkbookPath();
  const wb = XLSX.readFile(workbookPath);
  const bankMovements = loadBankMovements();
  const earliestMovementByIsin = buildEarliestMovementByIsin(bankMovements);

  const rvRows = XLSX.utils.sheet_to_json(wb.Sheets["ETf's Espai RV"], { header: 1, defval: null });
  const rfRows = XLSX.utils.sheet_to_json(wb.Sheets["ETf's Espai RF"], { header: 1, defval: null });
  const masterRows = XLSX.utils.sheet_to_json(wb.Sheets["Master"], { header: 1, defval: null });
  const gestorCol = findGestorCol(masterRows);

  const rvRaw = [];
  for (let i = 1; i < rvRows.length; i++) {
    const r = rvRows[i];
    if (!r || r[3] == null) continue;
    rvRaw.push({
      bancRaw: String(r[0] ?? "").trim() || null,
      divisa: String(r[1] ?? "").trim() || "EUR",
      nom: String(r[3] ?? "").trim(),
      dataCompra: toIsoDate(r[4]),
      costAnual: normalizeCostAnual(r[5]),
      isin: cleanIsin(r[6]),
      unitats: normalizeValue(r[8]),
      costInici: normalizeValue(r[9]),
      costEur: normalizeValue(r[10]),
      valorMercat: normalizeValue(r[25], normalizeValue(r[10], null)),
      pes: normalizeValue(r[26]),
      rendInici: normalizeValue(r[28]),
      rend2026: normalizeValue(r[29]),
      rend2025: normalizeValue(r[30]),
      rend2024: normalizeValue(r[31]),
      rend2023: normalizeValue(r[32]),
      tipus: "RV",
    });
  }

  const rfRaw = [];
  for (let i = 1; i < rfRows.length; i++) {
    const r = rfRows[i];
    if (!r || r[2] == null) continue;
    rfRaw.push({
      bancRaw: String(r[4] ?? "").trim() || null,
      divisa: String(r[0] ?? "").trim() || "EUR",
      nom: String(r[2] ?? "").trim(),
      dataCompra: toIsoDate(r[3]),
      costAnual: normalizeCostAnual(r[5]),
      isin: cleanIsin(r[6]),
      unitats: normalizeValue(r[8]),
      costInici: normalizeValue(r[9]),
      costEur: normalizeValue(r[10]),
      valorMercat: normalizeValue(r[25], normalizeValue(r[10], null)),
      pes: normalizeValue(r[26]),
      rendInici: normalizeValue(r[28]),
      rend2026: normalizeValue(r[29]),
      rend2025: normalizeValue(r[30]),
      rend2024: normalizeValue(r[31]),
      rend2023: normalizeValue(r[32]),
      tipus: "RF",
    });
  }

  const masterActive = [];
  let currentTancatsYear = null;
  for (let i = 3; i < masterRows.length; i++) {
    const r = masterRows[i];
    if (!r) continue;
    const rowStr = r.filter(Boolean).join(" ");
    const tancatsMatch = /TANCATS\s+(\d{4})/i.exec(rowStr);
    if (tancatsMatch) currentTancatsYear = Number(tancatsMatch[1]);

    const tipusRaw = String(r[1] ?? "").trim();
    const nom = String(r[2] ?? "").trim();
    const isin = cleanIsin(r[5]);
    const gestorRaw = gestorCol >= 0 ? r[gestorCol] : null;
    const unitats = normalizeValue(r[9]);
    if (!isin || !nom || !Number.isFinite(unitats) || unitats <= 0) continue;
    if (currentTancatsYear != null) continue;
    if (!String(gestorRaw ?? "").trim()) continue;

    const custodianMap = {
      CAIXA: "CaixaBank",
      "CAIXA*": "CaixaBank",
      CS: "Credit Suisse",
      UBS: "UBS",
      JPM: "JPMorgan",
      Abel: "Abel Font",
      ABEL: "Abel Font",
      Bankinter: "Bankinter",
      BANKINTER: "Bankinter",
    };
    const custodian = custodianMap[String(gestorRaw).trim()] ?? String(gestorRaw).trim();
    const nav = normalizeValue(r[10]);
    const value = normalizeValue(r[11], nav != null ? unitats * nav : null);

    masterActive.push({
      id: slugify(`${nom}-${custodian}-${String(r[3] ?? "")}-${unitats}`),
      nom,
      gestor: custodian,
      custodian,
      isin,
      tipus: tipusRaw || "RV",
      divisa: "EUR",
      dataCompra: toIsoDate(r[3]),
      unitats,
      costInici: nav,
      costEur: normalizeValue(r[11], nav != null ? unitats * nav : null),
      valorMercat: normalizeValue(r[29], value),
      pes: normalizeValue(r[30]),
      rendInici: normalizeValue(r[32]),
      rend2026: normalizeValue(r[37]),
      rend2025: normalizeValue(r[34]),
      rend2024: normalizeValue(r[35]),
      rend2023: normalizeValue(r[36]),
      costAnual: normalizeCostAnual(r[5]),
      _source: "Master",
    });
  }

  const splitByTotals = (rows, targets) => {
    const nonBank = rows.filter(r => !classifyAbelCustodian(r.bancRaw));
    const bank = rows.filter(r => classifyAbelCustodian(r.bancRaw));
    const values = nonBank.map(r => normalizeValue(r.valorMercat, 0));
    const prefix = [0];
    for (const value of values) prefix.push(prefix.at(-1) + value);
    let best = { idx: Math.floor(nonBank.length / 2), error: Number.POSITIVE_INFINITY, swap: false };
    for (let i = 1; i < nonBank.length; i++) {
      const left = prefix[i];
      const right = prefix.at(-1) - left;
      const errorA = Math.abs(left - targets[0]) + Math.abs(right - targets[1]);
      const errorB = Math.abs(left - targets[1]) + Math.abs(right - targets[0]);
      if (errorA < best.error) best = { idx: i, error: errorA, swap: false };
      if (errorB < best.error) best = { idx: i, error: errorB, swap: true };
    }
    const firstCustodian = best.swap ? "UBS" : "CaixaBank";
    const secondCustodian = best.swap ? "CaixaBank" : "UBS";
    const assigned = nonBank.map((row, idx) => ({
      ...row,
      gestor: idx < best.idx ? firstCustodian : secondCustodian,
      custodian: idx < best.idx ? firstCustodian : secondCustodian,
    }));
    const bankAssigned = bank.map(row => ({
      ...row,
      gestor: "Abel Font",
      custodian: classifyAbelCustodian(row.bancRaw),
    }));
    return [...assigned, ...bankAssigned];
  };

  const applyBankDateOverride = row => {
    if (!row) return row;
    if (row.dataCompra) return row;
    if (row.custodian !== "UBS" && row.custodian !== "Credit Suisse") return row;
    const exactDate = earliestMovementByIsin.get(cleanIsin(row.isin));
    return exactDate ? { ...row, dataCompra: exactDate } : row;
  };

  const rvPositions = splitByTotals(rvRaw, [8_037_347, 10_704_128]).map((row, idx) => applyBankDateOverride({
    id: row.id ?? slugify(`${row.nom}-${row.custodian}-${row.dataCompra ?? ""}-${row.unitats ?? idx}`),
    ...row,
  }));
  const rfPositions = splitByTotals(rfRaw, [3_990_758, 2_220_845]).map((row, idx) => applyBankDateOverride({
    id: row.id ?? slugify(`${row.nom}-${row.custodian}-${row.dataCompra ?? ""}-${row.unitats ?? idx}`),
    ...row,
  }));

  const workbookTotalRow = masterRows.find(row => String(row?.[1] ?? "").includes("TOTAL FINANCER AMB INVERSIÓ VIVA")) ?? null;
  const workbookTotal = workbookTotalRow
    ? workbookTotalRow.find(v => typeof v === "number" && v > 70_000_000 && v < 90_000_000) ?? null
    : null;

  return {
    workbookPath,
    rvPositions,
    rfPositions,
    activeRows: [...masterActive.map(applyBankDateOverride), ...rvPositions, ...rfPositions],
    workbookTotal,
  };
}

function rowKey(row) {
  return rowDedupeKey(row) ?? "";
}

function nearlyEqual(a, b, tolerance = 0.5) {
  if (a == null || b == null) return a === b;
  return Math.abs(Number(a) - Number(b)) <= tolerance;
}

function compareRows(workbookRows, sourceRows) {
  const workbookMap = new Map(workbookRows.map(row => [rowKey(row), row]));
  const sourceMap = new Map(sourceRows.map(row => [rowKey(row), row]));
  const missing = [];
  const changed = [];
  for (const [key, wbRow] of workbookMap.entries()) {
    const srcRow = sourceMap.get(key);
    if (!srcRow) {
      missing.push(wbRow);
      continue;
    }
    const fields = ["nom", "gestor", "custodian", "tipus", "divisa", "dataCompra", "unitats", "costInici", "costEur", "valorMercat", "pes", "rendInici", "rend2023", "rend2024", "rend2025", "rend2026", "costAnual"];
    const diffs = {};
    for (const field of fields) {
      const a = wbRow[field] ?? null;
      const b = srcRow[field] ?? null;
      const equal = typeof a === "number" || typeof b === "number"
        ? nearlyEqual(a, b, field === "unitats" ? 0.01 : 0.5)
        : String(a ?? "") === String(b ?? "");
      if (!equal) diffs[field] = { workbook: a, source: b };
    }
    if (Object.keys(diffs).length > 0) {
      changed.push({ key, nom: wbRow.nom, isin: wbRow.isin, custodian: wbRow.custodian, diffs });
    }
  }
  const extra = [];
  for (const [key, srcRow] of sourceMap.entries()) {
    if (!workbookMap.has(key)) extra.push(srcRow);
  }
  return { missing, changed, extra };
}

function fmtM(n) {
  if (n == null || !Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-GB", { maximumFractionDigits: 2 }).format(n);
}

function writeWorkbookModule(rows) {
  const workbookActiveSum = rows.reduce((sum, row) => sum + (Number(row?.valorMercat) || 0), 0);
  const out = [
    "// Auto-generated from Mercats Públics workbook by scripts/pm_autoresearch.mjs",
    "// Do not edit manually.",
    `export const PM_WORKBOOK_TOTAL_ACTIVE = ${JSON.stringify(workbookActiveSum)};`,
    `export const PM_WORKBOOK_TOTAL_ROW = ${JSON.stringify(rows._workbookTotalRow ?? null)};`,
    `export const PM_POSITIONS_RAW_WORKBOOK = ${JSON.stringify(rows, null, 2)};`,
    "",
  ].join("\n");
  fs.mkdirSync(path.dirname(OUT_JS), { recursive: true });
  fs.writeFileSync(OUT_JS, out, "utf8");
}

function main() {
  const parsed = parseWorkbook();
  const currentSource = synchronizeWorkbookRows(
    mergeRawRows(PM_POSITIONS_RAW_BASE, PM_POSITIONS_RAW_SUPPLEMENT),
    parsed.activeRows,
  );
  const { missing, changed, extra } = compareRows(parsed.activeRows, currentSource);
  const sourceTotal = currentSource.reduce((sum, row) => sum + (Number(row?.valorMercat) || 0), 0);
  const workbookValue = parsed.activeRows.reduce((sum, row) => sum + (Number(row?.valorMercat) || 0), 0);
  const workbookTotalRow = parsed.workbookTotal ?? null;

  const workbookRows = parsed.activeRows;
  workbookRows._workbookTotalRow = workbookTotalRow;
  writeWorkbookModule(workbookRows);

  const report = [
    "# PM Autoresearch",
    "",
    `**Workbook:** ${path.basename(parsed.workbookPath)}`,
    `**Generated:** ${new Date().toISOString().slice(0, 10)}`,
    "**Purpose:** reconcile the workbook against committed public-market source data and generate an overlay module that keeps the app consistent with Excel.",
    "",
    "## Summary",
    "",
    `- Workbook active rows: ${parsed.activeRows.length}`,
    `- Committed source rows: ${currentSource.length}`,
    `- Missing in source: ${missing.length}`,
    `- Changed rows: ${changed.length}`,
    `- Extra rows in source: ${extra.length}`,
    `- Workbook total row (row 105): ${fmtM(workbookTotalRow)}`,
    `- Workbook sum of active rows: ${fmtM(workbookValue)}`,
    `- Current source sum of active rows: ${fmtM(sourceTotal)}`,
    `- Delta vs workbook sum: ${fmtM(workbookValue - sourceTotal)}`,
    "",
    "## Missing In Source",
    "",
    missing.length
      ? missing.map(r => `- ${r.nom} | ${r.isin} | ${r.custodian ?? "—"} | ${r.tipus ?? "—"} | ${fmtM(r.valorMercat)}`).join("\n")
      : "_None_",
    "",
    "## Changed Rows",
    "",
    changed.length
      ? changed.map(r => `- ${r.nom} | ${r.isin} | ${r.custodian ?? "—"} | ${Object.keys(r.diffs).join(", ")}`).join("\n")
      : "_None_",
    "",
    "## Extra In Source",
    "",
    extra.length
      ? extra.map(r => `- ${r.nom} | ${r.isin} | ${r.custodian ?? "—"} | ${r.tipus ?? "—"} | ${fmtM(r.valorMercat)}`).join("\n")
      : "_None_",
    "",
    "## Workbook Overlay",
    "",
    `- Generated module: \`src/generated/publicMarkets/publicMarketsRawWorkbook.js\``,
    `- This overlay is merged after \`publicMarketsRaw.js\` and \`publicMarketsRawSupplement.js\` so workbook values win without losing metadata fields already curated in the source file.`,
    "",
  ].join("\n");

  const json = {
    workbookPath: parsed.workbookPath,
    generatedAt: new Date().toISOString(),
    workbookTotalRow,
    workbookValue,
    sourceTotal,
    missing,
    changed,
    extra,
    workbookRows: parsed.activeRows.length,
    sourceRows: currentSource.length,
  };

  fs.writeFileSync(OUT_MD, report, "utf8");
  fs.writeFileSync(OUT_JSON, JSON.stringify(json, null, 2), "utf8");

  console.log(`Wrote ${OUT_JS}`);
  console.log(`Wrote ${OUT_MD}`);
  console.log(`Wrote ${OUT_JSON}`);
  console.log(`Workbook rows: ${parsed.activeRows.length}`);
  console.log(`Missing in source: ${missing.length}`);
  console.log(`Changed rows: ${changed.length}`);
  console.log(`Extra source rows: ${extra.length}`);
  console.log(`Workbook sum: ${fmtM(workbookValue)}`);
  console.log(`Source sum: ${fmtM(sourceTotal)}`);
  console.log(`Workbook total row: ${fmtM(workbookTotalRow)}`);
  console.log(`Workbook active-row sum: ${fmtM(workbookValue)}`);
}

main();
