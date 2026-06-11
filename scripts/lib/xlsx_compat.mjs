/**
 * Minimal SheetJS-compatible facade over exceljs for the repo's Node scripts.
 *
 * Replicates the subset of the removed `xlsx` package API that the scripts use:
 *   - await XLSX.readFile(path)            (async — exceljs has no sync I/O)
 *   - await XLSX.read(buffer)              (async)
 *   - XLSX.utils.sheet_to_json(ws, { header: 1, defval }) and object mode
 *   - XLSX.utils.book_new / aoa_to_sheet / json_to_sheet / book_append_sheet
 *   - await XLSX.writeFile(wb, path)       (async)
 *   - XLSX.SSF.parse_date_code(serial)     ({ y, m, d, H, M, S, q })
 *
 * Semantics preserved from SheetJS defaults (cellDates:false, raw:true):
 *   - date cells are returned as Excel serial NUMBERS (1900 date system),
 *     so existing `typeof v === "number"` + parse_date_code logic keeps working;
 *   - header:1 keeps blank rows (scripts index rows by absolute position);
 *   - object mode skips blank rows; `defval` fills empty cells; without defval
 *     empty cells are left as holes / omitted keys.
 *
 * Known limitation: serials < 61 (before 1900-03-01) ignore the Excel leap-year
 * bug — irrelevant here, all scripts guard for dates >= 2010.
 */
import ExcelJS from "exceljs";

const DAY_MS = 86400000;
const EXCEL_EPOCH_OFFSET_DAYS = 25569; // days between 1899-12-30 and 1970-01-01

function dateToSerial(date) {
  const serial = date.getTime() / DAY_MS + EXCEL_EPOCH_OFFSET_DAYS;
  return Math.round(serial * 1e7) / 1e7; // kill float noise; midnights stay integers
}

// Reduce an exceljs cell value to the plain value SheetJS would return.
function plainCellValue(value) {
  if (value == null) return undefined;
  const t = typeof value;
  if (t === "number" || t === "string" || t === "boolean") return value;
  if (value instanceof Date) return dateToSerial(value);
  if (t === "object") {
    if (Array.isArray(value.richText)) {
      return value.richText.map((part) => part?.text ?? "").join("");
    }
    if (value.error != null) return undefined;
    if ("result" in value) return plainCellValue(value.result); // formula / shared formula
    if ("text" in value) return plainCellValue(value.text); // hyperlink
  }
  return undefined;
}

function worksheetToSheet(ws) {
  const rows = [];
  let width = 0;
  ws.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    const values = [];
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const v = plainCellValue(cell.value);
      if (v !== undefined) values[colNumber - 1] = v;
    });
    if (values.length > width) width = values.length;
    rows[rowNumber - 1] = values;
  });
  for (let i = 0; i < rows.length; i++) if (!rows[i]) rows[i] = [];
  return { "!data": rows, "!width": width };
}

function workbookToModel(workbook) {
  const SheetNames = workbook.worksheets.map((ws) => ws.name);
  const Sheets = {};
  for (const ws of workbook.worksheets) {
    Sheets[ws.name] = worksheetToSheet(ws);
  }
  return { SheetNames, Sheets };
}

export async function readFile(filePath /* opts ignored: dates → serial numbers */) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  return workbookToModel(workbook);
}

export async function read(data /* Buffer | ArrayBuffer; opts ignored */) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(data);
  return workbookToModel(workbook);
}

export async function writeFile(wb, filePath) {
  const workbook = new ExcelJS.Workbook();
  for (const name of wb.SheetNames) {
    const sheet = wb.Sheets[name];
    const ws = workbook.addWorksheet(name);
    for (const row of sheet?.["!data"] ?? []) {
      ws.addRow((row ?? []).map((v) => (v === undefined ? null : v)));
    }
    const cols = sheet?.["!cols"];
    if (Array.isArray(cols)) {
      cols.forEach((col, idx) => {
        if (col?.wch) ws.getColumn(idx + 1).width = col.wch;
      });
    }
  }
  await workbook.xlsx.writeFile(filePath);
}

