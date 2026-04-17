import test from "node:test";
import assert from "node:assert/strict";

import { routeManagerFromCustodian, summarizeLatestPmValues } from "../src/data/pmValueUtils.js";

test("routeManagerFromCustodian maps supported custodians", () => {
  assert.equal(routeManagerFromCustodian({ custodian: "CaixaBank" }), "caixa");
  assert.equal(routeManagerFromCustodian({ custodian: "Interactive Brokers" }), "abel");
  assert.equal(routeManagerFromCustodian({ custodian: "JPMorgan" }), "jpmorgan");
  assert.equal(routeManagerFromCustodian({ custodian: "Unknown" }), "altres");
});

test("summarizeLatestPmValues groups latest values by manager and asset type", () => {
  const nestedValues = {
    AAA: {
      CaixaBank: [{ date: "2026-03-01", value: 100 }, { date: "2026-04-01", value: 120 }],
    },
    BBB: {
      "Interactive Brokers": [{ date: "2026-04-01", value: 80 }],
    },
    CCC: {
      JPMorgan: [{ date: "2026-04-01", value: 40 }],
    },
  };
  const positions = [
    { isin: "AAA", custodian: "CaixaBank", tipus: "RV" },
    { isin: "BBB", custodian: "Interactive Brokers", tipus: "RF" },
    { isin: "CCC", custodian: "JPMorgan", tipus: "RV" },
  ];

  const summary = summarizeLatestPmValues(nestedValues, positions);

  assert.equal(summary.total, 240);
  assert.deepEqual(summary.byManager, { caixa: 120, abel: 80, jpmorgan: 40 });
  assert.deepEqual(summary.byType, { RV: 160, RF: 80 });
  assert.equal(summary.unmappedTotal, 0);
});
