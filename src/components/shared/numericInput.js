/**
 * Numeric input helpers for AddRowModal number fields.
 *
 * Two representations:
 * - stored:  JS-parseable string ("-1234.56") kept in form state, fed to Number()
 * - display: ca-ES formatted string ("-1.234,56") shown in the field at all times,
 *            with thousand separators appearing live while typing
 *
 * Live formatting is safe because dots in the field can only come from the
 * formatter itself, so when re-parsing an edit they are ALWAYS grouping
 * separators. A freshly typed "." (detected via InputEvent.data) is decimal
 * intent and becomes a comma; pasted text goes through the locale heuristic.
 * The old code re-parsed its own formatted output with a single-dot-is-decimal
 * rule, which corrupted amounts: typing 50000 stored 5, 12345 stored 1.2345.
 */

/**
 * Normalizes a user-typed number into a JS-parseable string:
 * - supports optional leading "-" (or parentheses for negatives)
 * - supports "." or "," as decimal separator
 * - a single dot followed by exactly 3 digits (with 1-3 digits before it) is
 *   treated as a thousands separator, matching the ca-ES display convention
 *   ("1.234" → 1234). Use a comma for decimals ("1,234" → 1.234).
 * - strips grouping separators (".", ",", spaces, apostrophes)
 *
 * Returned value is:
 * - "" (empty) for empty/invalid input
 * - "-" while user is mid-typing a negative number
 * - otherwise a string like "-1234.56" or "1234"
 */
export function normalizeNumericInput(raw) {
  const input = String(raw ?? "");
  const trimmed = input.trim();
  if (!trimmed) return "";

  const parenNegative = trimmed.startsWith("(") && trimmed.endsWith(")");
  const sign = (parenNegative || trimmed.startsWith("-")) ? "-" : "";

  // Keep digits and separators only
  const cleaned = trimmed
    .replace(/[()]/g, "")
    .replace(/\s+/g, "")
    .replace(/[^0-9.,']/g, "")
    .replace(/'/g, "");

  // Allow mid-typing a negative sign without digits yet
  if (sign === "-" && cleaned === "") return "-";

  const dotCount = (cleaned.match(/\./g) ?? []).length;
  const lastDot = cleaned.lastIndexOf(".");
  const lastComma = cleaned.lastIndexOf(",");

  let intPart, fracPart, hasDecimal;

  if (lastComma !== -1) {
    // Comma present → comma is decimal separator, all dots are thousand separators
    intPart = cleaned.slice(0, lastComma).replace(/\./g, "");
    fracPart = cleaned.slice(lastComma + 1).replace(/[^\d]/g, "");
    hasDecimal = true;
  } else if (dotCount > 1) {
    // Multiple dots, no comma → all dots are thousand separators (European style)
    // A trailing dot means the user is about to type a decimal part
    intPart = cleaned.replace(/\./g, "");
    fracPart = "";
    hasDecimal = cleaned.endsWith(".");
  } else if (lastDot !== -1) {
    const before = cleaned.slice(0, lastDot);
    const after = cleaned.slice(lastDot + 1);
    if (/^\d{1,3}$/.test(before) && /^\d{3}$/.test(after)) {
      // "1.234" / "12.345" → grouping dot (ca-ES); decimals use a comma here
      intPart = before + after;
      fracPart = "";
      hasDecimal = false;
    } else {
      // "1.2", "1234.56" → dot is the decimal separator
      intPart = before;
      fracPart = after.replace(/[^\d]/g, "");
      hasDecimal = true;
    }
  } else {
    intPart = cleaned;
    fracPart = "";
    hasDecimal = false;
  }

  intPart = intPart.replace(/[^\d]/g, "");
  if (!intPart && !fracPart) return sign ? "-" : "";

  return hasDecimal ? `${sign}${intPart || "0"}.${fracPart}` : `${sign}${intPart}`;
}

/**
 * Formats a stored normalized string for display when the field is not focused.
 * "1234.56" → "1.234,56" (ca-ES grouping). Mid-typing artifacts ("-", trailing
 * dot) pass through unchanged.
 */
export function formatDisplayValue(normalized) {
  if (!normalized || normalized === "-") return normalized ?? "";
  const str = String(normalized);
  const hasTrailingDot = str.endsWith(".");
  const base = hasTrailingDot ? str.slice(0, -1) : str;
  const num = Number(base);
  if (!isFinite(num)) return str;
  const dotIdx = base.indexOf(".");
  const fracDigits = dotIdx >= 0 ? base.length - dotIdx - 1 : 0;
  const formatted = num.toLocaleString("ca-ES", {
    minimumFractionDigits: fracDigits,
    maximumFractionDigits: fracDigits,
  });
  return hasTrailingDot ? formatted + "," : formatted;
}

/**
 * Converts a stored value into a plain editable string (no grouping separators,
 * comma as decimal). Kept for backwards compatibility; AddRowModal now uses
 * formatLive for live-formatted inputs.
 */
export function toEditableValue(stored) {
  const str = String(stored ?? "");
  if (!str || str === "-") return str;
  return str.replace(".", ",");
}

/**
 * Formats a live-typed field value and computes the new caret position.
 * Call this in an input's onChange handler. All dots in a live-formatted field
 * are grouping separators (inserted only by the formatter); a freshly typed "."
 * is treated as decimal intent and converted to ",". Pasted content falls back
 * to the locale-aware heuristic in normalizeNumericInput.
 *
 * @param {string} raw - field content after the keystroke (e.target.value)
 * @param {number} caretPos - caret position in raw (e.target.selectionStart)
 * @param {string|null} inputData - the character typed (e.nativeEvent.data), or null
 * @param {string|null} inputType - the input type (e.nativeEvent.inputType), or null
 * @returns {{ formatted: string, newCaret: number, stored: string }}
 */
export function formatLive(raw, caretPos, inputData = null, inputType = null) {
  // Pasted content: can't treat all dots as grouping, use locale-aware parse
  if (inputType === "insertFromPaste") {
    const stored = normalizeNumericInput(raw);
    const formatted = formatDisplayValue(stored);
    return { formatted, newCaret: formatted.length, stored };
  }

  let adjusted = raw;

  // User typed '.': convert to ',' (decimal intent in ca-ES locale)
  if (inputData === "." && caretPos > 0 && adjusted[caretPos - 1] === ".") {
    adjusted = adjusted.slice(0, caretPos - 1) + "," + adjusted.slice(caretPos);
  }

  // Count significant chars (digits, commas, leading minus) strictly before caret.
  // Grouping dots are NOT significant and don't affect caret math.
  let sigCount = 0;
  const capPos = Math.min(caretPos, adjusted.length);
  for (let i = 0; i < capPos; i++) {
    const ch = adjusted[i];
    if (/\d/.test(ch) || ch === "," || ch === "-") sigCount++;
  }

  // All remaining dots are grouping separators — strip them
  const stripped = adjusted.replace(/\./g, "");
  const stored = normalizeNumericInput(stripped);
  const formatted = formatDisplayValue(stored);

  // Find position in formatted after exactly sigCount significant chars have passed
  let sig = 0;
  let newCaret = formatted.length;
  for (let i = 0; i < formatted.length; i++) {
    if (sig >= sigCount) { newCaret = i; break; }
    const ch = formatted[i];
    if (/\d/.test(ch) || ch === "," || ch === "-") sig++;
  }

  return { formatted, newCaret, stored };
}
