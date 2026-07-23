import test from "node:test";
import assert from "node:assert/strict";

import { rowToLiquidityRegistry, rowToLiquidityBalance } from "../src/data/mappers.js";

test("rowToLiquidityRegistry maps snake_case row to camelCase account", () => {
  const row = { id: 7, nom: "Compte", banc: "Caixa", section: "alternatives", divisa: "USD" };
  assert.deepEqual(rowToLiquidityRegistry(row), {
    id: 7, nom: "Compte", banc: "Caixa", section: "alternatives", divisa: "USD",
  });
});

test("rowToLiquidityRegistry defaults banc to null and divisa to EUR", () => {
  const out = rowToLiquidityRegistry({ id: 1, nom: "X", section: "real-estate" });
  assert.equal(out.banc, null);
  assert.equal(out.divisa, "EUR");
});

test("rowToLiquidityBalance maps account_id/saldo_native to camelCase and coerces numbers", () => {
  const row = { id: 3, account_id: 7, data: "2026-06-30", saldo: "1000.5", saldo_native: "900" };
  assert.deepEqual(rowToLiquidityBalance(row), {
    id: 3, accountId: 7, data: "2026-06-30", saldo: 1000.5, saldoNative: 900,
  });
});

test("rowToLiquidityBalance leaves null saldo_native as null and defaults saldo to 0", () => {
  const out = rowToLiquidityBalance({ id: 4, account_id: 7, data: "2026-06-30", saldo: null, saldo_native: null });
  assert.equal(out.saldo, 0);
  assert.equal(out.saldoNative, null);
});
