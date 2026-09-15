import { estSection } from "./capitalCallStrategyModel.js";
import { normalizeSearcherName } from "./searcherName.js";
export { normalizeSearcherName } from "./searcherName.js";

/** @typedef {import("./dashboardTypes.js").Searcher} Searcher */

function isValidIsoDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value ?? "").slice(0, 10));
}

export function getCapitalCallEntityId(row) {
  return String(row?.vehicle_id ?? row?.id ?? "").trim();
}

function buildSearchersCapitalCallMeta(capitalCallRows) {
  const rows = Array.isArray(capitalCallRows) ? capitalCallRows : [];
  const byId = new Map();
  const byName = new Map();
  rows.forEach((row) => {
    if (estSection(row?.est) !== "SF") return;
    const date = String(row?.data ?? "").slice(0, 10);
    if (!isValidIsoDate(date)) return;
    if ((row?.eur ?? 0) <= 0) return;
    if (!["Compromís", "Capital Call"].includes(row?.cat)) return;
    const next = { firstCommitmentDate: date, firstCommitmentEur: row?.eur ?? null };
    const vehicleId = getCapitalCallEntityId(row);
    if (vehicleId) {
      const current = byId.get(vehicleId);
      if (!current || date < current.firstCommitmentDate) byId.set(vehicleId, next);
    }
    const nameKey = normalizeSearcherName(row?.fons);
    if (nameKey) {
      const current = byName.get(nameKey);
      if (!current || date < current.firstCommitmentDate) byName.set(nameKey, next);
    }
  });
  return { byId, byName };
}

function searcherCapitalCallMeta(row, meta) {
  const id = String(row?.nif ?? row?.id ?? "").trim();
  return (id && meta.byId.get(id)) || meta.byName.get(normalizeSearcherName(row?.nom));
}

/**
 * @param {Searcher[]} searchers
 * @param {object[]} capitalCallRows
 */
export function mergeSearchersWithCapitalCalls(searchers, capitalCallRows) {
  const rows = Array.isArray(searchers) ? searchers : [];
  const meta = buildSearchersCapitalCallMeta(capitalCallRows);
  return rows.map((row) => {
    const ccMeta = searcherCapitalCallMeta(row, meta);
    return {
      ...row,
      ticket: ccMeta?.firstCommitmentEur ?? row.ticket ?? null,
      dataCompr: ccMeta?.firstCommitmentDate ?? row.dataCompr ?? null,
    };
  });
}

export function describeSearcherStage(row) {
  const status = String(row?.statusScreening ?? "").trim();
  if (status === "Invertit en fase de cerca") {
    return row?.formEntrada === "Equity Gap"
      ? { label: "Equity Gap actiu", order: 2 }
      : { label: "Cerca activa", order: 1 };
  }
  if (status === "Invertit en fase d'adquisició") return { label: "En adquisició", order: 3 };
  if (status === "Pendent de formalitzar" || status === "En anàlisi") return { label: "En revisió", order: 4 };
  if (status === "Sobresuscrit") return { label: "Sense plaça", order: 5 };
  if (status === "No tancat") return { label: "Procés aturat", order: 6 };
  if (status === "Descartat") return { label: "Descartat", order: 7 };
  return { label: status || "Sense classificar", order: 99 };
}

export function isActiveSearcher(row) {
  if (row?.statusScreeningCode != null) return row.statusScreeningCode === 2;
  return row?.statusScreening === "Invertit en fase de cerca" || row?.statusScreening === "Invested - Search Phase";
}

export function isInvestedUnacquiredSearcher(row, actualCompanyIds = new Set()) {
  if (!(Number(row?.ticket ?? 0) > 0)) return false;
  if (row?.companiaAdquirida) return false;
  const nif = String(row?.nif ?? "").trim();
  if (nif && actualCompanyIds.has(nif)) return false;
  return true;
}

export function createSearcherCapitalCallMatcher(searchers) {
  const trackedIds = new Set();
  const trackedNames = new Set();
  const trackedCoreTokens = new Set();

  (Array.isArray(searchers) ? searchers : []).forEach((row) => {
    const id = String(row?.nif ?? row?.id ?? "").trim();
    if (id) trackedIds.add(id);
    const name = normalizeSearcherName(row?.nom);
    if (name) {
      trackedNames.add(name);
      const token = name.split(" ")[0];
      if (token && token.length >= 4) trackedCoreTokens.add(token);
    }
  });

  return (row) => {
    if (estSection(row?.est) !== "SF") return false;
    const entityId = getCapitalCallEntityId(row);
    if (entityId && trackedIds.has(entityId)) return true;
    const rowName = normalizeSearcherName(row?.fons);
    if (trackedNames.has(rowName)) return true;
    const coreToken = rowName.split(" ")[0];
    return Boolean(coreToken && coreToken.length >= 4 && trackedCoreTokens.has(coreToken));
  };
}

export function isActualCompanyCapitalCall(row, actualCompanyIds = new Set()) {
  const entityId = getCapitalCallEntityId(row);
  return Boolean(entityId && actualCompanyIds.has(entityId));
}

export function matchSearcherCapitalCall(row, searcher) {
  if (estSection(row?.est) !== "SF") return false;
  const matcher = createSearcherCapitalCallMatcher(searcher ? [searcher] : []);
  return matcher(row);
}

export function enrichSearchersWithCapitalCalls(searchers, capitalCallRows, { calcMonths } = {}) {
  const rows = Array.isArray(searchers) ? searchers : [];
  const meta = buildSearchersCapitalCallMeta(capitalCallRows);
  return rows.map((row) => {
    const searchersLabel = [row.searcher1, row.searcher2].filter(Boolean).join(" / ");
    const stage = describeSearcherStage(row);
    const ccMeta = searcherCapitalCallMeta(row, meta);
    const derivedDataCompr = ccMeta?.firstCommitmentDate ?? row.dataCompr ?? null;
    const derivedTicket = ccMeta?.firstCommitmentEur ?? row.ticket ?? null;
    const investmentYear = derivedDataCompr ? Number(derivedDataCompr.slice(0, 4)) : null;
    return {
      ...row,
      ticket: derivedTicket,
      searchers: searchersLabel,
      derivedDataCompr,
      investmentYear,
      stageLabel: stage.label,
      stageOrder: stage.order,
      mesosCercant: derivedDataCompr && typeof calcMonths === "function"
        ? calcMonths(derivedDataCompr)
        : row.mesosCercant ?? null,
    };
  });
}