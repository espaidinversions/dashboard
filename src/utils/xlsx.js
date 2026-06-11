// XLSX helpers built on exceljs (loaded lazily so it stays out of the main bundle).
// The exported API mirrors the previous SheetJS-based wrapper exactly:
//  - downloadSingleSheetXlsx / downloadMultiSheetXlsx (write path)
//  - readWorkbookFromArrayBuffer / sheetToRows (read path, sheet_to_json-like rows:
//    first row = headers, empty cells = "", date cells = JS Date, blank rows skipped).

async function loadExcelJS() {
  const mod = await import("exceljs");
  return mod?.default ?? mod;
}

function downloadArrayBuffer(buffer, filename) {
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function downloadSingleSheetXlsx({ sheetName, columns, rows, filename }) {
  const ExcelJS = await loadExcelJS();
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheetName);

  // Setting worksheet columns writes the header row and applies widths.
  ws.columns = columns.map((c) => ({
    header: c.header,
    key: c.key,
    ...(c?.width ? { width: c.width } : {}),
  }));
  for (const row of rows) {
    ws.addRow(columns.map((c) => (row?.[c.key] ?? "")));
  }

  const buffer = await wb.xlsx.writeBuffer();
  downloadArrayBuffer(buffer, filename);
}

export async function downloadMultiSheetXlsx({ sheets, filename }) {
  const ExcelJS = await loadExcelJS();
  const wb = new ExcelJS.Workbook();

  for (const sheet of sheets) {
    const name = String(sheet?.name ?? "Sheet1");
    const rows = Array.isArray(sheet?.rows) ? sheet.rows : [];
    const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
    const ws = wb.addWorksheet(name);
    ws.addRow(headers);
    for (const row of rows) {
      ws.addRow(headers.map((h) => (row?.[h] ?? "")));
    }
  }

  const buffer = await wb.xlsx.writeBuffer();
  downloadArrayBuffer(buffer, filename);
}

// ── Read path ───────────────────────────────────────────────────────────────

// Reduce an exceljs cell value to the plain value SheetJS sheet_to_json
// (cellDates:true) would return: number | string | boolean | Date.
// Empty/error cells reduce to undefined (filled with defval "" later).
function plainCellValue(value) {
  if (value == null) return undefined;
  const t = typeof value;
  if (t === "number" || t === "string" || t === "boolean") return value;
  if (value instanceof Date) return value;
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

function worksheetToMatrix(ws) {
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
  return { rows, width };
}

// Header keys mirror sheet_to_json: header text as key, empty header → "__EMPTY",
// duplicates suffixed "_1", "_2", …
function buildHeaderKeys(headerRow, width) {
  const keys = [];
  const used = new Set();
  for (let c = 0; c < width; c++) {
    const raw = headerRow?.[c];
    let base;
    if (raw == null || raw === "") base = "__EMPTY";
    else if (raw instanceof Date) base = raw.toISOString().slice(0, 10);
    else base = String(raw);
    let key = base;
    for (let n = 1; used.has(key); n++) key = `${base}_${n}`;
    used.add(key);
    keys.push(key);
  }
  return keys;
}

function matrixToObjects({ rows, width }) {
  if (!rows.length || width === 0) return [];
  const headers = buildHeaderKeys(rows[0], width);
  const out = [];
  for (let r = 1; r < rows.length; r++) {
    const src = rows[r] ?? [];
    let blank = true;
    for (let c = 0; c < width; c++) {
      if (src[c] !== undefined) { blank = false; break; }
    }
    if (blank) continue; // sheet_to_json default: skip blank rows
    const obj = {};
    for (let c = 0; c < width; c++) {
      obj[headers[c]] = src[c] === undefined ? "" : src[c];
    }
    out.push(obj);
  }
  return out;
}

export async function readWorkbookFromArrayBuffer(arrayBuffer, { maxSheets = 20 } = {}) {
  const ExcelJS = await loadExcelJS();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(arrayBuffer);
  if (workbook.worksheets.length > maxSheets) {
    throw new Error(`El fitxer té massa fulls (màxim ${maxSheets}).`);
  }
  const SheetNames = workbook.worksheets.map((ws) => ws.name);
  const Sheets = {};
  for (const ws of workbook.worksheets) {
    Sheets[ws.name] = worksheetToMatrix(ws);
  }
  // First slot kept for signature compatibility (callers pass it back to sheetToRows).
  return { XLSX: null, wb: { SheetNames, Sheets } };
}

export function sheetToRows(_XLSX, wb, sheetName) {
  const name = sheetName || wb?.SheetNames?.[0];
  if (!name) return null;
  const sheet = wb?.Sheets?.[name];
  if (!sheet) return null;
  const rows = matrixToObjects(sheet);
  return rows.length > 0 ? rows : null;
}
