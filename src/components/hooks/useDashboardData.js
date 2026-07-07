import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { readStoredJSON, writeStoredJSON } from "../../utils.js";
import { loadAll, insertCapitalCall, updateCapitalCall, deleteCapitalCall, loadCapitalCalls, saveCapitalCalls, savePipeline, saveCompanies, saveSearchers, saveFundMeta, saveDashboardBundle } from "../../db.js";
import { apiFetchJson } from "../../apiClient.js";
import { useToast } from "../../toast.jsx";
import { normalizePrivateWorkbookRows } from "../../data/alternativesModel.js";
import { inferCapitalCallCategoryFromTipus, normalizeCapitalCallSignedAmount, normalizeCapitalCallTipus } from "../../data/capitalCallTipusModel.js";
import { normalizeCapitalCallStrategy, estSection } from "../../data/capitalCallStrategyModel.js";
import { mergeCapitalCallRows } from "../../utils.js";
import { isActualCompany, isSearchFundShell } from "../../data/privateCompanyModel.js";
import { splitRealEstateRows } from "../../data/realEstateModel.js";
import { convertAmountToEurOnDate } from "../../fx.js";

const LS_CC = "tc_rawCC";
const LS_PL = "tc_funds0";
const LS_TS = "tc_loadedAt";

function sanitizeCapitalCallValues(values) {
  // Only pick known capital_calls columns — drop UI-only fields like nif, fiscal_name
  const {
    fons, tipus, cat, est, vehicleTipus, divisa, comentaris,
    data, eur, amountNative, fxRate, fxSource,
    recallable, non_recallable, from_recallable,
  } = values ?? {};
  return {
    fons: String(fons ?? "").trim(),
    tipus: normalizeCapitalCallTipus(tipus),
    cat: cat ?? null,
    est: est ?? null,
    vehicleTipus: vehicleTipus ?? null,
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
  const sfRows = Array.isArray(rows) ? rows.filter((row) => estSection(row?.est) === "SF") : [];
  if (!sfRows.length) return;
  try {
    await apiFetchJson("/api/searchers?action=sync-capital-calls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows: sfRows }),
    });
  } catch (error) {
    console.error("Searchers sync failed:", error);
  }
}

async function resolveEstimatedFxRates(rows) {
  const todayUtc = new Date().toISOString().slice(0, 10);
  const stale = rows.filter(
    (row) =>
      typeof row.fxSource === "string" &&
      row.fxSource.startsWith("ecb:estimated:") &&
      String(row.data ?? "").slice(0, 10) <= todayUtc,
  );
  if (!stale.length) return false;

  const batch = stale.slice(0, 10);
  const results = await Promise.allSettled(
    batch.map(async (row) => {
      const payload = await prepareCapitalCallPayload(
        { ...row, eur: row.amountNative },
        null,
      );
      const { error } = await updateCapitalCall(row._rowId, payload);
      if (error) throw error;
    }),
  );

  results.forEach((r, i) => {
    if (r.status === "rejected") {
      console.warn(`[resolveEstimatedFxRates] row ${batch[i]._rowId} failed:`, r.reason);
    }
  });

  return results.some((r) => r.status === "fulfilled");
}

