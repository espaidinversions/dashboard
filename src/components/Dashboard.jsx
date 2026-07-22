import { useState, useMemo, useEffect, useCallback, lazy, Suspense } from "react";
import {
  CAPITAL_CALL_TIPUS_OPTIONS,
  CAPITAL_CALL_TIPUS_GROUPED,
} from "../config.js";
import { useTheme } from "../theme.js";
import { usePersistedState, exportMultiXLSX, normalizeOptionValue, dedupeOptionValues } from "../utils.js";
import { useAuth } from "../auth.jsx";
import { ResumTab, LandingTab } from "./tabs/index.js";
import { Sidebar } from "./Sidebar.jsx";
import { useDashboardData } from "./hooks/useDashboardData.js";
import { buildAltCohortMatrix, buildCompanyCohortMatrix } from "../data/altCohortModel.js";
import { buildLandingModel } from "../data/landingModel.js";
import { AltCohortSection } from "./funds/AltCohortSection.jsx";
import { useTransactionDerivedData } from "./hooks/useTransactionDerivedData.js";
import { useTabRouter } from "./hooks/useTabRouter.js";
import { CapitalCallModalProvider, useCapitalCallModal } from "./contexts/CapitalCallModalContext.jsx";

const CcTransactionModal  = lazy(() => import("./CcTransactionModal.jsx").then(m => ({ default: m.CcTransactionModal })));
const DataLoader          = lazy(() => import("./DataLoader.jsx").then(m => ({ default: m.DataLoader })));
const PipelineFY26        = lazy(() => import("./PipelineFY26.jsx").then(m => ({ default: m.PipelineFY26 })));
const MensualTab          = lazy(() => import("./MensualTab.jsx").then(m => ({ default: m.MensualTab })));
const SearchersTab        = lazy(() => import("./SearchersTab.jsx").then(m => ({ default: m.SearchersTab })));
const SearchersIndexInner = lazy(() => import("./SearchersIndex.jsx").then(m => ({ default: m.SearchersIndexInner })));
const FundsIndexInner     = lazy(() => import("./FundsIndex.jsx").then(m => ({ default: m.FundsIndexInner })));
const CompaniesIndexInner = lazy(() => import("./CompaniesIndex.jsx").then(m => ({ default: m.CompaniesIndexInner })));
const TxSection           = lazy(() => import("./TxSection.jsx").then(m => ({ default: m.TxSection })));
const PublicMarketsTab    = lazy(() => import("./PublicMarketsTab.jsx").then(m => ({ default: m.PublicMarketsTab })));
const ProspectiveCashTab  = lazy(() => import("./ProspectiveCashTab.jsx").then(m => ({ default: m.ProspectiveCashTab })));
const HoldingsTable       = lazy(() => import("./HoldingsTable.jsx").then(m => ({ default: m.HoldingsTable })));
const PMTipusTab          = lazy(() => import("./PMTipusTab.jsx").then(m => ({ default: m.PMTipusTab })));
const PMTransaccionsTab   = lazy(() => import("./PMTransaccionsTab.jsx").then(m => ({ default: m.PMTransaccionsTab })));
const PMTraçabilitatTab   = lazy(() => import("./PMTraçabilitatTab.jsx").then(m => ({ default: m.PMTraçabilitatTab })));
const PmLandingCard       = lazy(() => import("./tabs/PmLandingCard.jsx"));

function CapitalCallModals({
  ccNameOptions,
  ccTipusOptions,
  amountInputStyle,
  defaultVehicleCurrency,
  recallablePoolByFund,
  uncalledByFund,
  onInsert,
  onUpdate,
}) {
  const {
    ccAddModalFons,
    ccAddModalDefaults,
    ccEditModalRow,
    closeAddModal,
    closeEditModal,
  } = useCapitalCallModal();

  return (
    <Suspense fallback={null}>
      {ccAddModalFons !== null && (
        <CcTransactionModal
          addFons={ccAddModalFons}
          addDefaults={ccAddModalDefaults}
          ccNameOptions={ccNameOptions}
          ccTipusOptions={ccTipusOptions}
          amountInputStyle={amountInputStyle}
          defaultVehicleCurrency={defaultVehicleCurrency}
          recallablePoolByFund={recallablePoolByFund}
          uncalledByFund={uncalledByFund}
          onInsert={onInsert}
          onUpdate={onUpdate}
          onClose={closeAddModal}
        />
      )}

      {ccEditModalRow && (
        <CcTransactionModal
          editRow={ccEditModalRow}
          ccNameOptions={ccNameOptions}
          ccTipusOptions={ccTipusOptions}
          amountInputStyle={amountInputStyle}
          defaultVehicleCurrency={defaultVehicleCurrency}
          recallablePoolByFund={recallablePoolByFund}
          uncalledByFund={uncalledByFund}
          onInsert={onInsert}
          onUpdate={onUpdate}
          onClose={closeEditModal}
        />
      )}
    </Suspense>
  );
}

