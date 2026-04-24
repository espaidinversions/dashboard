import React, { useState, useMemo, useEffect, useCallback } from "react";
import html2canvas from "html2canvas";
import {
  FY_LIST, MESOS,
  CAPITAL_CALL_TIPUS_OPTIONS,
} from "../config.js";
import { useTheme } from "../theme.js";
import { fmtM, usePersistedState, exportMultiXLSX, readStoredJSON, writeStoredJSON } from "../utils.js";
import { Badge, AddRowModal } from "./SharedComponents.jsx";
import { FonsSelector } from "./FonsSelector.jsx";
import { PipelineFY26 } from "./PipelineFY26.jsx";
import { MensualTab } from "./MensualTab.jsx";
import { SearchersTab } from "./SearchersTab.jsx";
import { SearchersIndexInner } from "./SearchersIndex.jsx";
import { PortfolioCompaniesTab } from "./PortfolioCompaniesTab.jsx";
import { FundsIndexInner } from "./FundsIndex.jsx";
import { CompaniesIndexInner } from "./CompaniesIndex.jsx";
import { useAuth } from "../auth.jsx";
import { DataLoader } from "./DataLoader.jsx";
import { PublicMarketsTab } from "./PublicMarketsTab.jsx";
import { HoldingsTable } from "./HoldingsTable.jsx";
import { PMTipusTab } from "./PMTipusTab.jsx";
import { PMTransaccionsTab } from "./PMTransaccionsTab.jsx";
import { PMTraçabilitatTab } from "./PMTraçabilitatTab.jsx";
import { ResumTab } from "./tabs/index.js";
import { Sidebar } from "./Sidebar.jsx";
import { buildRealEstateFundsMap } from "../data/realEstateModel.js";
import { useDashboardData } from "./hooks/useDashboardData.js";
import { TxSection } from "./TxSection.jsx";

const LS_CC = "tc_rawCC";