export function useDashboardData() {
  const { toast } = useToast();
  const [rawCC,   setRawCC]   = useState(()=>readStoredJSON(LS_CC, []));
  const [funds0,  setFunds0]  = useState(()=>readStoredJSON(LS_PL, []));
  const [companiesData, setCompaniesData] = useState(()=>readStoredJSON("tc_portfolioCompanies", []));
  const [searchersData, setSearchersData] = useState(()=>readStoredJSON("tc_allSearchers", []));
  const [loadedAt,setLoadedAt]= useState(()=>readStoredJSON(LS_TS, null));
  const [eurUsd,  setEurUsd]  = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const rawCCRef = useRef(rawCC);
  const searchersDataRef = useRef(searchersData);
  useEffect(() => { rawCCRef.current = rawCC; }, [rawCC]);
  useEffect(() => { searchersDataRef.current = searchersData; }, [searchersData]);

  useEffect(() => {
    const handler = () => {
      const fresh = readStoredJSON(LS_CC, []);
      setRawCC(fresh);
    };
    window.addEventListener("tc-rawcc-updated", handler);
    return () => window.removeEventListener("tc-rawcc-updated", handler);
  }, []);

  useEffect(() => {
    apiFetchJson("/api/eur-usd")
      .then(({ rate }) => setEurUsd(rate))
      .catch((err) => console.warn("[eur-usd] rate fetch failed, using fallback:", err));
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadAll()
      .then(data => {
        if (!data || cancelled) return;
        const now = new Date().toLocaleDateString("ca-ES");
        if (Array.isArray(data.rawCC)) {
          setRawCC(data.rawCC);
          writeStoredJSON(LS_CC, data.rawCC);
          window.dispatchEvent(new CustomEvent("tc-rawcc-updated"));
          resolveEstimatedFxRates(data.rawCC)
            .then((anyResolved) => {
              if (!anyResolved || cancelled) return;
              return loadCapitalCalls({ skipCompanions: true }).then((fresh) => {
                if (!fresh || cancelled) return;
                setRawCC(fresh);
                writeStoredJSON(LS_CC, fresh);
                window.dispatchEvent(new CustomEvent("tc-rawcc-updated"));
              });
            })
            .catch((err) => console.warn("[resolveEstimatedFxRates] unexpected error:", err));
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
      })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const handleCCInsert = useCallback(async (values, setError) => {
    if (!values.fons || !values.data || !values.eur || !values.tipus) { setError("Fons, data, tipus i import són obligatoris."); return; }
    let payload;
    try {
      payload = await prepareCapitalCallPayload(values);
    } catch (error) {
      setError(error?.message || "No s'ha pogut calcular el tipus de canvi.");
      return;
    }
    const { error, data: insertedRow } = await insertCapitalCall(payload);
    if (error) {
      console.error("insertCapitalCall failed:", error);
      setError("No s'ha pogut afegir el moviment. Torna-ho a provar.");
      return;
    }
    const fresh = await loadCapitalCalls({ skipCompanions: true });
    if (fresh) {
      setRawCC(fresh);
      writeStoredJSON(LS_CC, fresh);
      window.dispatchEvent(new CustomEvent("tc-rawcc-updated"));
      await syncSearchersFromCapitalCalls(fresh);
    } else {
      console.error("[handleCCInsert] loadCapitalCalls returned null after successful insert", { insertedRow });
    }
  }, []);

  const handleCCUpdate = useCallback(async (rowId, values, setError, existingRow = null) => {
    if (!values.data || !values.eur || !values.tipus) { setError("Data, tipus i import són obligatoris."); return; }
    let payload;
    try {
      payload = await prepareCapitalCallPayload(values, existingRow);
    } catch (error) {
      setError(error?.message || "No s'ha pogut calcular el tipus de canvi.");
      return;
    }
    const { error } = await updateCapitalCall(rowId, payload);
    if (error) {
      console.error("updateCapitalCall failed:", error);
      setError("No s'ha pogut desar el moviment. Torna-ho a provar.");
      return;
    }
    const fresh = await loadCapitalCalls({ skipCompanions: true });
    if (fresh) {
      setRawCC(fresh);
      writeStoredJSON(LS_CC, fresh);
      window.dispatchEvent(new CustomEvent("tc-rawcc-updated"));
      await syncSearchersFromCapitalCalls(fresh);
    }
  }, []);

  const handleCCDelete = useCallback(async (rowId) => {
    const { error } = await deleteCapitalCall(rowId);
    if (error) {
      console.error("deleteCapitalCall failed:", error);
      toast("No s'ha pogut eliminar el moviment.", "error");
      return;
    }
    const fresh = await loadCapitalCalls({ skipCompanions: true });
    if (fresh) {
      setRawCC(fresh);
      writeStoredJSON(LS_CC, fresh);
      window.dispatchEvent(new CustomEvent("tc-rawcc-updated"));
    }
  }, [toast]);

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
        const baseSearchers = rows.searchers || readStoredJSON("tc_allSearchers", searchersDataRef.current);
        const normalizedCcRows = Array.isArray(rows.cc)
          ? rows.cc.map((row) => {
              const tipus = normalizeCapitalCallTipus(row.tipus);
              const eur = normalizeCapitalCallSignedAmount(tipus, row.eur);
              return {
                ...row,
                tipus,
                eur,
                cat: row.cat ?? inferCapitalCallCategoryFromTipus(tipus, eur),
                est: normalizeCapitalCallStrategy(row.est, row.vehicleTipus ?? null, row),
              };
            })
          : null;
        const baseRawCC = normalizedCcRows ?? readStoredJSON(LS_CC, rawCCRef.current);
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
          window.dispatchEvent(new CustomEvent("tc-rawcc-updated"));
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
        window.dispatchEvent(new CustomEvent("tc-rawcc-updated"));
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
  }, []);

  const TRANSACTIONS = useMemo(()=>rawCC.filter(r=>r.cat!=="Compromís"),[rawCC]);
  const COMPROMISOS  = useMemo(()=>rawCC.filter(r=>r.cat==="Compromís"),[rawCC]);

  const actualCompanies = useMemo(() => (Array.isArray(companiesData) ? companiesData.filter(isActualCompany) : []), [companiesData]);
  const actualCompanyIds = useMemo(() => new Set(actualCompanies.map((company) => company.id).filter(Boolean)), [actualCompanies]);

  const sfTx        = useMemo(()=>TRANSACTIONS.filter(r=>estSection(r.est)==="SF"),[TRANSACTIONS]);
  const sfCompr     = useMemo(()=>COMPROMISOS.filter(r=>estSection(r.est)==="SF"),[COMPROMISOS]);
  const pcTx        = useMemo(()=>TRANSACTIONS.filter(r=>estSection(r.est)==="PC"),[TRANSACTIONS]);
  const pcCompr     = useMemo(()=>COMPROMISOS.filter(r=>estSection(r.est)==="PC"),[COMPROMISOS]);
  const searcherTx  = useMemo(()=>sfTx.filter((row) => !actualCompanyIds.has(row.id)),[sfTx, actualCompanyIds]);
  const searcherCompr = useMemo(()=>sfCompr.filter((row) => !actualCompanyIds.has(row.id)),[sfCompr, actualCompanyIds]);
  const { tx: reTx, compr: reCompr } = useMemo(() => splitRealEstateRows(rawCC), [rawCC]);

  return {
    rawCC, setRawCC,
    funds0, setFunds0,
    companiesData, setCompaniesData,
    searchersData, setSearchersData,
    loadedAt, setLoadedAt,
    isLoading,
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
