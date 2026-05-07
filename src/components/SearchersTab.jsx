import React, { useEffect, useMemo, useState, useRef } from "react";
import { ecTheme } from "../echartsTheme.js";
import { SearcherYearChart, SearcherGeoPieChart, SearcherGeoBarChart } from "./SearcherCharts.jsx";
import { ResponsiveSankey } from "@nivo/sankey";
import { useTheme } from "../theme.js";
import { fmtM, calcMesos, mesosColor, mesosBg, parseSearchersCSV, usePersistedState, formatIsoDateDMY, readStoredJSON, tvpiColor, tvpiBg, formatMultiple } from "../utils.js";
import { GEO_NAME, SEARCHER_STATUS_OPTIONS, SEARCHER_MODALITAT_OPTIONS, SEARCHER_FORM_ENTRADA_OPTIONS } from "../config.js";
import { FlagImg, AddRowModal, DeleteRowButton, EditableCell } from "./SharedComponents.jsx";
import { useAuth } from "../auth.jsx";
import { upsertSearcher, saveSearchers, loadSearchers, loadCompanies } from "../db.js";
import { useToast } from "../toast.jsx";
import { apiFetchJson } from "../apiClient.js";
import * as XLSX from "xlsx";
import { isSfBackedCompany } from "../data/privateCompanyModel.js";
import {
  normalizeSearcherName,
  describeSearcherStage,
} from "../data/searcherModel.js";
import {
  StatusBadge, StageBadge, SectionHeading,
  SANKEY_NODE_COLORS, ENTRY_BADGE_CFG,
} from "./SearchersBadges.jsx";
import {
  searcherKey, splitSearcherNames, splitSchoolNames,
  toggleActiveFilter, sankeyNodeToEntry, formatPercent, formatEquityStake,
} from "../data/searcherFormatting.js";

