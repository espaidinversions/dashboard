import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { fetchRawDashboardRows, mapDashboardBundle, readDashboardCache, writeDashboardCache, readEurUsdCache, writeEurUsdCache, insertCapitalCall, updateCapitalCall, deleteCapitalCall, loadCapitalCalls, saveCapitalCalls, savePipeline, saveCompanies, saveSearchers, saveFundMeta, saveDashboardBundle, loadLiquidity } from "../../db.js";
import { apiFetchJson } from "../../apiClient.js";
import { useToast } from "../../toast.jsx";
import { estSection } from "../../data/capitalCallStrategyModel.js";
import { isActualCompany } from "../../data/privateCompanyModel.js";
import { splitRealEstateRows } from "../../data/realEstateModel.js";
import { buildLatestAccounts } from "../../data/liquidityModel.js";
import { applyResolvedFxRows, buildXlsxDashboardBundle, prepareCapitalCallPayload, resolveEstimatedFxRates, syncSearchersFromCapitalCalls } from "./dashboardDataWorkflows.js";


export function useDashboardData() {
  const { toast } = useToast();
  const [rawCC,   setRawCC]   = useState([]);
  const [funds0,  setFunds0]  = useState([]);
  const [companiesData, setCompaniesData] = useState([]);
  const [searchersData, setSearchersData] = useState([]);
  const [fundMeta, setFundMeta] = useState([]);
  const [liquidityRegistry, setLiquidityRegistry] = useState([]);
  const [liquidityBalances, setLiquidityBalances] = useState([]);
  const [loadedAt,setLoadedAt]= useState(null);
  const [eurUsd,  setEurUsd]  = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const rawCCRef = useRef(rawCC);
  const searchersDataRef = useRef(searchersData);
  const companiesDataRef = useRef(companiesData);
  useEffect(() => { rawCCRef.current = rawCC; }, [rawCC]);
  useEffect(() => { searchersDataRef.current = searchersData; }, [searchersData]);
  useEffect(() => { companiesDataRef.current = companiesData; }, [companiesData]);

  // Dispatches tc-rawcc-updated for other components while letting this hook
  // skip its own event (it already holds the fresh rows in state).
  const selfDispatchRef = useRef(false);
  const refetchingRef = useRef(false);
  const dispatchRawCCUpdated = useCallback(() => {
    selfDispatchRef.current = true;
    window.dispatchEvent(new CustomEvent("tc-rawcc-updated"));
    selfDispatchRef.current = false;
  }, []);

  useEffect(() => {
    const handler = () => {
      if (selfDispatchRef.current || refetchingRef.current) return;
      refetchingRef.current = true;
      loadCapitalCalls({ skipCompanions: true })
        .then((fresh) => {
          if (Array.isArray(fresh)) setRawCC(fresh);
        })
        .catch((err) => console.error("Capital calls refetch failed:", err))
        .finally(() => { refetchingRef.current = false; });
    };
    window.addEventListener("tc-rawcc-updated", handler);
    return () => window.removeEventListener("tc-rawcc-updated", handler);
  }, []);

  useEffect(() => {
    // The /api/eur-usd serverless function cold-starts (~2s on Vercel Hobby).
    // Paint the cached rate instantly and only hit the network when the cached
    // rate is missing or stale, so it never blocks the initial render.
    const cached = readEurUsdCache();
    if (cached) setEurUsd(cached.rate);
    if (cached?.fresh) return;

    let cancelled = false;
    apiFetchJson("/api/eur-usd")
      .then(({ rate }) => {
        const value = Number(rate);
        if (cancelled || !Number.isFinite(value) || value <= 0) return;
        setEurUsd(value);
        writeEurUsdCache(value);
      })
      .catch((err) => console.warn("[eur-usd] rate fetch failed, using fallback:", err));
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const applyBundle = (data) => {
      if (!data || cancelled) return;
      if (Array.isArray(data.rawCC)) {
        setRawCC(data.rawCC);
        dispatchRawCCUpdated();
      }
      if (Array.isArray(data.funds0)) setFunds0(data.funds0);
      if (Array.isArray(data.companies)) setCompaniesData(data.companies);
      if (Array.isArray(data.searchers)) setSearchersData(data.searchers);
      if (Array.isArray(data.fundMeta)) setFundMeta(data.fundMeta);
      setLoadedAt(new Date().toLocaleDateString("ca-ES"));
    };

    // 1) Stale-while-revalidate: paint the last cached bundle instantly so the
    //    dashboard is usable immediately instead of blocking on the network.
    const cached = readDashboardCache();
    if (cached?.rows) {
      applyBundle(mapDashboardBundle(cached.rows));
      if (!cancelled) setIsLoading(false);
    }

    // 2) Revalidate against Supabase in the background and refresh the cache.
    fetchRawDashboardRows()
      .then((raw) => {
        if (!raw || cancelled) return;
        writeDashboardCache(raw);
        const data = mapDashboardBundle(raw);
        applyBundle(data);
        // Resolve estimated FX rates without blocking; patch the affected rows
        // in memory rather than refetching the whole capital_calls table.
        if (data && Array.isArray(data.rawCC)) {
          resolveEstimatedFxRates(data.rawCC)
            .then((resolvedRows) => {
              if (!Array.isArray(resolvedRows) || !resolvedRows.length || cancelled) return;
              setRawCC((prev) => applyResolvedFxRows(prev, resolvedRows));
              dispatchRawCCUpdated();
            })
            .catch((err) => console.warn("[resolveEstimatedFxRates] unexpected error:", err));
        }
      })
      .catch((err) => console.error("Initial dashboard load failed:", err))
      .finally(() => { if (!cancelled) setIsLoading(false); });

    return () => { cancelled = true; };
  }, []);

  const reloadLiquidity = useCallback(async () => {
    const { registry, balances } = await loadLiquidity();
    setLiquidityRegistry(registry);
    setLiquidityBalances(balances);
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadLiquidity()
      .then(({ registry, balances }) => {
        if (cancelled) return;
        setLiquidityRegistry(registry);
        setLiquidityBalances(balances);
      })
      .catch((err) => console.error("Initial liquidity load failed:", err));
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
      dispatchRawCCUpdated();
      await syncSearchersFromCapitalCalls(fresh);
    } else {
      console.error("[handleCCInsert] loadCapitalCalls returned null after successful insert", { insertedRow });
    }
  }, [dispatchRawCCUpdated]);

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
      dispatchRawCCUpdated();
      await syncSearchersFromCapitalCalls(fresh);
    }
  }, [dispatchRawCCUpdated]);

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
      dispatchRawCCUpdated();
    }
  }, [toast, dispatchRawCCUpdated]);

  const handleLoad = useCallback(async (key, rows, clearExcluded) => {
    const now = new Date().toLocaleDateString("ca-ES");
    try {
      if (key === "xlsx") {
        const bundle = buildXlsxDashboardBundle({
          rows,
          currentRawCC: rawCCRef.current,
          currentSearchers: searchersDataRef.current,
          currentCompanies: companiesDataRef.current,
        });
        const { error } = await saveDashboardBundle(bundle);
        if (error) throw error;
        if (bundle.rawCC != null) {
          setRawCC(bundle.rawCC);
          dispatchRawCCUpdated();
          await syncSearchersFromCapitalCalls(bundle.rawCC);
        }
        if (bundle.funds0 != null) setFunds0(bundle.funds0);
        setCompaniesData(bundle.companies);
        if (bundle.searchers != null) setSearchersData(bundle.searchers);
        if (bundle.fundMeta != null) setFundMeta(bundle.fundMeta);
        clearExcluded?.();
      } else if (key === "cc") {
        const { error } = await saveCapitalCalls(rows);
        if (error) throw error;
        setRawCC(rows);
        clearExcluded?.();
        dispatchRawCCUpdated();
        await syncSearchersFromCapitalCalls(rows);
      } else if (key === "pl") {
        const { error } = await savePipeline(rows);
        if (error) throw error;
        setFunds0(rows);
      } else if (key === "companies") {
        const { error } = await saveCompanies(rows);
        if (error) throw error;
        setCompaniesData(rows);
      } else if (key === "searchers") {
        const { error } = await saveSearchers(rows);
        if (error) throw error;
        setSearchersData(rows);
      } else if (key === "fundMeta") {
        const { error } = await saveFundMeta(rows);
        if (error) throw error;
        setFundMeta(rows);
      }
      setLoadedAt(now);
    } catch (err) {
      console.error("Load failed:", err);
      throw err;
    }
  }, [dispatchRawCCUpdated]);

  const liquidityAccounts = useMemo(
    () => buildLatestAccounts(liquidityRegistry, liquidityBalances),
    [liquidityRegistry, liquidityBalances],
  );

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
    fundMeta, setFundMeta,
    liquidityAccounts, liquidityRegistry, liquidityBalances, reloadLiquidity,
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
