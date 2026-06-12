import test from "node:test";
import assert from "node:assert/strict";

import {
  normalizeNumericInput,
  formatDisplayValue,
  toEditableValue,
  formatLive,
} from "../src/components/shared/numericInput.js";

// Simulates the AddRowModal number input: while focused, the field shows the
// raw draft (what the user typed), never a reformatted string. Each keystroke
// appends to the draft; the stored value is normalizeNumericInput(draft).
function typeKeys(keys, initialDraft = "") {
  let draft = initialDraft;
  for (const key of keys) draft += key;
  return normalizeNumericInput(draft);
}

test("typing 50000 stores 50000, not 5 (regression: format/parse round-trip)", () => {
  assert.equal(typeKeys("50000"), "50000");
  assert.equal(Number(typeKeys("50000")), 50000);
});

test("typing 12345 stores 12345, not 1.2345 (regression)", () => {
  assert.equal(typeKeys("12345"), "12345");
});

test("typing 1234567 stores 1234567 (regression)", () => {
  assert.equal(typeKeys("1234567"), "1234567");
});

test("typing 50000,75 stores 50000.75", () => {
  assert.equal(typeKeys("50000,75"), "50000.75");
});

test("backspacing the decimals of an edited amount keeps the integer part", () => {
  // Edit mode: field gains focus with the plain editable form of 12345.67
  const draft = toEditableValue("12345.67"); // "12345,67"
  assert.equal(draft, "12345,67");
  // Backspace three times: "12345,6" → "12345," → "12345"
  assert.equal(normalizeNumericInput(draft.slice(0, -1)), "12345.6");
  assert.equal(normalizeNumericInput(draft.slice(0, -2)), "12345.");
  assert.equal(normalizeNumericInput(draft.slice(0, -3)), "12345");
});

test("comma is the decimal separator", () => {
  assert.equal(normalizeNumericInput("1,5"), "1.5");
  assert.equal(normalizeNumericInput("0,5"), "0.5");
  assert.equal(normalizeNumericInput("1.234,56"), "1234.56");
});

test("dot with exactly 3 trailing digits is a thousands separator (ca-ES paste)", () => {
  assert.equal(normalizeNumericInput("1.234"), "1234");
  assert.equal(normalizeNumericInput("12.345"), "12345");
  assert.equal(normalizeNumericInput("1.234.567"), "1234567");
});

test("dot with non-3 trailing digits is a decimal separator (US/Excel paste)", () => {
  assert.equal(normalizeNumericInput("1.2"), "1.2");
  assert.equal(normalizeNumericInput("1234.56"), "1234.56");
  assert.equal(normalizeNumericInput("0.5"), "0.5");
});

test("negatives: leading minus and parentheses", () => {
  assert.equal(normalizeNumericInput("-1234,56"), "-1234.56");
  assert.equal(normalizeNumericInput("(100)"), "-100");
  assert.equal(normalizeNumericInput("-"), "-");
});

test("empty and junk input return empty string", () => {
  assert.equal(normalizeNumericInput(""), "");
  assert.equal(normalizeNumericInput("   "), "");
  assert.equal(normalizeNumericInput("abc"), "");
  assert.equal(normalizeNumericInput(null), "");
});

test("formatDisplayValue renders ca-ES grouping and decimals", () => {
  assert.equal(formatDisplayValue("1234"), "1.234");
  assert.equal(formatDisplayValue("1234567"), "1.234.567");
  assert.equal(formatDisplayValue("1234.56"), "1.234,56");
  assert.equal(formatDisplayValue("-1234.5"), "-1.234,5");
});

test("formatDisplayValue passes mid-typing artifacts through", () => {
  assert.equal(formatDisplayValue(""), "");
  assert.equal(formatDisplayValue("-"), "-");
  assert.equal(formatDisplayValue("1234."), "1.234,");
});

test("display → editable → normalize round-trip preserves the value", () => {
  for (const stored of ["5", "50000", "12345.67", "-1234.5", "0.01", "1234567"]) {
    const editable = toEditableValue(stored);
    assert.equal(
      normalizeNumericInput(editable),
      stored,
      `round-trip broke for ${stored} (editable: ${editable})`
    );
  }
});

// --- formatLive ---

test("formatLive: typing 5 into empty field", () => {
  const { formatted, newCaret, stored } = formatLive("5", 1, "5");
  assert.equal(formatted, "5");
  assert.equal(stored, "5");
  assert.equal(newCaret, 1);
});

test("formatLive: typing 12345 gains thousands separator, caret at end", () => {
  // Simulates the state after typing '5' when field already shows "1.234"
  // Browser gives raw="1.2345", caretPos=6
  const { formatted, newCaret, stored } = formatLive("1.2345", 6, "5");
  assert.equal(stored, "12345");
  assert.equal(formatted, "12.345");
  assert.equal(newCaret, 6); // end of "12.345"
});

test("formatLive: inserting digit before existing thousands dot", () => {
  // Field shows "12.345", caret at 2 (after '2'), user types '0' → "120.345", caretPos=3
  const { formatted, newCaret, stored } = formatLive("120.345", 3, "0");
  assert.equal(stored, "120345");
  assert.equal(formatted, "120.345");
  assert.equal(newCaret, 3); // after '0', before '.'
});

test("formatLive: inserting digit in the middle shifts thousands dot", () => {
  // Field shows "1.234", caret at 2 (after '1', before '.'), user types '5' → "1.5234", caretPos=3
  const { formatted, newCaret, stored } = formatLive("1.5234", 3, "5");
  assert.equal(stored, "15234");
  assert.equal(formatted, "15.234");
  assert.equal(newCaret, 2); // after '5' in "15.234"
});

test("formatLive: backspace at end removes last digit", () => {
  // Field shows "1.234", backspace → "1.23", caretPos=4
  const { formatted, newCaret, stored } = formatLive("1.23", 4, null, "deleteContentBackward");
  assert.equal(stored, "123");
  assert.equal(formatted, "123");
  assert.equal(newCaret, 3); // end of "123"
});

test("formatLive: typing '.' converts to decimal comma", () => {
  // Field shows "1.234", user types '.' at end → raw="1.234.", caretPos=6
  // formatLive converts the newly typed '.' to ','
  const { formatted, stored } = formatLive("1.234.", 6, ".");
  assert.equal(stored, "1234.");
  assert.equal(formatted, "1.234,");
});

test("formatLive: negative number caret preserved", () => {
  // Field shows "-1.234", caret at end (6), user types '5' → "-1.2345", caretPos=7
  const { formatted, newCaret, stored } = formatLive("-1.2345", 7, "5");
  assert.equal(stored, "-12345");
  assert.equal(formatted, "-12.345");
  assert.equal(newCaret, 7); // end of "-12.345"
});

test("formatLive: paste falls back to locale-aware parse", () => {
  // Paste "1234.56" (US format) — dots are NOT all grouping
  const { formatted, stored } = formatLive("1234.56", 7, null, "insertFromPaste");
  assert.equal(stored, "1234.56");
  assert.equal(formatted, "1.234,56");
});
