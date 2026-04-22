import test from "node:test";
import assert from "node:assert/strict";

import { buildClosedTransactionSummaryByIsinCustodian } from "../src/data/pmClosedUtils.js";

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
