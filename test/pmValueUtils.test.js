import test from "node:test";
import assert from "node:assert/strict";

import { routeManagerFromCustodian, summarizeLatestPmValues, summarizeLatestPmValuesWithWam } from "../src/data/pmValueUtils.js";

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

test("summarizeLatestPmValuesWithWam adds WAM valorMercat to total, andbank, and byType", () => {
  const nested = { "ISIN1": { CaixaBank: [{ date: "2024-01", value: 1000 }] } };
  const positions = [{ isin: "ISIN1", custodian: "CaixaBank", tipus: "RV" }];
  const wam = [{ custodian: "Andbank", tipus: "RF", valorMercat: 250 }, { custodian: "Andbank", tipus: "RF", valorMercat: 0 }];
  const s = summarizeLatestPmValuesWithWam(nested, positions, wam);
  assert.equal(s.total, 1250);            // 1000 + 250 (the 0 skipped)
  assert.equal(s.byManager.andbank, 250);
  assert.equal(s.byType.RF, 250);
  assert.equal(s.byType.RV, 1000);
});
