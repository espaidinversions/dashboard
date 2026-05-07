import { getPrivateEntityName } from "./privateEntities.js";

export function isSearchFundShell(company) {
  if (company?.tipus !== "SF") return false;
  const ticket = Number(company?.ticket ?? 0);
  return Number.isFinite(ticket) && ticket > 0 && ticket < 100000;
}

export function isSfBackedCompany(company) {
  return company?.tipus === "SF" && !isSearchFundShell(company);
}

export function isDirectPeCompany(company) {
  return company?.tipus === "PE";
}

export function isActualCompany(company) {
  return !isSearchFundShell(company);
}

export function getCompanyCategoryLabel(company) {
  if (isSfBackedCompany(company)) return "Via Search Fund";
  if (isDirectPeCompany(company)) return "PE Directe";
  return company?.tipus ?? "Altres";
}

export function matchesCompanyCategory(company, category) {
  if (!category || category === "totes") return isActualCompany(company);
  if (category === "via-sf") return isSfBackedCompany(company);
  if (category === "pe-directe") return isDirectPeCompany(company);
  return false;
}

/**
 * @param {object[]} capitalCallRows
 * @param {Map<string, object>} entityMap
 * @param {object[]} existingCompanies
 * @returns {object[]}
 */
export function buildFallbackCompaniesFromCapitalCalls(capitalCallRows, entityMap, existingCompanies) {
  const rows = Array.isArray(capitalCallRows) ? capitalCallRows : [];
  const existing = Array.isArray(existingCompanies) ? existingCompanies : [];
  const existingIds = new Set(existing.map((row) => row.id).filter(Boolean));
  const existingNames = new Set(existing.map((row) => row.nom).filter(Boolean));
  const grouped = new Map();

  rows.forEach((row) => {
    if (!["PC", "SF"].includes(row?.vcpe)) return;
    const entityId = row?.vehicle_id ?? null;
    const companyName = getPrivateEntityName(entityMap, entityId, row?.fons);
    if (!entityId || !companyName) return;
    if (existingIds.has(entityId) || existingNames.has(companyName)) return;

    const current = grouped.get(entityId) ?? {
      id: entityId,
      nom: companyName,
      tipus: row.vcpe,
      segment: null,
      entrepreneurs: null,
      origen: null,
      geo: entityMap.get(entityId)?.country ?? null,
      ticket: 0,
      tvpi: null,
      rvpiEur: null,
      dpiEur: null,
      rev: null,
      ebitda: null,
      dfn: null,
      grossEV: null,
      multEntry: null,
      dataCompr: null,
      mesosOperant: null,
      isMock: true,
      quarters: [],
      sourceName: row?.fons ?? companyName,
      workbookName: entityMap.get(entityId)?.workbook_name ?? null,
      matchType: entityMap.get(entityId)?.match_type ?? "capital_calls_fallback",
    };

    if (row?.cat === "Capital Call" && Number(row?.eur) > 0) {
      current.ticket += Number(row.eur);
      const rowDate = row?.data ? String(row.data).slice(0, 10) : null;
      if (rowDate && (!current.dataCompr || rowDate < current.dataCompr)) {
        current.dataCompr = rowDate;
      }
    }

    grouped.set(entityId, current);
  });

  return [...grouped.values()].map((row) => ({
    ...row,
    ticket: row.ticket > 0 ? row.ticket : null,
  }));
}
