export const SECTION_NAV_ITEMS = [
  { id: "alternatives", label: "Alternatius" },
  { id: "real-estate", label: "Real Estate" },
  { id: "mercats-publics", label: "Mercats Públics" },
];

export const SUPRA_NAV_ITEMS = [
  { id: "fons", label: "Fons" },
  { id: "searchers", label: "Searchers" },
  { id: "companies", label: "Participades" },
  { id: "inversions", label: "Totes les Posicions" },
  { id: "cash-model", label: "Model Caixa" },
];

export const SEARCHERS_SUBTABS = [
  { id: "resum", label: "Resum" },
  { id: "tots", label: "Tots" },
  { id: "actius", label: "Actius" },
  { id: "legacy", label: "Legacy" },
  { id: "transaccions", label: "Transaccions" },
];

export const COMPANIES_SUBTABS = [
  { id: "portfoli", label: "Portfoli" },
  { id: "transaccions", label: "Transaccions" },
];

export const REAL_ESTATE_NAV_ITEMS = [
  { id: "re-resum", tab: "resum", perm: "real-estate", label: "Resum" },
  { id: "re-directe", tab: "directe", label: "RE Directe" },
  { id: "re-altres", tab: "altres-vehicles", label: "Vehicles Real Estate" },
  { id: "re-inversions", tab: "inversions", label: "Totes les Posicions" },
];

export const PUBLIC_MARKETS_NAV_ITEMS = [
  { id: "mp-resum", tab: "resum" },
  { id: "mp-rv", tab: "rv" },
  { id: "mp-rf", tab: "rf" },
  { id: "mp-posicions", tab: "posicions" },
  { id: "mp-transaccions", tab: "transaccions" },
  { id: "mp-traçabilitat", tab: "traçabilitat" },
];

export function visibleSections(canAccessSection) {
  return SECTION_NAV_ITEMS.filter((item) => canAccessSection(item.id));
}

export function visibleSupra(canAccessSection) {
  return SUPRA_NAV_ITEMS.filter((item) =>
    item.id === "searchers" ? canAccessSection("alternatives") : canAccessSection(item.id),
  );
}

export function visibleRealEstateNav(canAccessSection) {
  return REAL_ESTATE_NAV_ITEMS.filter((item) => canAccessSection(item.perm ?? item.id));
}

export function visiblePublicMarketsNav(canAccessSection) {
  return PUBLIC_MARKETS_NAV_ITEMS.filter((item) => canAccessSection(item.id));
}

export function dashboardHeaderTitle(tab) {
  if (tab === "home") return "Inici";
  if (tab === "liquidity") return "Liquiditat";
  if (tab === "mercats-publics" || tab === "tx-mp") return "Mercats Públics";
  if (tab === "real-estate" || tab === "tx-re" || tab === "re-cash-model") return "Real Estate";
  if (tab === "cash-model") return "Model Caixa";
  return "Mercats Privats";
}
