import { GEO_NAME } from "../config.js";

export const getActiveSortValue = (row, key) => {
  if (key === "stage") return row.stageOrder ?? 0;
  if (key === "geo") return GEO_NAME[row.geo] || row.geo || "";
  if (key === "formEntrada") return row.formEntrada ?? "";
  if (key === "ticket") return row.ticket ?? 0;
  if (key === "investmentYear") return row.investmentYear ?? 0;
  if (key === "mesosCercant") return row.mesosCercant ?? 0;
  if (key === "equityStake") return row.equityStake ?? 0;
  if (key === "dataCompr") return row.derivedDataCompr ?? "";
  if (key === "irr") return row.irr ?? -Infinity;
  if (key === "dpi") return row.dpi ?? -Infinity;
  if (key === "companiaAdquirida") return row.companiaAdquirida ?? "";
  return row[key] ?? "";
};

export const getHistoricSortValue = (row, key) => {
  if (key === "geo") return GEO_NAME[row.geo] || row.geo || "";
  if (key === "stageLabel") return row.stageOrder ?? 0;
  if (key === "investmentYear") return row.investmentYear ?? 0;
  return row[key] ?? "";
};

export const isMockNif = (nif) => !nif || String(nif).startsWith("MOCKNIF:");
