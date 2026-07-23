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

import { buildLatestAccounts, buildLiquidityTrend } from "../src/data/liquidityModel.js";

const REG = [
  { id: 1, nom: "ALT A", banc: "Caixa", section: "alternatives", divisa: "EUR" },
  { id: 2, nom: "RE B", banc: "UBS", section: "real-estate", divisa: "USD" },
  { id: 3, nom: "No history", banc: null, section: "mercats-publics", divisa: "EUR" },
];
const BAL = [
  { id: 10, accountId: 1, data: "2026-04-30", saldo: 100, saldoNative: null },
  { id: 11, accountId: 1, data: "2026-06-30", saldo: 150, saldoNative: null },
  { id: 12, accountId: 2, data: "2026-05-31", saldo: 200, saldoNative: 220 },
];

test("buildLatestAccounts picks the max-date balance per account", () => {
  const out = buildLatestAccounts(REG, BAL);
  const a1 = out.find((a) => a.id === 1);
  assert.equal(a1.saldo, 150);
  assert.equal(a1.data, "2026-06-30");
  assert.equal(a1.divisa, "EUR");
  const a2 = out.find((a) => a.id === 2);
  assert.equal(a2.saldo, 200);
  assert.equal(a2.saldoNative, 220);
});

test("buildLatestAccounts yields zero/no-date for accounts with no balances", () => {
  const a3 = buildLatestAccounts(REG, BAL).find((a) => a.id === 3);
  assert.equal(a3.saldo, 0);
  assert.equal(a3.saldoNative, null);
  assert.equal(a3.data, null);
});

test("buildLatestAccounts returns the existing account shape and handles empty input", () => {
  assert.deepEqual(buildLatestAccounts([], []), []);
  assert.deepEqual(buildLatestAccounts(undefined, undefined), []);
  const keys = Object.keys(buildLatestAccounts(REG, BAL)[0]).sort();
  assert.deepEqual(keys, ["banc", "data", "divisa", "id", "nom", "saldo", "saldoNative", "section"]);
});

test("buildLiquidityTrend buckets by month, sorted, with carry-forward", () => {
  const { months, series } = buildLiquidityTrend(REG, BAL);
  assert.deepEqual(months, ["2026-04", "2026-05", "2026-06"]);
  const alt = series.find((s) => s.section === "alternatives");
  // 100 in Apr, carried to May, 150 in Jun
  assert.deepEqual(alt.values, [100, 100, 150]);
  const re = series.find((s) => s.section === "real-estate");
  // nothing in Apr, 200 from May onward (carry-forward)
  assert.deepEqual(re.values, [0, 200, 200]);
  const pub = series.find((s) => s.section === "mercats-publics");
  assert.deepEqual(pub.values, [0, 0, 0]);
});

test("buildLiquidityTrend returns empty structure for no balances", () => {
  assert.deepEqual(buildLiquidityTrend(REG, []), { months: [], series: [] });
  assert.deepEqual(buildLiquidityTrend(undefined, undefined), { months: [], series: [] });
});
