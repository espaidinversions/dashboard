import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import html2canvas from "html2canvas";
import ReactECharts from "echarts-for-react";
import { ecTheme } from "../echartsTheme.js";
import {
  FY_LIST, MESOS, CAT_CFG, VCPE_CFG, EST_CFG,
  RAW_CC as RAW_CC_DEFAULT, FUNDS0 as FUNDS0_DEFAULT, FUND_META as FUND_META_DEFAULT,
} from "../config.js";
import { ThemeContext, TC_DARK, TC_LIGHT, useTheme } from "../theme.js";
import { fmtM, fmtS, parseCapitalCallsCSV, parsePipelineCSV, usePersistedState, slugify, exportMultiXLSX } from "../utils.js";
import { PORTFOLIO_COMPANIES, ALL_SEARCHERS } from "../data/searchers.js";
import { loadAll, saveCapitalCalls, savePipeline, saveCompanies, saveSearchers, saveFundMeta } from "../db.js";
import { Logo, Badge, EmptyState } from "./SharedComponents.jsx";
import { FonsSelector } from "./FonsSelector.jsx";
import { PipelineFY26 } from "./PipelineFY26.jsx";
import { MensualTab } from "./MensualTab.jsx";
import { SearchersTab } from "./SearchersTab.jsx";
import { PortfolioCompaniesTab } from "./PortfolioCompaniesTab.jsx";
import { FundsIndexInner } from "./FundsIndex.jsx";
import { CompaniesIndexInner } from "./CompaniesIndex.jsx";
import { Link } from "react-router-dom";
import { useAuth } from "../auth.jsx";
import { DataLoader } from "./DataLoader.jsx";
import { PublicMarketsTab } from "./PublicMarketsTab.jsx";
import { HoldingsTable } from "./HoldingsTable.jsx";
import { PMTipusTab } from "./PMTipusTab.jsx";
import { PMTransaccionsTab } from "./PMTransaccionsTab.jsx";
import { ResumTab, FonsTab, TxLogTab } from "./tabs/index.js";

// ── Helpers localStorage ──────────────────────────────────
const LS_CC = "tc_rawCC";
const LS_PL = "tc_funds0";
const LS_TS = "tc_loadedAt";

function loadFromLS(key, fallback) {
  try {
    const s = localStorage.getItem(key);
    return s ? JSON.parse(s) : fallback;
  } catch { return fallback; }
}

