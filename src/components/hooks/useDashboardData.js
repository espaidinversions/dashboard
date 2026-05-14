import { useState, useMemo, useEffect, useCallback } from "react";
import { readStoredJSON, writeStoredJSON } from "../../utils.js";
import { loadAll, insertCapitalCall, updateCapitalCall, deleteCapitalCall, loadCapitalCalls, saveCapitalCalls, savePipeline, saveCompanies, saveSearchers, saveFundMeta, saveDashboardBundle } from "../../db.js";
import { apiFetchJson } from "../../apiClient.js";
import { normalizePrivateWorkbookRows } from "../../data/alternativesModel.js";
import { inferCapitalCallCategoryFromTipus, normalizeCapitalCallSignedAmount, normalizeCapitalCallTipus } from "../../data/capitalCallTipusModel.js";
import { normalizeCapitalCallStrategy } from "../../data/capitalCallStrategyModel.js";
import { mergeCapitalCallRows } from "../../utils.js";
import { isActualCompany, isSearchFundShell } from "../../data/privateCompanyModel.js";
import { splitRealEstateRows } from "../../data/realEstateModel.js";
import { convertAmountToEurOnDate } from "../../fx.js";

const LS_CC = "tc_rawCC";
const LS_PL = "tc_funds0";
const LS_TS = "tc_loadedAt";

function sanitizeCapitalCallValues(values) {
  return {
    ...values,
    fons: String(values?.fons ?? "").trim(),
    tipus: normalizeCapitalCallTipus(values?.tipus),
    vcpe: values?.vcpe || null,
    est: normalizeCapitalCallStrategy(values?.est, values?.vcpe, values) ?? null,
    divisa: values?.divisa || "EUR",
    comentaris: String(values?.comentaris ?? "").trim() || null,
  };
}

function isLegacyUsdRow(row) {
  return row?.divisa === "USD" && row?.amountNative == null && row?.fxRate == null;
}

async function prepareCapitalCallPayload(values, existingRow = null) {
  const sanitized = sanitizeCapitalCallValues(values);
  const rawAmount = normalizeCapitalCallSignedAmount(sanitized.tipus, parseFloat(values?.eur));
  if (!Number.isFinite(rawAmount)) {
    throw new Error("Import no vàlid");
  }

  const date = String(sanitized.data ?? "").slice(0, 10);
  if (!date) {
    throw new Error("Data obligatòria");
  }

  const sameVisibleAmount = existingRow && Number(rawAmount) === Number(existingRow.eur ?? NaN);
  const sameCurrency = existingRow && sanitized.divisa === existingRow.divisa;
  const sameDate = existingRow && date === String(existingRow.data ?? "").slice(0, 10);

  if (existingRow && isLegacyUsdRow(existingRow) && sameVisibleAmount && sameCurrency && sameDate) {
    return {
      ...sanitized,
      eur: rawAmount,
      amountNative: null,
      fxRate: null,
      fxSource: null,
    };
  }

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

async function syncSearchersFromCapitalCalls(rows) {
  if (!Array.isArray(rows) || !rows.some((row) => row?.vcpe === "SF")) return;
  try {
    await apiFetchJson("/api/searchers?action=sync-capital-calls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows }),
    });
  } catch (error) {
    console.error("Searchers sync failed:", error);
  }
}

