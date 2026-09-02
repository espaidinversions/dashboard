// ── Duplicate detection ─────────────────────────────────────
const DEDUPE_STOPWORDS = new Set([
  "a","an","and","capital","partner","partners","fund","funds","invest","investment","investments",
  "holding","holdings","group","global","private","equity","program","class","corporation","corp",
  "company","companies","limited","ltd","llp","llc","lp","sl","slp","srl","sa","spa","scra","scr",
  "scsp","sicav","raif","fcr","fcre","ficc","u","ua",
]);

function stripDiacritics(s) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function dedupeKey(name) {
  return stripDiacritics(name)
    .toLowerCase()
    .replace(/co[\s-]?inv(?:est(?:ment)?)?/g, "coinvest")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(t => t && !DEDUPE_STOPWORDS.has(t))
    .sort()
    .join(" ");
}

export function isMockId(id) {
  return String(id).startsWith("MOCKNIF:");
}

export const KIND_LABELS = { company: "Empresa", vehicle: "Vehicle" };
export const MATCH_COLORS = {
  manual:      { bg: "#E8EAF6", color: "#1A237E" },
  normalized:  { bg: "#E8F5E9", color: "#1B5E20" },
  workbook_id: { bg: "#FFF8E1", color: "#E65100" },
  fallback:    { bg: "#FFEBEE", color: "#B71C1C" },
};
