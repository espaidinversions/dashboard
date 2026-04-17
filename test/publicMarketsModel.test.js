import test from "node:test";
import assert from "node:assert/strict";

import { PM_MODEL } from "../src/data/publicMarketsModel.js";

test("PM_MODEL exposes the canonical PM runtime datasets and indexes", () => {
  assert.ok(Array.isArray(PM_MODEL.holdings.active));
  assert.ok(Array.isArray(PM_MODEL.holdings.closed));
  assert.ok(Array.isArray(PM_MODEL.activity.transactions));
  assert.equal(typeof PM_MODEL.series.values, "object");
  assert.ok(Array.isArray(PM_MODEL.series.monthly));
  assert.equal(typeof PM_MODEL.metadata.totals.active, "number");
  assert.ok(PM_MODEL.indexes.activeById instanceof Map);
  assert.ok(PM_MODEL.indexes.transactionsByIsin instanceof Map);
  assert.ok(PM_MODEL.indexes.activeById.size > 0);
});