export function useDashboardData() {
  const [rawCC,   setRawCC]   = useState(()=>readStoredJSON(LS_CC, []));
  const [funds0,  setFunds0]  = useState(()=>readStoredJSON(LS_PL, []));
  const [companiesData, setCompaniesData] = useState(()=>readStoredJSON("tc_portfolioCompanies", []));
  const [searchersData, setSearchersData] = useState(()=>readStoredJSON("tc_allSearchers", []));
  const [loadedAt,setLoadedAt]= useState(()=>readStoredJSON(LS_TS, null));
  const [eurUsd,  setEurUsd]  = useState(null);

  useEffect(() => {
    apiFetchJson("/api/eur-usd")
      .then(({ rate }) => setEurUsd(rate))
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadAll()
      .then(data => {
        if (!data) return;
        const now = new Date().toLocaleDateString("ca-ES");
        if (Array.isArray(data.rawCC)) {
          setRawCC(data.rawCC);
          writeStoredJSON(LS_CC, data.rawCC);
        }
        if (Array.isArray(data.funds0)) {
          setFunds0(data.funds0);
          writeStoredJSON(LS_PL, data.funds0);
        }
        if (Array.isArray(data.companies)) {
          setCompaniesData(data.companies);
          writeStoredJSON("tc_portfolioCompanies", data.companies);
        }
        if (Array.isArray(data.searchers)) {
          setSearchersData(data.searchers);
          writeStoredJSON("tc_allSearchers", data.searchers);
        }
        if (Array.isArray(data.fundMeta)) writeStoredJSON("tc_fundMeta", data.fundMeta);
        setLoadedAt(now);
        writeStoredJSON(LS_TS, now);
      })
      .catch(err => {
        console.error("Initial dashboard load failed:", err);
      });
  }, []);

  const handleCCInsert = useCallback(async (values, setError) => {
    if (!values.fons || !values.data || !values.eur) { setError("Fons, data i import són obligatoris."); return; }
    let payload;
    try {
      payload = await prepareCapitalCallPayload(values);
    } catch (error) {
      setError(error?.message || "No s'ha pogut calcular el tipus de canvi.");
      return;
    }
    const { error, data: insertedRow } = await insertCapitalCall(payload);
    if (error) { setError(error.message); return; }
    const fresh = await loadCapitalCalls();
    if (fresh) {
      setRawCC(fresh);
      writeStoredJSON(LS_CC, fresh);
      await syncSearchersFromCapitalCalls(fresh);
    } else {
      console.error("[handleCCInsert] loadCapitalCalls returned null after successful insert", { insertedRow });
    }
  }, []);

  const handleCCUpdate = useCallback(async (rowId, values, setError, existingRow = null) => {
    if (!values.data || !values.eur) { setError("Data i import són obligatoris."); return; }
    let payload;
    try {
      payload = await prepareCapitalCallPayload(values, existingRow);
    } catch (error) {
      setError(error?.message || "No s'ha pogut calcular el tipus de canvi.");
      return;
    }
    const { error } = await updateCapitalCall(rowId, payload);
    if (error) { setError(error.message); return; }
    const fresh = await loadCapitalCalls();
    if (fresh) {
      setRawCC(fresh);
      writeStoredJSON(LS_CC, fresh);
      await syncSearchersFromCapitalCalls(fresh);
    }
  }, []);

  const handleCCDelete = useCallback(async (rowId) => {
    const { error } = await deleteCapitalCall(rowId);
    if (error) { console.error(error); return; }
    const fresh = await loadCapitalCalls();
    if (fresh) { setRawCC(fresh); writeStoredJSON(LS_CC, fresh); }
  }, []);

  const handleLoad = useCallback(async (key, rows, clearExcluded) => {
    const now = new Date().toLocaleDateString("ca-ES");
    try {
      if (key === "xlsx") {
        const byNom = rows.kpiTrimestral;
        const existingCompanies = rows.companies || readStoredJSON("tc_portfolioCompanies", []);
        const mergedCompanies = existingCompanies.map(c => {
          const qs = byNom.get(c.nom);
          return qs ? { ...c, quarters: qs } : c;
        });
        const baseSearchers = rows.searchers || readStoredJSON("tc_allSearchers", searchersData);
        const normalizedCcRows = Array.isArray(rows.cc)
          ? rows.cc.map((row) => {
              const tipus = normalizeCapitalCallTipus(row.tipus);
              const eur = normalizeCapitalCallSignedAmount(tipus, row.eur);
              return {
                ...row,
                tipus,
                eur,
                cat: row.cat ?? inferCapitalCallCategoryFromTipus(tipus, eur),
                est: normalizeCapitalCallStrategy(row.est, row.vcpe, row),
              };
            })
          : null;
        const baseRawCC = normalizedCcRows ?? readStoredJSON(LS_CC, rawCC);
        const hasCapitalCallsSheet = Array.isArray(rows.cc);
        const searchFundTx = hasCapitalCallsSheet
          ? []
          : normalizePrivateWorkbookRows(rows.ccSearchFunds || [], baseSearchers, mergedCompanies);
        const mergedRawCC = hasCapitalCallsSheet
          ? normalizedCcRows
          : (searchFundTx.length ? mergeCapitalCallRows(baseRawCC, searchFundTx) : null);
        const bundle = {
          rawCC: mergedRawCC,
          funds0: rows.pl ?? null,
          companies: mergedCompanies,
          searchers: rows.searchers ?? null,
          fundMeta: rows.fundMeta ?? null,
        };
        const { error } = await saveDashboardBundle(bundle);
        if (error) throw error;
        if (bundle.rawCC != null) {
          setRawCC(bundle.rawCC);
          writeStoredJSON(LS_CC, bundle.rawCC);
          await syncSearchersFromCapitalCalls(bundle.rawCC);
        }
        if (bundle.funds0 != null) {
          setFunds0(bundle.funds0);
          writeStoredJSON(LS_PL, bundle.funds0);
        }
        setCompaniesData(bundle.companies);
        writeStoredJSON("tc_portfolioCompanies", bundle.companies);
        if (bundle.searchers != null) {
          setSearchersData(bundle.searchers);
          writeStoredJSON("tc_allSearchers", bundle.searchers);
        }
        if (bundle.fundMeta != null) writeStoredJSON("tc_fundMeta", bundle.fundMeta);
        clearExcluded?.();
      } else if (key === "cc") {
        const { error } = await saveCapitalCalls(rows);
        if (error) throw error;
        setRawCC(rows);
        clearExcluded?.();
        writeStoredJSON(LS_CC, rows);
        await syncSearchersFromCapitalCalls(rows);
      } else if (key === "pl") {
        const { error } = await savePipeline(rows);
        if (error) throw error;
        setFunds0(rows);
        writeStoredJSON(LS_PL, rows);
      } else if (key === "companies") {
        const { error } = await saveCompanies(rows);
        if (error) throw error;
        setCompaniesData(rows);
        writeStoredJSON("tc_portfolioCompanies", rows);
      } else if (key === "searchers") {
        const { error } = await saveSearchers(rows);
        if (error) throw error;
        setSearchersData(rows);
        writeStoredJSON("tc_allSearchers", rows);
      } else if (key === "fundMeta") {
        const { error } = await saveFundMeta(rows);
        if (error) throw error;
        writeStoredJSON("tc_fundMeta", rows);
      }
      setLoadedAt(now);
      writeStoredJSON(LS_TS, now);
    } catch (err) {
      console.error("Load failed:", err);
      throw err;
    }
  }, [rawCC, searchersData]);

  const TRANSACTIONS = useMemo(()=>rawCC.filter(r=>r.cat!=="Compromís"),[rawCC]);
  const COMPROMISOS  = useMemo(()=>rawCC.filter(r=>r.cat==="Compromís"),[rawCC]);

  const actualCompanies = useMemo(() => (Array.isArray(companiesData) ? companiesData.filter(isActualCompany) : []), [companiesData]);
  const actualCompanyIds = useMemo(() => new Set(actualCompanies.map((company) => company.id).filter(Boolean)), [actualCompanies]);

  const sfTx        = useMemo(()=>TRANSACTIONS.filter(r=>r.vcpe==="SF"),[TRANSACTIONS]);
  const sfCompr     = useMemo(()=>COMPROMISOS.filter(r=>r.vcpe==="SF"),[COMPROMISOS]);
  const pcTx        = useMemo(()=>TRANSACTIONS.filter(r=>r.vcpe==="PC"),[TRANSACTIONS]);
  const pcCompr     = useMemo(()=>COMPROMISOS.filter(r=>r.vcpe==="PC"),[COMPROMISOS]);
  const searcherTx  = useMemo(()=>sfTx.filter((row) => !actualCompanyIds.has(row.id)),[sfTx, actualCompanyIds]);
  const searcherCompr = useMemo(()=>sfCompr.filter((row) => !actualCompanyIds.has(row.id)),[sfCompr, actualCompanyIds]);
  const { tx: reTx, compr: reCompr } = useMemo(() => splitRealEstateRows(rawCC), [rawCC]);

  return {
    rawCC, setRawCC,
    funds0, setFunds0,
    companiesData, setCompaniesData,
    searchersData, setSearchersData,
    loadedAt, setLoadedAt,
    eurUsd,
    handleCCInsert,
    handleCCUpdate,
    handleCCDelete,
    handleLoad,
    TRANSACTIONS,
    COMPROMISOS,
    actualCompanies,
    actualCompanyIds,
    sfTx, sfCompr,
    pcTx, pcCompr,
    searcherTx, searcherCompr,
    reTx, reCompr,
  };
}
