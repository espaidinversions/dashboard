import test from "node:test";
import assert from "node:assert/strict";

import { buildLiquiditySummary } from "../src/data/liquidityModel.js";

const ACCOUNTS = [
  { id: 1, nom: "Compte ALT 1", section: "alternatives", saldo: 100000 },
  { id: 2, nom: "Compte ALT 2", section: "alternatives", saldo: 50000 },
  { id: 3, nom: "Compte RE", section: "real-estate", saldo: 200000 },
  { id: 4, nom: "Compte PM", section: "mercats-publics", saldo: 25000 },
];

test("buildLiquiditySummary totals all accounts when no section is given", () => {
  const summary = buildLiquiditySummary(ACCOUNTS);
  assert.equal(summary.total, 375000);
  assert.equal(summary.byAccount.length, 4);
  assert.deepEqual(summary.bySection, {
    alternatives: 150000,
    "real-estate": 200000,
    "mercats-publics": 25000,
  });
});

test("buildLiquiditySummary scopes total and byAccount to the requested section", () => {
  const summary = buildLiquiditySummary(ACCOUNTS, { section: "alternatives" });
  assert.equal(summary.total, 150000);
  assert.equal(summary.byAccount.length, 2);
  assert.ok(summary.byAccount.every((a) => a.section === "alternatives"));
  // bySection stays the full breakdown regardless of the filter.
  assert.equal(summary.bySection["real-estate"], 200000);
});

test("buildLiquiditySummary sorts byAccount by saldo descending", () => {
  const summary = buildLiquiditySummary(ACCOUNTS, { section: "alternatives" });
  assert.deepEqual(summary.byAccount.map((a) => a.saldo), [100000, 50000]);
});

test("buildLiquiditySummary handles empty and missing input", () => {
  const empty = buildLiquiditySummary([]);
  assert.equal(empty.total, 0);
  assert.deepEqual(empty.byAccount, []);
  assert.deepEqual(empty.bySection, { alternatives: 0, "real-estate": 0, "mercats-publics": 0 });

  const nullish = buildLiquiditySummary(undefined);
  assert.equal(nullish.total, 0);
});

test("buildLiquiditySummary ignores non-finite saldos", () => {
  const summary = buildLiquiditySummary([
    { section: "alternatives", saldo: "not-a-number" },
    { section: "alternatives", saldo: 1000 },
  ]);
  assert.equal(summary.total, 1000);
});
