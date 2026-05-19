import { test } from "node:test";
import assert from "node:assert/strict";
import { buildTipusConceptMap, resolveConceptFromTipus } from "./cc_import_append.mjs";

test("buildTipusConceptMap returns empty map when file does not exist", () => {
  const map = buildTipusConceptMap("/nonexistent/path.xlsx");
  assert.equal(map.size, 0);
});

test("resolveConceptFromTipus falls back to model when map is empty", () => {
  const map = new Map();
  assert.equal(resolveConceptFromTipus("Aportació", map), "Aportació");
  assert.equal(resolveConceptFromTipus("Distribució", map), "Distribució");
});

test("resolveConceptFromTipus uses override map when entry present", () => {
  const map = new Map([["aportacio", "Aportació Custom"]]);
  assert.equal(resolveConceptFromTipus("Aportació", map), "Aportació Custom");
});

test("resolveConceptFromTipus is accent-insensitive via slugify", () => {
  const map = new Map([["aportacio", "Aportació"]]);
  // "aportació" slugifies to "aportacio" — should match
  assert.equal(resolveConceptFromTipus("aportació", map), "Aportació");
});

import { parseSheets } from "./cc_import_append.mjs";
import { createRequire } from "module";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const XLSX = require("xlsx");

function makeRow(fons, tipus, dateSerial, importLocal, divisa, vcpe, importEur, est) {
  const r = new Array(17).fill("");
  r[2] = fons; r[3] = tipus; r[5] = dateSerial; r[6] = importLocal;
  r[7] = divisa; r[13] = vcpe; r[15] = importEur; r[16] = est;
  return r;
}

function makeWorkbook(sheet1Rows, sheet2Rows) {
  const pad = Array(8).fill(new Array(17).fill(""));
  const ws1 = XLSX.utils.aoa_to_sheet([...pad, ...sheet1Rows]);
  const ws2 = XLSX.utils.aoa_to_sheet([...pad, ...sheet2Rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws1, "Sheet1");
  XLSX.utils.book_append_sheet(wb, ws2, "Sheet2");
  return wb;
}

test("parseSheets — blank fons row inherits lastFons", () => {
  const wb = makeWorkbook(
    [
      makeRow("Test Fund", "Aportació", 45000, 1000, "EUR", "PE", 1000, "Fons Primari"),
      makeRow("", "Aportació", 45000, 500, "EUR", "PE", 500, ""),
    ],
    []
  );
  const { fundsRows } = parseSheets(wb);
  assert.equal(fundsRows.length, 2);
  assert.equal(fundsRows[1].fons, "Test Fund");
});

test("parseSheets — row with non-finite eur is skipped", () => {
  const wb = makeWorkbook(
    [
      makeRow("Fund A", "Aportació", 45000, 1000, "EUR", "PE", 1000, ""),
      makeRow("Fund A", "Aportació", 45000, "", "EUR", "PE", "", ""),
    ],
    []
  );
  const { fundsRows } = parseSheets(wb);
  assert.equal(fundsRows.length, 1);
});

test("parseSheets — companies sheet forces vcpe to PC", () => {
  const wb = makeWorkbook(
    [],
    [makeRow("Company A", "Aportació", 45000, 500, "EUR", "SF", 500, "")]
  );
  const { companiesRows } = parseSheets(wb);
  assert.equal(companiesRows.length, 1);
  assert.equal(companiesRows[0].vcpe, "PC");
});

test("parseSheets — date serial is converted to ISO string", () => {
  const wb = makeWorkbook(
    [makeRow("Fund A", "Aportació", 45000, 1000, "EUR", "PE", 1000, "")],
    []
  );
  const { fundsRows } = parseSheets(wb);
  assert.match(fundsRows[0].data, /^\d{4}-\d{2}-\d{2}$/);
});
