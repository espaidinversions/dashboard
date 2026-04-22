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
