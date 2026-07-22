import { PRIVATE_ENTITIES_WORKBOOK } from "../generated/dashboard/privateEntitiesWorkbook.js";

const ENTITY_ID_PREFIX = {
  company: "MOCKNIF:COMPANY:",
  vehicle: "MOCKNIF:VEHICLE:",
};


const EXACT_MATCH_STOPWORDS = new Set([
  "sl",
  "srl",
  "ltd",
  "lp",
  "llp",
  "llc",
  "sa",
  "scr",
  "scsp",
  "sicav",
  "raif",
  "fcr",
  "fcre",
  "ficc",
  "ua",
]);

const MANUAL_PRIVATE_ENTITY_ID_BY_NAME = {
  "seedrocket 4founders": "V01799568",
  "adams street asp lux raif global secondary fund 7": "LUXB230846",
  "altamar x": "V88060843",
  "altamar x midmarket": "V88361027",
  "arcano earth": "A88609060",
  "arcano earth ii 2021 scr": "A16743569",
  "arcano pe secondaries 2024 scr": "A19792845",
  "arcano xii": "V88239660",
  "aurica growth fund capital iv": "V16732752",
  "aurica search fund": "A44662351",
  "capital dynamics mid market direct v": "LUXB145913",
  "cs climate innovation fund": "LUXB230684",
  "cs seasons global": "LUXB230623",
  "ebn pre ipo us ii": "V88491808",
  "ebn pre ipo us iii": "V05299128",
  "frontenac xiii parallel": "USA000187",
  "galdana asia": "LUX33463685",
  "galdana iii fcr": "V05376298",
  "invivo ventures iii parallel fund fcre": "V56509813",
  "jp morgan vintage 2018": "V88140660",
  "jp morgan vintage 2020": "V88545793",
  "jp morgan vintage 2022": "V67917724",
  "magnum capital iv": "LUXN0324347D",
  "naxicap investment opportunities iii": "FRA1491827022",
  "pictet coinvest iv": "LUX0000003",
  "pictet monte rosa coinvest v": "LUX0000002",
  "pictet monte rosa vi fcr": "LUX0000005",
  "pictet tech": "LUX0000006",
  "qualitas funds direct ii a scr": "A56502883",
  "samaipata ii": "V88350335",
  "seedrocket 4 founders": "V01799568",
  "arcblue": "A06876742",
  "itaca": "A02769602",
  "itaca acquisition partners": "A02769602",
  "greenfarm": "B09745837",
  "the extension fund scr pyme": "A02882843",
  "umai": "B01755917",
  "veritas ix": "LUXN0309067G",
};

const FORCE_FALLBACK_PRIVATE_ENTITY_NAMES = new Set([
  "main foundation iii cooperatief u a",
]);

function stripDiacritics(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalizePrivateEntityName(value) {
  return stripDiacritics(value)
    .toLowerCase()
    .replace(/co[\s-]?inv(?:est(?:ment)?)?/g, "coinvest")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}


function normalizedMatchKey(value) {
  const tokens = normalizePrivateEntityName(value)
    .split(/\s+/)
    .filter((token) => token && !EXACT_MATCH_STOPWORDS.has(token));
  return tokens.join(" ");
}

const WORKBOOK_BY_ID = new Map(
  PRIVATE_ENTITIES_WORKBOOK.map((row) => [row.id, row]),
);

const WORKBOOK_BY_NORMALIZED_NAME = new Map();
const WORKBOOK_NORMALIZED_ROWS = PRIVATE_ENTITIES_WORKBOOK.map((row) => ({
  ...row,
  normalizedName: normalizedMatchKey(row.workbookName),
}));

for (const row of WORKBOOK_NORMALIZED_ROWS) {
  if (!WORKBOOK_BY_NORMALIZED_NAME.has(row.normalizedName)) {
    WORKBOOK_BY_NORMALIZED_NAME.set(row.normalizedName, row);
  }
}

function fallbackPrivateEntityId(kind, name) {
  const prefix = ENTITY_ID_PREFIX[kind] ?? "ENTITY:";
  const normalized = normalizePrivateEntityName(name).replace(/\s+/g, "-").toUpperCase();
  return `${prefix}${normalized || "UNNAMED"}`;
}

function workbookMetadata(row) {
  if (!row) {
    return {
      workbookName: null,
      isin: null,
      country: null,
      firstInvestmentDate: null,
    };
  }
  return {
    workbookName: row.workbookName ?? null,
    isin: row.isin ?? null,
    country: row.country ?? null,
    firstInvestmentDate: row.firstInvestmentDate ?? null,
  };
}

function resolveWorkbookMatch(name) {
  const normalizedName = normalizePrivateEntityName(name);
  if (FORCE_FALLBACK_PRIVATE_ENTITY_NAMES.has(normalizedName)) {
    return null;
  }
  const manualId = MANUAL_PRIVATE_ENTITY_ID_BY_NAME[normalizedName];
  if (manualId && WORKBOOK_BY_ID.has(manualId)) {
    return { ...WORKBOOK_BY_ID.get(manualId), matchType: "manual" };
  }

  const normalizedMatch = WORKBOOK_BY_NORMALIZED_NAME.get(normalizedMatchKey(name));
  if (normalizedMatch) {
    return { ...normalizedMatch, matchType: "normalized" };
  }

  return null;
}

export function resolvePrivateEntity(kind, name, existingId = null) {
  const trimmedName = String(name ?? "").trim();
  if (!trimmedName) return null;

  if (existingId) {
    const workbookRow = WORKBOOK_BY_ID.get(existingId);
    return {
      id: existingId,
      kind,
      canonicalName: trimmedName,
      sourceName: trimmedName,
      ...workbookMetadata(workbookRow),
      matchType: workbookRow ? "workbook_id" : "local",
      active: true,
      notes: null,
    };
  }

  const workbookMatch = resolveWorkbookMatch(trimmedName);
  if (workbookMatch) {
    return {
      id: workbookMatch.id,
      kind,
      canonicalName: trimmedName,
      sourceName: trimmedName,
      ...workbookMetadata(workbookMatch),
      matchType: workbookMatch.matchType,
      active: true,
      notes: null,
    };
  }

  return {
    id: fallbackPrivateEntityId(kind, trimmedName),
    kind,
    canonicalName: trimmedName,
    sourceName: trimmedName,
    ...workbookMetadata(null),
    matchType: "fallback",
    active: true,
    notes: null,
  };
}

export function buildPrivateEntitiesFromDashboardBundle({ companies = [], rawCC = [], fundMeta = [] } = {}) {
  const rows = new Map();
  for (const company of companies) {
    const resolved = resolvePrivateEntity("company", company.nom, company.id ?? company.entityId ?? null);
    if (resolved) rows.set(resolved.id, resolved);
  }
  for (const row of rawCC) {
    const resolved = resolvePrivateEntity("vehicle", row.fons, row.id ?? row.vehicleId ?? null);
    if (resolved) rows.set(resolved.id, resolved);
  }
  for (const row of fundMeta) {
    const resolved = resolvePrivateEntity("vehicle", row.fons, row.id ?? row.vehicleId ?? null);
    if (resolved) rows.set(resolved.id, resolved);
  }
  return [...rows.values()].sort((a, b) => a.canonicalName.localeCompare(b.canonicalName));
}

export function getPrivateEntityName(entityMap, entityId, fallbackName) {
  return entityMap.get(entityId)?.canonical_name
    ?? entityMap.get(entityId)?.canonicalName
    ?? fallbackName;
}
