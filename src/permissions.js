export const ACCESS_NONE = "none";
export const ACCESS_USER = "user";
export const ACCESS_SUPERUSER = "superuser";

export const ACCESS_LEVELS = [ACCESS_NONE, ACCESS_USER, ACCESS_SUPERUSER];
const GLOBAL_ROLES = ["user", "superuser", "admin"];

export const TOP_LEVEL_SECTION_IDS = ["alternatives", "real-estate", "mercats-publics"];
export const ALTERNATIVES_SECTION_IDS = ["fons", "searchers", "companies", "inversions", "cash-model", "txlog"];
export const REAL_ESTATE_SUBSECTION_IDS = ["re-directe", "re-altres"];
export const PUBLIC_MARKETS_SUBSECTION_IDS = [
  "mp-resum",
  "mp-rv",
  "mp-rf",
  "mp-posicions",
  "mp-transaccions",
  "mp-traçabilitat",
];
export const TRANSACTION_SUBSECTION_IDS = ["tx-alt", "tx-re", "tx-mp"];
const ALL_SECTION_IDS = [
  ...TOP_LEVEL_SECTION_IDS,
  ...ALTERNATIVES_SECTION_IDS,
  ...REAL_ESTATE_SUBSECTION_IDS,
  ...PUBLIC_MARKETS_SUBSECTION_IDS,
  ...TRANSACTION_SUBSECTION_IDS,
];

const PARENT_BY_SECTION = {
  fons: "alternatives",
  searchers: "alternatives",
  companies: "alternatives",
  inversions: "alternatives",
  "cash-model": "alternatives",
  txlog: "alternatives",
  "re-directe": "real-estate",
  "re-altres": "real-estate",
  "mp-resum": "mercats-publics",
  "mp-rv": "mercats-publics",
  "mp-rf": "mercats-publics",
  "mp-posicions": "mercats-publics",
  "mp-transaccions": "mercats-publics",
  "mp-traçabilitat": "mercats-publics",
};
const LEVEL_RANK = {
  [ACCESS_NONE]: 0,
  [ACCESS_USER]: 1,
  [ACCESS_SUPERUSER]: 2,
};

function normalizeAccessLevel(value, fallback = ACCESS_NONE) {
  return ACCESS_LEVELS.includes(value) ? value : fallback;
}

export function isAdminRole(role) {
  return role === "admin";
}

export function isLegacySuperuserRole(role) {
  return role === "superuser";
}

function normalizeSectionId(sectionId) {
  if (sectionId === "transaccions") return "txlog";
  if (sectionId === "posicions") return "inversions";
  if (sectionId === "directe") return "re-directe";
  if (sectionId === "altres-vehicles") return "re-altres";
  if (sectionId === "resum") return "mp-resum";
  if (sectionId === "rv") return "mp-rv";
  if (sectionId === "rf") return "mp-rf";
  if (sectionId === "traçabilitat") return "mp-traçabilitat";
  return sectionId;
}

function getParentSectionId(sectionId) {
  const normalized = normalizeSectionId(sectionId);
  return PARENT_BY_SECTION[normalized] ?? normalized;
}

export function getVehiclePermissionSection(row) {
  return row?.vcpe === "RE" ? "real-estate" : "alternatives";
}

export function buildSectionAccessMap({ role, sectionRoles, deniedSections } = {}) {
  const baseLevel = isAdminRole(role)
    ? ACCESS_SUPERUSER
    : isLegacySuperuserRole(role)
      ? ACCESS_SUPERUSER
      : ACCESS_USER;

  const access = Object.fromEntries(ALL_SECTION_IDS.map((sectionId) => [sectionId, baseLevel]));

  for (const [sectionIdRaw, levelRaw] of Object.entries(sectionRoles ?? {})) {
    const sectionId = normalizeSectionId(sectionIdRaw);
    if (!ALL_SECTION_IDS.includes(sectionId)) continue;
    access[sectionId] = normalizeAccessLevel(levelRaw, access[sectionId]);
  }

  for (const sectionIdRaw of Array.isArray(deniedSections) ? deniedSections : []) {
    const sectionId = normalizeSectionId(sectionIdRaw);
    if (!ALL_SECTION_IDS.includes(sectionId)) continue;
    access[sectionId] = ACCESS_NONE;
  }

  if (access.alternatives === ACCESS_NONE) {
    [...ALTERNATIVES_SECTION_IDS, "tx-alt"].forEach((sectionId) => {
      access[sectionId] = ACCESS_NONE;
    });
  }
  if (access["real-estate"] === ACCESS_NONE) {
    [...REAL_ESTATE_SUBSECTION_IDS, "tx-re"].forEach((sectionId) => {
      access[sectionId] = ACCESS_NONE;
    });
  }
  if (access["mercats-publics"] === ACCESS_NONE) {
    [...PUBLIC_MARKETS_SUBSECTION_IDS, "tx-mp"].forEach((sectionId) => {
      access[sectionId] = ACCESS_NONE;
    });
  }

  return access;
}

export function getSectionAccessLevel(accessMap, sectionId) {
  const normalized = normalizeSectionId(sectionId);
  const direct = normalizeAccessLevel(accessMap?.[normalized], ACCESS_NONE);
  const parentId = getParentSectionId(normalized);
  if (parentId === normalized) return direct;
  const parent = normalizeAccessLevel(accessMap?.[parentId], ACCESS_NONE);
  return LEVEL_RANK[parent] < LEVEL_RANK[direct] ? parent : direct;
}

export function hasSectionAccess(accessMap, sectionId, requiredLevel = ACCESS_USER) {
  return LEVEL_RANK[getSectionAccessLevel(accessMap, sectionId)] >= LEVEL_RANK[requiredLevel];
}

export function canAccessAnySection(accessMap, sectionIds, requiredLevel = ACCESS_USER) {
  return (Array.isArray(sectionIds) ? sectionIds : []).some((sectionId) =>
    hasSectionAccess(accessMap, sectionId, requiredLevel),
  );
}

export function sectionAccessMapToDeniedSections(accessMap) {
  return ALL_SECTION_IDS.filter((sectionId) => getSectionAccessLevel(accessMap, sectionId) === ACCESS_NONE);
}
