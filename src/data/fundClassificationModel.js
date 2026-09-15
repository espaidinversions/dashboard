// Pure logic for the fund one-pager Classificació editor. Kept UI-free and
// theme-free so it can be unit-tested with node:test. The modal
// (FundClassificationEditModal) and the save path (db/funds.saveFundClassification)
// consume these helpers; nothing here touches React or Supabase.
//
// Weight maps are stored as jsonb fractions 0–1 summing to 1.0 (matching
// geography/sector/strategy). The editor works in whole percentages and
// converts on the boundary.

// The eight vehicle classes (Classe). Mirrors config.js EST_CFG keys; kept as a
// plain list here so the model stays import-light and testable.
export const CLASSE_OPTIONS = [
  "Fons Primari",
  "Fons Secundari",
  "Fons de Fons",
  "Fons de Coinversió",
  "Search Fund - Cerca",
  "Search Fund - Participada",
  "Participada (Altres)",
  "Fons Real Estate",
];

// Per-dimension known category vocabularies (dropdown seed; users may free-add).
// "Sense classificar" is intentionally excluded — it is a display-only residual
// bucket, not something you'd manually assign a weight to.
export const ALLOCATION_OPTIONS = ["Fons de Fons", "Fons Primari", "Fons Secundari", "Fons de Coinversió"];
export const GEOGRAFIA_OPTIONS = ["Nord America", "Nord d'Europa", "Sud d'Europa", "Asia", "LatAm"];
export const VERTICAL_OPTIONS = [
  "Tecnologia", "Consum", "Salut", "Industrials / Materials", "Energy",
  "Telecoms", "Finance", "Food & Agriculture", "Serveis", "Real Estate & Infraestructure",
];
export const TIPUS_FONS_OPTIONS = ["Small Buyout", "Mid Buyout", "Large Buyout", "Growth", "VC", "Turnaround", "Real Estate & Infraestructure"];

// Drives the weight-map sections of the editor, in display order. `key` matches
// both the fund_meta column and the buildFundDetailSnapshot field.
export const CLASSIFICATION_DIMENSIONS = [
  { key: "allocation", label: "Al·locació", options: ALLOCATION_OPTIONS },
  { key: "geography", label: "Geografia", options: GEOGRAFIA_OPTIONS },
  { key: "sector", label: "Vertical", options: VERTICAL_OPTIONS },
  { key: "strategy", label: "Tipus fons", options: TIPUS_FONS_OPTIONS },
];

/**
 * Stored fraction map → editor rows (whole %), sorted descending.
 * @param {Record<string, number> | null | undefined} map
 * @returns {{ categoria: string, pct: number }[]}
 */
export function mapToRows(map) {
  if (!map || typeof map !== "object") return [];
  return Object.entries(map)
    .map(([categoria, value]) => ({ categoria, pct: Math.round(Number(value) * 100) }))
    .filter((row) => row.categoria && Number.isFinite(row.pct))
    .sort((a, b) => b.pct - a.pct);
}

/**
 * Editor rows (whole %) → stored fraction map, or null when empty. Rows without
 * a category name or with a non-positive % are dropped. Assumes validation has
 * already rejected duplicates and non-100 totals.
 * @param {{ categoria: string, pct: number | string }[]} rows
 * @returns {Record<string, number> | null}
 */
export function rowsToMap(rows) {
  const out = {};
  for (const row of rows ?? []) {
    const key = String(row?.categoria ?? "").trim();
    const pct = Number(row?.pct);
    if (!key || !Number.isFinite(pct) || pct <= 0) continue;
    out[key] = pct / 100;
  }
  return Object.keys(out).length === 0 ? null : out;
}

/**
 * Validate one dimension's rows. A dimension with no named rows is valid and
 * clears the map. Otherwise every named row needs a positive %, no duplicate
 * categories, and the total must be exactly 100%.
 * @param {{ categoria: string, pct: number | string }[]} rows
 * @returns {{ ok: boolean, total: number, empty: boolean, error: string | null }}
 */
export function validateDimension(rows) {
  const named = (rows ?? [])
    .map((row) => ({ categoria: String(row?.categoria ?? "").trim(), pct: Number(row?.pct) }))
    .filter((row) => row.categoria !== "");

  if (named.length === 0) return { ok: true, total: 0, empty: true, error: null };

  const seen = new Set();
  for (const row of named) {
    if (seen.has(row.categoria)) {
      return { ok: false, total: 0, empty: false, error: `Categoria duplicada: ${row.categoria}` };
    }
    seen.add(row.categoria);
    if (!Number.isFinite(row.pct) || row.pct <= 0) {
      return { ok: false, total: 0, empty: false, error: `Introdueix un % vàlid per a "${row.categoria}"` };
    }
  }

  const total = named.reduce((sum, row) => sum + row.pct, 0);
  if (Math.round(total) !== 100) {
    return { ok: false, total, empty: false, error: `Ha de sumar 100% (actual: ${Math.round(total)}%)` };
  }
  return { ok: true, total, empty: false, error: null };
}
