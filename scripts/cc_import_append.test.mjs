import { test } from "node:test";
import assert from "node:assert/strict";
import { buildTipusConceptMap, resolveConceptFromTipus, resolveEntityId, normalizeRow, buildDedupSet, buildDedupKey } from "./cc_import_append.mjs";

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

test("resolveEntityId — exact match", () => {
  const exactMap = new Map([["fons innovation iv", "uuid-1"]]);
  const entities = [{ id: "uuid-1", canonical_name: "Fons Innovation IV" }];
  assert.equal(resolveEntityId("Fons Innovation IV", exactMap, entities), "uuid-1");
});

test("resolveEntityId — case-insensitive exact match", () => {
  const exactMap = new Map([["fons innovation iv", "uuid-1"]]);
  const entities = [{ id: "uuid-1", canonical_name: "Fons Innovation IV" }];
  assert.equal(resolveEntityId("fons innovation iv", exactMap, entities), "uuid-1");
});

test("resolveEntityId — DB name starts with input (prefix match)", () => {
  const exactMap = new Map([["fons innovation iv (sicav)", "uuid-2"]]);
  const entities = [{ id: "uuid-2", canonical_name: "Fons Innovation IV (SICAV)" }];
  assert.equal(resolveEntityId("Fons Innovation IV", exactMap, entities), "uuid-2");
});

test("resolveEntityId — input starts with DB base name", () => {
  const exactMap = new Map([["fons innovation", "uuid-3"]]);
  const entities = [{ id: "uuid-3", canonical_name: "Fons Innovation" }];
  assert.equal(resolveEntityId("Fons Innovation Extended Name", exactMap, entities), "uuid-3");
});

test("resolveEntityId — no match returns null", () => {
  const exactMap = new Map();
  const entities = [];
  assert.equal(resolveEntityId("Nonexistent Fund", exactMap, entities), null);
});

test("normalizeRow — capital call is positive, cat=Capital Call", () => {
  const tipusMap = new Map();
  const raw = { fons: "Fund A", tipus: "Aportació", data: "2024-03-01", importLocal: 1000, divisa: "EUR", vcpe: "PE", eur: 1000, est: "Fons Primari" };
  const row = normalizeRow(raw, "uuid-1", tipusMap);
  assert.equal(row.vehicle_id, "uuid-1");
  assert.equal(row.tipus, "Aportació");
  assert.equal(row.cat, "Capital Call");
  assert.ok(row.eur > 0);
  assert.ok(row.amount_native > 0);
});

test("normalizeRow — distribution is negative, cat=Distribució", () => {
  const tipusMap = new Map();
  const raw = { fons: "Fund A", tipus: "Distribució", data: "2024-03-01", importLocal: 500, divisa: "EUR", vcpe: "PE", eur: 500, est: null };
  const row = normalizeRow(raw, "uuid-1", tipusMap);
  assert.equal(row.cat, "Distribució");
  assert.ok(row.eur < 0);
  assert.ok(row.amount_native < 0);
});

test("normalizeRow — tipusMap override takes effect", () => {
  const tipusMap = new Map([["capital call", "Aportació"]]);
  const raw = { fons: "Fund A", tipus: "Capital Call", data: "2024-03-01", importLocal: 1000, divisa: "EUR", vcpe: "PE", eur: 1000, est: null };
  const row = normalizeRow(raw, "uuid-1", tipusMap);
  assert.equal(row.tipus, "Aportació");
});

test("buildDedupKey produces consistent key", () => {
  const row = { vehicle_id: "uuid-1", tipus: "Aportació", data: "2024-03-01", eur: 1000.005 };
  const key = buildDedupKey(row);
  assert.equal(key, "uuid-1|Aportació|2024-03-01|100001");
});

test("buildDedupSet returns set of keys from existing rows", () => {
  const existing = [
    { vehicle_id: "uuid-1", tipus: "Aportació", data: "2024-03-01", eur: 1000 },
    { vehicle_id: "uuid-2", tipus: "Distribució", data: "2024-04-01", eur: -500 },
  ];
  const set = buildDedupSet(existing);
  assert.equal(set.size, 2);
  assert.ok(set.has("uuid-1|Aportació|2024-03-01|100000"));
  assert.ok(set.has("uuid-2|Distribució|2024-04-01|-50000"));
});

