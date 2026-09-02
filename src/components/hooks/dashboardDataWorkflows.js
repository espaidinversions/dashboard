import { normalizePrivateWorkbookRows } from "../../data/alternativesModel.js";
import { inferCapitalCallCategoryFromTipus, normalizeCapitalCallSignedAmount, normalizeCapitalCallTipus } from "../../data/capitalCallTipusModel.js";
import { normalizeCapitalCallStrategy, estSection } from "../../data/capitalCallStrategyModel.js";
import { convertAmountToEurOnDate } from "../../fx.js";
import { mergeCapitalCallRows } from "../../utils.js";

export function sanitizeCapitalCallValues(values) {
  const {
    fons, tipus, cat, est, divisa, comentaris,
    data, eur, amountNative, fxRate, fxSource,
    recallable, non_recallable, from_recallable,
  } = values ?? {};
  return {
    fons: String(fons ?? "").trim(),
    tipus: normalizeCapitalCallTipus(tipus),
    cat: cat ?? null,
    est: est ?? null,
    divisa: divisa || "EUR",
    comentaris: String(comentaris ?? "").trim() || null,
    data,
    eur,
    amountNative,
    fxRate,
    fxSource,
    recallable,
    non_recallable,
    from_recallable,
  };
}

export async function prepareCapitalCallPayload(values) {
  const sanitized = sanitizeCapitalCallValues(values);
  const rawAmount = normalizeCapitalCallSignedAmount(sanitized.tipus, parseFloat(values?.eur));
  if (!Number.isFinite(rawAmount)) throw new Error("Import no vàlid");

  const date = String(sanitized.data ?? "").slice(0, 10);
  if (!date) throw new Error("Data obligatòria");

  const conversion = await convertAmountToEurOnDate({
    amount: rawAmount,
    currency: sanitized.divisa,
    date,
  });

  return {
    ...sanitized,
    eur: conversion.eur,
    amountNative: conversion.amountNative,
    fxRate: conversion.fxRate,
    fxSource: conversion.fxSource,
  };
}

export async function syncSearchersFromCapitalCalls(rows) {
  const sfRows = Array.isArray(rows) ? rows.filter((row) => estSection(row?.est) === "SF") : [];
  if (!sfRows.length) return;
  try {
    const { apiFetchJson } = await import("../../apiClient.js");
    await apiFetchJson("/api/searchers?action=sync-capital-calls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows: sfRows }),
    });
  } catch (error) {
    console.error("Searchers sync failed:", error);
  }
}

export async function resolveEstimatedFxRates(rows) {
  const todayUtc = new Date().toISOString().slice(0, 10);
  const stale = rows.filter(
    (row) =>
      typeof row.fxSource === "string" &&
      row.fxSource.startsWith("ecb:estimated:") &&
      String(row.data ?? "").slice(0, 10) <= todayUtc,
  );
  if (!stale.length) return [];

  const batch = stale.slice(0, 10);

  const { updateCapitalCall } = await import("../../db.js");
  const results = await Promise.allSettled(
    batch.map(async (row) => {
      const payload = await prepareCapitalCallPayload({ ...row, eur: row.amountNative });
      const { error } = await updateCapitalCall(row._rowId, payload);
      if (error) throw error;
      return { _rowId: row._rowId, payload };
    }),
  );

  const resolved = [];
  results.forEach((r, i) => {
    if (r.status === "rejected") console.warn(`[resolveEstimatedFxRates] row ${batch[i]._rowId} failed:`, r.reason);
    else if (r.value) resolved.push(r.value);
  });
  return resolved;
}

export function applyResolvedFxRows(rows, resolved) {
  if (!Array.isArray(rows) || !resolved.length) return rows;
  const byId = new Map(resolved.map((r) => [r._rowId, r.payload]));
  return rows.map((row) => {
    const p = byId.get(row._rowId);
    if (!p) return row;
    return { ...row, eur: p.eur, amountNative: p.amountNative, fxRate: p.fxRate, fxSource: p.fxSource };
  });
}

export function buildXlsxDashboardBundle({ rows, currentRawCC = [], currentSearchers = [], currentCompanies = [] }) {
  const byNom = rows.kpiTrimestral;
  const existingCompanies = rows.companies || currentCompanies;
  const mergedCompanies = existingCompanies.map(c => {
    const qs = byNom.get(c.nom);
    return qs ? { ...c, quarters: qs } : c;
  });
  const baseSearchers = rows.searchers || currentSearchers;
  const normalizedCcRows = Array.isArray(rows.cc)
    ? rows.cc.map((row) => {
        const tipus = normalizeCapitalCallTipus(row.tipus);
        const eur = normalizeCapitalCallSignedAmount(tipus, row.eur);
        return {
          ...row,
          tipus,
          eur,
          cat: row.cat ?? inferCapitalCallCategoryFromTipus(tipus, eur),
          est: normalizeCapitalCallStrategy(row.est, null, row),
        };
      })
    : null;
  const baseRawCC = normalizedCcRows ?? currentRawCC;
  const hasCapitalCallsSheet = Array.isArray(rows.cc);
  const searchFundTx = hasCapitalCallsSheet
    ? []
    : normalizePrivateWorkbookRows(rows.ccSearchFunds || [], baseSearchers, mergedCompanies);
  const mergedRawCC = hasCapitalCallsSheet
    ? normalizedCcRows
    : (searchFundTx.length ? mergeCapitalCallRows(baseRawCC, searchFundTx) : null);
  return {
    rawCC: mergedRawCC,
    funds0: rows.pl ?? null,
    companies: mergedCompanies,
    searchers: rows.searchers ?? null,
    fundMeta: rows.fundMeta ?? null,
  };
}


