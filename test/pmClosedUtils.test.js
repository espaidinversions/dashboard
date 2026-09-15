import test from "node:test";
import assert from "node:assert/strict";

import {
  buildClosedTransactionSummaryByIsinCustodian,
  enrichClosedPosition,
} from "../src/data/pmClosedUtils.js";

test("closed PM summaries stay split by isin and custodian", () => {
  const summary = buildClosedTransactionSummaryByIsinCustodian();
  const caixa = summary.get("IE00BYVQ9F29||CaixaBank");
  const ib = summary.get("IE00BYVQ9F29||Interactive Brokers");
  const ubs = summary.get("IE00BYVQ9F29||UBS");

  assert.ok(caixa);
  assert.ok(ib);
  assert.ok(ubs);
  assert.notEqual(caixa.costEur, ib.costEur);
  assert.notEqual(ib.custodian, ubs.custodian);
});

// Inject synthetic transactions to exercise the average-cost realized P&L directly.
function summarize(txs) {
  return buildClosedTransactionSummaryByIsinCustodian(txs);
}

test("realized P&L: single buy then single full sell", () => {
  const s = summarize([
    { isin: "AAA", custodian: "IB", action: "buy", date: "2024-01-10", units: 10, valueEur: 1000 },
    { isin: "AAA", custodian: "IB", action: "sell", date: "2024-06-10", units: 10, valueEur: 1200 },
  ]).get("AAA||IB");
  assert.equal(s.costEur, 1000); // matched cost of the sold units
  assert.equal(s.unitats, 10); // gross units bought
  assert.equal(s.costInici, 100); // avg buy price
  assert.equal(s.valorMercat, 1200); // proceeds
  assert.equal(s.rendInici, 20); // (1200 - 1000) / 1000 * 100
  assert.equal(s.dataCompra, "2024-01-10");
  assert.equal(s.endDate, "2024-06-10");
});

test("realized P&L: layered buys at different prices use average cost", () => {
  // Buy 10 @ 100 (=1000), buy 10 @ 200 (=2000). Avg cost = 150/unit.
  // Sell 10 @ 300 (=3000). Matched cost = 10 * 150 = 1500. Realized = (3000-1500)/1500 = 100%.
  const s = summarize([
    { isin: "BBB", custodian: "IB", action: "buy", date: "2024-01-01", units: 10, valueEur: 1000 },
    { isin: "BBB", custodian: "IB", action: "buy", date: "2024-02-01", units: 10, valueEur: 2000 },
    { isin: "BBB", custodian: "IB", action: "sell", date: "2024-03-01", units: 10, valueEur: 3000 },
  ]).get("BBB||IB");
  assert.equal(s.costEur, 1500); // matched cost of the 10 sold units at avg 150
  assert.equal(s.unitats, 20); // gross units ever bought
  assert.equal(s.costInici, 150); // total cost / total units
  assert.equal(s.valorMercat, 3000);
  assert.equal(s.rendInici, 100);
});

test("realized P&L: a naive Σsells − Σbuys would be wrong for partial sells", () => {
  // Naive method: proceeds(3000) - buys(3000) = 0 -> 0% return. Wrong.
  // Average-cost method matches only the sold units and reports the true +100%.
  const s = summarize([
    { isin: "BBB", custodian: "IB", action: "buy", date: "2024-01-01", units: 10, valueEur: 1000 },
    { isin: "BBB", custodian: "IB", action: "buy", date: "2024-02-01", units: 10, valueEur: 2000 },
    { isin: "BBB", custodian: "IB", action: "sell", date: "2024-03-01", units: 10, valueEur: 3000 },
  ]).get("BBB||IB");
  assert.equal(s.rendInici, 100);
});

test("realized P&L: rounding drift is clamped so a fully-closed line reads clean", () => {
  const s = summarize([
    { isin: "CCC", custodian: "IB", action: "buy", date: "2024-01-01", units: 3, valueEur: 100 },
    { isin: "CCC", custodian: "IB", action: "sell", date: "2024-02-01", units: 1, valueEur: 40 },
    { isin: "CCC", custodian: "IB", action: "sell", date: "2024-03-01", units: 2, valueEur: 80 },
  ]).get("CCC||IB");
  // avg cost 100/3; matched cost = 1*(100/3) + 2*(100/3) = 100. Proceeds 120. Realized +20%.
  assert.ok(Math.abs(s.costEur - 100) < 1e-6);
  assert.ok(Math.abs(s.valorMercat - 120) < 1e-6);
  assert.ok(Math.abs(s.rendInici - 20) < 1e-6);
});

test("realized P&L: firstBuy drives dataCompra even when a sell is first in the array", () => {
  const s = summarize([
    { isin: "DDD", custodian: "IB", action: "sell", date: "2024-05-01", units: 5, valueEur: 600 },
    { isin: "DDD", custodian: "IB", action: "buy", date: "2024-01-01", units: 5, valueEur: 500 },
  ]).get("DDD||IB");
  assert.equal(s.dataCompra, "2024-01-01");
  assert.equal(s.endDate, "2024-05-01"); // lastSell
});

test("enrichClosedPosition: hand-entered workbook values are authoritative over the summary", () => {
  const summaryByIsin = new Map([
    ["EEE||IB", { costEur: 999, valorMercat: 111, rendInici: -88, custodian: "IB", gestor: "auto" }],
  ]);
  const p = { isin: "EEE", custodian: "IB", costEur: 1000, valorMercat: 1500, rendInici: 50 };
  const enriched = enrichClosedPosition(p, summaryByIsin);
  assert.equal(enriched.costEur, 1000); // workbook wins, not summary's 999
  assert.equal(enriched.valorMercat, 1500); // workbook wins, not 111
  assert.equal(enriched.rendInici, 50); // workbook wins, not -88
});

test("enrichClosedPosition: summary fills only the fields the workbook left blank", () => {
  const summaryByIsin = new Map([
    ["FFF||IB", { costEur: 800, valorMercat: 900, rendInici: 12.5, gestor: "Abel", dataCompra: "2023-01-01" }],
  ]);
  const p = { isin: "FFF", custodian: "IB", costEur: null, valorMercat: 950 };
  const enriched = enrichClosedPosition(p, summaryByIsin);
  assert.equal(enriched.costEur, 800); // filled from summary
  assert.equal(enriched.valorMercat, 950); // workbook value kept
  assert.equal(enriched.rendInici, 12.5); // filled from summary
  assert.equal(enriched.gestor, "Abel"); // filled from summary
  assert.equal(enriched.dataCompra, "2023-01-01");
});

test("enrichClosedPosition: missing summary entry falls back to nulls without throwing", () => {
  const enriched = enrichClosedPosition({ isin: "ZZZ", custodian: "IB" }, new Map());
  assert.equal(enriched.costEur, null);
  assert.equal(enriched.rendInici, null);
  assert.equal(enriched.custodian, "IB");
});