function Dashboard() {
  const { tc, dark } = useTheme();
  const { isAdmin, canAccessSection, canEditSection, canAccessAny } = useAuth();
  const d = useDashboardData();

  const {
    tab,
    setTab,
    inversionsSubTab,
    setInversionsSubTab,
    realEstateTab,
    setRealEstateTab,
    mercatsPublicsTab,
    searchersSubTab,
    setSearchersSubTab,
    companiesSubTab,
    setCompaniesSubTab,
    companiesPortfoliSubTab,
    setCompaniesPortfoliSubTab,
    activeNavItem,
    setActiveNavItem,
    handleNavigate,
  } = useTabRouter();

  const [excluded, setExcluded]= usePersistedState("ui_excluded", new Set(), { isSet: true });
  const [showLoader, setShowLoader] = useState(false);
  const [globalSearch, setGlobalSearch] = useState("");
  const [sidebarCollapsed, setSidebarCollapsed] = usePersistedState("ui_sidebarCollapsed", false);
  const [includeCompanies, setIncludeCompanies] = usePersistedState("ui_alt_include_companies", false);
  const [matrixMetric, setMatrixMetric] = usePersistedState("ui_alt_matrix_metric", "tvpi");
  // Single control for the Resum tab: the 3-way figures scope also drives whether
  // the companies matrix is shown (Fons → hidden, All/Companyies → shown).
  const [resumScope, setResumScope] = usePersistedState("ui_resum_scope", "all");
  const resumIncludeCompanies = resumScope !== "vehicles"; // shown for "all" and "companies"
  const resumShowFunds = resumScope !== "companies";       // shown for "all" and "vehicles"

  const altCohortMatrix = useMemo(
    () => buildAltCohortMatrix(d.rawCC, d.fundMeta),
    [d.rawCC, d.fundMeta]
  );
  const altCompanyCohortMatrix = useMemo(
    () => buildCompanyCohortMatrix(d.rawCC, d.fundMeta, { excludeIds: d.actualCompanyIds }),
    [d.rawCC, d.fundMeta, d.actualCompanyIds]
  );

  const ccNameOptions = useMemo(() => dedupeOptionValues([
    ...d.rawCC.map((row) => row.fons),
    ...d.companiesData.map((row) => row.nom),
    ...d.searchersData.map((row) => row.nom),
  ]), [d.companiesData, d.rawCC, d.searchersData]);
  const ccTipusOptions = useMemo(() => {
    const known = new Set(CAPITAL_CALL_TIPUS_OPTIONS.map(v => String(v).trim().toLowerCase()));
    const extras = [...new Set(d.rawCC.map(r => r.tipus).filter(Boolean))]
      .filter(v => !known.has(String(v).trim().toLowerCase()));
    return extras.length > 0 ? [...CAPITAL_CALL_TIPUS_GROUPED, ...extras] : CAPITAL_CALL_TIPUS_GROUPED;
  }, [d.rawCC]);
  const vehicleCurrencyMap = useMemo(() => {
    const map = new Map();
    d.rawCC.forEach((row) => {
      const key = normalizeOptionValue(row?.fons);
      const currency = String(row?.divisa ?? "").trim();
      if (key && currency && !map.has(key)) map.set(key, currency);
    });
    return map;
  }, [d.rawCC]);
  const recallablePoolByFund = useMemo(() => {
    const map = {};
    for (const r of d.rawCC) {
      const fund = r.fons;
      if (!fund) continue;
      if (!map[fund]) map[fund] = 0;
      if (r.cat === "Distribució" && r.recallable) {
        map[fund] += Number(r.recallable);
      }
      if (r.cat === "Capital Call" && r.from_recallable) {
        map[fund] -= Number(r.from_recallable);
      }
    }
    for (const k of Object.keys(map)) {
      map[k] = Math.round(map[k] * 100) / 100;
    }
    return map;
  }, [d.rawCC]);
  const uncalledByFund = useMemo(() => {
    const map = {};
    for (const r of d.rawCC) {
      const fund = r.fons;
      if (!fund) continue;
      if (!map[fund]) map[fund] = { compromis: 0, calls: 0 };
      if (r.cat === "Compromís") map[fund].compromis += Number(r.eur);
      if (r.cat === "Capital Call") map[fund].calls += Number(r.eur);
    }
    return Object.fromEntries(
      Object.entries(map).map(([k, v]) => [k, Math.max(0, Math.round((v.compromis - v.calls) * 100) / 100)])
    );
  }, [d.rawCC]);
  const defaultVehicleCurrency = useCallback((vehicleName) => {
    const key = normalizeOptionValue(vehicleName);
    return vehicleCurrencyMap.get(key) ?? "EUR";
  }, [vehicleCurrencyMap]);
  const amountInputStyle = useCallback((values) => {
    const raw = String(values?.eur ?? "").trim();
    if (!raw) return null;
    const amount = Number(raw);
    if (Number.isNaN(amount) || amount === 0) return null;
    return amount < 0
      ? { background: "#FDECEC", borderColor: "#E5B7B7", color: "#8F1D1D" }
      : { background: "#ECF8EE", borderColor: "#B7DEBD", color: tc.text };
  }, [tc.text]);

  const handleTxQuickUpdate = useCallback(async (row, fields) => {
    let errorMessage = null;
    await d.handleCCUpdate(
      row._rowId,
      { ...row, ...fields },
      (message) => { errorMessage = message; },
      row,
    );
    if (errorMessage) throw new Error(errorMessage);
  }, [d]);

  // navigation handled by useTabRouter()

  const [exporting, setExporting] = useState(false);

  const exportPDF = useCallback(() => { window.print(); }, []);

  const exportPNG = useCallback(async () => {
    const el = document.getElementById("dashboard-content");
    if (!el) return;
    setExporting(true);
    try {
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: null });
      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      a.download = `dashboard-${new Date().toISOString().slice(0,10)}.png`;
      a.click();
    } finally { setExporting(false); }
  }, []);

  const exportAll = useCallback(async () => {
    setExporting(true);
    try {
    const companies = d.companiesData;
    const searchers = d.searchersData;
    const pipeline  = d.funds0;
    const cc        = d.rawCC;
    const fundMeta  = d.fundMeta;
    const fmtN = v => v != null ? +(v / 1e6).toFixed(3) : "";

    await exportMultiXLSX([
      {
        name: "Capital Calls",
        rows: cc.map(r => ({
          "Fons": r.fons, "Tipus": r.tipus, "Categoria": r.cat,
          "Data": r.data, "Mes": r.mes, "Any": r.any, "FY": r.fy,
          "Estructura": r.est, "Import (€)": r.eur, "Divisa": r.divisa,
          "Import Divisa": r.amountNative ?? "",
          "FX BCE": r.fxRate ?? "",
          "Font FX": r.fxSource ?? "",
          "Comentaris": r.comentaris ?? "",
        })),
      },
      {
        name: "Fund Meta",
        rows: fundMeta.map(r => ({
          "Fons": r.fons,
          "TVPI": r.tvpi ?? "",
        })),
      },
      {
        name: "Pipeline",
        rows: pipeline.map(r => ({
          "ID": r.id, "Nom": r.name, "Import": r.amount, "Divisa": r.currency,
          "Geo": r.geography, "Estratègia": r.strategy, "Sector": r.sector,
          "Status": r.status, "Canal": r.canal, "Actiu": r.active ? "1" : "0",
        })),
      },
      {
        name: "Participades",
        rows: companies.map(c => ({
          "Nom": c.nom, "Tipus": c.tipus, "Segment": c.segment || "",
          "Entrepreneurs": c.entrepreneurs || "", "Origen": c.origen || "", "Geo": c.geo || "",
          "Ticket (€M)": c.ticket ? +(c.ticket / 1e6).toFixed(3) : "",
          "TVPI": c.tvpi ?? "", "Ingressos (€M)": c.rev ? +(c.rev / 1e6).toFixed(3) : "",
          "EBITDA (€M)": c.ebitda ? +(c.ebitda / 1e6).toFixed(3) : "",
          "Data Compromís": c.dataCompr || "", "Mesos Operant": c.mesosOperant ?? "",
        })),
      },
      (() => {
        const KPI_FIELDS = [
          ["Ingressos (€M)",       "rev"],
          ["Ing. Pressupost (€M)", "revBudget"],
          ["EBITDA (€M)",          "ebitda"],
          ["EBITDA Pres. (€M)",    "ebitdaBudget"],
          ["Deute Net (€M)",       "dfn"],
          ["DFN Pres. (€M)",       "dfnBudget"],
        ];
        const allQs = [...new Set(companies.flatMap(c => (c.quarters || []).map(q => q.q)))]
          .sort((a, b) => {
            const [, qa, ya] = a.match(/Q(\d) (\d+)/) || [, "0", "0"];
            const [, qb, yb] = b.match(/Q(\d) (\d+)/) || [, "0", "0"];
            return (+ya * 4 + +qa) - (+yb * 4 + +qb);
          });
        const rows = companies.map(c => {
          const byQ = Object.fromEntries((c.quarters || []).map(q => [q.q, q]));
          const row = { "Nom": c.nom };
          allQs.forEach(q => {
            const data = byQ[q] || {};
            KPI_FIELDS.forEach(([label, key]) => { row[`${q} | ${label}`] = fmtN(data[key] ?? null); });
          });
          return row;
        });
        return { name: "KPIs Trimestral", rows };
      })(),
      {
        name: "Searchers",
        rows: searchers.map(r => ({
          "Nom": r.nom || "", "Status": r.statusScreening || "",
          "Forma Entrada": r.formEntrada || "", "Geo": r.geo || "",
          "Ticket (€M)": r.ticket ? +(r.ticket / 1e6).toFixed(3) : "",
          "Data Inici": r.dataInici || "", "Modalitat": r.modalitat || "",
        })),
      },
    ], "TurtleCapital_Data");
    } finally { setExporting(false); }
  }, [d.companiesData, d.searchersData, d.funds0, d.rawCC, d.fundMeta]);

  const [fFy] = usePersistedState("ui_fFy",  "Tots");
  const [fEst] = usePersistedState("ui_fEst",  "Tots");
  const [fTipus] = usePersistedState("ui_fTipus",  "Tots");
  const [txSearch] = usePersistedState("ui_txSearch", "");
  const [sortFons] = usePersistedState("ui_sortFons", "compr");
  const [sortFonsDir] = usePersistedState("ui_sortFonsDir", "desc");
  const [ccChartF] = useState(null);

  const section = tab==="mercats-publics" ? "mercats-publics"
              : tab==="real-estate"     ? "real-estate"
              : tab==="re-cash-model"   ? "real-estate"
              : tab==="tx-alt"          ? "txlog"
              : tab==="tx-re"           ? "real-estate"
              : "alternatives";

  const {
    altAllTx,
    altAllCompr,
    byFy,
    byEst,
  } = useTransactionDerivedData({
    TRANSACTIONS: d.TRANSACTIONS,
    COMPROMISOS: d.COMPROMISOS,
    pcTx: d.pcTx,
    pcCompr: d.pcCompr,
    searcherTx: d.searcherTx,
    searcherCompr: d.searcherCompr,
    excluded,
    fFy,
    fEst,
    fTipus,
    txSearch,
    globalSearch,
    section,
    sortFons,
    sortFonsDir,
    ccChartF,
  });

  const currentPermissionId =
    tab === "real-estate"
      ? (realEstateTab === "altres-vehicles" ? "re-altres" : "re-directe")
      : tab === "mercats-publics"
        ? (
          mercatsPublicsTab === "transaccions" && activeNavItem === "tx-mp" ? "tx-mp"
          :
          mercatsPublicsTab === "rv" ? "mp-rv"
          : mercatsPublicsTab === "rf" ? "mp-rf"
          : mercatsPublicsTab === "posicions" ? "mp-posicions"
          : mercatsPublicsTab === "transaccions" ? "mp-transaccions"
          : mercatsPublicsTab === "traçabilitat" ? "mp-traçabilitat"
          : "mp-resum"
        )
        : tab === "tx-re"
          ? "tx-re"
          : tab === "tx-alt"
          ? "tx-alt"
          : tab === "searchers"
            ? "alternatives"
            : tab === "cash-model"
              ? "cash-model"
              : tab === "alt-cash-model"
              ? "cash-model"
              : tab === "re-cash-model"
              ? "cash-model"
              : tab === "companies"
              ? "companies"
              : tab === "inversions"
                ? "inversions"
                : "fons";



  const landingModel = useMemo(() => buildLandingModel({
    altTx: altAllTx,
    altCompr: altAllCompr,
    reTx: d.reTx,
    reCompr: d.reCompr,
    pmSummary: canAccessSection("mercats-publics") ? { valorActual: 0, nGestors: 0 } : null,
    canAccess: canAccessSection,
  }), [altAllTx, altAllCompr, d.reTx, d.reCompr, canAccessSection]);



  const estCfg = {
    "Fons Primari": { color:tc.navy, bg: dark ? "#112030" : "#E6EDF3" },
    "Fons Secundari": { color:tc.navyLight, bg: dark ? "#15263A" : "#EAF0F6" },
    "Fons de Fons": { color:tc.greenDark, bg: dark ? "#0A2010" : "#E8F8E8" },
    "Fons de Coinversió": { color:"#0F766E", bg: dark ? "#0B1F1D" : "#DFF7F3" },
    "Search Fund - Cerca": { color:"#2563A8", bg: dark ? "#0A1828" : "#DDEAF8" },
    "Search Fund - Participada": { color:"#1D4ED8", bg: dark ? "#101B3D" : "#E0E7FF" },
    "Participada (Altres)": { color:"#7A5A00", bg: dark ? "#1A1200" : "#FFF5D6" },
    "Fons Real Estate": { color:tc.purple||"#9B7CC8", bg: dark ? "#20163A" : "#F3EEF8" },
  };
  const catCfg = {
    "Capital Call":   { color:tc.navy,      bg: dark ? "#112030" : "#E6EDF3" },
    "Distribució":    { color:tc.green,     bg: dark ? "#0A2010" : "#E8F8E8" },
    "Retorn Capital": { color:tc.greenDark, bg: dark ? "#0A2010" : "#D6EAD6" },
    "Compromís":      { color:tc.navyLight, bg: dark ? "#112030" : "#E6EDF3" },
    "Altres":         { color:tc.textLight, bg: tc.bgAlt },
  };

  const SECTIONS_ALL = [
    {id:"alternatives",   label:"Alternatius"},
    {id:"real-estate",    label:"Real Estate"},
    {id:"mercats-publics", label:"Mercats Públics"},
  ];
  const SUPRA_ALL = [
    {id:"fons",       label:"Fons"},
    {id:"searchers",  label:"Searchers"},
    {id:"companies",  label:"Participades"},
    {id:"inversions", label:"Totes les Posicions"},
    {id:"cash-model", label:"Model Caixa"},
  ];
  const SECTIONS = useMemo(() => SECTIONS_ALL.filter(s => canAccessSection(s.id)), [canAccessSection]);
  const SUPRA = useMemo(() => SUPRA_ALL.filter(s =>
    s.id === "searchers" ? canAccessSection("alternatives") : canAccessSection(s.id)
  ), [canAccessSection]);
  const SEARCHERS_SUBTABS = useMemo(() => ([
    { id: "resum", label: "Resum" },
    { id: "tots", label: "Tots" },
    { id: "actius", label: "Actius" },
    { id: "legacy", label: "Legacy" },
    { id: "transaccions", label: "Transaccions" },
  ]), []);
  const COMPANIES_SUBTABS = useMemo(() => ([
    { id: "portfoli", label: "Portfoli" },
    { id: "transaccions", label: "Transaccions" },
  ]), []);
  const REAL_ESTATE_NAV = useMemo(() => [
    { id: "re-directe", tab: "directe" },
    { id: "re-altres", tab: "altres-vehicles" },
    { id: "re-inversions", tab: "inversions" },
  ].filter((item) => canAccessSection(item.id)), [canAccessSection]);
  const PUBLIC_MARKETS_NAV = useMemo(() => [
    { id: "mp-resum", tab: "resum" },
    { id: "mp-rv", tab: "rv" },
    { id: "mp-rf", tab: "rf" },
    { id: "mp-posicions", tab: "posicions" },
    { id: "mp-transaccions", tab: "transaccions" },
    { id: "mp-traçabilitat", tab: "traçabilitat" },
  ].filter((item) => canAccessSection(item.id)), [canAccessSection]);

  useEffect(() => {
    if (tab !== "searchers") return;
    if (!SEARCHERS_SUBTABS.some((item) => item.id === searchersSubTab)) setSearchersSubTab("tots");
  }, [tab, searchersSubTab, SEARCHERS_SUBTABS]);

  useEffect(() => {
    if (tab !== "companies") return;
    if (!COMPANIES_SUBTABS.some((item) => item.id === companiesSubTab)) setCompaniesSubTab("portfoli");
  }, [tab, companiesSubTab, COMPANIES_SUBTABS]);

  useEffect(() => {
    if (tab === "txlog") { setTab("tx-alt"); setActiveNavItem("tx-alt"); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (tab === "searchers" && activeNavItem !== "searchers") setActiveNavItem("searchers");
    if (tab === "companies" && activeNavItem !== "companies") setActiveNavItem("companies");
    if (tab === "cash-model"     && activeNavItem !== "cash-model")     setActiveNavItem("cash-model");
    if (tab === "alt-cash-model" && activeNavItem !== "alt-cash-model") setActiveNavItem("alt-cash-model");
    if (tab === "re-cash-model"  && activeNavItem !== "re-cash-model")  setActiveNavItem("re-cash-model");
    if (tab === "inversions" && activeNavItem !== "posicions") setActiveNavItem("posicions");
    if (tab === "pipeline" && activeNavItem !== "fons") setActiveNavItem("fons");
  }, [tab, activeNavItem, setActiveNavItem]);

  const canEdit = canEditSection(currentPermissionId);

  return (
    <CapitalCallModalProvider defaultVehicleCurrency={defaultVehicleCurrency}>
      <div className={`dashboard-wrapper ${dark ? "dark-theme" : "light-theme"}`} style={{ display: "flex", minHeight: "100vh", background: tc.bg }}>
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          activeNavItem={activeNavItem}
          onNavigate={handleNavigate}
          isAdmin={isAdmin}
          canAccessSection={canAccessSection}
          canAccessAny={canAccessAny}
          sections={SECTIONS}
          realEstateNav={REAL_ESTATE_NAV}
          publicMarketsNav={PUBLIC_MARKETS_NAV}
          supra={SUPRA}
        />

        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
          <header style={{ height: 64, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px", background: tc.card, borderBottom: `1px solid ${tc.border}`, position: "sticky", top: 0, zIndex: 100 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: tc.navy, letterSpacing: "-0.02em" }}>
                {tab === "home" ? "Inici" : (tab === "mercats-publics" || tab === "tx-mp") ? "Mercats Públics" : (tab === "real-estate" || tab === "tx-re" || tab === "re-cash-model") ? "Real Estate" : tab === "cash-model" ? "Model Caixa" : "Mercats Privats"}
              </div>
              {globalSearch.trim() && <div style={{ background: tc.bgAlt, padding: "4px 12px", borderRadius: 20, fontSize: 12, color: tc.textMid }}>🔍 {globalSearch}</div>}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ position: "relative", width: 280 }}>
                <input value={globalSearch} onChange={e => setGlobalSearch(e.target.value)} placeholder="Cerca global..." style={{ width: "100%", padding: "8px 12px 8px 36px", borderRadius: 8, border: `1.5px solid ${tc.border}`, background: tc.bg, color: tc.text, fontSize: 13, outline: "none", transition: "all 0.2s" }} />
                <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", opacity: 0.4 }}>🔍</span>
                {globalSearch && <button onClick={() => setGlobalSearch("")} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 14, opacity: 0.5 }}>✕</button>}
              </div>
            </div>
          </header>

        {d.isLoading && d.rawCC.length === 0 && (
          <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 200, background: tc.card, border: `1px solid ${tc.border}`, borderRadius: 10, padding: "10px 18px", display: "flex", alignItems: "center", gap: 10, boxShadow: "0 4px 16px rgba(0,0,0,.12)", fontSize: 13, color: tc.textMid }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: "spin 1s linear infinite", flexShrink: 0 }}>
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
            Carregant dades...
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}
        <main id="dashboard-content" style={{ flex: 1, padding: "24px 32px" }}>
          {tab === "home" && (
            <LandingTab
              model={landingModel}
              tc={tc}
              onNavigate={handleNavigate}
              pmCard={canAccessSection("mercats-publics")
                ? <Suspense fallback={null}><PmLandingCard tc={tc} onNavigate={handleNavigate} /></Suspense>
                : null}
            />
          )}

          {tab === "resum" && (
            <ResumTab
              tc={tc}
              byFy={byFy}
              byEst={byEst}
              estCfg={estCfg}
            />
          )}

          {tab === "mensual" && <Suspense fallback={null}><MensualTab TRANSACTIONS={d.TRANSACTIONS} COMPROMISOS={d.COMPROMISOS} onNavigate={setTab} onExcloure={setExcluded} excluded={excluded} /></Suspense>}

          {tab === "pipeline" && <Suspense fallback={null}><PipelineFY26 initialFunds={d.funds0} eurUsd={d.eurUsd} onDealsChange={d.setFunds0} /></Suspense>}

          {tab === "searchers" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div style={{ display: "flex", gap: 8, borderBottom: `1px solid ${tc.border}`, paddingBottom: 0 }}>
                {SEARCHERS_SUBTABS.map(st => (
                  <button key={st.id} onClick={() => setSearchersSubTab(st.id)} style={{ padding: "10px 16px", border: "none", background: "none", borderBottom: searchersSubTab === st.id ? `2px solid ${tc.navy}` : "2px solid transparent", color: searchersSubTab === st.id ? tc.navy : tc.textLight, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>{st.label}</button>
                ))}
              </div>
              <Suspense fallback={null}>
                {searchersSubTab === "resum" ? <SearchersTab search={globalSearch} subTab="resum" rawCC={d.rawCC} /> : <SearchersIndexInner searchOverride={globalSearch} subTab={searchersSubTab} rawCC={d.rawCC} />}
              </Suspense>
            </div>
          )}

          {tab === "companies" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div style={{ display: "flex", gap: 8, borderBottom: `1px solid ${tc.border}`, paddingBottom: 0 }}>
                {COMPANIES_SUBTABS.map(st => (
                  <button key={st.id} onClick={() => setCompaniesSubTab(st.id)} style={{ padding: "10px 16px", border: "none", background: "none", borderBottom: companiesSubTab === st.id ? `2px solid ${tc.navy}` : "2px solid transparent", color: companiesSubTab === st.id ? tc.navy : tc.textLight, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>{st.label}</button>
                ))}
              </div>
              <Suspense fallback={null}>
                {companiesSubTab === "transaccions" ? (
                  <TxSection tx={d.pcTx} compr={d.pcCompr} search={globalSearch} catCfg={catCfg} estCfg={estCfg} tc={tc} dark={dark} canEdit={canEdit} addDefaults={{ est: "Participada (Altres)" }} onDelete={r => d.handleCCDelete(r._rowId)} onQuickUpdate={handleTxQuickUpdate} title="Transaccions Participades (PC)" />
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <div style={{ display: "flex", gap: 6 }}>
                      {[{ id: "totes", label: "Tots" }, { id: "via-sf", label: "Via Search Fund" }, { id: "pe-directe", label: "PE Directe" }].map(st => (
                        <button key={st.id} onClick={() => setCompaniesPortfoliSubTab(st.id)} style={{ padding: "5px 14px", borderRadius: 20, border: `1.5px solid ${companiesPortfoliSubTab === st.id ? tc.navy : tc.border}`, background: companiesPortfoliSubTab === st.id ? tc.navy : "transparent", color: companiesPortfoliSubTab === st.id ? "#fff" : tc.textMid, cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: "inherit" }}>{st.label}</button>
                      ))}
                    </div>
                    <CompaniesIndexInner searchOverride={globalSearch} subTab={companiesPortfoliSubTab} />
                  </div>
                )}
              </Suspense>
            </div>
          )}

          {tab === "inversions" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div style={{ display: "flex", gap: 8, borderBottom: `1px solid ${tc.border}`, paddingBottom: 0 }}>
                <button onClick={() => setInversionsSubTab("resum")} style={{ padding: "10px 16px", border: "none", background: "none", borderBottom: inversionsSubTab === "resum" ? `2px solid ${tc.navy}` : "2px solid transparent", color: inversionsSubTab === "resum" ? tc.navy : tc.textLight, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>Resum</button>
                <button onClick={() => setInversionsSubTab("pipeline")} style={{ padding: "10px 16px", border: "none", background: "none", borderBottom: inversionsSubTab === "pipeline" ? `2px solid ${tc.navy}` : "2px solid transparent", color: inversionsSubTab === "pipeline" ? tc.navy : tc.textLight, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>Pipeline</button>
                <button onClick={() => setInversionsSubTab("fons")} style={{ padding: "10px 16px", border: "none", background: "none", borderBottom: inversionsSubTab === "fons" ? `2px solid ${tc.navy}` : "2px solid transparent", color: inversionsSubTab === "fons" ? tc.navy : tc.textLight, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>Portfoli</button>
                <button onClick={() => setInversionsSubTab("tx")} style={{ padding: "10px 16px", border: "none", background: "none", borderBottom: inversionsSubTab === "tx" ? `2px solid ${tc.navy}` : "2px solid transparent", color: inversionsSubTab === "tx" ? tc.navy : tc.textLight, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>Transaccions</button>
              </div>
              <Suspense fallback={null}>
                {inversionsSubTab === "resum"
                  ? <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                      <TxSection
                        summaryOnly
                        tx={altAllTx}
                        compr={altAllCompr}
                        scopeToggle
                        scope={resumScope}
                        onScopeChange={setResumScope}
                        vehiclesLabel="Fons"
                        search={globalSearch}
                        catCfg={catCfg}
                        estCfg={estCfg}
                        tc={tc}
                        dark={dark}
                        canEdit={false}
                      />
                      <AltCohortSection
                        tc={tc}
                        matrix={altCohortMatrix}
                        companyMatrix={altCompanyCohortMatrix}
                        includeCompanies={resumIncludeCompanies}
                        showFundsMatrix={resumShowFunds}
                        hideCompaniesToggle
                        metric={matrixMetric}
                        onMetricChange={setMatrixMetric}
                      />
                    </div>
                  : inversionsSubTab === "fons"
                  ? <FundsIndexInner searchOverride={globalSearch} vcpeTypes={["PE", "VC"]} excludeIds={d.actualCompanyIds} includeCompanies={includeCompanies} onToggleCompanies={setIncludeCompanies} />
                  : inversionsSubTab === "pipeline"
                    ? <PipelineFY26 initialFunds={d.funds0} eurUsd={d.eurUsd} onDealsChange={d.setFunds0} />
                    : <TxSection tx={altAllTx} compr={altAllCompr} scopeToggle scopeStorageKey="ui_tx_all_scope" defaultScope="vehicles" search={globalSearch} catCfg={catCfg} estCfg={estCfg} tc={tc} dark={dark} canEdit={canEdit} addDefaults={{}} onDelete={r => d.handleCCDelete(r._rowId)} onQuickUpdate={handleTxQuickUpdate} title="Totes les Transaccions" />}
              </Suspense>
            </div>
          )}

          {tab === "cash-model" && (
            canAccessSection("cash-model")
              ? <Suspense fallback={null}><ProspectiveCashTab rawCapitalCalls={d.rawCC} fundMeta={d.fundMeta} /></Suspense>
              : <div style={{ padding: 32, color: tc.textLight, fontSize: 14 }}>No tens permisos per accedir al Model Caixa.</div>
          )}

          {tab === "alt-cash-model" && (
            canAccessSection("cash-model")
              ? <Suspense fallback={null}><ProspectiveCashTab rawCapitalCalls={d.rawCC} fundMeta={d.fundMeta} forceScope="alt" /></Suspense>
              : <div style={{ padding: 32, color: tc.textLight, fontSize: 14 }}>No tens permisos per accedir al Model Caixa.</div>
          )}

          {tab === "re-cash-model" && (
            canAccessSection("cash-model")
              ? <Suspense fallback={null}><ProspectiveCashTab rawCapitalCalls={d.rawCC} fundMeta={d.fundMeta} forceScope="re" /></Suspense>
              : <div style={{ padding: 32, color: tc.textLight, fontSize: 14 }}>No tens permisos per accedir al Model Caixa.</div>
          )}


          {tab === "real-estate" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div style={{ display: "flex", gap: 8, borderBottom: `1px solid ${tc.border}`, paddingBottom: 0 }}>
                {REAL_ESTATE_NAV.map(item => (
                  <button key={item.id} onClick={() => setRealEstateTab(item.tab)} style={{ padding: "10px 16px", border: "none", background: "none", borderBottom: realEstateTab === item.tab ? `2px solid ${tc.navy}` : "2px solid transparent", color: realEstateTab === item.tab ? tc.navy : tc.textLight, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>{item.tab === "directe" ? "RE Directe" : item.tab === "altres-vehicles" ? "Vehicles Real Estate" : "Totes les Posicions"}</button>
                ))}
              </div>
              {(realEstateTab === "inversions" || realEstateTab === "altres-vehicles")
                ? <Suspense fallback={null}><FundsIndexInner searchOverride={globalSearch} vcpeTypes={["RE"]} /></Suspense>
                : <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:12, padding:"80px 24px", color:tc.textLight, textAlign:"center" }}>
                    <span style={{ fontSize:36 }}>🚧</span>
                    <div style={{ fontSize:16, fontWeight:700, color:tc.text }}>Secció en construcció</div>
                    <div style={{ fontSize:13 }}>La cartera de Real Estate Directe estarà disponible properament.</div>
                  </div>}
            </div>
          )}

          {tab === "mercats-publics" && (
            <Suspense fallback={null}>
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                {mercatsPublicsTab === "resum" && <PublicMarketsTab />}
                {mercatsPublicsTab === "rv" && <HoldingsTable assetClass="RV" title="Renda Variable" />}
                {mercatsPublicsTab === "rf" && <HoldingsTable assetClass="RF" title="Renda Fixa" />}
                {mercatsPublicsTab === "posicions" && <PMTipusTab />}
                {mercatsPublicsTab === "transaccions" && <PMTransaccionsTab search={globalSearch} />}
                {mercatsPublicsTab === "traçabilitat" && <PMTraçabilitatTab />}
              </div>
            </Suspense>
          )}

          {tab === "tx-alt" && <Suspense fallback={null}><TxSection tx={altAllTx} compr={altAllCompr} scopeToggle scopeStorageKey="ui_tx_alt_scope" defaultScope="vehicles" search={globalSearch} catCfg={catCfg} estCfg={estCfg} tc={tc} dark={dark} canEdit={canEdit} addDefaults={{}} onDelete={r => d.handleCCDelete(r._rowId)} onQuickUpdate={handleTxQuickUpdate} title="Registre de Transaccions (Alternatius)" /></Suspense>}
          {tab === "tx-re" && <Suspense fallback={null}><TxSection tx={d.reTx} compr={d.reCompr} search={globalSearch} catCfg={catCfg} estCfg={estCfg} tc={tc} dark={dark} canEdit={canEdit} addDefaults={{ est: "Fons Real Estate" }} onDelete={r => d.handleCCDelete(r._rowId)} onQuickUpdate={handleTxQuickUpdate} title="Registre de Transaccions (Real Estate)" /></Suspense>}
          {tab === "tx-mp" && <Suspense fallback={null}><PMTransaccionsTab search={globalSearch} /></Suspense>}
        </main>
      </div>

      {showLoader && (
        <Suspense fallback={null}>
          <DataLoader
            onClose={() => setShowLoader(false)}
            onLoad={(key, rows) => d.handleLoad(key, rows, () => setExcluded(new Set()))}
            exportAll={exportAll}
            exportPDF={exportPDF}
            exportPNG={exportPNG}
            exporting={exporting}
            loadedAt={d.loadedAt}
          />
        </Suspense>
      )}

      <CapitalCallModals
        ccNameOptions={ccNameOptions}
        ccTipusOptions={ccTipusOptions}
        amountInputStyle={amountInputStyle}
        defaultVehicleCurrency={defaultVehicleCurrency}
        recallablePoolByFund={recallablePoolByFund}
        uncalledByFund={uncalledByFund}
        onInsert={d.handleCCInsert}
        onUpdate={d.handleCCUpdate}
      />
    </div>
  </CapitalCallModalProvider>
  );
}

export { Dashboard };
export default Dashboard;
