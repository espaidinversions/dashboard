// Single source of truth for Public Markets return-value normalization.
//
// rend${year} fields are stored in MIXED conventions across the source sheets:
//   - ETF / Espai sheet stores direct percent   (34.24  => 34.24%)
//   - Master / IB sheets store decimal fractions (0.199  => 19.9%)
// rendInici is ALWAYS percent form.
// WAM / Andbank positions are ALWAYS percent form.
//
// Every display and aggregation site MUST route rend values through here so the
// same holding never shows two different numbers on two different screens.
//
// The transform is idempotent for values already in percent form (|v| > 0.5 is
// left untouched), so it is safe to apply repeatedly and to stored overrides.

// Returns whose absolute value exceeds this are treated as data-entry errors.
export const REND_MAX_ABS_PCT = 150;

// Values at or below this magnitude are interpreted as decimal fractions.
const DECIMAL_FRACTION_CUTOFF = 0.5;

/**
 * @param {{ custodian?: string }} [pos]
 * @returns {boolean} true when the position's returns are always in percent form
 */
export function isPercentFormPosition(pos) {
  const custodian = String(pos?.custodian ?? "").trim().toLowerCase();
  return custodian === "andbank" || custodian === "wam";
}

/**
 * Normalize a raw rend value to percent form (e.g. 19.9 meaning 19.9%).
 * @param {number|null|undefined} value
 * @param {{ alwaysPercent?: boolean, onOutlier?: (v: number) => void }} [opts]
 * @returns {number|null} percent value, or null when missing / an outlier
 */
export function rendToPercent(value, { alwaysPercent = false, onOutlier } = {}) {
  if (value == null) return null;
  const v = Number(value);
  if (!Number.isFinite(v)) return null;
  if (alwaysPercent) return v;
  if (Math.abs(v) > REND_MAX_ABS_PCT) {
    if (onOutlier) onOutlier(v);
    return null;
  }
  return Math.abs(v) > DECIMAL_FRACTION_CUTOFF ? v : v * 100;
}

/**
 * Normalize a position's return field to percent form.
 * @param {Record<string, any>} pos
 * @param {string} field  e.g. "rend2025" or "rendInici"
 * @param {{ onOutlier?: (v: number, pos: any, field: string) => void }} [opts]
 * @returns {number|null}
 */
export function rendPct(pos, field, opts = {}) {
  const alwaysPercent = field === "rendInici" || isPercentFormPosition(pos);
  return rendToPercent(pos?.[field], {
    alwaysPercent,
    onOutlier: opts.onOutlier ? (v) => opts.onOutlier(v, pos, field) : undefined,
  });
}