// ── utils ───────────────────────────────────────────────────────────────────

function sheetWidth(sheet, rows) {
  if (Number.isFinite(sheet?.["!width"])) return sheet["!width"];
  return rows.reduce((max, r) => Math.max(max, r?.length ?? 0), 0);
}

// Header keys mirror sheet_to_json: header text as key, empty header → "__EMPTY",
// duplicates suffixed "_1", "_2", …
function buildHeaderKeys(headerRow, width) {
  const keys = [];
  const used = new Set();
  for (let c = 0; c < width; c++) {
    const raw = headerRow?.[c];
    const base = raw == null || raw === "" ? "__EMPTY" : String(raw);
    let key = base;
    for (let n = 1; used.has(key); n++) key = `${base}_${n}`;
    used.add(key);
    keys.push(key);
  }
  return keys;
}

function sheet_to_json(sheet, opts = {}) {
  const rows = sheet?.["!data"] ?? [];
  const width = sheetWidth(sheet, rows);
  const hasDefval = Object.prototype.hasOwnProperty.call(opts, "defval");
  const defval = opts.defval;

  if (opts.header === 1) {
    // Array-of-arrays mode: blank rows are KEPT (scripts use absolute row indices).
    return rows.map((row) => {
      const src = row ?? [];
      if (!hasDefval) return src.slice();
      const out = new Array(width);
      for (let c = 0; c < width; c++) out[c] = src[c] === undefined ? defval : src[c];
      return out;
    });
  }

  // Object mode: first row = headers, blank rows skipped.
  if (!rows.length || width === 0) return [];
  const headers = buildHeaderKeys(rows[0], width);
  const out = [];
  for (let r = 1; r < rows.length; r++) {
    const src = rows[r] ?? [];
    let blank = true;
    for (let c = 0; c < width; c++) {
      if (src[c] !== undefined) { blank = false; break; }
    }
    if (blank) continue;
    const obj = {};
    for (let c = 0; c < width; c++) {
      const v = src[c];
      if (v === undefined) {
        if (hasDefval) obj[headers[c]] = defval;
        continue;
      }
      obj[headers[c]] = v;
    }
    out.push(obj);
  }
  return out;
}

function book_new() {
  return { SheetNames: [], Sheets: {} };
}

function book_append_sheet(wb, ws, name) {
  const sheetName = String(name ?? `Sheet${wb.SheetNames.length + 1}`);
  wb.SheetNames.push(sheetName);
  wb.Sheets[sheetName] = ws;
}

function aoa_to_sheet(aoa) {
  const rows = (aoa ?? []).map((row) => (row ?? []).slice());
  return { "!data": rows };
}

function json_to_sheet(jsonRows) {
  const headers = [];
  const seen = new Set();
  for (const row of jsonRows ?? []) {
    for (const key of Object.keys(row ?? {})) {
      if (!seen.has(key)) { seen.add(key); headers.push(key); }
    }
  }
  const data = [headers.slice()];
  for (const row of jsonRows ?? []) {
    data.push(headers.map((h) => row?.[h]));
  }
  return { "!data": data };
}

// ── SSF ─────────────────────────────────────────────────────────────────────

function parse_date_code(serial) {
  const value = Number(serial);
  if (!Number.isFinite(value)) return null;
  const ms = Math.round((value - EXCEL_EPOCH_OFFSET_DAYS) * DAY_MS);
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return null;
  return {
    y: date.getUTCFullYear(),
    m: date.getUTCMonth() + 1,
    d: date.getUTCDate(),
    H: date.getUTCHours(),
    M: date.getUTCMinutes(),
    S: date.getUTCSeconds(),
    q: date.getUTCDay(),
  };
}

export const utils = { sheet_to_json, book_new, book_append_sheet, aoa_to_sheet, json_to_sheet };
export const SSF = { parse_date_code };

const XLSX = { readFile, read, writeFile, utils, SSF };
export default XLSX;
