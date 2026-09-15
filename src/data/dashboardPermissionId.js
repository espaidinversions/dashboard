/**
 * Pure resolvers for the dashboard's section bucket and fine-grained
 * permission id. Extracted from Dashboard.jsx and kept dependency-free so the
 * routing logic can be unit tested in isolation.
 */

/**
 * Coarse section bucket used to drive transaction-derived data.
 *
 * @param {string} tab
 * @returns {string}
 */
export function resolveSection(tab) {
  switch (tab) {
    case "mercats-publics":
      return "mercats-publics";
    case "real-estate":
      return "real-estate";
    case "re-cash-model":
      return "real-estate";
    case "tx-alt":
      return "txlog";
    case "tx-re":
      return "real-estate";
    default:
      return "alternatives";
  }
}

/**
 * Fine-grained permission id used for canAccessSection / canEditSection checks.
 *
 * @param {{ tab: string, realEstateTab?: string, mercatsPublicsTab?: string, activeNavItem?: string }} state
 * @returns {string}
 */
export function resolvePermissionId({ tab, realEstateTab, mercatsPublicsTab, activeNavItem }) {
  if (tab === "liquidity") return "liquidity";

  if (tab === "real-estate") {
    if (realEstateTab === "resum") return "real-estate";
    if (realEstateTab === "altres-vehicles") return "re-altres";
    return "re-directe";
  }

  if (tab === "mercats-publics") {
    if (mercatsPublicsTab === "transaccions" && activeNavItem === "tx-mp") return "tx-mp";
    if (mercatsPublicsTab === "rv") return "mp-rv";
    if (mercatsPublicsTab === "rf") return "mp-rf";
    if (mercatsPublicsTab === "posicions") return "mp-posicions";
    if (mercatsPublicsTab === "transaccions") return "mp-transaccions";
    if (mercatsPublicsTab === "traçabilitat") return "mp-traçabilitat";
    return "mp-resum";
  }

  if (tab === "tx-re") return "tx-re";
  if (tab === "tx-alt") return "tx-alt";
  if (tab === "searchers") return "alternatives";
  if (tab === "cash-model") return "cash-model";
  if (tab === "alt-cash-model") return "cash-model";
  if (tab === "re-cash-model") return "cash-model";
  if (tab === "companies") return "companies";
  if (tab === "inversions") return "inversions";
  return "fons";
}
