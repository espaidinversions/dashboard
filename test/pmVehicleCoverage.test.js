import test from "node:test";
import assert from "node:assert/strict";

import { PM_MODEL } from "../src/data/publicMarketsModel.js";
import { FUND_PRICES } from "../src/generated/prices/fundPrices.js";
import { ALL_PRICE_SERIES, ESTIMATED_PRICE_ISINS } from "../src/data/allPrices.js";
import { buildPmVehicleCoverageReport } from "../src/data/pmVehicleCoverage.js";

test("vehicle coverage report is fully covered outside closed placeholders", () => {
  const report = buildPmVehicleCoverageReport({
    pmModel: PM_MODEL,
    allPriceSeries: ALL_PRICE_SERIES,
    fundPrices: FUND_PRICES,
    estimatedPriceIsins: ESTIMATED_PRICE_ISINS,
  });

  assert.equal(report.summary.total, report.rows.length);
  assert.equal(report.actionableGaps.length, 0);
  assert.equal(report.summary.fullCoverage, 191);
  assert.equal(report.closedPlaceholders.length, 12);
});
