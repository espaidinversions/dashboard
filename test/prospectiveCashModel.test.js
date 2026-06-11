import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  forecastRowsToEditorData,
  editorDataToForecastRows,
  deriveProspectiveCashRows,
} from "../src/data/prospectiveCashModel.js";

const ROWS = [
  { vehicle_id: "V001", fons: "Fund A", flow_type: "calls", year: 2024, amount: 100000 },
  { vehicle_id: "V001", fons: "Fund A", flow_type: "calls", year: 2025, amount: 200000 },
  { vehicle_id: "V001", fons: "Fund A", flow_type: "dist",  year: 2027, amount: 50000  },
  { vehicle_id: "V002", fons: "Fund B", flow_type: "calls", year: 2026, amount: 300000 },
  { vehicle_id: "V002", fons: "Fund B", flow_type: "dist",  year: 2028, amount: 0      }, // zero: skip
];

describe("forecastRowsToEditorData", () => {
  it("groups rows by fons into model_calls and model_dist", () => {
    const { editorData } = forecastRowsToEditorData(ROWS);
    assert.equal(editorData.funds["Fund A"].model_calls[2024], 100000);
    assert.equal(editorData.funds["Fund A"].model_calls[2025], 200000);
    assert.equal(editorData.funds["Fund A"].model_dist[2027], 50000);
    assert.equal(editorData.funds["Fund B"].model_calls[2026], 300000);
  });

  it("skips zero-amount rows", () => {
    const { editorData } = forecastRowsToEditorData(ROWS);
    assert.strictEqual(editorData.funds["Fund B"].model_dist[2028], undefined);
  });

  it("tracks vehicleIds by fons", () => {
    const { vehicleIds } = forecastRowsToEditorData(ROWS);
    assert.equal(vehicleIds["Fund A"], "V001");
    assert.equal(vehicleIds["Fund B"], "V002");
  });

  it("derives years from min to max+3", () => {
    const { editorData } = forecastRowsToEditorData(ROWS);
    assert.equal(editorData.years[0], 2024);           // min year in data
    assert.equal(editorData.years.at(-1), 2027 + 3);   // max year (2027, last non-zero) + 3 = 2030
    assert.deepEqual(editorData.years, [2024, 2025, 2026, 2027, 2028, 2029, 2030]);
  });

  it("returns empty editorData for empty input", () => {
    const { editorData, vehicleIds } = forecastRowsToEditorData([]);
    assert.deepEqual(editorData.years, []);
    assert.deepEqual(editorData.funds, {});
    assert.deepEqual(vehicleIds, {});
  });
});

describe("editorDataToForecastRows", () => {
  it("converts editorData back to DB rows", () => {
    const { editorData, vehicleIds } = forecastRowsToEditorData(ROWS);
    const rows = editorDataToForecastRows(editorData, vehicleIds);
    assert(rows.some(r => r.vehicle_id === "V001" && r.fons === "Fund A" && r.flow_type === "calls" && r.year === 2024 && r.amount === 100000));
    assert(rows.some(r => r.vehicle_id === "V001" && r.fons === "Fund A" && r.flow_type === "dist" && r.year === 2027 && r.amount === 50000));
    assert(rows.some(r => r.vehicle_id === "V002" && r.fons === "Fund B" && r.flow_type === "calls" && r.year === 2026 && r.amount === 300000));
  });

  it("excludes funds with no vehicleId", () => {
    const editorData = {
      years: [2024],
      funds: { "Orphan Fund": { model_calls: { 2024: 99999 }, model_dist: {} } },
    };
    const rows = editorDataToForecastRows(editorData, {});
    assert.equal(rows.length, 0);
  });

  it("is a round-trip (rows → editorData → rows produces same set)", () => {
    const nonZeroRows = ROWS.filter((r) => Number(r.amount) > 0);
    const { editorData, vehicleIds } = forecastRowsToEditorData(nonZeroRows);
    const backRows = editorDataToForecastRows(editorData, vehicleIds);
    // Same length and every source row appears in result
    assert.equal(backRows.length, nonZeroRows.length);
    for (const src of nonZeroRows) {
      assert(backRows.some(r =>
        r.vehicle_id === src.vehicle_id &&
        r.fons === src.fons &&
        r.flow_type === src.flow_type &&
        r.year === src.year &&
        r.amount === src.amount
      ));
    }
  });
});

describe("deriveProspectiveCashRows", () => {
  it("includes actuals for funds that have no forecast rows (unmodeled)", () => {
    const editorData = { years: [], funds: {} };
    const actualCapitalCalls = [
      { fons: "Unmodeled Fund", cat: "Capital Call", eur: 1000, any: 2026, vcpe: "PE" },
      { fons: "Unmodeled Fund", cat: "Distribució", eur: -200, any: 2027, vcpe: "PE" },
      { fons: "Unmodeled Fund", cat: "Compromís", eur: 5000, any: 2026, vcpe: "PE" },
    ];

    const { rows, committed, firstCall } = deriveProspectiveCashRows(editorData, actualCapitalCalls);
    assert(rows.some((r) => r.fund === "Unmodeled Fund" && r.year === 2026 && r.type === "calls" && r.real === 1000));
    assert(rows.some((r) => r.fund === "Unmodeled Fund" && r.year === 2027 && r.type === "dist" && r.real === 200));
    assert.equal(committed["Unmodeled Fund"], 5000);
    assert.equal(firstCall["Unmodeled Fund"], 2026);
  });

  it("excludes transfer/conversion tipus from calls and committed; dist is cat-only", () => {
    const editorData = { years: [], funds: {} };
    const actualCapitalCalls = [
      { fons: "Legacy Vehicle", cat: "Compromís", eur: 1000, any: 2026, vehicleTipus: "PE", tipus: "Saldo apertura 2019" }, // transfer
      { fons: "Legacy Vehicle", cat: "Capital Call", eur: 1000, any: 2026, vehicleTipus: "PE", tipus: "Saldo apertura 2019" }, // transfer
      { fons: "Legacy Vehicle", cat: "Capital Call", eur: 500, any: 2026, vehicleTipus: "PE", tipus: "Aportació" }, // real cash
      { fons: "Legacy Vehicle", cat: "Distribució", eur: -200, any: 2027, vehicleTipus: "PE", tipus: "Conversió Participacions" }, // included since 3801421
      { fons: "Legacy Vehicle", cat: "Distribució", eur: -300, any: 2027, vehicleTipus: "PE", tipus: "Distribució" }, // real cash
    ];

    const { rows, committed } = deriveProspectiveCashRows(editorData, actualCapitalCalls);
    // Transfers are ignored: committed should not include the 1000
    assert.equal(committed["Legacy Vehicle"] ?? 0, 0);
    // Calls should include only the 500
    assert(rows.some((r) => r.fund === "Legacy Vehicle" && r.year === 2026 && r.type === "calls" && r.real === 500));
    assert(!rows.some((r) => r.fund === "Legacy Vehicle" && r.year === 2026 && r.type === "calls" && r.real === 1500));
    // Dist includes ALL distribution concepts (cat-only filter, matching TxSection — commit 3801421)
    assert(rows.some((r) => r.fund === "Legacy Vehicle" && r.year === 2027 && r.type === "dist" && r.real === 500));
    assert(!rows.some((r) => r.fund === "Legacy Vehicle" && r.year === 2027 && r.type === "dist" && r.real === 300));
  });
});
