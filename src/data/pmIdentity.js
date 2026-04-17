/** @typedef {import("./publicMarketsTypes.js").PMRawWorkbookPosition} PMRawWorkbookPosition */

export function normalizeIsin(value) {
  const raw = String(value ?? "").trim().toUpperCase();
  const match = raw.match(/([A-Z]{2}[A-Z0-9]{10})/);
  return match ? match[1] : raw || null;
}

export function mergeDefinedRow(prev, next) {
  const merged = { ...(prev ?? {}) };
  for (const [key, value] of Object.entries(next ?? {})) {
    if (value === undefined || value === null || value === "") continue;
    merged[key] = value;
  }
  return merged;
}

/**
 * @param {PMRawWorkbookPosition | { isin?: string | null, custodian?: string | null, dataCompra?: string | null, startDate?: string | null, unitats?: number | null, n_titols?: number | null }} row
 * @returns {string | null}
 */
export function rowDedupeKey(row) {
  const isin = normalizeIsin(row?.isin);
  if (!isin) return null;
  return [
    isin,
    String(row?.custodian ?? "").trim(),
    String(row?.dataCompra ?? row?.startDate ?? "").slice(0, 10),
    Number(row?.unitats ?? row?.n_titols ?? 0).toFixed(6),
  ].join("||");
}

/**
 * @param {PMRawWorkbookPosition[]} rows
 * @returns {PMRawWorkbookPosition[]}
 */
export function dedupeRows(rows) {
  const map = new Map();
  for (const row of rows ?? []) {
    const key = rowDedupeKey(row);
    if (!key) continue;
    const prev = map.get(key) ?? {};
    map.set(key, mergeDefinedRow(prev, { ...row, isin: normalizeIsin(row?.isin) }));
  }
  return [...map.values()];
}

/**
 * @param {PMRawWorkbookPosition[][]} sources
 * @returns {PMRawWorkbookPosition[]}
 */
export function mergeRawRows(...sources) {
  const map = new Map();
  for (const source of sources) {
    for (const row of source ?? []) {
      const key = rowDedupeKey(row);
      if (!key) continue;
      const prev = map.get(key) ?? {};
      map.set(key, mergeDefinedRow(prev, { ...row, isin: normalizeIsin(row?.isin) }));
    }
  }
  return [...map.values()];
}

/**
 * @param {PMRawWorkbookPosition | { isin?: string | null, custodian?: string | null }} row
 * @returns {string}
 */
export function broadRowKey(row) {
  return `${normalizeIsin(row?.isin) ?? ""}||${String(row?.custodian ?? "").trim()}`;
}
