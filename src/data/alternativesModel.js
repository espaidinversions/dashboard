import { slugify } from "../utils.js";

export function buildPrivateSyntheticRows(rows, { vehicleTipus, include, fons, tipus, est }) {
  const source = Array.isArray(rows) ? rows : [];
  const tx = [];
  const compr = [];

  source.forEach((row) => {
    if (include && !include(row)) return;
    const date = String(row?.dataCompr ?? "").slice(0, 10);
    const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const eur = Number(row?.ticket ?? 0);
    if (!match || !Number.isFinite(eur) || eur <= 0) return;

    const any = Number(match[1]);
    const mes = Number(match[2]);
    const fundName = fons(row);
    const rowEst = est ? est(row) : null;
    const base = {
      _synthetic: true,
      _rowId: null,
      id: row?.id ?? slugify(`${vehicleTipus}-${fundName}`),
      fons: fundName,
      data: date,
      any,
      mes,
      fy: `FY ${any}`,
      divisa: "EUR",
      vehicleTipus,
      est: rowEst ?? null,
      tipus: tipus ? tipus(row) : "Aportació",
      eur,
    };

    compr.push({ ...base, cat: "Compromís" });
    tx.push({ ...base, cat: "Capital Call" });
  });

  return { tx, compr };
}

export function mergePrivateRows(actualRows, syntheticRows) {
  const actual = Array.isArray(actualRows) ? actualRows : [];
  const synthetic = Array.isArray(syntheticRows) ? syntheticRows : [];
  const exactKeys = new Set(actual.map((row) => `${row.fons}|${row.data}|${row.cat}|${row.eur}|${row.vehicleTipus}`));
  const coarseKeys = new Set(actual.map((row) => `${row.fons}|${row.data}|${row.cat}|${row.vehicleTipus}`));
  return [
    ...actual,
    ...synthetic.filter((row) => {
      const exactKey = `${row.fons}|${row.data}|${row.cat}|${row.eur}|${row.vehicleTipus}`;
      if (exactKeys.has(exactKey)) return false;
      // Synthetic rows are approximations. If a real row already exists for the
      // same fund/date/category bucket, prefer the real row even if the amount
      // differs slightly due to rounding or source precision.
      const coarseKey = `${row.fons}|${row.data}|${row.cat}|${row.vehicleTipus}`;
      return !coarseKeys.has(coarseKey);
    }),
  ];
}

const PRIVATE_TX_NAME_ALIASES = {
  "a ponent spv": "A Ponent",
  "alfavet seqos aurica spv": "Alfavet",
  "essentialist": "Essentialist",
  "hotek": "Hotek",
  "irmarfer": "Irmafer",
  "itaca capital partners": "Ítaca",
  "omega project": "Greenfarm",
  "panart group": "Baluard",
};

function normalizePrivateName(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[().,/-]/g, " ")
    .replace(/\b(s\.?l\.?|srl|ltd|limited|b\.?v\.?|lp|l\.p\.|sa|scr|sicc|slp)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildNameVariants(value) {
  const raw = String(value ?? "").trim();
  const variants = new Set();
  const push = (item) => {
    const normalized = normalizePrivateName(item);
    if (normalized) variants.add(normalized);
  };
  push(raw);
  const paren = [...raw.matchAll(/\(([^)]+)\)/g)].map((match) => match[1]);
  paren.forEach(push);
  push(raw.replace(/\([^)]*\)/g, " "));
  return [...variants];
}

function matchPrivateTxName(rawName, searchers, companies) {
  const searcherMap = new Map();
  const companyMap = new Map();
  const register = (map, name) => buildNameVariants(name).forEach((variant) => {
    if (!map.has(variant)) map.set(variant, name);
  });
  (Array.isArray(searchers) ? searchers : []).forEach((row) => register(searcherMap, row?.nom));
  (Array.isArray(companies) ? companies : []).forEach((row) => register(companyMap, row?.nom));

  const variants = buildNameVariants(rawName);
  for (const variant of variants) {
    const aliased = PRIVATE_TX_NAME_ALIASES[variant];
    if (aliased) {
      if (searcherMap.has(normalizePrivateName(aliased))) return { fons: aliased, vehicleTipus: "SF" };
      if (companyMap.has(normalizePrivateName(aliased))) return { fons: aliased, vehicleTipus: "PC" };
    }
    if (searcherMap.has(variant)) return { fons: searcherMap.get(variant), vehicleTipus: "SF" };
    if (companyMap.has(variant)) return { fons: companyMap.get(variant), vehicleTipus: "PC" };
  }

  const longestContains = (map) => {
    let winner = null;
    for (const [variant, canonical] of map.entries()) {
      if (!variant || variant.length < 4) continue;
      if (variants.some((candidate) => candidate.includes(variant) || variant.includes(candidate))) {
        if (!winner || variant.length > winner.variant.length) winner = { variant, canonical };
      }
    }
    return winner?.canonical ?? null;
  };

  const searcherHit = longestContains(searcherMap);
  if (searcherHit) return { fons: searcherHit, vehicleTipus: "SF" };
  const companyHit = longestContains(companyMap);
  if (companyHit) return { fons: companyHit, vehicleTipus: "PC" };
  return null;
}

export function normalizePrivateWorkbookRows(rows, searchers, companies) {
  return (Array.isArray(rows) ? rows : []).map((row) => {
    const match = matchPrivateTxName(row?.fons, searchers, companies);
    return match ? { ...row, fons: match.fons, vehicleTipus: match.vehicleTipus, est: null } : row;
  });
}
