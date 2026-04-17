import test from "node:test";
import assert from "node:assert/strict";

import { buildGroupedMonthlySeriesFromNestedValues, buildMonthlySeriesFromNestedValues } from "../src/chartSeries.js";

test("buildMonthlySeriesFromNestedValues scales WAM bond prices by 100 nominal", () => {
  const series = buildMonthlySeriesFromNestedValues(
    {},
    [{
      isin: "XS0000000001",
      custodian: "Andbank",
      gestor: "WAM",
      tipus: "RF",
      unitats: 200000,
      valorMercat: 200000,
      startDate: "2026-01-01",
    }],
    {
      startMonth: "2026-01",
      endMonth: "2026-02",
      priceSeriesByIsin: {
        XS0000000001: [["2026-01", 100], ["2026-02", 101]],
      },
    }
  );

  assert.deepEqual(series, [
    { date: "2026-01", value: 200000 },
    { date: "2026-02", value: 202000 },
  ]);
});

test("buildGroupedMonthlySeriesFromNestedValues keeps multi-custodian ISINs in separate groups", () => {
  const series = buildGroupedMonthlySeriesFromNestedValues(
    {
      AAA: {
        UBS: [{ date: "2026-01-01", value: 100 }, { date: "2026-02-01", value: 110 }],
        CaixaBank: [{ date: "2026-01-01", value: 50 }, { date: "2026-02-01", value: 55 }],
      },
    },
    [
      { isin: "AAA", custodian: "UBS", tipus: "RV", startDate: "2026-01-01", valorMercat: 110 },
      { isin: "AAA", custodian: "CaixaBank", tipus: "RF", startDate: "2026-01-01", valorMercat: 55 },
    ],
    {
      startMonth: "2026-01",
      groupBy: position => position?.custodian ?? "other",
      groups: ["UBS", "CaixaBank"],
    }
  );

  assert.deepEqual(series, [
    { date: "2026-01", UBS: 100, CaixaBank: 50 },
    { date: "2026-02", UBS: 110, CaixaBank: 55 },
  ]);
});

test("buildGroupedMonthlySeriesFromNestedValues keeps price-derived tranches split by custodian", () => {
  const series = buildGroupedMonthlySeriesFromNestedValues(
    {},
    [
      { isin: "AAA", custodian: "UBS", startDate: "2026-01-01", unitats: 10, valorMercat: 120 },
      { isin: "AAA", custodian: "Interactive Brokers", startDate: "2026-01-01", unitats: 5, valorMercat: 60 },
    ],
    {
      startMonth: "2026-01",
      groupBy: position => position?.custodian ?? "other",
      groups: ["UBS", "Interactive Brokers"],
      priceSeriesByIsin: {
        AAA: [["2026-01", 10], ["2026-02", 12]],
      },
    }
  );

  assert.deepEqual(series, [
    { date: "2026-01", UBS: 100, "Interactive Brokers": 50 },
    { date: "2026-02", UBS: 120, "Interactive Brokers": 60 },
  ]);
});
