import { test } from "node:test";
import assert from "node:assert/strict";
import { formatEur } from "../src/components/tabs/landingFormat.js";

test("formatEur renders whole euros with a euro suffix and no decimals", () => {
  assert.equal(formatEur(1234567), "1.234.567 €");
});

test("formatEur coerces non-finite input to zero", () => {
  assert.equal(formatEur(undefined), "0 €");
  assert.equal(formatEur(NaN), "0 €");
});