// ══════════════════════════════════════════════════════════
function DashboardInner() {
  const { tc, dark, toggle: toggleDark } = useTheme();
  const { signOut, isAdmin } = useAuth();

  const [tab,      setTab]     = usePersistedState("ui_tab", "resum");
  const [excluded, setExcluded]= usePersistedState("ui_excluded", new Set(), { isSet: true });
  const [showLoader, setShowLoader] = useState(false);
  const [globalSearch, setGlobalSearch] = useState("");
  const [inversionsSubTab, setInversionsSubTab] = useState("fons");
  const [realEstateTab, setRealEstateTab] = useState("directe");
  const [mercatsPublicsTab, setMercatsPublicsTab] = useState("resum");

  // Dades dinàmiques (localStorage → static fallback)
  const [rawCC,   setRawCC]   = useState(()=>loadFromLS(LS_CC, RAW_CC_DEFAULT));
  const [funds0,  setFunds0]  = useState(()=>loadFromLS(LS_PL, FUNDS0_DEFAULT));
  const [loadedAt,setLoadedAt]= useState(()=>localStorage.getItem(LS_TS));
  const [eurUsd,  setEurUsd]  = useState(null);

  useEffect(() => {
    fetch("/api/eur-usd").then(r => r.json()).then(({ rate }) => setEurUsd(rate)).catch(() => {});
  }, []);

  // Load from Supabase on mount (overrides localStorage if data exists)
  useEffect(() => {
    loadAll().then(data => {
      if (!data) return;
      const now = new Date().toLocaleDateString("ca-ES");
      if (data.rawCC?.length)    { setRawCC(data.rawCC);   try { localStorage.setItem(LS_CC, JSON.stringify(data.rawCC)); } catch {} }
      if (data.funds0?.length)   { setFunds0(data.funds0); try { localStorage.setItem(LS_PL, JSON.stringify(data.funds0)); } catch {} }
      if (data.companies?.length) try { localStorage.setItem("tc_portfolioCompanies", JSON.stringify(data.companies)); } catch {}
      if (data.searchers?.length) try { localStorage.setItem("tc_allSearchers",        JSON.stringify(data.searchers)); } catch {}
      if (data.fundMeta?.length)  try { localStorage.setItem("tc_fundMeta",            JSON.stringify(data.fundMeta)); } catch {}
      setLoadedAt(now);
      try { localStorage.setItem(LS_TS, now); } catch {}
    });
  }, []);

  const [exporting, setExporting] = useState(false);

  const exportPDF = useCallback(() => {
    window.print();
  }, []);

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
    } finally {
      setExporting(false);
    }
  }, []);

  const exportAll = useCallback(async () => {
    setExporting(true);
    try {
    const ls = (key, fallback) => { try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : fallback; } catch { return fallback; } };
    const companies = ls("tc_portfolioCompanies", PORTFOLIO_COMPANIES);
    const searchers = ls("tc_allSearchers", ALL_SEARCHERS);
    const pipeline  = ls("tc_funds0", FUNDS0_DEFAULT);
    const cc        = ls("tc_rawCC",  RAW_CC_DEFAULT);

    const fundMeta = ls("tc_fundMeta", FUND_META_DEFAULT);
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
        // Collect all quarters across all companies, sorted chronologically
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
            KPI_FIELDS.forEach(([label, key]) => {
              row[`${q} | ${label}`] = fmtN(data[key] ?? null);
            });
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

  const handleLoad = (key, rows) => {
    const now = new Date().toLocaleDateString("ca-ES");
    if (key === "cc") {
      setRawCC(rows);
      setExcluded(new Set());
      try { localStorage.setItem(LS_CC, JSON.stringify(rows)); } catch {}
      saveCapitalCalls(rows);
    } else if (key === "pl") {
      setFunds0(rows);
      try { localStorage.setItem(LS_PL, JSON.stringify(rows)); } catch {}
      savePipeline(rows);
    } else if (key === "companies") {
      try { localStorage.setItem("tc_portfolioCompanies", JSON.stringify(rows)); } catch {}
      saveCompanies(rows);
    } else if (key === "searchers") {
      try { localStorage.setItem("tc_allSearchers", JSON.stringify(rows)); } catch {}
      saveSearchers(rows);
    } else if (key === "fundMeta") {
      try { localStorage.setItem("tc_fundMeta", JSON.stringify(rows)); } catch {}
      saveFundMeta(rows);
    } else if (key === "kpiTrimestral") {
      try {
        const byNom = rows;
        const existing = JSON.parse(localStorage.getItem("tc_portfolioCompanies") || "null") || PORTFOLIO_COMPANIES;
        const updated = existing.map(c => {
          const qs = byNom.get(c.nom);
          return qs ? { ...c, quarters: qs } : c;
        });
        localStorage.setItem("tc_portfolioCompanies", JSON.stringify(updated));
        saveCompanies(updated);
      } catch {}
    }
    setLoadedAt(now);
    try { localStorage.setItem(LS_TS, now); } catch {}
  };

  // Derivar TRANSACTIONS i COMPROMISOS del rawCC en estat
  const TRANSACTIONS = useMemo(()=>rawCC.filter(r=>r.cat!=="Compromís"),[rawCC]);
  const COMPROMISOS  = useMemo(()=>rawCC.filter(r=>r.cat==="Compromís"),[rawCC]);

  // Filtres Capital Calls
  const [fFy,     setFFy]     = usePersistedState("ui_fFy",  "Tots");
  const [fVcpe,   setFVcpe]   = usePersistedState("ui_fVcpe", new Set(), { isSet: true });
  const [fEst,    setFEst]    = usePersistedState("ui_fEst",  "Tots");
  const [fCat,    setFCat]    = usePersistedState("ui_fCat",  "Tots");
  const [txSearch,setTxSearch]= usePersistedState("ui_txSearch", "");
  const [txPage,  setTxPage]  = useState(0);
  const [txSort,setTxSort]= usePersistedState("ui_txSort", {k:"data",d:"desc"});
  const [sortFons, setSortFons] = usePersistedState("ui_sortFons", "compr");
  const [sortFonsDir, setSortFonsDir] = usePersistedState("ui_sortFonsDir", "desc");
  const [expandedFons, setExpandedFons] = useState(new Set());
  const [ccChartF, setCcChartF] = useState(null); // {type, value} per filtrar taula fons
  const TX_PP = 30;

  // Dades base filtrades per exclusió
  const baseTx    = useMemo(()=>TRANSACTIONS.filter(r=>!excluded.has(r.fons)),[TRANSACTIONS,excluded]);
  const baseCompr = useMemo(()=>COMPROMISOS.filter(r=>!excluded.has(r.fons)),[COMPROMISOS,excluded]);

  // Hoisted above filtered so it can be used in the dep array without TDZ:
  const section = (tab==="mercats-publics"||tab==="real-estate") ? tab : "alternatives";

  // Filtres addicionals
  const filtered = useMemo(()=>{
    let d=baseTx;
    if(fFy  !=="Tots") d=d.filter(r=>r.fy===fFy);
    if(fVcpe.size>0) d=d.filter(r=>fVcpe.has(r.vcpe));
    if(fEst !=="Tots") d=d.filter(r=>r.est===fEst);
    if(fCat !=="Tots") d=d.filter(r=>r.cat===fCat);
    if(txSearch.trim()) {
      const q=txSearch.trim().toLowerCase();
      d=d.filter(r=>(r.fons||"").toLowerCase().includes(q)||(r.tipus||"").toLowerCase().includes(q)||(r.cat||"").toLowerCase().includes(q));
    }
    if(section==="alternatives"&&globalSearch.trim()) {
      const q=globalSearch.trim().toLowerCase();
      d=d.filter(r=>(r.fons||"").toLowerCase().includes(q));
    }
    return d;
  },[baseTx,fFy,fVcpe,fEst,fCat,txSearch,globalSearch,section]);

  // KPIs
  const gCompr = useMemo(()=>baseCompr.reduce((s,r)=>s+r.eur,0),[baseCompr]);
  const gCalls = useMemo(()=>baseTx.filter(r=>r.cat==="Capital Call").reduce((s,r)=>s+r.eur,0),[baseTx]);
  const gDist  = useMemo(()=>baseTx.filter(r=>r.cat==="Distribució"||r.cat==="Retorn Capital").reduce((s,r)=>s+Math.abs(r.eur),0),[baseTx]);
  const gNet   = gDist - gCalls;

  const fCalls = useMemo(()=>filtered.filter(r=>r.cat==="Capital Call").reduce((s,r)=>s+r.eur,0),[filtered]);
  const fDist  = useMemo(()=>filtered.filter(r=>r.cat==="Distribució"||r.cat==="Retorn Capital").reduce((s,r)=>s+Math.abs(r.eur),0),[filtered]);

  // Gràfics
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

  // Fons taula
  const FONS_MAP2 = useMemo(()=>{
    const m={};
    baseCompr.forEach(r=>{m[r.fons]={fons:r.fons,compr:r.eur,vcpe:r.vcpe,est:r.est,calls:0,dist:0,retorn:0};});
    baseTx.forEach(r=>{
      if(!m[r.fons])m[r.fons]={fons:r.fons,compr:0,vcpe:r.vcpe,est:r.est,calls:0,dist:0,retorn:0};
      if(r.cat==="Capital Call")   m[r.fons].calls  +=r.eur;
      if(r.cat==="Distribució")    m[r.fons].dist   +=Math.abs(r.eur);
      if(r.cat==="Retorn Capital") m[r.fons].retorn +=Math.abs(r.eur);
    });
    return Object.values(m);
  },[baseCompr,baseTx]);

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

  // Tx paginades
  const txSorted = useMemo(()=>[...filtered].sort((a,b)=>{
    const {k,d}=txSort;
    let va=a[k],vb=b[k];
    if(typeof va==="string") return d==="asc"?va.localeCompare(vb):vb.localeCompare(va);
    return d==="asc"?va-vb:vb-va;
  }),[filtered,txSort]);
  const txPages = Math.ceil(txSorted.length/TX_PP);
  const txSlice = txSorted.slice(txPage*TX_PP,(txPage+1)*TX_PP);
  const sortTx = k=>{setTxSort(p=>({k,d:p.k===k&&p.d==="desc"?"asc":"desc"}));setTxPage(0);};
  const TArr = ({k})=><span style={{marginLeft:3,opacity:txSort.k===k?1:0.2,fontSize:9}}>{txSort.k===k&&txSort.d==="asc"?"▲":"▼"}</span>;

  const clearFilters = ()=>{setFFy("Tots");setFVcpe(new Set());setFEst("Tots");setFCat("Tots");setTxSearch("");setTxPage(0);};
  const anyFilter = fFy!=="Tots"||fVcpe.size>0||fEst!=="Tots"||fCat!=="Tots"||txSearch.trim()!="";

  // Theme-based style objects
  const inp = {border:`1px solid ${tc.border}`,borderRadius:5,padding:"5px 8px",fontSize:12,color:tc.text,background:tc.card,outline:"none",fontFamily:"inherit",cursor:"pointer"};
  const th  = {padding:"9px 10px",fontSize:10,letterSpacing:"0.09em",color:tc.textLight,textTransform:"uppercase",fontWeight:600,textAlign:"left",borderBottom:`2px solid ${tc.border}`,whiteSpace:"nowrap",userSelect:"none"};

  // Dark-aware badge configs
  const vcpeCfg = {
    "PE": { color:tc.navy,  bg: dark ? "#112030" : "#E6EDF3" },
    "VC": { color:tc.green, bg: dark ? "#0A2010" : "#E8F8E8" },
    "RE": { color:tc.purple||"#9B7CC8", bg: dark ? "#20163A" : "#F3EEF8" },
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

  // Expanded fons row colors
  const rowExpandBg     = dark ? "#0E2412" : "#F4FBF4";
  const rowExpandHeader = dark ? "#0A1E0C" : "#E8F8E8";
  const rowExpandAlt    = dark ? "#091C0B" : "#F0FBF0";
  const rowExpandBorder = dark ? "#183820" : "#E0F0E0";

  const TABS_CC = [
    {id:"resum",   label:"📊 Resum Anual"},
    {id:"mensual", label:"📈 Detall Mensual"},
    {id:"fons",    label:"🏦 Per Fons"},
    {id:"txlog",   label:"📋 Transaccions"},
  ];
  const SECTIONS = [
    {id:"alternatives",   label:"Alternatives"},
    {id:"mercats-publics", label:"Mercats Públics"},
    {id:"real-estate",    label:"Real Estate"},
  ];
  const SUPRA = [
    {id:"fons",       label:"Fons"},
    {id:"searchers",  label:"Searchers"},
    {id:"portfolio",  label:"Participades"},
    {id:"inversions", label:"Detall per Inversió"},
  ];
  const supra = tab==="searchers"?"searchers":tab==="portfolio"?"portfolio":tab==="inversions"?"inversions":"fons";
  const TABS_FONS = [{id:"pipeline",label:"🎯 Pipeline FY26"}, ...TABS_CC];

  // Keyboard navigation: ArrowLeft/ArrowRight cycle sub-tabs (fons) or supra tabs or sections
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.tagName === "SELECT") return;
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      const dir = e.key === "ArrowRight" ? 1 : -1;
      if (section !== "alternatives") {
        const sectionIds = ["alternatives", "mercats-publics", "real-estate"];
        const idx = sectionIds.indexOf(section);
        const next = sectionIds[(idx + dir + sectionIds.length) % sectionIds.length];
        setTab(next === "alternatives" ? "pipeline" : next);
      } else if (supra === "fons") {
        const idx = TABS_FONS.findIndex(t => t.id === tab);
        const next = TABS_FONS[(idx + dir + TABS_FONS.length) % TABS_FONS.length];
        setTab(next.id);
      } else {
        const supraIds = ["fons", "searchers", "portfolio", "inversions"];
        const idx = supraIds.indexOf(supra);
        const nextSupra = supraIds[(idx + dir + supraIds.length) % supraIds.length];
        setTab(nextSupra === "fons" ? "pipeline" : nextSupra);
      }
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tab, section, supra, TABS_FONS]);

  return (
    <div id="dashboard-content" style={{minHeight:"100vh",background:tc.bg,color:tc.text,fontFamily:"'Outfit',system-ui,sans-serif",fontSize:14,letterSpacing:"0.005em"}}>

      {/* ── Header ── */}
      <div className="no-print" style={{background:tc.card,borderBottom:`1px solid ${tc.border}`,padding:"12px 32px",display:"flex",alignItems:"center",gap:12,boxShadow:"0 1px 0 rgba(0,0,0,.06), 0 4px 16px rgba(0,0,0,.05)"}}>
        <Link to="/" style={{display:"flex",alignItems:"center",flexShrink:0}}>
          <Logo/>
        </Link>
        <div style={{flex:1}}/>
        <input
          value={globalSearch}
          onChange={e=>{setGlobalSearch(e.target.value);setTxPage(0);}}
          placeholder="Cerca…"
          style={{padding:"7px 14px",borderRadius:8,border:`1.5px solid ${tc.border}`,background:tc.bg,color:tc.text,fontSize:13,fontFamily:"inherit",width:220,outline:"none"}}
        />
        {globalSearch&&(
          <button onClick={()=>{setGlobalSearch("");setTxPage(0);}}
            style={{background:"transparent",border:"none",cursor:"pointer",fontSize:14,color:tc.textLight,padding:"0 2px",lineHeight:1,marginLeft:-4}}>
            ✕
          </button>
        )}
        {isAdmin && (
          <Link to="/admin"
            style={{background:"transparent",border:`1.5px solid ${tc.border}`,borderRadius:7,padding:"7px 12px",cursor:"pointer",fontSize:12,color:tc.textMid,fontFamily:"inherit",fontWeight:600,textDecoration:"none"}}>
            Admin
          </Link>
        )}
        <button onClick={exportAll} disabled={exporting}
          style={{background:"transparent",border:`1.5px solid ${tc.border}`,borderRadius:7,padding:"7px 12px",cursor:exporting?"not-allowed":"pointer",fontSize:12,color:tc.textMid,fontFamily:"inherit",fontWeight:600,opacity:exporting?0.6:1}}>
          {exporting ? "Exportant…" : "↓ Excel"}
        </button>
        <button onClick={toggleDark}
          style={{background:"transparent",border:`1.5px solid ${tc.border}`,borderRadius:7,padding:"7px 12px",cursor:"pointer",fontSize:16,color:tc.textMid,fontFamily:"inherit"}}>
          {dark?"☀️":"🌙"}
        </button>
        <button onClick={signOut}
          style={{background:"transparent",border:`1.5px solid ${tc.border}`,borderRadius:7,padding:"7px 12px",cursor:"pointer",fontSize:12,color:tc.textMid,fontFamily:"inherit",fontWeight:600}}>
          Sortir
        </button>
      </div>

      {/* ── Section nav (top level) ── */}
      <div className="tab-bar no-print" style={{background:tc.navy,padding:"0 32px",display:"flex",gap:0}}>
        {SECTIONS.map(s=>(
          <button key={s.id}
            onClick={()=>{ if(s.id!=="alternatives") setTab(s.id); else if(section!=="alternatives") setTab("pipeline"); }}
            style={{background:"none",border:"none",borderBottom:`2px solid ${section===s.id?"rgba(255,255,255,0.9)":"transparent"}`,padding:"12px 24px",cursor:"pointer",fontSize:12,fontWeight:section===s.id?600:400,color:section===s.id?"#fff":"rgba(255,255,255,0.5)",fontFamily:"inherit",transition:"color 0.15s, border-color 0.15s, transform 0.1s cubic-bezier(0.23,1,0.32,1), opacity 0.1s ease",whiteSpace:"nowrap",letterSpacing:"0.04em",textTransform:"uppercase"}}>
            {s.label}
          </button>
        ))}
      </div>

      {/* ── Supra-category nav (Alternatives only) ── */}
      {section==="alternatives"&&(
      <div className="tab-bar no-print" style={{background:"#1a3a5c",padding:"0 32px",display:"flex",gap:0}}>
        {SUPRA.map(s=>(
          <button key={s.id}
            onClick={()=>{ setTab(s.id==="fons"?"pipeline":s.id); }}
            style={{background:"none",border:"none",borderBottom:`2px solid ${supra===s.id?"rgba(255,255,255,0.75)":"transparent"}`,padding:"10px 22px",cursor:"pointer",fontSize:11,fontWeight:supra===s.id?600:400,color:supra===s.id?"rgba(255,255,255,0.95)":"rgba(255,255,255,0.4)",fontFamily:"inherit",transition:"color 0.15s, border-color 0.15s",whiteSpace:"nowrap",letterSpacing:"0.04em",textTransform:"uppercase"}}>
            {s.label}
          </button>
        ))}
      </div>
      )}

      {/* ── Sub-toolbar (Searchers) ── */}
      {section==="alternatives"&&supra==="searchers"&&(
      <div className="tab-bar no-print" style={{background:tc.card,borderBottom:`1px solid ${tc.border}`,padding:"0 32px",display:"flex",justifyContent:"flex-end",alignItems:"center",minHeight:44}}>
        <button
          style={{background:"transparent",color:tc.textMid,border:`1.5px solid ${tc.border}`,borderRadius:7,padding:"6px 14px",cursor:"default",fontSize:11,fontFamily:"inherit",opacity:0.6}}
          title="Actualitza el CSV dins la secció Historial de Searchers">
          ↑ CSV Searchers
        </button>
      </div>
      )}

      {/* ── Sub-toolbar (Portfolio) ── */}
      {section==="alternatives"&&supra==="portfolio"&&(
      <div className="tab-bar no-print" style={{background:tc.card,borderBottom:`1px solid ${tc.border}`,padding:"0 32px",display:"flex",justifyContent:"flex-end",alignItems:"center",minHeight:44}}>
        <span style={{fontSize:11,color:tc.textLight}}>21 empreses en cartera</span>
      </div>
      )}

      {/* ── Sub-tabs (Inversions) ── */}
      {section==="alternatives"&&supra==="inversions"&&(
      <div className="tab-bar no-print" style={{background:tc.card,borderBottom:`1px solid ${tc.border}`,padding:"0 32px",display:"flex"}}>
        {[{id:"fons",label:"Fons"},{id:"companies",label:"Participades"}].map(s=>(
          <button key={s.id} onClick={()=>setInversionsSubTab(s.id)}
            style={{background:"none",border:"none",borderBottom:`2px solid ${inversionsSubTab===s.id?tc.green:"transparent"}`,padding:"11px 20px",cursor:"pointer",fontSize:12,fontWeight:inversionsSubTab===s.id?600:400,color:inversionsSubTab===s.id?tc.navy:tc.textMid,fontFamily:"inherit",whiteSpace:"nowrap",letterSpacing:"0.01em"}}>
            {s.label}
          </button>
        ))}
      </div>
      )}

      {/* ── Sub-tabs (Mercats Públics) ── */}
      {section==="mercats-publics"&&(
      <div className="tab-bar no-print" style={{background:tc.card,borderBottom:`1px solid ${tc.border}`,padding:"0 32px",display:"flex",gap:0}}>
        {[{id:"resum",label:"Resum"},{id:"rv",label:"Renda Variable"},{id:"rf",label:"Renda Fixa"},{id:"posicions",label:"Posicions"},{id:"transaccions",label:"Transaccions"}].map(t=>(
          <button key={t.id} onClick={()=>setMercatsPublicsTab(t.id)}
            style={{background:"none",border:"none",borderBottom:`2px solid ${mercatsPublicsTab===t.id?tc.green:"transparent"}`,padding:"11px 20px",cursor:"pointer",fontSize:12,fontWeight:mercatsPublicsTab===t.id?600:400,color:mercatsPublicsTab===t.id?tc.navy:tc.textMid,fontFamily:"inherit",transition:"color 0.15s, border-color 0.15s",whiteSpace:"nowrap",letterSpacing:"0.01em"}}>
            {t.label}
          </button>
        ))}
      </div>
      )}

      {/* ── Sub-tabs (Real Estate) ── */}
      {section==="real-estate"&&(
      <div className="tab-bar no-print" style={{background:tc.card,borderBottom:`1px solid ${tc.border}`,padding:"0 32px",display:"flex",gap:0}}>
        {[{id:"directe",label:"Directe"},{id:"altres-vehicles",label:"Altres Vehicles"}].map(t=>(
          <button key={t.id} onClick={()=>setRealEstateTab(t.id)}
            style={{background:"none",border:"none",borderBottom:`2px solid ${realEstateTab===t.id?tc.green:"transparent"}`,padding:"11px 20px",cursor:"pointer",fontSize:12,fontWeight:realEstateTab===t.id?600:400,color:realEstateTab===t.id?tc.navy:tc.textMid,fontFamily:"inherit",transition:"color 0.15s, border-color 0.15s",whiteSpace:"nowrap",letterSpacing:"0.01em"}}>
            {t.label}
          </button>
        ))}
      </div>
      )}

      {/* ── Sub-tabs (Fons only) ── */}
      {section==="alternatives"&&supra==="fons"&&(
      <div className="tab-bar no-print" style={{background:tc.card,borderBottom:`1px solid ${tc.border}`,padding:"0 32px",display:"flex",gap:0,alignItems:"center"}}>
        <div style={{display:"flex",flex:1}}>
          {TABS_FONS.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)}
              style={{background:"none",border:"none",borderBottom:`2px solid ${tab===t.id?tc.green:"transparent"}`,padding:"11px 20px",cursor:"pointer",fontSize:12,fontWeight:tab===t.id?600:400,color:tab===t.id?tc.navy:tc.textMid,fontFamily:"inherit",transition:"color 0.15s, border-color 0.15s, transform 0.1s cubic-bezier(0.23,1,0.32,1), opacity 0.1s ease",whiteSpace:"nowrap",letterSpacing:"0.01em"}}>
              {t.label}
            </button>
          ))}
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8,paddingRight:4}}>
          {tab!=="pipeline"&&(
            <FonsSelector excluded={excluded} setExcluded={setExcluded} rawCC={rawCC}/>
          )}
          <button onClick={()=>setShowLoader(true)}
            style={{background:tc.navy,color:"#fff",border:"none",borderRadius:7,padding:"6px 14px",cursor:"pointer",fontSize:11,fontFamily:"inherit"}}>
            ↑ Carregar dades
          </button>
        </div>
      </div>
      )}

      <div className="page-pad" style={{padding:"22px 32px 60px"}}>
        <div className="no-print" style={{display:"flex",justifyContent:"flex-end",gap:8,marginBottom:16}}>
          <button onClick={exportPDF}
            style={{background:"transparent",border:`1.5px solid ${tc.border}`,borderRadius:7,padding:"6px 12px",cursor:"pointer",fontSize:12,color:tc.textMid,fontFamily:"inherit"}}>
            ↓ PDF
          </button>
          <button onClick={exportPNG} disabled={exporting}
            style={{background:"transparent",border:`1.5px solid ${tc.border}`,borderRadius:7,padding:"6px 12px",cursor:exporting?"wait":"pointer",fontSize:12,color:tc.textMid,fontFamily:"inherit"}}>
            {exporting?"…":"↓ PNG"}
          </button>
        </div>

        {/* ── PIPELINE ── */}
        {tab==="pipeline"&&<div className="tab-panel"><PipelineFY26 initialFunds={funds0} eurUsd={eurUsd}/></div>}

        {/* ── SEARCHERS ── */}
        {tab==="searchers"&&<div className="tab-panel"><SearchersTab search={globalSearch}/></div>}

        {/* ── PORTFOLIO COMPANIES ── */}
        {tab==="portfolio"&&<div className="tab-panel"><PortfolioCompaniesTab search={globalSearch}/></div>}

        {/* ── ALTERNATIVES ── */}
        {tab==="mercats-publics"&&mercatsPublicsTab==="resum"&&(
          <div className="tab-panel"><PublicMarketsTab setMercatsPublicsTab={setMercatsPublicsTab}/></div>
        )}
        {tab==="mercats-publics"&&mercatsPublicsTab==="rv"&&(
          <div className="tab-panel"><PMTipusTab tipus="RV"/></div>
        )}
        {tab==="mercats-publics"&&mercatsPublicsTab==="rf"&&(
          <div className="tab-panel"><PMTipusTab tipus="RF"/></div>
        )}
        {tab==="mercats-publics"&&mercatsPublicsTab==="posicions"&&(
          <div className="tab-panel"><HoldingsTable/></div>
        )}
        {tab==="mercats-publics"&&mercatsPublicsTab==="transaccions"&&(
          <div className="tab-panel"><PMTransaccionsTab/></div>
        )}
        {tab==="real-estate"&&realEstateTab==="directe"&&(
          <div className="tab-panel" style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"80px 0",gap:12}}>
            <div style={{fontSize:32}}>🏗️</div>
            <div style={{fontSize:16,fontWeight:700,color:tc.navy}}>Real Estate · Directe</div>
            <div style={{fontSize:13,color:tc.textLight}}>Pròximament</div>
          </div>
        )}
        {tab==="real-estate"&&realEstateTab==="altres-vehicles"&&(
          <div className="tab-panel" style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"80px 0",gap:12}}>
            <div style={{fontSize:32}}>🏗️</div>
            <div style={{fontSize:16,fontWeight:700,color:tc.navy}}>Real Estate · Altres Vehicles</div>
            <div style={{fontSize:13,color:tc.textLight}}>Pròximament</div>
          </div>
        )}

        {/* ── DETALL PER INVERSIÓ ── */}
        {tab==="inversions"&&inversionsSubTab==="fons"&&(
          <div className="tab-panel"><FundsIndexInner inline searchOverride={globalSearch}/></div>
        )}
        {tab==="inversions"&&inversionsSubTab==="companies"&&(
          <div className="tab-panel"><CompaniesIndexInner inline searchOverride={globalSearch}/></div>
        )}

        {/* ── CAPITAL CALLS: KPIs ── */}
        {section==="alternatives"&&supra==="fons"&&tab!=="pipeline"&&(
          <>
            {excluded.size>0&&(
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14,background:tc.yellowLight,border:`1.5px solid ${tc.yellow}`,borderRadius:8,padding:"9px 16px"}}>
                <span style={{fontSize:13,color:tc.yellow,fontWeight:700}}>⚠️ Anàlisi parcial:</span>
                <span style={{fontSize:12,color:tc.text}}><b>{excluded.size} fons exclosos</b> de l'anàlisi</span>
                <div style={{display:"flex",gap:6,flexWrap:"wrap",flex:1}}>
                  {[...excluded].slice(0,4).map(f=>(
                    <span key={f} style={{fontSize:10,background:tc.card,border:`1px solid ${tc.yellow}`,borderRadius:4,padding:"1px 7px",color:tc.yellow,fontWeight:600}}>{f}</span>
                  ))}
                  {excluded.size>4&&<span style={{fontSize:10,color:tc.yellow}}>+{excluded.size-4} més</span>}
                </div>
                <button onClick={()=>setExcluded(new Set())} style={{background:"transparent",border:`1px solid ${tc.yellow}`,borderRadius:5,padding:"3px 10px",cursor:"pointer",fontSize:11,color:tc.yellow,fontFamily:"inherit",whiteSpace:"nowrap"}}>Restaurar tots</button>
              </div>
            )}
            <div className="grid-5" style={{gap:12,marginBottom:18}}>
              {[
                {label:"Compromís Total",    value:fmtM(gCompr),  sub:`${FONS_MAP2.length} fons`,                 accent:tc.navyLight},
                {label:"Capital Cridat",     value:fmtM(gCalls),  sub:`${(gCalls/gCompr*100).toFixed(1)}% cridat`, accent:tc.navy},
                {label:"Total Distribuït",   value:fmtM(gDist),   sub:"distribucions + retorns",                  accent:tc.green},
                {label:"Flux Net",           value:fmtM(Math.abs(gNet)), sub:gNet>=0?"saldo positiu":"pendent",   accent:gNet>=0?tc.greenDark:tc.navyLight},
                {label:"DPI",                value:`${(gDist/gCalls).toFixed(2)}x`, sub:"distribuït / cridat",    accent:tc.green},
              ].map((k,i)=>(
                <div key={i} className="kpi-card card-hover" style={{background:tc.card,border:`1px solid ${tc.border}`,borderRadius:12,padding:"16px 18px",borderTop:`3px solid ${k.accent}`,boxShadow:"0 2px 12px rgba(0,0,0,.06)"}}>
                  <div style={{fontSize:10,letterSpacing:"0.11em",color:tc.textLight,textTransform:"uppercase",marginBottom:6,fontWeight:500}}>{k.label}</div>
                  <div style={{fontSize:21,fontWeight:700,color:k.accent,marginBottom:2,letterSpacing:"-0.02em"}}>{k.value}</div>
                  <div style={{fontSize:11,color:tc.textLight}}>{k.sub}</div>
                </div>
              ))}
            </div>

            {/* Filtres */}
            <div style={{background:tc.card,border:`1px solid ${tc.border}`,borderRadius:10,padding:"12px 18px",marginBottom:18,display:"flex",gap:12,alignItems:"center",flexWrap:"wrap"}}>
              <span style={{fontSize:10,color:tc.textLight,fontWeight:700,letterSpacing:"0.12em",textTransform:"uppercase"}}>Filtres</span>
              {[
                {label:"Any Fiscal", val:fFy,   set:v=>{setFFy(v);setTxPage(0)},   opts:["Tots",...FY_LIST]},
                {label:"VC/PE/RE",   val:"__vcpe__", set:null, opts:null},
                {label:"Estratègia", val:fEst,   set:v=>{setFEst(v);setTxPage(0)},  opts:["Tots","Fons Primari","Fons de Fons","SOCIMI"]},
                {label:"Categoria",  val:fCat,   set:v=>{setFCat(v);setTxPage(0)},  opts:["Tots","Capital Call","Distribució","Retorn Capital"]},
              ].map(f=>{
                if(f.opts===null){
                  // Multi-select pills for VC/PE/RE
                  const toggleVcpe=v=>{setFVcpe(prev=>{const s=new Set(prev);s.has(v)?s.delete(v):s.add(v);return s;});setTxPage(0);};
                  return(
                    <div key={f.label} style={{display:"flex",alignItems:"center",gap:5}}>
                      <span style={{fontSize:11,color:tc.textLight}}>{f.label}:</span>
                      {["PE","VC","RE"].map(v=>(
                        <button key={v} onClick={()=>toggleVcpe(v)}
                          style={{background:fVcpe.has(v)?tc.navy:"transparent",border:`1.5px solid ${fVcpe.has(v)?tc.navy:tc.border}`,color:fVcpe.has(v)?"#fff":tc.textMid,borderRadius:20,padding:"2px 10px",cursor:"pointer",fontSize:11,fontWeight:fVcpe.has(v)?700:400,fontFamily:"inherit"}}>
                          {v}
                        </button>
                      ))}
                    </div>
                  );
                }
                return(
                <div key={f.label} style={{display:"flex",alignItems:"center",gap:5}}>
                  <span style={{fontSize:11,color:tc.textLight}}>{f.label}:</span>
                  <select value={f.val} onChange={e=>f.set(e.target.value)} style={inp}>
                    {f.opts.map(o=><option key={o}>{o}</option>)}
                  </select>
                </div>
                );
              })}
              <div style={{display:"flex",alignItems:"center",gap:6,marginLeft:4}}>
                <span style={{fontSize:11,color:tc.textLight}}>Cerca:</span>
                <input value={txSearch} onChange={e=>{setTxSearch(e.target.value);setTxPage(0);}} placeholder="fons, tipus…"
                  style={{...inp,width:160,paddingLeft:8}} />
                {txSearch&&<button onClick={()=>{setTxSearch("");setTxPage(0);}} style={{background:"transparent",border:"none",cursor:"pointer",fontSize:13,color:tc.textLight,padding:"0 2px",lineHeight:1}}>✕</button>}
              </div>
              {anyFilter&&<button onClick={clearFilters} style={{background:"transparent",border:`1px solid ${tc.border}`,borderRadius:5,padding:"4px 10px",cursor:"pointer",fontSize:11,color:tc.textMid,fontFamily:"inherit"}}>✕ Netejar</button>}
              <div style={{marginLeft:"auto",fontSize:12,color:tc.textLight}}>
                <b style={{color:tc.navy}}>{filtered.length}</b> mov. ·
                Cridat <b style={{color:tc.navy}}>{fmtS(fCalls)}</b> ·
                Rebut <b style={{color:tc.green}}>{fmtS(fDist)}</b>
                {anyFilter&&<span style={{marginLeft:6,fontSize:10,color:tc.green,background:dark?"#0A2010":"#E8F8E8",padding:"1px 7px",borderRadius:4,fontWeight:600}}>FILTRE ACTIU</span>}
              </div>
            </div>
          </>
        )}

        {/* ── RESUM ANUAL ── */}
        {tab==="resum"&&(<div key="resum" className="tab-panel"><ResumTab tc={tc} byFy={byFy} byVcpe={byVcpe} byEst={byEst} vcpeCfg={VCPE_CFG} /></div>)}

        {/* ── MENSUAL ── */}
        {tab==="mensual"&&(<div key="mensual" className="tab-panel"><MensualTab filtered={filtered} fFy={fFy}/></div>)}

        {/* ── PER FONS ── */}
        {tab==="fons"&&(()=>{
          const clickCcChart = (type,val) => setCcChartF(p=>p&&p.type===type&&p.value===val?null:{type,value:val});
          const isCcHl = (type,val) => !ccChartF||(ccChartF.type===type&&ccChartF.value===val);
          const toggleExpand = fons => setExpandedFons(p=>{const n=new Set(p);n.has(fons)?n.delete(fons):n.add(fons);return n;});
          const sortFonsBy = k=>{if(sortFons===k)setSortFonsDir(d=>d==="asc"?"desc":"asc");else{setSortFons(k);setSortFonsDir("desc");}};
          const FAr = ({k})=><span style={{marginLeft:3,opacity:sortFons===k?1:0.2,fontSize:9}}>{sortFons===k&&sortFonsDir==="asc"?"▲":"▼"}</span>;
          const pctCol = p=>`hsl(${Math.round(Math.min(p,100)*1.3)},60%,38%)`;

          // Dades gràfics per Fons tab (basats en baseTx + filtres actuals)
          const ccByFy = FY_LIST.map(fy=>{
            const rows=baseTx.filter(r=>r.fy===fy);
            const calls=rows.filter(r=>r.cat==="Capital Call").reduce((s,r)=>s+r.eur,0);
            const dist =rows.filter(r=>r.cat==="Distribució"||r.cat==="Retorn Capital").reduce((s,r)=>s+Math.abs(r.eur),0);
            return {fy:fy.replace("FY ",""),"Capital Call":+calls.toFixed(0),"Retornat":+dist.toFixed(0)};
          }).filter(r=>r["Capital Call"]||r["Retornat"]);

          const ccByVcpe = (()=>{
            const m={};
            baseTx.filter(r=>r.cat==="Capital Call").forEach(r=>{m[r.vcpe]=(m[r.vcpe]||0)+r.eur;});
            const tot=Object.values(m).reduce((s,v)=>s+v,0);
            return Object.entries(m).map(([name,value])=>({name,value:+value.toFixed(0),pct:((value/tot)*100).toFixed(1)}));
          })();

          const ccByEst = (()=>{
            const m={};
            baseTx.filter(r=>r.cat==="Capital Call"&&r.est).forEach(r=>{m[r.est]=(m[r.est]||0)+r.eur;});
            const tot=Object.values(m).reduce((s,v)=>s+v,0);
            return Object.entries(m).map(([name,value])=>({name,value:+value.toFixed(0),pct:((value/tot)*100).toFixed(1)}));
          })();

          const greenBadgeBg = dark ? "#0A2010" : "#E8F8E8";

          return (
          <div className="tab-panel">
            {/* Tags VC / PE / RE */}
            {(()=>{
              const toggleVcpe=v=>{setFVcpe(prev=>{const s=new Set(prev);s.has(v)?s.delete(v):s.add(v);return s;});};
              return(
              <div style={{display:"flex",gap:6,marginBottom:14,alignItems:"center"}}>
                <span style={{fontSize:11,color:tc.textLight,fontWeight:600,letterSpacing:"0.08em",textTransform:"uppercase"}}>Tipus:</span>
                {["PE","VC","RE"].map(v=>(
                  <button key={v} onClick={()=>toggleVcpe(v)}
                    style={{background:fVcpe.has(v)?tc.navy:"transparent",border:`1.5px solid ${fVcpe.has(v)?tc.navy:tc.border}`,color:fVcpe.has(v)?"#fff":tc.textMid,borderRadius:20,padding:"4px 14px",cursor:"pointer",fontSize:12,fontWeight:fVcpe.has(v)?700:400,fontFamily:"inherit"}}>
                    {v}
                  </button>
                ))}
                {fVcpe.size>0&&<button onClick={()=>setFVcpe(new Set())} style={{background:"transparent",border:`1px solid ${tc.border}`,borderRadius:20,padding:"4px 10px",cursor:"pointer",fontSize:11,color:tc.textMid,fontFamily:"inherit"}}>✕</button>}
              </div>
              );
            })()}
            {/* Gràfics interactius */}
            <div className="grid-3w" style={{gap:14,marginBottom:14}}>
              {/* Barres per any */}
              <div style={{background:tc.card,border:`1.5px solid ${ccChartF?.type==="fy"?tc.green:tc.border}`,borderRadius:10,padding:"16px 18px",boxShadow:"0 2px 8px rgba(0,0,0,.08)",transition:"border-color 0.2s"}}>
                <div style={{fontSize:10,letterSpacing:"0.13em",color:tc.textLight,textTransform:"uppercase",marginBottom:12,fontWeight:600,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  Capital Cridat per Any Fiscal
                  <span style={{fontSize:9,color:tc.green,background:greenBadgeBg,padding:"1px 6px",borderRadius:4}}>clicable</span>
                </div>
                {(()=>{
                  const t = ecTheme(tc);
                  const option = {
                    grid: { top: 8, right: 8, bottom: 32, left: 0, containLabel: true },
                    tooltip: { ...t.tooltip, trigger: "axis", axisPointer: { type: "shadow" } },
                    legend: { bottom: 0, textStyle: { fontSize: 10, color: tc.textLight } },
                    xAxis: { type: "category", data: ccByFy.map(d=>d.fy), axisLabel: { ...t.axisLabel, color: tc.textMid, fontSize: 10 }, axisLine: t.axisLine, axisTick: t.axisTick },
                    yAxis: { type: "value", axisLabel: { ...t.axisLabel, formatter: v=>fmtS(v) }, splitLine: t.splitLine, axisLine: t.axisLine, axisTick: t.axisTick },
                    series: [
                      {
                        name: "Capital Call",
                        type: "bar",
                        data: ccByFy.map(d=>({ value: d["Capital Call"], itemStyle: { color: tc.navy, opacity: isCcHl("fy",d.fy)?1:0.25, borderRadius: [4,4,0,0] } })),
                        cursor: "pointer",
                      },
                      {
                        name: "Retornat",
                        type: "bar",
                        data: ccByFy.map(d=>({ value: d["Retornat"], itemStyle: { color: tc.green, opacity: isCcHl("fy",d.fy)?1:0.25, borderRadius: [4,4,0,0] } })),
                        cursor: "pointer",
                      },
                    ],
                  };
                  return <ReactECharts option={option} style={{ width: "100%", height: 160 }} opts={{ renderer: "canvas" }}
                    onEvents={{ click: p => p?.name && clickCcChart("fy", p.name) }} />;
                })()}
              </div>
              {/* Pastís VC/PE/RE */}
              {[
                {title:"Per Tipus",     data:ccByVcpe, colorFn:n=>vcpeCfg[n]?.color||tc.navy, type:"vcpe"},
                {title:"Per Estratègia",data:ccByEst,  colorFn:n=>estCfg[n]?.color||tc.navy,  type:"est"},
              ].map((ch,ci)=>(
                <div key={ci} style={{background:tc.card,border:`1.5px solid ${ccChartF?.type===ch.type?tc.green:tc.border}`,borderRadius:10,padding:"16px 18px",boxShadow:"0 2px 8px rgba(0,0,0,.08)",transition:"border-color 0.2s"}}>
                  <div style={{fontSize:10,letterSpacing:"0.13em",color:tc.textLight,textTransform:"uppercase",marginBottom:8,fontWeight:600,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    {ch.title}<span style={{fontSize:9,color:tc.green,background:greenBadgeBg,padding:"1px 6px",borderRadius:4}}>clicable</span>
                  </div>
                  {(()=>{
                    const t = ecTheme(tc);
                    const option = {
                      tooltip: { ...t.tooltip, trigger: "item", formatter: p=>`${p.marker}${p.name}: ${fmtS(p.value)} (${p.percent}%)` },
                      legend: { orient: "vertical", right: 8, top: "center", textStyle: { fontSize: 10, color: tc.textLight } },
                      series: [{
                        type: "pie",
                        radius: ["38%", "68%"],
                        center: ["38%", "50%"],
                        data: ch.data.map(d=>({ name: d.name, value: d.value, itemStyle: { color: ch.colorFn(d.name), opacity: isCcHl(ch.type,d.name)?1:0.25 } })),
                        label: { show: false },
                        emphasis: { itemStyle: { shadowBlur: 8, shadowColor: "rgba(0,0,0,0.15)" } },
                        cursor: "pointer",
                      }],
                    };
                    return <ReactECharts option={option} style={{ width: "100%", height: 160 }} opts={{ renderer: "canvas" }}
                      onEvents={{ click: p => clickCcChart(ch.type, p.name) }} />;
                  })()}
                </div>
              ))}
            </div>


            {/* Indicador filtre actiu gràfic */}
            {ccChartF&&(
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12,background:tc.card,border:`1.5px solid ${tc.green}`,borderRadius:8,padding:"8px 14px"}}>
                <span style={{fontSize:12,color:tc.navy,fontWeight:600}}>🔍 Filtre gràfic actiu:</span>
                <span style={{fontSize:12,color:tc.green,fontWeight:700,background:greenBadgeBg,padding:"2px 10px",borderRadius:5}}>{ccChartF.value}</span>
                <button onClick={()=>setCcChartF(null)} style={{marginLeft:"auto",background:"transparent",border:`1px solid ${tc.border}`,color:tc.textMid,borderRadius:5,padding:"3px 10px",cursor:"pointer",fontSize:11,fontFamily:"inherit"}}>✕ Treure filtre</button>
              </div>
            )}

            {/* Taula */}
            <div style={{background:tc.card,border:`1px solid ${tc.border}`,borderRadius:10,padding:"18px",boxShadow:"0 2px 8px rgba(0,0,0,.08)"}}>
              <div style={{display:"flex",gap:8,marginBottom:10,alignItems:"center"}}>
                <span style={{fontSize:12,color:tc.textLight}}>
                  <b style={{color:tc.navy}}>{fonsFiltered.length}</b> fons ·
                  <span style={{fontSize:10,color:tc.textLight,marginLeft:6}}>Clica la capçalera per ordenar · Clica el nom per veure moviments</span>
                </span>
              </div>
              <div style={{overflowX:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse"}}>
                  <thead>
                    <tr style={{background:tc.bgAlt}}>
                      <th style={{...th,width:30}}></th>
                      <th style={th}>#</th>
                      <th style={{...th,cursor:"pointer"}} onClick={()=>sortFonsBy("fons")}>Fons<FAr k="fons"/></th>
                      <th style={{...th,textAlign:"right",cursor:"pointer"}} onClick={()=>sortFonsBy("compr")}>Compromís<FAr k="compr"/></th>
                      <th style={{...th,textAlign:"right",cursor:"pointer"}} onClick={()=>sortFonsBy("calls")}>Capital Cridat<FAr k="calls"/></th>
                      <th style={{...th,textAlign:"right",minWidth:110,cursor:"pointer"}} onClick={()=>sortFonsBy("pct")}>% Cridat<FAr k="pct"/></th>
                      <th style={{...th,textAlign:"right",cursor:"pointer"}} onClick={()=>sortFonsBy("dist")}>Distribucions<FAr k="dist"/></th>
                      <th style={{...th,textAlign:"right",cursor:"pointer"}} onClick={()=>sortFonsBy("retorn")}>Retorn Capital<FAr k="retorn"/></th>
                      <th style={{...th,textAlign:"right",cursor:"pointer"}} onClick={()=>sortFonsBy("rebut")}>Total Rebut<FAr k="rebut"/></th>
                      <th style={{...th,textAlign:"right",cursor:"pointer"}} onClick={()=>sortFonsBy("net")}>Flux Net<FAr k="net"/></th>
                      <th style={{...th,cursor:"pointer"}} onClick={()=>sortFonsBy("vcpe")} title="Venture Capital / Private Equity">Tipus<FAr k="vcpe"/></th>
                      <th style={{...th,cursor:"pointer"}} onClick={()=>sortFonsBy("est")} title="Estructura del fons">Estratègia<FAr k="est"/></th>
                    </tr>
                  </thead>
                  <tbody>
                    {fonsFiltered.length===0 && <tr><td colSpan={10}><EmptyState/></td></tr>}
                    {fonsFiltered.map((f,i)=>{
                      const pct=f.compr>0?(f.calls/f.compr*100):null;
                      const rebut=f.dist+f.retorn;
                      const net=rebut-f.calls;
                      const isExp=expandedFons.has(f.fons);
                      const rowBg=i%2===0?tc.card:tc.bgAlt;

                      // Moviments d'aquest fons (filtrats per filtres actius)
                      const moviments = baseTx
                        .filter(r=>r.fons===f.fons)
                        .filter(r=>fFy!=="Tots"?r.fy===fFy:true)
                        .filter(r=>fCat!=="Tots"?r.cat===fCat:true)
                        .sort((a,b)=>b.data.localeCompare(a.data));

                      return (
                        <>
                          {/* Fila principal */}
                          <tr key={`row-${i}`} style={{borderBottom:isExp?"none":`1px solid ${tc.bgAlt}`,background:isExp?rowExpandBg:rowBg,cursor:"pointer"}}
                            onClick={()=>toggleExpand(f.fons)}>
                            <td style={{padding:"10px 8px 10px 12px",textAlign:"center"}}>
                              <span style={{fontSize:14,color:tc.green,fontWeight:700,lineHeight:1,display:"inline-block",transition:"transform 0.2s",transform:isExp?"rotate(90deg)":"rotate(0deg)"}}>▶</span>
                            </td>
                            <td style={{padding:"10px 10px",fontSize:11,color:tc.textLight,fontWeight:600}}>{i+1}</td>
                            <td style={{padding:"10px 10px",fontWeight:700,color:isExp?tc.green:tc.text,fontSize:12,maxWidth:220,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                              <Link
                                to={`/fund/${slugify(f.fons)}`}
                                onClick={e => e.stopPropagation()}
                                style={{ color: "inherit", textDecoration: "none" }}
                                onMouseEnter={e => e.currentTarget.style.textDecoration = "underline"}
                                onMouseLeave={e => e.currentTarget.style.textDecoration = "none"}
                              >
                                {f.fons}
                              </Link>
                            </td>
                            <td style={{padding:"10px 10px",textAlign:"right",fontFamily:"'DM Mono',monospace",fontSize:12,color:tc.navyLight}}>{f.compr?fmtM(f.compr):"—"}</td>
                            <td style={{padding:"10px 10px",textAlign:"right",fontFamily:"'DM Mono',monospace",fontSize:12,fontWeight:700,color:tc.navy}}>{fmtM(f.calls)}</td>
                            <td style={{padding:"10px 10px",textAlign:"right"}}>
                              {pct!==null&&(
                                <div style={{display:"flex",alignItems:"center",gap:7,justifyContent:"flex-end"}}>
                                  <div style={{width:70,height:6,background:tc.bgAlt,borderRadius:3,overflow:"hidden"}}>
                                    <div style={{width:`${Math.min(100,pct)}%`,height:"100%",background:pctCol(pct),borderRadius:3}}/>
                                  </div>
                                  <span style={{fontSize:11,color:pctCol(pct),minWidth:38,textAlign:"right",fontWeight:600}}>{pct.toFixed(1)}%</span>
                                </div>
                              )}
                            </td>
                            <td style={{padding:"10px 10px",textAlign:"right",fontFamily:"'DM Mono',monospace",fontSize:12,color:tc.green}}>{f.dist?fmtM(f.dist):"—"}</td>
                            <td style={{padding:"10px 10px",textAlign:"right",fontFamily:"'DM Mono',monospace",fontSize:12,color:tc.greenDark}}>{f.retorn?fmtM(f.retorn):"—"}</td>
                            <td style={{padding:"10px 10px",textAlign:"right",fontFamily:"'DM Mono',monospace",fontSize:12,fontWeight:700,color:tc.green}}>{rebut?fmtM(rebut):"—"}</td>
                            <td style={{padding:"10px 10px",textAlign:"right",fontFamily:"'DM Mono',monospace",fontSize:12,fontWeight:700,color:net>=0?tc.greenDark:tc.navy}}>{net>=0?"+":""}{fmtM(net)}</td>
                            <td style={{padding:"10px 10px"}}><Badge label={f.vcpe} cfg={vcpeCfg[f.vcpe]}/></td>
                            <td style={{padding:"10px 10px"}}><Badge label={f.est}  cfg={estCfg[f.est]}/></td>
                          </tr>

                          {/* Fila desplegable: moviments */}
                          {isExp&&(
                            <tr key={`exp-${i}`} style={{borderBottom:`2px solid ${tc.green}`}}>
                              <td colSpan={12} style={{padding:0,background:rowExpandBg}}>
                                <div style={{padding:"0 16px 14px 52px"}}>
                                  <div style={{fontSize:10,letterSpacing:"0.12em",color:tc.green,textTransform:"uppercase",fontWeight:700,padding:"10px 0 8px"}}>
                                    Moviments · {moviments.length} transaccions
                                  </div>
                                  {moviments.length===0
                                    ? <div style={{fontSize:12,color:tc.textLight,padding:"8px 0"}}>Cap moviment amb els filtres actuals.</div>
                                    : <table style={{width:"100%",borderCollapse:"collapse"}}>
                                        <thead>
                                          <tr style={{background:rowExpandHeader}}>
                                            {["Data","Tipus","Categoria","FY","Import EUR"].map(h=>(
                                              <th key={h} style={{padding:"6px 10px",fontSize:10,letterSpacing:"0.08em",color:tc.greenDark,textTransform:"uppercase",fontWeight:600,textAlign:h==="Import EUR"?"right":"left",whiteSpace:"nowrap",borderBottom:`1px solid ${rowExpandBorder}`}}>{h}</th>
                                            ))}
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {moviments.map((r,mi)=>{
                                            const isIn=r.eur>0;
                                            const cfg=catCfg[r.cat]||{};
                                            return (
                                              <tr key={mi} style={{borderBottom:`1px solid ${rowExpandBorder}`,background:mi%2===0?"transparent":rowExpandAlt}}>
                                                <td style={{padding:"6px 10px",fontSize:11,color:tc.textMid,whiteSpace:"nowrap"}}>{r.data}</td>
                                                <td style={{padding:"6px 10px",fontSize:11,color:tc.textMid,whiteSpace:"nowrap"}}>{r.tipus}</td>
                                                <td style={{padding:"6px 10px"}}>
                                                  <span style={{fontSize:10,background:cfg.bg||tc.bgAlt,color:cfg.color||tc.textMid,borderRadius:4,padding:"1px 7px",fontWeight:600}}>{r.cat}</span>
                                                </td>
                                                <td style={{padding:"6px 10px",fontSize:11,color:tc.textLight}}>{r.fy}</td>
                                                <td style={{padding:"6px 10px",textAlign:"right",fontFamily:"'DM Mono',monospace",fontSize:12,fontWeight:700,color:isIn?tc.navy:tc.green}}>
                                                  {!isIn&&"+ "}{fmtM(Math.abs(r.eur))}
                                                </td>
                                              </tr>
                                            );
                                          })}
                                        </tbody>
                                        <tfoot>
                                          <tr style={{borderTop:`1px solid ${rowExpandBorder}`,background:rowExpandHeader}}>
                                            <td colSpan={4} style={{padding:"6px 10px",fontSize:11,fontWeight:700,color:tc.greenDark}}>Total period</td>
                                            <td style={{padding:"6px 10px",textAlign:"right",fontFamily:"'DM Mono',monospace",fontSize:12,fontWeight:700,color:tc.navy}}>
                                              {fmtM(moviments.filter(r=>r.eur>0).reduce((s,r)=>s+r.eur,0))} cridat
                                              {moviments.filter(r=>r.eur<0).length>0&&<span style={{color:tc.green,marginLeft:8}}>{fmtM(moviments.filter(r=>r.eur<0).reduce((s,r)=>s+Math.abs(r.eur),0))} rebut</span>}
                                            </td>
                                          </tr>
                                        </tfoot>
                                      </table>
                                  }
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{borderTop:`2px solid ${tc.border}`,background:tc.bgAlt}}>
                      <td colSpan={3} style={{padding:"9px 10px",fontSize:12,fontWeight:700}}>TOTAL ({fonsFiltered.length} fons)</td>
                      <td style={{padding:"9px 10px",textAlign:"right",fontFamily:"'DM Mono',monospace",fontWeight:700,color:tc.navyLight,fontSize:12}}>{fmtM(fonsFiltered.reduce((s,f)=>s+f.compr,0))}</td>
                      <td style={{padding:"9px 10px",textAlign:"right",fontFamily:"'DM Mono',monospace",fontWeight:700,color:tc.navy,fontSize:12}}>{fmtM(fonsFiltered.reduce((s,f)=>s+f.calls,0))}</td>
                      <td style={{padding:"9px 10px",textAlign:"right",fontSize:11,color:tc.textMid}}>{(()=>{const tcc=fonsFiltered.reduce((s,f)=>s+f.calls,0),tco=fonsFiltered.reduce((s,f)=>s+f.compr,0);return tco>0?(tcc/tco*100).toFixed(1)+"%":"—";})()}</td>
                      <td style={{padding:"9px 10px",textAlign:"right",fontFamily:"'DM Mono',monospace",fontWeight:700,color:tc.green,fontSize:12}}>{fmtM(fonsFiltered.reduce((s,f)=>s+f.dist,0))}</td>
                      <td style={{padding:"9px 10px",textAlign:"right",fontFamily:"'DM Mono',monospace",fontWeight:700,color:tc.greenDark,fontSize:12}}>{fmtM(fonsFiltered.reduce((s,f)=>s+f.retorn,0))}</td>
                      <td style={{padding:"9px 10px",textAlign:"right",fontFamily:"'DM Mono',monospace",fontWeight:700,color:tc.green,fontSize:12}}>{fmtM(fonsFiltered.reduce((s,f)=>s+f.dist+f.retorn,0))}</td>
                      <td style={{padding:"9px 10px",textAlign:"right",fontFamily:"'DM Mono',monospace",fontWeight:700,fontSize:12}}>{(()=>{const net=fonsFiltered.reduce((s,f)=>s+(f.dist+f.retorn-f.calls),0);return(net>=0?"+":"")+fmtM(net);})()}</td>
                      <td colSpan={2}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
          );
        })()}

        {/* ── TRANSACCIONS ── */}
        {tab==="txlog"&&(
          <div key="txlog" className="tab-panel" style={{background:tc.card,border:`1px solid ${tc.border}`,borderRadius:10,padding:"18px",boxShadow:"0 2px 8px rgba(0,0,0,.08)"}}>
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead>
                  <tr style={{background:tc.bgAlt}}>
                    {[{k:"data",l:"Data"},{k:"fons",l:"Fons"},{k:"tipus",l:"Tipus"},{k:"cat",l:"Categoria"},{k:"eur",l:"Import EUR",right:true},{k:"fy",l:"FY"},{k:"vcpe",l:"VC/PE",title:"Venture Capital / Private Equity"},{k:"est",l:"Estratègia",title:"Estructura del fons"}].map(h=>(
                      <th key={h.k} onClick={()=>sortTx(h.k)} title={h.title} style={{...th,textAlign:h.right?"right":"left",cursor:"pointer"}}>
                        {h.l}<TArr k={h.k}/>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {txSorted.length===0 && <tr><td colSpan={8}><EmptyState/></td></tr>}
                  {txSlice.map((r,i)=>{
                    const isIn=r.eur>0;
                    const cfg=catCfg[r.cat]||{};
                    return (
                      <tr key={i} style={{borderBottom:`1px solid ${tc.bgAlt}`,background:i%2===0?tc.card:tc.bgAlt}}>
                        <td style={{padding:"8px 10px",fontSize:11,color:tc.textMid,whiteSpace:"nowrap"}}>{r.data}</td>
                        <td style={{padding:"8px 10px",fontWeight:600,color:tc.text,fontSize:12,maxWidth:210,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={r.fons}>{r.fons}</td>
                        <td style={{padding:"8px 10px",fontSize:11,color:tc.textMid,whiteSpace:"nowrap"}}>{r.tipus}</td>
                        <td style={{padding:"8px 10px"}}><span style={{fontSize:11,background:cfg.bg||tc.bgAlt,color:cfg.color||tc.textMid,borderRadius:5,padding:"2px 8px",fontWeight:600,whiteSpace:"nowrap"}}>{r.cat}</span></td>
                        <td style={{padding:"8px 10px",textAlign:"right",fontFamily:"'DM Mono',monospace",fontSize:12,fontWeight:700,color:isIn?tc.navy:tc.green}}>{!isIn&&"+ "}{fmtM(Math.abs(r.eur))}</td>
                        <td style={{padding:"8px 10px",fontSize:11,color:tc.textMid,whiteSpace:"nowrap"}}>{r.fy}</td>
                        <td style={{padding:"8px 10px"}}><Badge label={r.vcpe} cfg={vcpeCfg[r.vcpe]}/></td>
                        <td style={{padding:"8px 10px"}}><Badge label={r.est}  cfg={estCfg[r.est]}/></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:14,paddingTop:12,borderTop:`1px solid ${tc.border}`}}>
              <span style={{fontSize:12,color:tc.textLight}}>{txSorted.length} moviments · pàgina <b style={{color:tc.navy}}>{txPage+1}</b> de {txPages}</span>
              <div style={{display:"flex",gap:6}}>
                <button disabled={txPage===0} onClick={()=>setTxPage(p=>p-1)} style={{background:"transparent",border:`1px solid ${tc.border}`,borderRadius:5,padding:"5px 14px",cursor:txPage===0?"not-allowed":"pointer",color:txPage===0?tc.textLight:tc.navy,fontFamily:"inherit",fontSize:12}}>← Anterior</button>
                <button disabled={txPage>=txPages-1} onClick={()=>setTxPage(p=>p+1)} style={{background:txPage>=txPages-1?tc.bgAlt:tc.navy,border:"none",borderRadius:5,padding:"5px 14px",cursor:txPage>=txPages-1?"not-allowed":"pointer",color:txPage>=txPages-1?tc.textLight:"#fff",fontFamily:"inherit",fontSize:12}}>Següent →</button>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* ── Data Loader Modal ── */}
      {showLoader&&(
        <DataLoader
          onLoad={handleLoad}
          onClose={()=>setShowLoader(false)}
          dataInfo={{ccRows:rawCC.length, plRows:funds0.length, loaded:loadedAt}}
        />
      )}
    </div>
  );
}

// In production, poll /api/data-version and reload if src/data files change.
// In dev, Vite HMR handles this automatically.
function useDataReload() {
  useEffect(() => {
    if (!import.meta.env.PROD) return;
    let version = null;
    const id = setInterval(async () => {
      try {
        const { version: v } = await fetch("/api/data-version").then(r => r.json());
        if (version === null) { version = v; return; }
        if (v !== version) window.location.reload();
      } catch { /* server unreachable, ignore */ }
    }, 10_000);
    return () => clearInterval(id);
  }, []);
}

export default function Dashboard() {
  useDataReload();
  const [dark, setDark] = useState(() => localStorage.getItem("tc_dark") === "1");
  const tc = dark ? TC_DARK : TC_LIGHT;
  const toggleDark = () => {
    setDark(d => {
      const next = !d;
      localStorage.setItem("tc_dark", next ? "1" : "0");
      return next;
    });
  };

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  }, [dark]);

  return (
    <ThemeContext.Provider value={{ tc, dark, toggle: toggleDark }}>
      <DashboardInner />
    </ThemeContext.Provider>
  );
}