test("a normalized new row matches its existing counterpart", () => {
  const existingRow = { vehicle_id: "uuid-1", tipus: "Aportació", data: "2024-03-01", eur: 1000 };
  const set = buildDedupSet([existingRow]);
  const newRow = { vehicle_id: "uuid-1", tipus: "Aportació", data: "2024-03-01", eur: 1000 };
  assert.ok(set.has(buildDedupKey(newRow)));
});

import { parseSheets } from "./cc_import_append.mjs";
import { createRequire } from "module";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const XLSX = require("xlsx");

// Funds sheet row (FUNDS_COLS: fons=r[2], tipus=r[3], date=r[5], importLocal=r[6],
//   divisa=r[7], vcpe=r[13], eur=r[15], est=r[16])
function makeFundsRow(fons, tipus, dateSerial, importLocal, divisa, vcpe, importEur, est) {
  const r = new Array(17).fill("");
  r[2] = fons; r[3] = tipus; r[5] = dateSerial; r[6] = importLocal;
  r[7] = divisa; r[13] = vcpe; r[15] = importEur; r[16] = est;
  return r;
}

// Startups sheet row (STARTUP_COLS: fons=r[1], tipus=r[2], date=r[4], importLocal=r[5],
//   divisa=r[6], vcpe=r[14], eur=r[5])
function makeStartupRow(fons, tipus, dateSerial, importLocal, divisa, vcpe) {
  const r = new Array(17).fill("");
  r[1] = fons; r[2] = tipus; r[4] = dateSerial; r[5] = importLocal;
  r[6] = divisa; r[14] = vcpe;
  return r;
}

function makeWorkbook(fundsRows, startupsRows) {
  const pad = Array(8).fill(new Array(17).fill(""));
  const ws1 = XLSX.utils.aoa_to_sheet([...pad, ...fundsRows]);
  const ws2 = XLSX.utils.aoa_to_sheet([...pad, ...startupsRows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws1, "Capital Calls log");
  XLSX.utils.book_append_sheet(wb, ws2, "Startups log");
  return wb;
}

test("parseSheets — blank fons row inherits lastFons", () => {
  const wb = makeWorkbook(
    [
      makeFundsRow("Test Fund", "Aportació", 45000, 1000, "EUR", "PE", 1000, "Fons Primari"),
      makeFundsRow("", "Aportació", 45000, 500, "EUR", "PE", 500, ""),
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
      makeFundsRow("Fund A", "Aportació", 45000, 1000, "EUR", "PE", 1000, ""),
      makeFundsRow("Fund A", "Aportació", 45000, "", "EUR", "PE", "", ""),
    ],
    []
  );
  const { fundsRows } = parseSheets(wb);
  assert.equal(fundsRows.length, 1);
});

test("parseSheets — companies sheet parses rows without vcpe field", () => {
  const wb = makeWorkbook(
    [],
    [makeStartupRow("Company A", "Aportació", 45000, 500, "EUR", "VC")]
  );
  const { companiesRows } = parseSheets(wb);
  assert.equal(companiesRows.length, 1);
  // vcpe is no longer read from the sheet; vehicle_tipus comes from fund_meta
  assert.equal(companiesRows[0].vcpe, undefined);
});

test("parseSheets — companies rows are parsed regardless of former vcpe column value", () => {
  const wb = makeWorkbook(
    [],
    [
      makeStartupRow("Company A", "Aportació", 45000, 500, "EUR", "VC"),
      makeStartupRow("Company B", "Aportació", 45000, 500, "EUR", "INVALID"),
    ]
  );
  const { companiesRows } = parseSheets(wb);
  // Both rows have valid eur and date, so both are kept (vcpe no longer filters rows)
  assert.equal(companiesRows.length, 2);
});

test("parseSheets — date serial is converted to ISO string", () => {
  const wb = makeWorkbook(
    [makeFundsRow("Fund A", "Aportació", 45000, 1000, "EUR", "PE", 1000, "")],
    []
  );
  const { fundsRows } = parseSheets(wb);
  assert.match(fundsRows[0].data, /^\d{4}-\d{2}-\d{2}$/);
});
