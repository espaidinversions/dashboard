import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCurrentManagerValues,
  buildCustodianPositions,
  buildPmBucketValues,
  buildPmChartData,
  buildTotalValueSeries,
  calculatePortfolioMwr,
  calculatePortfolioTwr,
  groupPmCustodian,
  pmMonthlyTotal,
} from "../src/data/publicMarketsDashboardModel.js";

test("public market dashboard model groups custodians and totals monthly rows", () => {
  assert.equal(groupPmCustodian({ custodian: "CaixaBank" }), "caixa");
  assert.equal(groupPmCustodian({ custodian: "Interactive Brokers" }), "ib");
  assert.equal(pmMonthlyTotal({ caixaRV: 1, caixaRF: 2, ubsRV: 3, ubsRF: 4, abelBK: 5, andbank: 6 }), 21);
});

test("public market dashboard model builds manager values and bucket values", () => {
  const positions = [
    { id: "p1", isin: "ETF1", custodian: "CaixaBank", tipus: "RV", valorMercat: 100, nom: "ETF" },
    { id: "p2", isin: "F1", custodian: "Bankinter", tipus: "RV", valorMercat: 50, nom: "Fund" },
    { id: "p3", isin: "S1", custodian: "Interactive Brokers", tipus: "RV", valorMercat: 25, nom: "Stock", assetType: "stock" },
  ];
  const custodians = buildCustodianPositions(positions, [{ id: "w1", valorMercat: 10 }]);
  const current = buildCurrentManagerValues({ total: 185, byManager: { caixa: 100, ubs: 0, abel: 75, andbank: 10 } }, custodians);
  const buckets = buildPmBucketValues({ pmPositions: positions, pmValues: {}, custodianPositions: custodians, currentManagerValues: current, liquidityValue: 5, residualValue: 2 });

  assert.equal(current.bankinter, 50);
  assert.equal(current.ib, 25);
  assert.equal(buckets.rfWam, 10);
  assert.equal(buckets.liquiditat, 5);
  assert.equal(buckets.residualExcel, 2);
});

test("public market dashboard model builds total and chart series", () => {
  const reportMonthly = [
    { date: "2026-03", caixaRV: 100, caixaRF: 0, ubsRV: 0, ubsRF: 0, abelBK: 0, andbank: 0 },
    { date: "2026-04", caixaRV: 110, caixaRF: 0, ubsRV: 0, ubsRF: 0, abelBK: 0, andbank: 0 },
  ];
  const totalValueSeries = buildTotalValueSeries({ reportMonthly, workbookTotalRow: 120, workbookTotalMonth: "2026-04" });
  const chart = buildPmChartData({
    chartView: "total",
    chartMonths: ["2026-03", "2026-04"],
    reportMonthly,
    totalValueSeries,
    custodianValueByMonth: new Map(),
    custodianPositions: buildCustodianPositions([], []),
    workbookTotalMonth: "2026-04",
  });

  assert.deepEqual(totalValueSeries, [{ date: "2026-03", value: 100 }, { date: "2026-04", value: 120 }]);
  assert.deepEqual(chart, [{ month: "2026-03", total: 100 }, { month: "2026-04", total: 120 }]);
});

test("public market dashboard model computes portfolio return metrics", () => {
  const rows = [
    { date: "2026-01", caixaRV: 100, caixaRF: 0, ubsRV: 0, ubsRF: 0, abelBK: null },
    { date: "2026-02", caixaRV: 110, caixaRF: 0, ubsRV: 0, ubsRF: 0, abelBK: 10 },
    { date: "2026-03", caixaRV: 130, caixaRF: 0, ubsRV: 0, ubsRF: 0, abelBK: 10, cashflows: { abelBK: 5 } },
  ];

  assert.equal(Number.isFinite(calculatePortfolioTwr(rows)), true);
  assert.equal(Number.isFinite(calculatePortfolioMwr(rows)), true);
});