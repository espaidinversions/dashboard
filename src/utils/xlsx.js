async function loadXLSX() {
  const mod = await import("xlsx");
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
  const XLSX = await loadXLSX();
  const wb = XLSX.utils.book_new();

  const aoa = [
    columns.map((c) => c.header),
    ...rows.map((row) => columns.map((c) => (row?.[c.key] ?? ""))),
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = columns.map((c) => (c?.width ? { wch: c.width } : {}));

  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  const buffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  downloadArrayBuffer(buffer, filename);
}

export async function downloadMultiSheetXlsx({ sheets, filename }) {
  const XLSX = await loadXLSX();
  const wb = XLSX.utils.book_new();

  for (const sheet of sheets) {
    const name = String(sheet?.name ?? "Sheet1");
    const rows = Array.isArray(sheet?.rows) ? sheet.rows : [];
    const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
    const aoa = [
      headers,
      ...rows.map((row) => headers.map((h) => (row?.[h] ?? ""))),
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    XLSX.utils.book_append_sheet(wb, ws, name);
  }

  const buffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  downloadArrayBuffer(buffer, filename);
}

export async function readWorkbookFromArrayBuffer(arrayBuffer, { maxSheets = 20 } = {}) {
  const XLSX = await loadXLSX();
  const wb = XLSX.read(arrayBuffer, { type: "array", cellDates: true });
  if (wb.SheetNames.length > maxSheets) {
    throw new Error(`El fitxer té massa fulls (màxim ${maxSheets}).`);
  }
  return { XLSX, wb };
}

export function sheetToRows(XLSX, wb, sheetName) {
  const name = sheetName || wb?.SheetNames?.[0];
  if (!name) return null;
  const ws = wb.Sheets?.[name];
  if (!ws) return null;
  const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });
  return rows.length > 0 ? rows : null;
}

