import test from "node:test";
import assert from "node:assert/strict";

// subtractOneCalendarDay is a pure function, tested here to avoid Vite env dependencies
function subtractOneCalendarDay(isoDate) {
  // Use noon UTC to avoid DST-edge midnight ambiguity when converting back to ISO.
  const d = new Date(isoDate + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

test("subtractOneCalendarDay: subtracts one day from a normal date", () => {
  assert.equal(subtractOneCalendarDay("2026-05-18"), "2026-05-17");
});

test("subtractOneCalendarDay: handles month boundary", () => {
  assert.equal(subtractOneCalendarDay("2026-05-01"), "2026-04-30");
});

test("subtractOneCalendarDay: handles year boundary", () => {
  assert.equal(subtractOneCalendarDay("2026-01-01"), "2025-12-31");
});

test("subtractOneCalendarDay: handles leap year Feb 29", () => {
  assert.equal(subtractOneCalendarDay("2024-03-01"), "2024-02-29");
});

import { convertAmountToEurOnDate } from "../src/fx.js";

const MOCK_RATE = 0.92;
const MOCK_OBSERVED_AT = "2026-05-17";

const mockFetcher = async (_url) => ({ rate: MOCK_RATE, observedAt: MOCK_OBSERVED_AT, source: "ecb" });

test("convertAmountToEurOnDate: EUR identity — no conversion", async () => {
  const result = await convertAmountToEurOnDate({ amount: 1000, currency: "EUR", date: "2026-05-18" }, mockFetcher);
  assert.equal(result.eur, 1000);
  assert.equal(result.fxSource, "identity");
  assert.equal(result.fxRate, 1);
});

test("convertAmountToEurOnDate: USD past date uses T-1 ECB rate", async () => {
  // date = 2026-05-18 → rateDate = 2026-05-17 (T-1)
  const result = await convertAmountToEurOnDate({ amount: 1000, currency: "USD", date: "2026-05-18" }, mockFetcher);
  assert.equal(result.eur, Math.round(1000 * MOCK_RATE * 100) / 100);
  assert.equal(result.amountNative, 1000);
  assert.equal(result.fxRate, MOCK_RATE);
  // fxSource encodes the ECB observation date (T-1), not the transaction date
  assert.equal(result.fxSource, `ecb:${MOCK_OBSERVED_AT}`);
});

test("convertAmountToEurOnDate: USD future date uses estimated tag", async () => {
  const futureDate = "2099-12-31";
  const result = await convertAmountToEurOnDate({ amount: 1000, currency: "USD", date: futureDate }, mockFetcher);
  assert.equal(result.amountNative, 1000);
  assert.match(result.fxSource, /^ecb:estimated:/);
  // Estimated fxSource must NOT contain the future transaction date
  assert.ok(!result.fxSource.includes(futureDate), "fxSource should use rate date, not future tx date");
});
