import test from "node:test";
import assert from "node:assert/strict";

import {
  buildLiquiditySummary,
  buildLiquidityByBank,
  buildLiquidityByCurrency,
} from "../src/data/liquidityModel.js";

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

const BANK_ACCOUNTS = [
  { id: 1, banc: "Caixa", section: "alternatives", saldo: 100000 },
  { id: 2, banc: "Caixa", section: "real-estate", saldo: 50000 },
  { id: 3, banc: "UBS", section: "mercats-publics", saldo: 200000 },
  { id: 4, section: "alternatives", saldo: 5000 },
];

test("buildLiquidityByBank sums per bank and sorts by total descending", () => {
  const byBank = buildLiquidityByBank(BANK_ACCOUNTS);
  assert.deepEqual(byBank, [
    { banc: "UBS", total: 200000 },
    { banc: "Caixa", total: 150000 },
    { banc: "—", total: 5000 },
  ]);
});

test("buildLiquidityByBank groups falsy banc under the '—' label", () => {
  const byBank = buildLiquidityByBank([
    { banc: "", saldo: 1000 },
    { banc: null, saldo: 2000 },
  ]);
  assert.deepEqual(byBank, [{ banc: "—", total: 3000 }]);
});

test("buildLiquidityByBank returns [] for empty and non-array input", () => {
  assert.deepEqual(buildLiquidityByBank([]), []);
  assert.deepEqual(buildLiquidityByBank(undefined), []);
});

test("buildLiquidityByBank ignores non-finite saldos", () => {
  const byBank = buildLiquidityByBank([
    { banc: "Caixa", saldo: "x" },
    { banc: "Caixa", saldo: 1000 },
  ]);
  assert.deepEqual(byBank, [{ banc: "Caixa", total: 1000 }]);
});

const CURRENCY_ACCOUNTS = [
  { id: 1, divisa: "EUR", saldo: 100000 },
  { id: 2, divisa: "USD", saldo: 250000 },
  { id: 3, divisa: "USD", saldo: 50000 },
  { id: 4, saldo: 30000 },
];

test("buildLiquidityByCurrency sums EUR-equivalent per divisa, sorted descending", () => {
  const byCurrency = buildLiquidityByCurrency(CURRENCY_ACCOUNTS);
  assert.deepEqual(byCurrency, [
    { divisa: "USD", total: 300000 },
    { divisa: "EUR", total: 130000 },
  ]);
});

test("buildLiquidityByCurrency defaults missing divisa to EUR", () => {
  const byCurrency = buildLiquidityByCurrency([{ saldo: 5000 }]);
  assert.deepEqual(byCurrency, [{ divisa: "EUR", total: 5000 }]);
});

test("buildLiquidityByCurrency returns [] for empty and non-array input", () => {
  assert.deepEqual(buildLiquidityByCurrency([]), []);
  assert.deepEqual(buildLiquidityByCurrency(null), []);
});

test("buildLiquidityByCurrency ignores non-finite saldos", () => {
  const byCurrency = buildLiquidityByCurrency([
    { divisa: "EUR", saldo: "x" },
    { divisa: "EUR", saldo: 1000 },
  ]);
  assert.deepEqual(byCurrency, [{ divisa: "EUR", total: 1000 }]);
});