function normalizeOptionValue(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function dedupeOptionValues(values) {
  const seen = new Map();
  (Array.isArray(values) ? values : []).forEach((value) => {
    const raw = String(value ?? "").trim();
    if (!raw) return;
    const key = normalizeOptionValue(raw);
    if (!seen.has(key)) seen.set(key, raw);
  });
  return [...seen.values()].sort((a, b) => String(a).localeCompare(String(b), "ca", { sensitivity: "base" }));
}

function Dashboard() {
  const { tc, dark } = useTheme();
  const { isAdmin, canAccessSection, canEditSection } = useAuth();
  const d = useDashboardData();

  const [tab,      setTab]     = usePersistedState("ui_tab", "resum");
  const [excluded, setExcluded]= usePersistedState("ui_excluded", new Set(), { isSet: true });
  const [showLoader, setShowLoader] = useState(false);
  const [globalSearch, setGlobalSearch] = useState("");
  const [inversionsSubTab, setInversionsSubTab] = useState("fons");
  const [realEstateTab, setRealEstateTab] = useState("directe");
  const [mercatsPublicsTab, setMercatsPublicsTab] = useState("resum");
  const [searchersSubTab, setSearchersSubTab] = useState("tots");
  const [companiesSubTab, setCompaniesSubTab] = useState("totes");
  const [sidebarCollapsed, setSidebarCollapsed] = usePersistedState("ui_sidebarCollapsed", false);
  const [activeNavItem,    setActiveNavItem]     = usePersistedState("ui_navItem", "fons");
  const [ccAddModalFons, setCcAddModalFons] = useState(null);
  const [ccAddModalDefaults, setCcAddModalDefaults] = useState(null);
  const [ccEditModalRow, setCcEditModalRow] = useState(null);

  const ccNameOptions = useMemo(() => dedupeOptionValues([
    ...d.rawCC.map((row) => row.fons),
    ...d.companiesData.map((row) => row.nom),
    ...d.searchersData.map((row) => row.nom),
  ]), [d.companiesData, d.rawCC, d.searchersData]);
  const ccTipusOptions = useMemo(() => dedupeOptionValues([
    ...CAPITAL_CALL_TIPUS_OPTIONS,
  ]), []);
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
  const defaultVehicleCurrency = useCallback((vehicleName) => {
    const key = normalizeOptionValue(vehicleName);
    return vehicleCurrencyMap.get(key) ?? "EUR";
  }, [vehicleCurrencyMap]);

  function openCcAddModal(defaults = {}) {
    const fons = defaults.fons ?? "";
    setCcAddModalDefaults({
      ...defaults,
      divisa: defaults.divisa ?? defaultVehicleCurrency(fons),
    });
    setCcAddModalFons(fons);
  }

  function handleNavigate(itemId) {
    setActiveNavItem(itemId);
    switch (itemId) {
      case "fons":           setTab("inversions"); setInversionsSubTab("fons"); break;
      case "searchers":      setTab("searchers"); break;
      case "companies":      setTab("companies"); break;
      case "posicions":      setTab("inversions"); break;
      case "re-directe":     setTab("real-estate");     setRealEstateTab("directe"); break;
      case "re-altres":      setTab("real-estate");     setRealEstateTab("altres-vehicles"); break;
      case "re-inversions":  setTab("real-estate");     setRealEstateTab("inversions"); break;
      case "mp-resum":       setTab("mercats-publics"); setMercatsPublicsTab("resum"); break;
      case "mp-rv":          setTab("mercats-publics"); setMercatsPublicsTab("rv"); break;
      case "mp-rf":          setTab("mercats-publics"); setMercatsPublicsTab("rf"); break;
      case "mp-posicions":   setTab("mercats-publics"); setMercatsPublicsTab("posicions"); break;
      case "mp-transaccions":setTab("mercats-publics"); setMercatsPublicsTab("transaccions"); break;
      case "mp-traçabilitat":setTab("mercats-publics"); setMercatsPublicsTab("traçabilitat"); break;
      case "tx-alt":         setTab("tx-alt"); break;
      case "tx-mp":          setTab("mercats-publics"); setMercatsPublicsTab("transaccions"); break;
      default: break;
    }
  }

  const [exporting, setExporting] = useState(false);

  const exportPDF = useCallback(() => { window.print(); }, []);

  const exportPNG = useCallback(async () => {
    const el = document.getElementById("dashboard-content");
    if (!el) return;
    setExporting(true);
    try {
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
    const companies = readStoredJSON("tc_portfolioCompanies", []);
    const searchers = readStoredJSON("tc_allSearchers", []);
    const pipeline  = readStoredJSON("tc_funds0", []);
    const cc        = readStoredJSON("tc_rawCC", []);
    const fundMeta = readStoredJSON("tc_fundMeta", []);
    const fmtN = v => v != null ? +(v / 1e6).toFixed(3) : "";

    await exportMultiXLSX([
      {
        name: "Capital Calls",
        rows: cc.map(r => ({
          "Fons": r.fons, "Tipus": r.tipus, "Categoria": r.cat,
          "Data": r.data, "Mes": r.mes, "Any": r.any, "FY": r.fy,
          "VCPE": r.vcpe, "Estructura": r.est, "Import (€)": r.eur, "Divisa": r.divisa,
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
  }, []);

  const [fFy,     setFFy]     = usePersistedState("ui_fFy",  "Tots");
  const [fVcpe,   setFVcpe]   = usePersistedState("ui_fVcpe", new Set(), { isSet: true });
  const [fEst,    setFEst]    = usePersistedState("ui_fEst",  "Tots");
  const [fCat,    setFCat]    = usePersistedState("ui_fCat",  "Tots");
  const [txSearch,setTxSearch]= usePersistedState("ui_txSearch", "");
  const [sortFons, setSortFons] = usePersistedState("ui_sortFons", "compr");
  const [sortFonsDir, setSortFonsDir] = usePersistedState("ui_sortFonsDir", "desc");
  const [expandedFons, setExpandedFons] = useState(new Set());
  const [ccChartF, setCcChartF] = useState(null);

  const baseTx      = useMemo(()=>d.TRANSACTIONS.filter(r=>!excluded.has(r.fons)&&(r.vcpe==="PE"||r.vcpe==="VC")),[d.TRANSACTIONS,excluded]);
  const baseCompr   = useMemo(()=>d.COMPROMISOS.filter(r=>!excluded.has(r.fons)&&(r.vcpe==="PE"||r.vcpe==="VC")),[d.COMPROMISOS,excluded]);
  const allAltTx    = useMemo(()=>d.TRANSACTIONS.filter(r=>!excluded.has(r.fons)),[d.TRANSACTIONS,excluded]);
  const allAltCompr = useMemo(()=>d.COMPROMISOS.filter(r=>!excluded.has(r.fons)),[d.COMPROMISOS,excluded]);

  const section = tab==="mercats-publics" ? "mercats-publics"
              : tab==="real-estate"     ? "real-estate"
              : tab==="tx-alt"          ? "txlog"
              : "alternatives";
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
        : tab === "tx-alt"
          ? "tx-alt"
          : tab === "searchers"
            ? "alternatives"
            : tab === "companies"
              ? "companies"
              : tab === "inversions"
                ? "inversions"
                : "fons";

  const filtered = useMemo(()=>{
    let dat=baseTx;
    if(fFy  !=="Tots") dat=dat.filter(r=>r.fy===fFy);
    if(fVcpe.size>0) dat=dat.filter(r=>fVcpe.has(r.vcpe));
    if(fEst !=="Tots") dat=dat.filter(r=>r.est===fEst);
    if(fCat !=="Tots") dat=dat.filter(r=>r.cat===fCat);
    if(txSearch.trim()) {
      const q=txSearch.trim().toLowerCase();
      dat=dat.filter(r=>(r.fons||"").toLowerCase().includes(q)||(r.tipus||"").toLowerCase().includes(q)||(r.cat||"").toLowerCase().includes(q));
    }
    if(section==="alternatives"&&globalSearch.trim()) {
      const q=globalSearch.trim().toLowerCase();
      dat=dat.filter(r=>(r.fons||"").toLowerCase().includes(q));
    }
    return dat;
  },[baseTx,fFy,fVcpe,fEst,fCat,txSearch,globalSearch,section]);

  const fCalls = useMemo(()=>filtered.filter(r=>r.cat==="Capital Call").reduce((s,r)=>s+r.eur,0),[filtered]);
  const fDist  = useMemo(()=>filtered.filter(r=>r.cat==="Distribució"||r.cat==="Retorn Capital").reduce((s,r)=>s+Math.abs(r.eur),0),[filtered]);

  const byFy = useMemo(()=>FY_LIST.map(fy=>{
    const rows=filtered.filter(r=>r.fy===fy);
    const calls=rows.filter(r=>r.cat==="Capital Call").reduce((s,r)=>s+r.eur,0);
    const dist =rows.filter(r=>r.cat==="Distribució").reduce((s,r)=>s+Math.abs(r.eur),0);
    const ret  =rows.filter(r=>r.cat==="Retorn Capital").reduce((s,r)=>s+Math.abs(r.eur),0);
    return {fy:fy.replace("FY ",""),"Capital Call":+calls.toFixed(0),"Distribució":+dist.toFixed(0),"Retorn Capital":+ret.toFixed(0)};
  }).filter(r=>r["Capital Call"]||r["Distribució"]||r["Retorn Capital"]),[filtered]);

  const byMes = useMemo(()=>{
    const src=fFy!=="Tots"?filtered:filtered.filter(r=>r.any>=2023);
    const m={};
    src.forEach(r=>{
      const k=`${r.any}-${String(r.mes).padStart(2,"0")}`;
      if(!m[k])m[k]={mes:k,label:`${MESOS[r.mes]||""} ${r.any}`,"Capital Call":0,"Distribució":0,"Retorn Capital":0};
      if(r.cat==="Capital Call")   m[k]["Capital Call"]   +=r.eur;
      if(r.cat==="Distribució")    m[k]["Distribució"]    +=Math.abs(r.eur);
      if(r.cat==="Retorn Capital") m[k]["Retorn Capital"] +=Math.abs(r.eur);
    });
    return Object.values(m).sort((a,b)=>a.mes.localeCompare(b.mes));
  },[filtered,fFy]);

  const byVcpe = useMemo(()=>{
    const m={};
    filtered.filter(r=>r.cat==="Capital Call").forEach(r=>{m[r.vcpe]=(m[r.vcpe]||0)+r.eur;});
    const tot=Object.values(m).reduce((s,v)=>s+v,0);
    return Object.entries(m).map(([name,value])=>({name,value:+value.toFixed(0),pct:((value/tot)*100).toFixed(1)}));
  },[filtered]);

  const byEst = useMemo(()=>{
    const m={};
    filtered.filter(r=>r.cat==="Capital Call"&&r.est).forEach(r=>{m[r.est]=(m[r.est]||0)+r.eur;});
    const tot=Object.values(m).reduce((s,v)=>s+v,0);
    return Object.entries(m).map(([name,value])=>({name,value:+value.toFixed(0),pct:((value/tot)*100).toFixed(1)}));
  },[filtered]);

  const FONS_MAP2 = useMemo(()=>{
    const m={};
    baseCompr.forEach(r=>{m[r.id ?? r.fons]={id:r.id ?? null,fons:r.fons,compr:r.eur,vcpe:r.vcpe,est:r.est,calls:0,dist:0,retorn:0};});
    baseTx.forEach(r=>{
      const key = r.id ?? r.fons;
      if(!m[key])m[key]={id:r.id ?? null,fons:r.fons,compr:0,vcpe:r.vcpe,est:r.est,calls:0,dist:0,retorn:0};
      if(r.cat==="Capital Call")   m[key].calls  +=r.eur;
      if(r.cat==="Distribució")    m[key].dist   +=Math.abs(r.eur);
      if(r.cat==="Retorn Capital") m[key].retorn +=Math.abs(r.eur);
    });
    return Object.values(m);
  },[baseCompr,baseTx]);
  const RE_FONS_MAP = useMemo(() => buildRealEstateFundsMap(d.reCompr, d.reTx), [d.reCompr, d.reTx]);

  const fonsFiltered = useMemo(()=>{
    let fl=[...FONS_MAP2];
    if(fVcpe.size>0) fl=fl.filter(f=>fVcpe.has(f.vcpe));
    if(fEst !=="Tots") fl=fl.filter(f=>f.est===fEst);
    if(ccChartF) {
      if(ccChartF.type==="vcpe") fl=fl.filter(f=>f.vcpe===ccChartF.value);
      if(ccChartF.type==="est")  fl=fl.filter(f=>f.est===ccChartF.value);
      if(ccChartF.type==="fy")   fl=fl.filter(f=>baseTx.filter(r=>r.fons===f.fons&&r.fy==="FY "+ccChartF.value&&r.cat==="Capital Call").length>0);
    }
    const dir=sortFonsDir==="asc"?1:-1;
    return [...fl].sort((a,b)=>{
      if(sortFons==="fons")   return dir*a.fons.localeCompare(b.fons);
      if(sortFons==="compr")  return dir*(a.compr-b.compr);
      if(sortFons==="calls")  return dir*(a.calls-b.calls);
      if(sortFons==="pct")    return dir*((a.compr>0?a.calls/a.compr:0)-(b.compr>0?b.calls/b.compr:0));
      if(sortFons==="dist")   return dir*(a.dist-b.dist);
      if(sortFons==="retorn") return dir*(a.retorn-b.retorn);
      if(sortFons==="rebut")  return dir*((a.dist+a.retorn)-(b.dist+b.retorn));
      if(sortFons==="net")    return dir*(((a.dist+a.retorn)-a.calls)-((b.dist+b.retorn)-b.calls));
      if(sortFons==="vcpe")   return dir*a.vcpe.localeCompare(b.vcpe);
      if(sortFons==="est")    return dir*a.est.localeCompare(b.est);
      return 0;
    });
  },[FONS_MAP2,fVcpe,fEst,sortFons,sortFonsDir,ccChartF,baseTx]);

  const clearFilters = ()=>{setFFy("Tots");setFVcpe(new Set());setFEst("Tots");setFCat("Tots");setTxSearch("");};
  const anyFilter = fFy!=="Tots"||fVcpe.size>0||fEst!=="Tots"||fCat!=="Tots"||txSearch.trim()!="";

  const vcpeCfg = {
    "PE": { color:tc.navy,               bg: dark ? "#112030" : "#E6EDF3" },
    "VC": { color:tc.green,              bg: dark ? "#0A2010" : "#E8F8E8" },
    "RE": { color:tc.purple||"#9B7CC8",  bg: dark ? "#20163A" : "#F3EEF8" },
    "SF": { color:"#2563A8",             bg: dark ? "#0A1828" : "#DDEAF8" },
    "PC": { color:"#7A5A00",             bg: dark ? "#1A1200" : "#FFF5D6" },
  };
  const estCfg = {
    "Fons Primari": { color:tc.navy,      bg: dark ? "#112030" : "#E6EDF3" },
    "Fons de Fons": { color:tc.greenDark, bg: dark ? "#0A2010" : "#E8F8E8" },
    "SOCIMI":       { color:tc.purple||"#9B7CC8", bg: dark ? "#20163A" : "#F3EEF8" },
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
  ];
  const SECTIONS = useMemo(() => SECTIONS_ALL.filter(s => canAccessSection(s.id)), [canAccessSection]);
  const SUPRA = useMemo(() => SUPRA_ALL.filter(s =>
    s.id === "searchers" ? canAccessSection("alternatives") : canAccessSection(s.id)
  ), [canAccessSection]);
  const SEARCHERS_SUBTABS = useMemo(() => ([
    { id: "resum", label: "Resum" },
    { id: "tots", label: "Tots" },
    { id: "actius", label: "Actius" },
    { id: "transaccions", label: "Transaccions" },
  ]), []);
  const COMPANIES_SUBTABS = useMemo(() => ([
    { id: "totes", label: "Totes" },
    { id: "via-sf", label: "Via Search Fund" },
    { id: "pe-directe", label: "PE Directe" },
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
    if (!COMPANIES_SUBTABS.some((item) => item.id === companiesSubTab)) setCompaniesSubTab("totes");
  }, [tab, companiesSubTab, COMPANIES_SUBTABS]);

  useEffect(() => {
    if (tab === "txlog") { setTab("tx-alt"); setActiveNavItem("tx-alt"); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (tab === "searchers" && activeNavItem !== "searchers") setActiveNavItem("searchers");
    if (tab === "companies" && activeNavItem !== "companies") setActiveNavItem("companies");
    if (tab === "inversions" && activeNavItem !== "posicions") setActiveNavItem("posicions");
    if (tab === "pipeline" && activeNavItem !== "fons") setActiveNavItem("fons");
  }, [tab, activeNavItem, setActiveNavItem]);

  const canEdit = canEditSection(currentPermissionId);

  return (
    <div className={`dashboard-wrapper ${dark ? "dark-theme" : "light-theme"}`} style={{ display: "flex", minHeight: "100vh", background: tc.bg }}>
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        activeNavItem={activeNavItem}
        onNavigate={handleNavigate}
        sections={SECTIONS}
        realEstateNav={REAL_ESTATE_NAV}
        publicMarketsNav={PUBLIC_MARKETS_NAV}
        supra={SUPRA}
      />

      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <header style={{ height: 64, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px", background: tc.card, borderBottom: `1px solid ${tc.border}`, position: "sticky", top: 0, zIndex: 100 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: tc.navy, letterSpacing: "-0.02em" }}>
              {tab === "mercats-publics" ? "Mercats Públics" : tab === "real-estate" ? "Real Estate" : "Mercats Privats"}
            </div>
            {globalSearch.trim() && <div style={{ background: tc.bgAlt, padding: "4px 12px", borderRadius: 20, fontSize: 12, color: tc.textMid }}>🔍 {globalSearch}</div>}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ position: "relative", width: 280 }}>
              <input value={globalSearch} onChange={e => setGlobalSearch(e.target.value)} placeholder="Cerca global..." style={{ width: "100%", padding: "8px 12px 8px 36px", borderRadius: 8, border: `1.5px solid ${tc.border}`, background: tc.bg, color: tc.text, fontSize: 13, outline: "none", transition: "all 0.2s" }} />
              <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", opacity: 0.4 }}>🔍</span>
              {globalSearch && <button onClick={() => setGlobalSearch("")} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 14, opacity: 0.5 }}>✕</button>}
            </div>
            <button onClick={() => setShowLoader(true)} style={{ background: tc.navy, color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>Gestió Dades</button>
          </div>
        </header>

        <main id="dashboard-content" style={{ flex: 1, padding: "24px 32px" }}>
          {tab === "resum" && <ResumTab TRANSACTIONS={d.TRANSACTIONS} COMPROMISOS={d.COMPROMISOS} fonsFiltered={FONS_MAP2} rawCC={d.rawCC} onNavigate={setTab} onExcloure={setExcluded} excluded={excluded} />}

          {tab === "mensual" && <MensualTab TRANSACTIONS={d.TRANSACTIONS} COMPROMISOS={d.COMPROMISOS} onNavigate={setTab} onExcloure={setExcluded} excluded={excluded} />}

          {tab === "pipeline" && <PipelineFY26 initialFunds={d.funds0} eurUsd={d.eurUsd} onDealsChange={d.setFunds0} />}

          {tab === "searchers" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div style={{ display: "flex", gap: 8, borderBottom: `1px solid ${tc.border}`, paddingBottom: 0 }}>
                {SEARCHERS_SUBTABS.map(st => (
                  <button key={st.id} onClick={() => setSearchersSubTab(st.id)} style={{ padding: "10px 16px", border: "none", background: "none", borderBottom: searchersSubTab === st.id ? `2px solid ${tc.navy}` : "2px solid transparent", color: searchersSubTab === st.id ? tc.navy : tc.textLight, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>{st.label}</button>
                ))}
              </div>
              {searchersSubTab === "resum" ? <SearchersTab search={globalSearch} subTab="resum" rawCC={d.rawCC} /> : <SearchersIndexInner search={globalSearch} subTab={searchersSubTab} rawCC={d.rawCC} />}
            </div>
          )}

          {tab === "companies" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div style={{ display: "flex", gap: 8, borderBottom: `1px solid ${tc.border}`, paddingBottom: 0 }}>
                {COMPANIES_SUBTABS.map(st => (
                  <button key={st.id} onClick={() => setCompaniesSubTab(st.id)} style={{ padding: "10px 16px", border: "none", background: "none", borderBottom: companiesSubTab === st.id ? `2px solid ${tc.navy}` : "2px solid transparent", color: companiesSubTab === st.id ? tc.navy : tc.textLight, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>{st.label}</button>
                ))}
              </div>
              {companiesSubTab === "transaccions" ? (
                <TxSection tx={d.pcTx} compr={d.pcCompr} search={globalSearch} catCfg={catCfg} vcpeCfg={vcpeCfg} estCfg={estCfg} tc={tc} dark={dark} canEdit={canEdit} onAdd={() => openCcAddModal({ vcpe: "PC" })} onEdit={setCcEditModalRow} onDelete={r => d.handleCCDelete(r._rowId)} title="Transaccions Participades (PC)" />
              ) : <CompaniesIndexInner search={globalSearch} subTab={companiesSubTab} />}
            </div>
          )}

          {tab === "inversions" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div style={{ display: "flex", gap: 8, borderBottom: `1px solid ${tc.border}`, paddingBottom: 0 }}>
                <button onClick={() => setInversionsSubTab("fons")} style={{ padding: "10px 16px", border: "none", background: "none", borderBottom: inversionsSubTab === "fons" ? `2px solid ${tc.navy}` : "2px solid transparent", color: inversionsSubTab === "fons" ? tc.navy : tc.textLight, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>Per Vehicle</button>
                <button onClick={() => setInversionsSubTab("tx")} style={{ padding: "10px 16px", border: "none", background: "none", borderBottom: inversionsSubTab === "tx" ? `2px solid ${tc.navy}` : "2px solid transparent", color: inversionsSubTab === "tx" ? tc.navy : tc.textLight, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>Transaccions</button>
              </div>
              {inversionsSubTab === "fons" ? <FundsIndexInner search={globalSearch} /> : <TxSection tx={allAltTx} compr={allAltCompr} search={globalSearch} catCfg={catCfg} vcpeCfg={vcpeCfg} estCfg={estCfg} tc={tc} dark={dark} canEdit={canEdit} onAdd={() => openCcAddModal()} onEdit={setCcEditModalRow} onDelete={r => d.handleCCDelete(r._rowId)} title="Totes les Transaccions" />}
            </div>
          )}

          {tab === "real-estate" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div style={{ display: "flex", gap: 8, borderBottom: `1px solid ${tc.border}`, paddingBottom: 0 }}>
                {REAL_ESTATE_NAV.map(item => (
                  <button key={item.id} onClick={() => setRealEstateTab(item.tab)} style={{ padding: "10px 16px", border: "none", background: "none", borderBottom: realEstateTab === item.tab ? `2px solid ${tc.navy}` : "2px solid transparent", color: realEstateTab === item.tab ? tc.navy : tc.textLight, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>{item.tab === "directe" ? "RE Directe" : item.tab === "altres-vehicles" ? "Altres Vehicles" : "Totes les Posicions"}</button>
                ))}
              </div>
              {realEstateTab === "inversions" ? <FundsIndexInner search={globalSearch} vcpeFilter="RE" /> : <TxSection tx={d.reTx.filter(r => realEstateTab === "directe" ? r.est === "Directe" : r.est !== "Directe")} compr={d.reCompr.filter(r => realEstateTab === "directe" ? r.est === "Directe" : r.est !== "Directe")} search={globalSearch} catCfg={catCfg} vcpeCfg={vcpeCfg} estCfg={estCfg} tc={tc} dark={dark} canEdit={canEdit} onAdd={() => openCcAddModal({ vcpe: "RE", est: realEstateTab === "directe" ? "Directe" : "SOCIMI" })} onEdit={setCcEditModalRow} onDelete={r => d.handleCCDelete(r._rowId)} title={`Transaccions Real Estate — ${realEstateTab === "directe" ? "Directe" : "Altres"}`} />}
            </div>
          )}

          {tab === "mercats-publics" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {mercatsPublicsTab === "resum" && <PublicMarketsTab />}
              {mercatsPublicsTab === "rv" && <HoldingsTable assetClass="RV" title="Renda Variable" />}
              {mercatsPublicsTab === "rf" && <HoldingsTable assetClass="RF" title="Renda Fixa" />}
              {mercatsPublicsTab === "posicions" && <PMTipusTab />}
              {mercatsPublicsTab === "transaccions" && <PMTransaccionsTab search={globalSearch} />}
              {mercatsPublicsTab === "traçabilitat" && <PMTraçabilitatTab />}
            </div>
          )}

          {tab === "tx-alt" && <TxSection tx={allAltTx} compr={allAltCompr} search={globalSearch} catCfg={catCfg} vcpeCfg={vcpeCfg} estCfg={estCfg} tc={tc} dark={dark} canEdit={canEdit} onAdd={() => openCcAddModal()} onEdit={setCcEditModalRow} onDelete={r => d.handleCCDelete(r._rowId)} title="Registre de Transaccions (Alternatius)" />}
        </main>
      </div>

      {showLoader && (
        <DataLoader
          onClose={() => setShowLoader(false)}
          onLoad={(key, rows) => d.handleLoad(key, rows, () => setExcluded(new Set()))}
          exportAll={exportAll}
          exportPDF={exportPDF}
          exportPNG={exportPNG}
          exporting={exporting}
          loadedAt={d.loadedAt}
        />
      )}

      {ccAddModalFons !== null && (
        <AddRowModal
          title="Afegeix moviment"
          fields={[
            {
              key: "fons",
              label: "Vehicle",
              type: "combo",
              options: ccNameOptions,
              defaultValue: ccAddModalFons,
              onChange: (value, nextValues, { setValue }) => {
                setValue("divisa", defaultVehicleCurrency(value));
                return nextValues;
              },
            },
            { key: "tipus", label: "Tipus Moviment", type: "combo", options: ccTipusOptions, defaultValue: ccAddModalDefaults?.tipus ?? "" },
            { key: "cat", label: "Categoria", type: "select", options: ["Capital Call", "Distribució", "Retorn Capital", "Compromís", "Altres"], defaultValue: ccAddModalDefaults?.cat ?? "Capital Call" },
            { key: "data", label: "Data", type: "date", defaultValue: new Date().toISOString().slice(0, 10) },
            { key: "eur", label: "Import EUR", type: "number" },
            {
              key: "divisa",
              label: "Divisa",
              type: "select",
              options: ["EUR", "USD"],
              defaultValue: ccAddModalDefaults?.divisa ?? defaultVehicleCurrency(ccAddModalFons),
            },
            { key: "vcpe", label: "VCPE", type: "select", options: ["PE", "VC", "RE", "SF", "PC"], defaultValue: ccAddModalDefaults?.vcpe ?? "PE" },
            { key: "est", label: "Estratègia", type: "select", options: ["Fons Primari", "Fons de Fons", "Directe", "SOCIMI"], defaultValue: ccAddModalDefaults?.est ?? "Fons Primari" },
            { key: "recallable", label: "Recallable (€)", type: "number", visible: v => v.cat === "Distribució" },
            { key: "non_recallable", label: "No Recallable (€)", type: "number", visible: v => v.cat === "Distribució" },
            {
              key: "from_recallable",
              label: `Des de pool recallable (€) — disponible: ${fmtM(recallablePoolByFund[ccAddModalFons] ?? 0)}`,
              type: "number",
              visible: v => v.cat === "Capital Call",
            },
          ]}
          onSave={(values, setError) => {
            if (values.cat === "Capital Call" && values.from_recallable !== "" && values.from_recallable != null) {
              const pool = recallablePoolByFund[values.fons] ?? 0;
              if (Number(values.from_recallable) > pool + 0.01) {
                setError(`El pool recallable disponible és ${fmtM(pool)}`);
                return;
              }
            }
            if (values.cat === "Distribució" && values.recallable !== "" && values.recallable != null) {
              const rec = Number(values.recallable);
              const nonRec = values.non_recallable !== "" && values.non_recallable != null
                ? Number(values.non_recallable)
                : Number(values.eur) - rec;
              const total = rec + nonRec;
              if (Math.abs(total - Number(values.eur)) > 0.01) {
                setError(`Recallable (${rec}) + No recallable (${nonRec}) = ${total}, però l'import total és ${values.eur}`);
                return;
              }
              d.handleCCInsert({ ...values, non_recallable: nonRec }, setError);
            } else {
              d.handleCCInsert(values, setError);
            }
          }}
          onClose={() => setCcAddModalFons(null)}
        />
      )}

      {ccEditModalRow && (
        <AddRowModal
          title="Edita moviment"
          fields={[
            { key: "fons", label: "Vehicle", type: "text", defaultValue: ccEditModalRow.fons, disabled: true },
            { key: "tipus", label: "Tipus Moviment", type: "combo", options: ccTipusOptions, defaultValue: ccEditModalRow.tipus },
            { key: "cat", label: "Categoria", type: "select", options: ["Capital Call", "Distribució", "Retorn Capital", "Compromís", "Altres"], defaultValue: ccEditModalRow.cat },
            { key: "data", label: "Data", type: "date", defaultValue: ccEditModalRow.data },
            { key: "eur", label: "Import EUR", type: "number", defaultValue: ccEditModalRow.eur },
            { key: "divisa", label: "Divisa", type: "select", options: ["EUR", "USD"], defaultValue: ccEditModalRow.divisa },
            { key: "vcpe", label: "VCPE", type: "select", options: ["PE", "VC", "RE", "SF", "PC"], defaultValue: ccEditModalRow.vcpe },
            { key: "est", label: "Estratègia", type: "select", options: ["Fons Primari", "Fons de Fons", "Directe", "SOCIMI"], defaultValue: ccEditModalRow.est },
            { key: "recallable", label: "Recallable (€)", type: "number", defaultValue: ccEditModalRow.recallable ?? "", visible: v => v.cat === "Distribució" },
            { key: "non_recallable", label: "No Recallable (€)", type: "number", defaultValue: ccEditModalRow.non_recallable ?? "", visible: v => v.cat === "Distribució" },
            {
              key: "from_recallable",
              label: `Des de pool recallable (€) — disponible: ${fmtM(recallablePoolByFund[ccEditModalRow.fons] ?? 0)}`,
              type: "number",
              defaultValue: ccEditModalRow.from_recallable ?? "",
              visible: v => v.cat === "Capital Call",
            },
          ]}
          onSave={(values, setError) => {
            if (values.cat === "Capital Call" && values.from_recallable !== "" && values.from_recallable != null) {
              const pool = recallablePoolByFund[values.fons] ?? 0;
              if (Number(values.from_recallable) > pool + 0.01) {
                setError(`El pool recallable disponible és ${fmtM(pool)}`);
                return;
              }
            }
            if (values.cat === "Distribució" && values.recallable !== "" && values.recallable != null) {
              const rec = Number(values.recallable);
              const nonRec = values.non_recallable !== "" && values.non_recallable != null
                ? Number(values.non_recallable)
                : Number(values.eur) - rec;
              const total = rec + nonRec;
              if (Math.abs(total - Number(values.eur)) > 0.01) {
                setError(`Recallable (${rec}) + No recallable (${nonRec}) = ${total}, però l'import total és ${values.eur}`);
                return;
              }
              d.handleCCUpdate(ccEditModalRow._rowId, { ...values, non_recallable: nonRec }, setError);
            } else {
              d.handleCCUpdate(ccEditModalRow._rowId, values, setError);
            }
          }}
          onClose={() => setCcEditModalRow(null)}
        />
      )}
    </div>
  );
}

export { Dashboard };
export default Dashboard;
