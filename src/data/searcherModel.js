import { estSection } from "./capitalCallStrategyModel.js";

/** @typedef {import("./dashboardTypes.js").Searcher} Searcher */

export function normalizeSearcherName(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[().,/-]/g, " ")
    .replace(/\b(s\.?l\.?|srl|ltd|limited)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildSearchersCapitalCallMeta(capitalCallRows) {
  const rows = Array.isArray(capitalCallRows) ? capitalCallRows : [];
  const byId = new Map();
  const byName = new Map();
  rows.forEach((row) => {
    if (estSection(row?.est) !== "SF") return;
    const date = String(row?.data ?? "").slice(0, 10);
    if (!date.match(/^\d{4}-\d{2}-\d{2}$/)) return;
    if ((row?.eur ?? 0) <= 0) return;
    if (!["Compromís", "Capital Call"].includes(row?.cat)) return;
    const next = { firstCommitmentDate: date, firstCommitmentEur: row?.eur ?? null };
    const vehicleId = row?.vehicle_id ?? null;
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

/**
 * @param {Searcher[]} searchers
 * @param {object[]} capitalCallRows
 */
export function mergeSearchersWithCapitalCalls(searchers, capitalCallRows) {
  const rows = Array.isArray(searchers) ? searchers : [];
  const { byId, byName } = buildSearchersCapitalCallMeta(capitalCallRows);
  return rows.map((row) => {
    const ccMeta = (row?.nif && byId.get(row.nif)) || byName.get(normalizeSearcherName(row?.nom));
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
