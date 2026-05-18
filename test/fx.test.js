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