// ── main component ─────────────────────────────────────────
export function SearchersTab({ search = "", subTab = "tots", rawCC = [] }) {
  const { tc: TC, dark } = useTheme();
  const { canEditSection } = useAuth();
  const canEdit = canEditSection("searchers");
  const { toast } = useToast();
  const [showAddModal, setShowAddModal] = useState(false);

  const [historicData, setHistoricData] = usePersistedState("tc_allSearchers", []);
  const [companies, setCompanies] = usePersistedState("tc_portfolioCompanies", []);
  const [histFilter, setHistFilter]     = useState({ status:"Tots", geo:"Tots", entrada:"Tots" });
  const [histSort, setHistSort]         = useState({ k:"nom", d:"asc" });
  const [activeGeoFilter, setActiveGeoFilter] = usePersistedState("ui_searchersGeo", "Tots");
  const [activeEntryFilter, setActiveEntryFilter] = usePersistedState("ui_searchersEntry", "Tots");
  const [activeStatusFilter, setActiveStatusFilter] = usePersistedState("ui_searchersStatus", "Tots");
  const [activeTypeFilter, setActiveTypeFilter] = usePersistedState("ui_searchersType", "Tots");
  const [activeModalityFilter, setActiveModalityFilter] = usePersistedState("ui_searchersModality", "Tots");
  const [activeSort, setActiveSort] = usePersistedState("ui_searchersSort", { k:"nom", d:"asc" });
  const csvRef    = useRef(null);
  const nifXlsRef = useRef(null);
  const capitalCalls = useMemo(
    () => (Array.isArray(rawCC) && rawCC.length ? rawCC : readStoredJSON("tc_rawCC", [])),
    [rawCC]
  );

  // shared styles
  const card = { background:TC.card, border:`1px solid ${TC.border}`, borderRadius:10, padding:"20px 22px", boxShadow:"0 2px 12px rgba(0,0,0,.06)" };
  const th   = { padding:"9px 10px", fontSize:10, letterSpacing:"0.09em", color:TC.textLight, textTransform:"uppercase", fontWeight:600, textAlign:"left", borderBottom:`2px solid ${TC.border}`, whiteSpace:"nowrap", userSelect:"none" };
  const sec  = { fontSize:10, letterSpacing:"0.11em", color:TC.textLight, textTransform:"uppercase", marginBottom:16, fontWeight:600 };

  useEffect(() => {
    loadSearchers().then((data) => {
      if (Array.isArray(data)) setHistoricData(data);
    }).catch((error) => {
      console.error("Searchers refresh failed:", error);
    });
    loadCompanies().then((data) => {
      if (Array.isArray(data)) setCompanies(data);
    }).catch((error) => {
      console.error("Companies refresh failed:", error);
    });
  }, [setCompanies, setHistoricData]);

  // Keyed by private_entity NIF (= row.id in rawCC = vehicle_id)
  const capitalCallsByNif = useMemo(() => {
    const map = new Map();
    (Array.isArray(capitalCalls) ? capitalCalls : []).forEach((row) => {
      if (row?.vcpe !== "SF" || !row?.id) return;
      const date = String(row?.data ?? "").slice(0, 10);
      if (!date.match(/^\d{4}-\d{2}-\d{2}$/)) return;
      const current = map.get(row.id) ?? { firstCommitmentDate: null, firstCommitmentEur: null };
      if (row?.eur > 0 && ["Compromís", "Capital Call"].includes(row?.cat) && (!current.firstCommitmentDate || date < current.firstCommitmentDate)) {
        current.firstCommitmentDate = date;
        if (current.firstCommitmentEur == null && row.eur != null) current.firstCommitmentEur = row.eur;
      }
      map.set(row.id, current);
    });
    return map;
  }, [capitalCalls]);

  // Fallback: keyed by normalised fund name for searchers without NIF set
  const capitalCallsBySearcher = useMemo(() => {
    const map = new Map();
    (Array.isArray(capitalCalls) ? capitalCalls : []).forEach((row) => {
      if (row?.vcpe !== "SF") return;
      const key = normalizeSearcherName(row?.fons);
      const date = String(row?.data ?? "").slice(0, 10);
      if (!key || !date.match(/^\d{4}-\d{2}-\d{2}$/)) return;
      const current = map.get(key) ?? { firstCommitmentDate: null, firstCommitmentEur: null };
      if (row?.eur > 0 && ["Compromís", "Capital Call"].includes(row?.cat) && (!current.firstCommitmentDate || date < current.firstCommitmentDate)) {
        current.firstCommitmentDate = date;
        if (current.firstCommitmentEur == null && row.eur != null) current.firstCommitmentEur = row.eur;
      }
      map.set(key, current);
    });
    return map;
  }, [capitalCalls]);

  const enrichedSearchers = useMemo(() => (
    historicData.map((row) => {
      const searchers = [row.searcher1, row.searcher2].filter(Boolean).join(" / ");
      const stage = describeSearcherStage(row);
      const ccMeta = (row.nif && capitalCallsByNif.get(row.nif)) || capitalCallsBySearcher.get(normalizeSearcherName(row.nom));
      const derivedDataCompr = ccMeta?.firstCommitmentDate ?? row.dataCompr ?? null;
      const derivedTicket = ccMeta?.firstCommitmentEur ?? row.ticket ?? null;
      const investmentYear = derivedDataCompr ? Number(derivedDataCompr.slice(0, 4)) : null;
      return {
        ...row,
        ticket: derivedTicket,
        searchers,
        derivedDataCompr,
        investmentYear,
        stageLabel: stage.label,
        stageOrder: stage.order,
        mesosCercant: derivedDataCompr ? calcMesos(derivedDataCompr) : row.mesosCercant ?? null,
      };
    })
  ), [capitalCallsByNif, capitalCallsBySearcher, historicData]);

  const activeRows = useMemo(
    () => enrichedSearchers.filter((row) => row.statusScreening === "Invertit en fase de cerca"),
    [enrichedSearchers]
  );

  const commitmentYearData = useMemo(() => {
    const counts = new Map();
    activeRows
      .filter((row) => !row.isMock && Number.isFinite(row.investmentYear))
      .forEach((row) => {
        counts.set(row.investmentYear, (counts.get(row.investmentYear) ?? 0) + 1);
      });
    return [...counts.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([year, count]) => ({ year: String(year), count }));
  }, [activeRows]);

  // ── KPIs ──────────────────────────────────────────────────
  const totalSearchers  = activeRows.reduce((sum, row) => sum + (row.ticket ?? 0), 0);
  const soloCount       = activeRows.filter(r => r.modalitat === "Solo").length;
  const duoCount        = activeRows.filter(r => r.modalitat !== "Solo").length;

  const getActiveSortValue = (row, key) => {
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

  const displayedSearchers = useMemo(() => {
    let list = activeRows;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(r =>
        r.nom.toLowerCase().includes(q) ||
        (r.searchers ?? "").toLowerCase().includes(q)
      );
    }
    if (activeGeoFilter !== "Tots") {
      list = list.filter(r => r.geo === activeGeoFilter);
    }
    if (activeEntryFilter !== "Tots") {
      list = list.filter(r => r.formEntrada === activeEntryFilter);
    }
    if (activeStatusFilter !== "Tots") {
      list = list.filter(r => r.statusScreening === activeStatusFilter);
    }
    if (activeTypeFilter !== "Tots") {
      list = list.filter(r => r.tipus === activeTypeFilter);
    }
    if (activeModalityFilter !== "Tots") {
      list = list.filter(r => r.modalitat === activeModalityFilter);
    }
    return [...list].sort((a, b) => {
      const va = getActiveSortValue(a, activeSort.k);
      const vb = getActiveSortValue(b, activeSort.k);
      let cmp = 0;
      if (typeof va === "number" && typeof vb === "number") cmp = va - vb;
      else cmp = String(va).localeCompare(String(vb), "ca", { sensitivity: "base" });
      if (cmp === 0) cmp = String(a.nom).localeCompare(String(b.nom), "ca", { sensitivity: "base" });
      return activeSort.d === "asc" ? cmp : -cmp;
    });
  }, [activeEntryFilter, activeGeoFilter, activeModalityFilter, activeRows, activeSort, activeStatusFilter, activeTypeFilter, search]);
  const displayedSearchersTicket = useMemo(
    () => displayedSearchers.reduce((sum, row) => sum + (row.ticket ?? 0), 0),
    [displayedSearchers]
  );

  // ── Sankey data ───────────────────────────────────────────
  const sankeyData = useMemo(() => {
    const real = enrichedSearchers.filter(r => !r.isMock);
    const sc   = real.filter(r => r.formEntrada === "Search Capital");
    const eg   = real.filter(r => r.formEntrada === "Equity Gap");

    const scBacked   = sc.filter(r => r.statusScreening === "Invertit en fase de cerca").length;
    const scAcq      = companies.filter(c => isSfBackedCompany(c) && c.origen === "Search Capital").length;
    const scCercant  = Math.max(scBacked - scAcq, 0);
    const egInvertit = eg.filter(r =>
      r.statusScreening === "Invertit en fase d'adquisició" ||
      r.statusScreening === "Invertit en fase de cerca"
    ).length;
    const portfolio  = scAcq + egInvertit;

    const links = [
      { source: "Searchers",    target: "Cercant",      value: scCercant  },
      { source: "Searchers",    target: "Acabat Cerca", value: scAcq      },
      { source: "Equity Gap",   target: "Portafoli",    value: egInvertit },
      { source: "Acabat Cerca", target: "Portafoli",    value: scAcq      },
      { source: "Portafoli",    target: "Operant",      value: portfolio  },
    ].filter(l => l.value > 0);

    const usedIds = new Set(links.flatMap(l => [l.source, l.target]));
    const nodes = [...usedIds].map(id => ({ id }));

    return { nodes, links };
  }, [companies, enrichedSearchers]);

  // ── Conversations stats ────────────────────────────────────
  const convStats = useMemo(() => {
    const real        = enrichedSearchers.filter(r => !r.isMock);
    const sc          = real.filter(r => r.formEntrada === "Search Capital");
    const eg          = real.filter(r => r.formEntrada === "Equity Gap");
    const scBacked    = sc.filter(r => r.statusScreening === "Invertit en fase de cerca").length;
    const egInvertit  = eg.filter(r => r.statusScreening === "Invertit en fase d'adquisició" || r.statusScreening === "Invertit en fase de cerca").length;
    const allDescartat = real.filter(r => ["Descartat","Sobresuscrit","No tancat"].includes(r.statusScreening)).length;
    const allRevisio  = real.filter(r => ["En anàlisi","Pendent de formalitzar"].includes(r.statusScreening)).length;
    return { total: real.length, scBacked, egInvertit, allDescartat, allRevisio };
  }, [enrichedSearchers]);

  const handleGeoClick = (geo) => {
    setActiveGeoFilter((current) => toggleActiveFilter(current, geo));
  };

  const handleEntryFilterClick = (entry) => {
    setActiveEntryFilter((current) => toggleActiveFilter(current, entry));
  };

  // ── Geography data (searchers only) ──────────────────────
  const geoData = useMemo(() => {
    const m = {};
    activeRows.forEach(s => {
      if (!m[s.geo]) m[s.geo] = { geo:s.geo, name:GEO_NAME[s.geo]||s.geo, value:0, count:0 };
      m[s.geo].value += s.ticket ?? 0;
      m[s.geo].count += 1;
    });
    return Object.values(m).sort((a, b) => b.value - a.value);
  }, [activeRows]);
  const geoCountData = useMemo(
    () => [...geoData].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "ca", { sensitivity: "base" })),
    [geoData]
  );
  const geoTotal = geoData.reduce((s, r) => s + r.value, 0);
  const geoCountTotal = geoCountData.reduce((s, r) => s + r.count, 0);
  const t = ecTheme(TC);
  const sortActive = (k) => setActiveSort(p => ({ k, d: p.k === k && p.d === "asc" ? "desc" : "asc" }));
  const AArr = ({ k }) => <span style={{ marginLeft:3, opacity:activeSort.k===k?1:0.2, fontSize:9 }}>{activeSort.k===k&&activeSort.d==="asc"?"▲":"▼"}</span>;
  const isSummaryView = subTab === "resum";
  const isAllView = subTab === "tots";
  const isActiveView = subTab === "actius";

  // ── Historic table ─────────────────────────────────────────
  const getHistoricSortValue = (row, key) => {
    if (key === "geo") return GEO_NAME[row.geo] || row.geo || "";
    if (key === "stageLabel") return row.stageOrder ?? 0;
    if (key === "investmentYear") return row.investmentYear ?? 0;
    return row[key] ?? "";
  };

  const filteredHistoric = useMemo(() => {
    let d = [...enrichedSearchers];
    if (histFilter.status !== "Tots") d = d.filter(r => r.statusScreening === histFilter.status);
    if (histFilter.geo    !== "Tots") d = d.filter(r => r.geo === histFilter.geo);
    if (histFilter.entrada !== "Tots") d = d.filter(r => r.formEntrada === histFilter.entrada);
    return [...d].sort((a, b) => {
      const va = getHistoricSortValue(a, histSort.k);
      const vb = getHistoricSortValue(b, histSort.k);
      let cmp = 0;
      if (typeof va === "number" && typeof vb === "number") cmp = va - vb;
      else cmp = String(va).localeCompare(String(vb), "ca", { sensitivity: "base" });
      if (cmp === 0) cmp = String(a.nom).localeCompare(String(b.nom), "ca", { sensitivity: "base" });
      return histSort.d === "asc" ? cmp : -cmp;
    });
  }, [enrichedSearchers, histFilter, histSort]);

  const sortHist = k => setHistSort(p => ({ k, d: p.k === k && p.d === "asc" ? "desc" : "asc" }));
  const HArr = ({ k }) => <span style={{ marginLeft:3, opacity:histSort.k===k?1:0.2, fontSize:9 }}>{histSort.k===k&&histSort.d==="asc"?"▲":"▼"}</span>;

  const uniq     = key => ["Tots", ...Array.from(new Set(historicData.map(r => r[key]).filter(Boolean))).sort()];
  const uniqVals = key => Array.from(new Set(historicData.map(r => r[key]).filter(Boolean))).sort();

  const handleCSV = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const rows = parseSearchersCSV(ev.target.result);
        if (rows.length) {
          const mapped = rows.map(r => ({
            nom: r.nom, tipus: r.tipus, modalitat: r.modalitat, geo: r.geo,
            statusScreening: r.statusScreening, formEntrada: r.formEntrada,
            introPer: r.introPer, searcher1: r.searcher1||"", searcher2: r.searcher2||"",
            escola1: r.escola1||"", escola2: r.escola2||"",
          }));
          const { error } = await saveSearchers(mapped);
          if (error) {
            toast({ message: "Error carregant searchers: " + error.message, type: "error" });
            return;
          }
          const refreshed = await loadSearchers();
          setHistoricData(refreshed ?? mapped);
        }
      } catch {
        toast({ message: "No s'ha pogut llegir el CSV.", type: "error" });
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const isMockNif = (nif) => !nif || String(nif).startsWith("MOCKNIF:");

  const exportNifExcel = () => {
    const rows = historicData.filter(r => isMockNif(r.nif));
    if (!rows.length) {
      toast({ message: "Tots els searchers ja tenen NIF real." });
      return;
    }
    const data = rows.map(r => ({
      id:          r.id ?? "",
      nom:         r.nom ?? "",
      nif_actual:  r.nif ?? "",
      nif_nou:     "",
      status:      r.statusScreening ?? "",
      entrada:     r.formEntrada ?? "",
      geo:         r.geo ?? "",
      ticket:      r.ticket ?? "",
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    ws["!cols"] = [
      { wch: 10 }, { wch: 40 }, { wch: 30 }, { wch: 20 },
      { wch: 30 }, { wch: 16 }, { wch: 6 }, { wch: 10 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "NIFs");
    XLSX.writeFile(wb, `searchers_nif_${new Date().toISOString().slice(0,10)}.xlsx`);
    toast({ message: `${rows.length} searchers exportats.` });
  };

  const handleNifImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const wb = XLSX.read(ev.target.result, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });
        const updates = rows.filter(r => String(r.nif_nou ?? "").trim());
        if (!updates.length) {
          toast({ message: "Cap NIF nou trobat a la columna nif_nou." });
          return;
        }
        let ok = 0, fail = 0;
        for (const row of updates) {
          const id = Number(row.id);
          const newNif = String(row.nif_nou).trim();
          const target = historicData.find(s => s.id === id);
          if (!target) { fail++; continue; }
          const { error } = await upsertSearcher({ ...target, nif: newNif });
          if (error) { fail++; } else { ok++; }
        }
        const refreshed = await loadSearchers();
        if (Array.isArray(refreshed)) setHistoricData(refreshed);
        toast({ message: `NIFs actualitzats: ${ok} ok${fail ? `, ${fail} errors` : ""}.`, type: fail ? "error" : "success" });
      } catch (err) {
        toast({ message: "Error important NIFs: " + err.message, type: "error" });
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  };

  const reloadSearchers = async () => {
    const refreshed = await loadSearchers();
    if (!Array.isArray(refreshed)) {
      toast({ message: "No s'han pogut refrescar els searchers des de la base de dades.", type: "error" });
      return;
    }
    setHistoricData(refreshed);
    toast({ message: "Searchers recarregats des de la base de dades." });
  };

  const inp = { border:`1px solid ${TC.border}`, borderRadius:4, padding:"4px 8px", fontSize:11, color:TC.text, background:TC.card, outline:"none", fontFamily:"inherit", cursor:"pointer" };

  // ── Handlers for historic table ───────────────────────────
  const saveSearcherField = async (target, field, value) => {
    const targetKey = searcherKey(target);
    const targetIndex = historicData.findIndex((searcher) => {
      const candidateKey = searcherKey(searcher);
      return targetKey != null ? candidateKey === targetKey : searcher.nom === target.nom;
    });
    if (targetIndex === -1) return;
    const fieldPatch = field === "searchers"
      ? splitSearcherNames(value)
      : field === "schools"
        ? splitSchoolNames(value)
      : field === "status"
        ? { statusScreening: value }
        : { [field]: value };
    const updated = historicData.map((searcher, index) => (
      index === targetIndex ? { ...searcher, ...fieldPatch } : searcher
    ));
    setHistoricData(updated);
    const searcher = updated[targetIndex];
    if (searcher) {
      const { data, error } = await upsertSearcher(searcher);
      if (error) {
        toast({ message: "Error desant canvis: " + error.message, type: "error" });
        return;
      }
      if (data) {
        setHistoricData((current) => current.map((row, index) => (
          index === targetIndex ? data : row
        )));
      }
    }
  };

  const handleAddSearcher = async (values, setError) => {
    const nom = values.nom?.trim();
    if (!nom) { setError("El nom és obligatori"); return; }
    if (historicData.some(s => String(s.nom ?? "").trim().toLowerCase() === nom.toLowerCase())) {
      setError("Ja existeix un searcher amb aquest nom");
      return;
    }
    const searcher = {
      nom, tipus: values.tipus || null, modalitat: values.modalitat || null,
      geo: values.geo || null, statusScreening: values.statusScreening || null,
      formEntrada: values.formEntrada || null, introPer: null,
      searcher1: null, searcher2: null, escola1: null, escola2: null,
      ticket: parseFloat(values.ticket) || null,
      dataInici: values.dataInici || null, dataCompr: null, mesosCercant: null,
      equityStake: parseFloat(values.equityStake) || null, isMock: false,
      nif: values.nif?.trim() || null,
    };
    let inserted = null;
    try {
      const response = await apiFetchJson("/api/searchers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(searcher),
      });
      inserted = response?.data ?? null;
    } catch (error) {
      setError(error?.message || "Error en crear el searcher");
      return;
    }
    if (!inserted) {
      setError("Error en crear el searcher");
      return;
    }
    const refreshed = await loadSearchers();
    setHistoricData(Array.isArray(refreshed) ? refreshed : [inserted, ...historicData]);
    setShowAddModal(false);
    toast({ message: `Searcher creat: ${nom}` });
  };

  const handleDeleteSearcher = async (target) => {
    if (target?.id) {
      try {
        await apiFetchJson(`/api/searchers?id=${encodeURIComponent(target.id)}`, {
          method: "DELETE",
        });
      } catch (error) {
        toast({ message: "Error eliminant searcher: " + (error?.message || "error desconegut"), type: "error" });
        return;
      }
    }
    const targetKey = searcherKey(target);
    setHistoricData(historicData.filter((searcher) => (
      targetKey != null ? searcherKey(searcher) !== targetKey : searcher.nom !== target.nom
    )));
    toast({ message: "Searcher eliminat." });
  };

  return (
    <div style={{ padding:"0 0 40px" }}>

      {/* ── Data load bar ── */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"flex-end", gap:8, marginBottom:14 }}>
        <span style={{ fontSize:11, color:TC.textLight }}>
          {historicData.length} searchers a base de dades
          {historicData.filter(r => isMockNif(r.nif)).length > 0 && (
            <span style={{ marginLeft:6, color:"#B01F17", fontWeight:600 }}>
              · {historicData.filter(r => isMockNif(r.nif)).length} sense NIF real
            </span>
          )}
        </span>
        <button onClick={reloadSearchers}
          style={{ background:"transparent", border:`1px solid ${TC.border}`, borderRadius:6, padding:"5px 11px", cursor:"pointer", fontSize:11, color:TC.textMid, fontFamily:"inherit" }}>
          Recarregar DB
        </button>
        <button onClick={exportNifExcel}
          style={{ background:"transparent", border:`1px solid ${TC.border}`, borderRadius:6, padding:"5px 11px", cursor:"pointer", fontSize:11, color:TC.textMid, fontFamily:"inherit" }}>
          ↓ Exportar NIFs
        </button>
        <input ref={nifXlsRef} type="file" accept=".xlsx,.xls" style={{ display:"none" }} onChange={handleNifImport} />
        <button onClick={() => nifXlsRef.current?.click()}
          style={{ background:"transparent", border:`1px solid ${TC.border}`, borderRadius:6, padding:"5px 11px", cursor:"pointer", fontSize:11, color:TC.textMid, fontFamily:"inherit" }}>
          ↑ Importar NIFs
        </button>
        <input ref={csvRef} type="file" accept=".csv" style={{ display:"none" }} onChange={handleCSV} />
        <button onClick={() => csvRef.current?.click()}
          style={{ background:TC.navy, color:"#fff", border:"none", borderRadius:6, padding:"6px 14px", cursor:"pointer", fontSize:11, fontFamily:"inherit" }}>
          ↑ Importar CSV
        </button>
      </div>

      {/* ── KPIs ── */}
      {isSummaryView && <>
      <div className="grid-4" style={{ gap:12, marginBottom:18 }}>
        {[
          { label:"Searchers Actius",  value: activeRows.length,                             sub:`${soloCount} solo / ${duoCount} duo`,   accent:TC.navy },
          { label:"Capital Compromès", value: fmtM(totalSearchers),                          sub:"total search capital",                  accent:TC.green },
          { label:"Ticket Promig",     value: activeRows.length ? fmtM(totalSearchers / activeRows.length) : "—", sub:"per searcher", accent:TC.navyLight },
          { label:"Total DB",          value: historicData.length,                           sub:"searchers en base de dades",            accent:TC.navyLight },
        ].map(k => (
          <div key={k.label} style={{ ...card, padding:"16px 18px", borderTop:`3px solid ${k.accent}` }}>
            <div style={{ fontSize:10, color:TC.textLight, letterSpacing:"0.11em", textTransform:"uppercase", marginBottom:6, fontWeight:500 }}>{k.label}</div>
            <div style={{ fontSize:21, fontWeight:700, color:k.accent, marginBottom:2, letterSpacing:"-0.02em" }}>{k.value}</div>
            <div style={{ fontSize:11, color:TC.textLight }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Sankey + Geography ── */}
      <div className="grid-2" style={{ gap:14, marginBottom:14 }}>
        <div style={card}>
          <div style={{ ...sec, color:TC.textLight }}>
            <SectionHeading icon="🧭" color={dark ? "#112030" : "#E6EDF3"}>Participades per Forma d'Entrada i Resultat</SectionHeading>
          </div>

          {/* Conversations funnel strip */}
          <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:16, padding:"10px 14px", background:TC.bgAlt, borderRadius:10 }}>
            {[
              { label:"Total converses", value: convStats.total,       color: TC.navy },
              { label:"SC backed",       value: convStats.scBacked,    color: "#2563A8" },
              { label:"Equity Gap",      value: convStats.egInvertit,  color: "#6B2E7E" },
              { label:"Descartats",      value: convStats.allDescartat,color: "#B01F17" },
              { label:"En Revisió",      value: convStats.allRevisio,  color: "#8A6400" },
            ].map((s, i) => (
              <React.Fragment key={s.label}>
                {i > 0 && <span style={{ color:TC.border, alignSelf:"center" }}>·</span>}
                <span style={{ fontSize:11, color:TC.textMid }}>
                  <b style={{ color:s.color, fontFamily:"'DM Mono',monospace" }}>{s.value}</b>
                  {" "}{s.label}
                </span>
              </React.Fragment>
            ))}
          </div>

          <div style={{ height: 340 }}>
            {sankeyData.links.length === 0 ? (
              <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100%", color:TC.textLight, fontSize:12 }}>Sense dades</div>
            ) : (
            <ResponsiveSankey
              data={sankeyData}
              margin={{ top: 16, right: 180, bottom: 16, left: 180 }}
              align="start"
              colors={node => SANKEY_NODE_COLORS[node.id] || TC.navy}
              nodeOpacity={0.92}
              nodeThickness={20}
              nodeInnerPadding={4}
              nodeBorderWidth={0}
              nodeBorderRadius={3}
              nodePadding={28}
              linkOpacity={0.22}
              enableLinkGradient={true}
              labelPosition="outside"
              labelOrientation="horizontal"
              label={node => `${node.id} (${node.value})`}
              labelTextColor={node => SANKEY_NODE_COLORS[node.id] || TC.textMid}
              onClick={(node) => {
                const entry = sankeyNodeToEntry(node?.id);
                if (entry) handleEntryFilterClick(entry);
              }}
              theme={{
                text: { fontSize: 11, fontFamily: "'Outfit',system-ui,sans-serif", fill: TC.text },
                tooltip: {
                  container: {
                    background: TC.card,
                    border: `1px solid ${TC.border}`,
                    borderRadius: 6,
                    fontSize: 11,
                    fontFamily: "'Outfit',system-ui,sans-serif",
                    color: TC.text,
                  },
                },
              }}
            />
            )}
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:6, minHeight:20 }}>
            {activeEntryFilter !== "Tots" ? (
              <>
                <span style={{ fontSize:11, color:TC.textMid }}>
                  Filtre actiu: <b style={{ color:TC.navy }}>{activeEntryFilter}</b>
                </span>
                <button
                  onClick={() => setActiveEntryFilter("Tots")}
                  style={{ background:"transparent", border:`1px solid ${TC.border}`, borderRadius:4, padding:"1px 8px", cursor:"pointer", fontSize:10, color:TC.textMid, fontFamily:"inherit" }}
                >
                  ✕ netejar
                </button>
              </>
            ) : (
              <span style={{ fontSize:11, color:TC.textLight }}>Clica `Searchers` o `Equity Gap` per filtrar la taula d'actius per entrada.</span>
            )}
          </div>
        </div>

        <div style={card}>
          <div style={{ ...sec, color:TC.textLight }}>
            <SectionHeading icon="🌍" color={dark ? "#0A2010" : "#E8F8E8"}>Allocation Geogràfica — Searchers (€)</SectionHeading>
          </div>
          <SearcherGeoPieChart
            geoData={geoData}
            geoTotal={geoTotal}
            activeGeoFilter={activeGeoFilter}
            t={t}
            TC={TC}
            onGeoClick={handleGeoClick}
          />
          <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:6, minHeight:20 }}>
            {activeGeoFilter !== "Tots" ? (
              <>
                <span style={{ fontSize:11, color:TC.textMid }}>
                  Filtre actiu: <b style={{ color:TC.navy }}>{GEO_NAME[activeGeoFilter] || activeGeoFilter}</b>
                </span>
                <button
                  onClick={() => setActiveGeoFilter("Tots")}
                  style={{ background:"transparent", border:`1px solid ${TC.border}`, borderRadius:4, padding:"1px 8px", cursor:"pointer", fontSize:10, color:TC.textMid, fontFamily:"inherit" }}
                >
                  ✕ netejar
                </button>
              </>
            ) : (
              <span style={{ fontSize:11, color:TC.textLight }}>Clica un segment per filtrar la taula d'actius per geografia.</span>
            )}
          </div>
        </div>
      </div>

      <div className="grid-2" style={{ gap:14, marginBottom:14 }}>
      <div style={card}>
        <div style={{ ...sec, color:TC.textLight }}>
          <SectionHeading icon="📅" color={dark ? "#162840" : "#EAF2FB"}>Any de Compromís — Nombre de Searchers</SectionHeading>
        </div>
        {commitmentYearData.length === 0 ? (
          <div style={{ padding:"36px 0 12px", textAlign:"center", color:TC.textLight, fontSize:12 }}>
            Sense dades de compromís a capital calls.
          </div>
        ) : (
          <SearcherYearChart commitmentYearData={commitmentYearData} t={t} TC={TC} />
        )}
      </div>
      <div style={card}>
        <div style={{ ...sec, color:TC.textLight }}>
          <SectionHeading icon="🗺️" color={dark ? "#162840" : "#EAF2FB"}>Searchers Actius per Geografia</SectionHeading>
        </div>
        {geoCountData.length === 0 ? (
          <div style={{ padding:"36px 0 12px", textAlign:"center", color:TC.textLight, fontSize:12 }}>
            Sense dades geogràfiques.
          </div>
        ) : (
          <SearcherGeoBarChart
            geoCountData={geoCountData}
            geoCountTotal={geoCountTotal}
            activeGeoFilter={activeGeoFilter}
            t={t}
            TC={TC}
            onGeoClick={handleGeoClick}
          />
        )}
      </div>
      </div>
      </>}

      {/* ── Active Searchers table ── */}
      {isActiveView && (
      <div style={{ ...card, marginBottom:14 }}>
        <div style={{ ...sec, color:TC.textLight }}>
          <SectionHeading icon="🔍" color={dark ? "#162840" : "#EAF2FB"}>Searchers Actius</SectionHeading>
        </div>
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
            <thead>
              <tr>
                {[
                  { label:"Search Fund", k:"nom" },
                  { label:"Searchers", k:"searchers" },
                  { label:"Entrada", k:"formEntrada" },
                  { label:"Modalitat", k:"modalitat" },
                  { label:"Pais", k:"geo" },
                  { label:"Fase", k:"stage" },
                  { label:"Companyia Adquirida", k:"companiaAdquirida" },
                  { label:"Ticket", k:"ticket", right:true },
                  { label:"TVPI", k:"tvpi", right:true },
                  { label:"IRR", k:"irr", right:true },
                  { label:"DPI", k:"dpi", right:true },
                  { label:"Any Inv.", k:"investmentYear", center:true },
                  { label:"Data Compromis", k:"dataCompr" },
                  { label:"Mesos Cercant", k:"mesosCercant", center:true },
                  { label:"Equity Stake", k:"equityStake", right:true },
                ].map(h => (
                  <th
                    key={h.k}
                    style={{ ...th, cursor:"pointer", textAlign:h.right ? "right" : h.center ? "center" : "left" }}
                    onClick={() => sortActive(h.k)}
                  >
                    {h.label}<AArr k={h.k} />
                  </th>
                ))}
              </tr>
              <tr style={{ borderBottom:`1px solid ${TC.border}` }}>
                <th style={{ padding:"6px 10px" }} />
                <th style={{ padding:"6px 10px" }} />
                <th style={{ padding:"6px 10px" }}>
                  <select value={activeEntryFilter} onChange={e => setActiveEntryFilter(e.target.value)} style={{ ...inp, width:"100%", padding:"4px 6px", fontSize:11 }}>
                    {["Tots", ...Array.from(new Set(activeRows.map(r => r.formEntrada).filter(Boolean))).sort()].map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </th>
                <th style={{ padding:"6px 10px" }}>
                  <select value={activeModalityFilter} onChange={e => setActiveModalityFilter(e.target.value)} style={{ ...inp, width:"100%", padding:"4px 6px", fontSize:11 }}>
                    {["Tots", ...Array.from(new Set(activeRows.map(r => r.modalitat).filter(Boolean))).sort()].map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </th>
                <th style={{ padding:"6px 10px" }}>
                  <select value={activeGeoFilter} onChange={e => setActiveGeoFilter(e.target.value)} style={{ ...inp, width:"100%", padding:"4px 6px", fontSize:11 }}>
                    {["Tots", ...Array.from(new Set(activeRows.map(r => r.geo).filter(Boolean))).sort()].map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </th>
                <th style={{ padding:"6px 10px" }}>
                  <select value={activeStatusFilter} onChange={e => setActiveStatusFilter(e.target.value)} style={{ ...inp, width:"100%", padding:"4px 6px", fontSize:11 }}>
                    {["Tots", ...Array.from(new Set(activeRows.map(r => r.statusScreening).filter(Boolean))).sort()].map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </th>
                <th style={{ padding:"6px 10px" }} />
                <th style={{ padding:"6px 10px", textAlign:"right" }}>
                  <select value={activeTypeFilter} onChange={e => setActiveTypeFilter(e.target.value)} style={{ ...inp, width:"100%", padding:"4px 6px", fontSize:11 }}>
                    {["Tots", ...Array.from(new Set(activeRows.map(r => r.tipus).filter(Boolean))).sort()].map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </th>
                <th style={{ padding:"6px 10px" }} />
                <th style={{ padding:"6px 10px" }} />
                <th style={{ padding:"6px 10px" }} />
                <th style={{ padding:"6px 10px", textAlign:"center" }}>
                  {(activeGeoFilter !== "Tots" || activeEntryFilter !== "Tots" || activeStatusFilter !== "Tots" || activeTypeFilter !== "Tots" || activeModalityFilter !== "Tots") ? (
                    <button onClick={() => {
                      setActiveGeoFilter("Tots");
                      setActiveEntryFilter("Tots");
                      setActiveStatusFilter("Tots");
                      setActiveTypeFilter("Tots");
                      setActiveModalityFilter("Tots");
                    }}
                      style={{ background:"transparent", border:`1px solid ${TC.border}`, borderRadius:4, padding:"1px 8px", cursor:"pointer", fontSize:10, color:TC.textMid, fontFamily:"inherit" }}>
                      netejar
                    </button>
                  ) : null}
                </th>
                <th style={{ padding:"6px 10px" }} />
                <th style={{ padding:"6px 10px" }} />
                <th style={{ padding:"6px 10px" }} />
              </tr>
            </thead>
            <tbody>
              {displayedSearchers.map((r, i) => {
                return (
                  <tr key={searcherKey(r) ?? r.nom} className="hoverable" style={{ background: i % 2 === 0 ? TC.card : TC.bgAlt, opacity: r.isMock ? 0.45 : 1 }}>
                    <td style={{ padding:"9px 10px", fontWeight:600, color:TC.navy }}>
                      {canEdit
                        ? <EditableCell value={r.nom} type="text" onSave={v => saveSearcherField(r, "nom", v)} />
                        : r.nom}
                    </td>
                    <td style={{ padding:"9px 10px", color:TC.text, fontSize:11 }}>
                      {canEdit
                        ? <EditableCell value={r.searchers} type="text" onSave={v => saveSearcherField(r, "searchers", v)} />
                        : r.searchers}
                    </td>
                    <td style={{ padding:"9px 10px" }}>
                      {canEdit ? (
                        <EditableCell
                          value={r.formEntrada}
                          options={SEARCHER_FORM_ENTRADA_OPTIONS}
                          allowCustom optionsKey="s_entrada"
                          onSave={v => saveSearcherField(r, "formEntrada", v)}
                          badgeCfg={ENTRY_BADGE_CFG}
                          emptyDisplay="—"
                        />
                      ) : (
                        <span style={{ background:r.formEntrada==="Equity Gap"?"#E8F8E8":"#E6EDF3", color:r.formEntrada==="Equity Gap"?TC.green:TC.navy, borderRadius:20, padding:"2px 10px", fontSize:10, fontWeight:600, whiteSpace:"nowrap" }}>
                          {r.formEntrada || "—"}
                        </span>
                      )}
                    </td>
                    <td style={{ padding:"9px 10px" }}>
                      {canEdit ? (
                        <EditableCell
                          value={r.modalitat}
                          options={SEARCHER_MODALITAT_OPTIONS}
                          allowCustom optionsKey="s_modalitat"
                          onSave={v => saveSearcherField(r, "modalitat", v)}
                          badgeCfg={{
                            Solo: { bg:"#E8F8E8", color:TC.green, border:"#E8F8E8" },
                            Duo: { bg:"#E6EDF3", color:TC.navy, border:"#E6EDF3" },
                            Partnership: { bg:"#F5F0FA", color:"#5A3E9A", border:"#F5F0FA" },
                          }}
                        />
                      ) : (
                        <span style={{ background:r.modalitat==="Solo"?"#E8F8E8":"#E6EDF3", color:r.modalitat==="Solo"?TC.green:TC.navy, borderRadius:20, padding:"2px 10px", fontSize:10, fontWeight:600 }}>{r.modalitat}</span>
                      )}
                    </td>
                    <td style={{ padding:"9px 10px", textAlign:"center" }}>
                      {canEdit ? (
                        <EditableCell
                          value={r.geo}
                          options={["ES","EN","IT","DE","FR","PT","NL","US","CH"]}
                          onSave={v => saveSearcherField(r, "geo", v)}
                          fmt={v => <FlagImg geo={v} />}
                        />
                      ) : <FlagImg geo={r.geo} />}
                    </td>
                    <td style={{ padding:"9px 10px" }}>
                      <StageBadge label={r.stageLabel} />
                    </td>
                    <td style={{ padding:"9px 10px", fontSize:11, color:TC.text }}>
                      {canEdit
                        ? <EditableCell value={r.companiaAdquirida ?? ""} type="text" emptyDisplay="—" onSave={v => saveSearcherField(r, "companiaAdquirida", v || null)} />
                        : (r.companiaAdquirida || "—")}
                    </td>
                    <td style={{ padding:"9px 10px", textAlign:"right", fontFamily:"'DM Mono',monospace", fontWeight:600, color:TC.navy }}>
                      {canEdit
                        ? <EditableCell value={r.ticket} type="number" align="right" fmt={fmtM} onSave={v => saveSearcherField(r, "ticket", v)} />
                        : fmtM(r.ticket)}
                    </td>
                    <td style={{ padding:"9px 10px", textAlign:"center" }}>
                      <EditableCell value={r.tvpi} type="number" align="center"
                        fmt={v => v != null ? <span style={{ background:tvpiBg(v), color:tvpiColor(v), borderRadius:20, padding:"2px 8px", fontFamily:"'DM Mono',monospace", fontWeight:700, fontSize:11, whiteSpace:"nowrap" }}>{formatMultiple(v)}</span> : <span style={{ color:TC.textLight, fontSize:10, fontStyle:"italic" }}>Pendent</span>}
                        onSave={v => saveSearcherField(r, "tvpi", v)}
                        disabled={!canEdit} />
                    </td>
                    <td style={{ padding:"9px 10px", textAlign:"right", fontFamily:"'DM Mono',monospace", fontSize:11, color:TC.navyLight }}>
                      <EditableCell value={r.irr} type="number" align="right"
                        fmt={v => v != null ? `${Number(v).toFixed(1)}%` : "—"}
                        onSave={v => saveSearcherField(r, "irr", v)}
                        disabled={!canEdit} />
                    </td>
                    <td style={{ padding:"9px 10px", textAlign:"right", fontFamily:"'DM Mono',monospace", fontSize:11, color:TC.navyLight }}>
                      <EditableCell value={r.dpi} type="number" align="right"
                        fmt={v => v != null ? formatMultiple(v) : "—"}
                        onSave={v => saveSearcherField(r, "dpi", v)}
                        disabled={!canEdit} />
                    </td>
                    <td style={{ padding:"9px 10px", textAlign:"center", fontFamily:"'DM Mono',monospace", color:TC.textMid }}>
                      {r.investmentYear || "—"}
                    </td>
                    <td style={{ padding:"9px 10px", color:TC.textMid, fontSize:11 }}>
                      {canEdit
                        ? <EditableCell
                            value={r.derivedDataCompr ?? ""}
                            type="date"
                            fmt={formatIsoDateDMY}
                            emptyDisplay="—"
                            onSave={v => saveSearcherField(r, "dataCompr", v || null)}
                          />
                        : formatIsoDateDMY(r.derivedDataCompr)}
                    </td>
                    <td style={{ padding:"9px 10px", textAlign:"center" }}>
                      <span style={{
                        display:"inline-block", minWidth:32, textAlign:"center",
                        background:mesosBg(r.mesosCercant), color:mesosColor(r.mesosCercant),
                        borderRadius:20, padding:"2px 8px", fontWeight:700, fontSize:11,
                      }}>{r.mesosCercant}</span>
                    </td>
                    <td style={{ padding:"9px 10px", textAlign:"right", fontFamily:"'DM Mono',monospace", color:TC.navyLight }}>
                      {canEdit
                        ? <EditableCell value={r.equityStake} type="number" align="right" fmt={formatEquityStake} onSave={v => saveSearcherField(r, "equityStake", v)} />
                        : formatEquityStake(r.equityStake)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ borderTop:`2px solid ${TC.border}` }}>
                <td colSpan={7} style={{ padding:"9px 10px", fontWeight:700, fontSize:11, color:TC.navyLight }}>TOTAL ({displayedSearchers.length}{search.trim() || activeGeoFilter !== "Tots" || activeEntryFilter !== "Tots" ? `/${activeRows.length}` : ""} searchers)</td>
                <td style={{ padding:"9px 10px", textAlign:"right", fontFamily:"'DM Mono',monospace", fontWeight:700, color:TC.navy }}>{fmtM(displayedSearchersTicket)}</td>
                <td colSpan={7} />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
      )}

      {/* ── Historic table ── */}
      {isAllView && <div style={card}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <div style={{ ...sec, color:TC.textLight, marginBottom:0 }}>
              <SectionHeading icon="🗂" color={dark ? "#112030" : "#E6EDF3"}>Historial de Searchers</SectionHeading>
            </div>
            {canEdit && (
              <button onClick={() => setShowAddModal(true)}
                style={{ padding: "7px 14px", borderRadius: 6, border: `1.5px solid ${TC.border}`,
                  background: "transparent", color: TC.navy, cursor: "pointer",
                  fontFamily: "inherit", fontSize: 12, fontWeight: 600 }}>
                + Nou searcher
              </button>
            )}
          </div>
          <div />
        </div>
        <div style={{ fontSize:11, color:TC.textMid, marginBottom:10 }}>
          <b style={{ color:TC.navy }}>{filteredHistoric.length}</b> / {historicData.length} searchers
          {Object.entries(histFilter).some(([, v]) => v !== "Tots") &&
            <button onClick={() => setHistFilter({ status:"Tots", geo:"Tots", entrada:"Tots" })}
              style={{ marginLeft:8, background:"transparent", border:`1px solid ${TC.border}`, borderRadius:4, padding:"1px 8px", cursor:"pointer", fontSize:10, color:TC.textMid, fontFamily:"inherit" }}>
              ✕ netejar
            </button>
          }
        </div>
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
            <thead>
                <tr>
                  {[
                    { label:"Nom SF",       k:"nom"            },
                    { label:"NIF",          k:"nif"            },
                    { label:"Tipus",        k:"tipus"          },
                    { label:"Modalitat",    k:"modalitat"      },
                    { label:"País",         k:"geo"            },
                    { label:"Status",       k:"statusScreening"},
                    { label:"Fase",         k:"stageLabel"     },
                    { label:"Any Inv.",     k:"investmentYear" },
                    { label:"Entrada",      k:"formEntrada"    },
                    { label:"Searchers",    k:"searcher1"      },
                    { label:"Escola/MBA",   k:"escola1"        },
                    { label:"Intro per",    k:"introPer"       },
                ].map(h => (
                  <th key={h.k} style={{ ...th, cursor:"pointer" }} onClick={() => sortHist(h.k)}>
                    {h.label}<HArr k={h.k} />
                  </th>
                ))}
                {canEdit && <th style={{ ...th, width: 40 }} />}
              </tr>
              <tr style={{ borderBottom:`1px solid ${TC.border}` }}>
                <th style={{ padding:"6px 10px" }} />
                <th style={{ padding:"6px 10px" }} />
                <th style={{ padding:"6px 10px" }} />
                <th style={{ padding:"6px 10px" }} />
                <th style={{ padding:"6px 10px" }}>
                  <select value={histFilter.geo} onChange={e => setHistFilter(p => ({ ...p, geo: e.target.value }))} style={{ ...inp, width:"100%", padding:"4px 6px", fontSize:11 }}>
                    {["Tots", ...Array.from(new Set(historicData.map(r=>r.geo).filter(Boolean))).sort()].map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </th>
                <th style={{ padding:"6px 10px" }}>
                  <select value={histFilter.status} onChange={e => setHistFilter(p => ({ ...p, status: e.target.value }))} style={{ ...inp, width:"100%", padding:"4px 6px", fontSize:11 }}>
                    {uniq("statusScreening").map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </th>
                <th style={{ padding:"6px 10px" }} />
                <th style={{ padding:"6px 10px" }} />
                <th style={{ padding:"6px 10px" }}>
                  <select value={histFilter.entrada} onChange={e => setHistFilter(p => ({ ...p, entrada: e.target.value }))} style={{ ...inp, width:"100%", padding:"4px 6px", fontSize:11 }}>
                    {["Tots","Search Capital","Equity Gap"].map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </th>
                <th style={{ padding:"6px 10px" }} />
                <th style={{ padding:"6px 10px" }} />
                <th style={{ padding:"6px 10px", textAlign:"left" }}>
                  {Object.entries(histFilter).some(([, v]) => v !== "Tots") ? (
                    <button onClick={() => setHistFilter({ status:"Tots", geo:"Tots", entrada:"Tots" })}
                      style={{ background:"transparent", border:`1px solid ${TC.border}`, borderRadius:4, padding:"1px 8px", cursor:"pointer", fontSize:10, color:TC.textMid, fontFamily:"inherit" }}>
                      netejar
                    </button>
                  ) : null}
                </th>
                {canEdit && <th style={{ padding:"6px 10px" }} />}
              </tr>
            </thead>
            <tbody>
              {filteredHistoric.map((r, i) => (
                <tr key={`${r.nom}-${i}`} className="hoverable" style={{ background: i % 2 === 0 ? TC.card : TC.bgAlt }}>
                  <td style={{ padding:"7px 10px", fontWeight:500, color:TC.navy }}>
                    <EditableCell value={r.nom} type="text"
                      onSave={v => saveSearcherField(r, "nom", v)}
                      disabled={!canEdit} />
                  </td>
                  <td style={{ padding:"7px 10px", fontFamily:"'DM Mono',monospace", fontSize:11, color:TC.textLight }}>
                    <EditableCell value={r.nif ?? ""} type="text"
                      emptyDisplay="—"
                      onSave={v => saveSearcherField(r, "nif", v || null)}
                      disabled={!canEdit} />
                  </td>
                  <td style={{ padding:"7px 10px", color:TC.textMid, fontSize:11 }}>
                    <EditableCell value={r.tipus} type="text"
                      onSave={v => saveSearcherField(r, "tipus", v)}
                      disabled={!canEdit} />
                  </td>
                  <td style={{ padding:"7px 10px" }}>
                    <EditableCell value={r.modalitat} type="text"
                      onSave={v => saveSearcherField(r, "modalitat", v)}
                      disabled={!canEdit}
                      fmt={v => (
                        <span style={{ background:v==="Solo"?"#E8F8E8":v==="Duo"?"#E6EDF3":"#F5F0FA", color:v==="Solo"?TC.green:v==="Duo"?TC.navy:"#5A3E9A", borderRadius:20, padding:"1px 8px", fontSize:10, fontWeight:600 }}>{v}</span>
                      )} />
                  </td>
                  <td style={{ padding:"7px 10px", textAlign:"center" }}>
                    <EditableCell
                      value={r.geo}
                      options={["ES","EN","IT","DE","FR","PT","NL","US","CH"]}
                      onSave={v => saveSearcherField(r, "geo", v)}
                      fmt={v => <FlagImg geo={v} />}
                      disabled={!canEdit}
                    />
                  </td>
                  <td style={{ padding:"7px 10px" }}>
                    <EditableCell
                      value={r.statusScreening}
                      options={uniqVals("statusScreening")}
                      allowCustom optionsKey="s_status"
                      onSave={v => saveSearcherField(r, "status", v)}
                      fmt={v => <StatusBadge s={v} />}
                      disabled={!canEdit}
                    />
                  </td>
                  <td style={{ padding:"7px 10px" }}>
                    <StageBadge label={r.stageLabel} />
                  </td>
                  <td style={{ padding:"7px 10px", textAlign:"center", fontFamily:"'DM Mono',monospace", fontSize:11, color:TC.textMid }}>
                    {r.investmentYear || "—"}
                  </td>
                  <td style={{ padding:"7px 10px" }}>
                    <EditableCell value={r.formEntrada} options={SEARCHER_FORM_ENTRADA_OPTIONS}
                      allowCustom optionsKey="s_entrada"
                      onSave={v => saveSearcherField(r, "formEntrada", v)}
                      disabled={!canEdit}
                      badgeCfg={ENTRY_BADGE_CFG} />
                  </td>
                  <td style={{ padding:"7px 10px", fontSize:11, color:TC.text }}>
                    <EditableCell
                      value={[r.searcher1, r.searcher2].filter(Boolean).join(" / ") || "—"}
                      options={uniqVals("searcher1")}
                      allowCustom optionsKey="s_searchers"
                      onSave={v => saveSearcherField(r, "searchers", v)}
                      disabled={!canEdit} />
                  </td>
                  <td style={{ padding:"7px 10px", fontSize:11 }}>
                    <EditableCell
                      value={[r.escola1, r.escola2].filter(Boolean).join(" / ")}
                      options={uniqVals("escola1")}
                      allowCustom optionsKey="s_escola"
                      onSave={v => saveSearcherField(r, "schools", v)}
                      disabled={!canEdit}
                      emptyDisplay="—"
                    />
                  </td>
                  <td style={{ padding:"7px 10px", color:TC.textMid, fontSize:11 }}>
                    <EditableCell
                      value={r.introPer}
                      options={uniqVals("introPer")}
                      allowCustom optionsKey="s_introPer"
                      onSave={v => saveSearcherField(r, "introPer", v)}
                      disabled={!canEdit} />
                  </td>
                  {canEdit && (
                    <td style={{ padding: "4px 8px", textAlign: "center" }}>
                      <DeleteRowButton onDelete={() => handleDeleteSearcher(r)} />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>}

      {showAddModal && (
        <AddRowModal
          title="Nou searcher"
          fields={[
            { key: "nom", label: "Nom", type: "text", placeholder: "Nom del searcher" },
            { key: "nif", label: "NIF", type: "text", placeholder: "B12345678" },
            { key: "tipus", label: "Tipus", type: "select", options: ["", "Tradicional", "Self-funded"] },
            { key: "modalitat", label: "Modalitat", type: "select", options: ["", ...SEARCHER_MODALITAT_OPTIONS] },
            { key: "geo", label: "Geografia", type: "select", options: ["", ...Object.keys(GEO_NAME).sort()] },
            { key: "statusScreening", label: "Status", type: "select", options: ["", ...SEARCHER_STATUS_OPTIONS] },
            { key: "formEntrada", label: "Entrada", type: "select", options: ["", ...SEARCHER_FORM_ENTRADA_OPTIONS] },
            { key: "dataInici", label: "Data inici", type: "date" },
            { key: "ticket", label: "Ticket (€)", type: "number" },
            { key: "equityStake", label: "Equity stake (%)", type: "number" },
          ]}
          onSave={handleAddSearcher}
          onClose={() => setShowAddModal(false)}
        />
      )}

    </div>
  );
}
