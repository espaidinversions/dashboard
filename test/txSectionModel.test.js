import test from "node:test";
import assert from "node:assert/strict";
import {
  EXCLUDED_KPI_TIPUS,
  PM_TX_MONTHS_SHORT,
  isCompanyRow,
  isExcludedKpiRow,
  isAportacio,
  computeCanonicalEstByNif,
  buildTxChartData,
} from "../src/data/txSectionModel.js";

test("isCompanyRow treats search funds and participades as companies, funds as vehicles", () => {
  assert.equal(isCompanyRow({ est: "Search Fund - Cerca" }), true);
  assert.equal(isCompanyRow({ est: "Participada (Altres)" }), true);
  assert.equal(isCompanyRow({ est: "Fons Primari" }), false);
  assert.equal(isCompanyRow({ est: "Fons Real Estate" }), false);
  assert.equal(isCompanyRow({}), false);
});

test("isExcludedKpiRow flags legacy non-cash participation movements", () => {
  assert.equal(EXCLUDED_KPI_TIPUS.has("Transferència Participacions"), true);
  assert.equal(isExcludedKpiRow({ tipus: "Transferència Participacions" }), true);
  assert.equal(isExcludedKpiRow({ tipus: "Conversió Participacions" }), true);
  assert.equal(isExcludedKpiRow({ tipus: "Aportació" }), false);
});

test("isAportacio detects contribution rows", () => {
  assert.equal(isAportacio({ tipus: "Aportació" }), true);
  assert.equal(isAportacio({ tipus: "Distribució" }), false);
});

test("computeCanonicalEstByNif skips search funds and unclassified rows", () => {
  assert.equal(computeCanonicalEstByNif([]).size, 0);
  const onlySf = computeCanonicalEstByNif([
    { id: "1", est: "Search Fund - Cerca", data: "2024-01-01" },
  ]);
  assert.equal(onlySf.has("1"), false);
  const noEst = computeCanonicalEstByNif([{ id: "2", est: "", data: "2024-01-01" }]);
  assert.equal(noEst.size, 0);
});

test("computeCanonicalEstByNif picks the majority est per NIF", () => {
  const canonical = computeCanonicalEstByNif([
    { id: "10", est: "Fons Primari", data: "2024-01-01" },
    { id: "10", est: "Fons Primari", data: "2024-02-01" },
    { id: "10", est: "Fons Secundari", data: "2024-03-01" },
  ]);
  assert.equal(canonical.get("10"), "Fons Primari");
});

test("computeCanonicalEstByNif breaks ties with the most recent transaction", () => {
  const canonical = computeCanonicalEstByNif([
    { id: "20", est: "Fons Primari", data: "2023-01-01" },
    { id: "20", est: "Fons Secundari", data: "2024-06-01" },
  ]);
  assert.equal(canonical.get("20"), "Fons Secundari");
});

test("buildTxChartData aggregates calls and returns per month, sorted", () => {
  const rows = [
    { data: "2024-01-15", cat: "Capital Call", tipus: "Aportació", eur: -100 },
    { data: "2024-01-20", cat: "Distribució", eur: 50 },
    { data: "2024-02-01", cat: "Retorn Capital", eur: 30 },
    { data: "2024-02-10", cat: "Compromís", tipus: "Aportació", eur: 999 },
    { data: "bad-date", cat: "Capital Call", tipus: "Aportació", eur: 40 },
  ];

  const result = buildTxChartData(rows);

  assert.deepEqual(result, [
    { label: `${PM_TX_MONTHS_SHORT[1]} '24`, CapitalCalls: 100, Retorns: 50 },
    { label: `${PM_TX_MONTHS_SHORT[2]} '24`, CapitalCalls: 0, Retorns: 30 },
  ]);
});

test("buildTxChartData ignores excluded-tipus capital calls", () => {
  const result = buildTxChartData([
    { data: "2024-05-01", cat: "Capital Call", tipus: "Transferència Participacions", eur: -200 },
  ]);
  assert.equal(result.length, 1);
  assert.equal(result[0].CapitalCalls, 0);
});
