import React, { useEffect, useMemo, useState, useRef } from "react";
import ReactECharts from "../ReactECharts.jsx";
import { ecTheme } from "../echartsTheme.js";
import { ResponsiveSankey } from "@nivo/sankey";
import { useTheme } from "../theme.js";
import { fmtM, calcMesos, mesosColor, mesosBg, parseSearchersCSV, usePersistedState, formatIsoDateDMY } from "../utils.js";
import { GEO_NAME, SEARCHER_STATUS_CFG, SEARCHER_STATUS_OPTIONS, SEARCHER_MODALITAT_OPTIONS, SEARCHER_FORM_ENTRADA_OPTIONS } from "../config.js";
import { FlagImg, AddRowModal, DeleteRowButton, EditableCell } from "./SharedComponents.jsx";
import { useAuth } from "../auth.jsx";
import { upsertSearcher, insertSearcher, deleteSearcher, saveSearchers, loadSearchers, loadCompanies } from "../db.js";
import { useToast } from "../toast.jsx";

// ── constants ──────────────────────────────────────────────

const StatusBadge = ({ s }) => {
  const { tc: TC } = useTheme();
  const cfg = SEARCHER_STATUS_CFG[s] || { bg:TC.border, color:TC.textMid };
  return (
    <span style={{
      background:cfg.bg, color:cfg.color,
      borderRadius:20, padding:"2px 9px",
      fontSize:10, fontWeight:600, whiteSpace:"nowrap",
    }}>{s || "—"}</span>
  );
};

// ── Sankey node colours ────────────────────────────────────
const SANKEY_NODE_COLORS = {
  "Searchers":    "#2563A8",
  "Equity Gap":   "#6B2E7E",
  "Cercant":      "#27A55A",
  "Acabat Cerca": "#145230",
  "Portafoli":    "#5A3E9A",
  "Operant":      "#2B5070",
};

const ENTRY_BADGE_CFG = {
  "Search Capital": { bg:"#E6EDF3", color:"#2563A8", border:"#E6EDF3" },
  "Equity Gap": { bg:"#F5F0FA", color:"#6B2E7E", border:"#F5F0FA" },
};

function searcherKey(row) {
  return row?.id ?? row?.nom ?? null;
}

function splitSearcherNames(value) {
  const parts = String(value ?? "")
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean);
  return {
    searcher1: parts[0] ?? null,
    searcher2: parts[1] ?? null,
  };
}

function splitSchoolNames(value) {
  const parts = String(value ?? "")
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean);
  return {
    searcher1: parts[0] ?? null,
    searcher2: parts[1] ?? null,
  };
}

function toggleActiveFilter(currentValue, nextValue) {
  if (!nextValue || nextValue === "Tots") return "Tots";
  return currentValue === nextValue ? "Tots" : nextValue;
}

function sankeyNodeToEntry(nodeId) {
  if (nodeId === "Searchers") return "Search Capital";
  if (nodeId === "Equity Gap") return "Equity Gap";
  return null;
}

function formatPercent(value, digits = 1) {
  return Number.isFinite(value) ? value.toFixed(digits) : "0.0";
}

function formatEquityStake(value) {
  return Number.isFinite(Number(value)) ? `${Number(value).toFixed(1)}%` : "—";
}

// ── main component ─────────────────────────────────────────
export function SearchersTab({ search = "", subTab = "tots" }) {
  const { tc: TC, dark } = useTheme();
  const { canEdit } = useAuth();
  const { toast } = useToast();
  const [showAddModal, setShowAddModal] = useState(false);

  const [historicData, setHistoricData] = usePersistedState("tc_allSearchers", []);
  const [companies, setCompanies] = usePersistedState("tc_portfolioCompanies", []);
  const [histFilter, setHistFilter]     = useState({ status:"Tots", geo:"Tots", entrada:"Tots" });
  const [histSort, setHistSort]         = useState({ k:"nom", d:"asc" });
  const [activeGeoFilter, setActiveGeoFilter] = usePersistedState("ui_searchersGeo", "Tots");
  const [activeEntryFilter, setActiveEntryFilter] = usePersistedState("ui_searchersEntry", "Tots");
  const [activeSort, setActiveSort] = usePersistedState("ui_searchersSort", { k:"nom", d:"asc" });
  const csvRef = useRef(null);

  // shared styles
  const card = { background:TC.card, border:`1px solid ${TC.border}`, borderRadius:12, padding:"20px 22px", boxShadow:"0 2px 12px rgba(0,0,0,.06)" };
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

  const activeRows = useMemo(() => (
    historicData
      .filter((row) => row.statusScreening === "Invertit en fase de cerca")
      .map((row) => {
        const searchers = [row.searcher1, row.searcher2].filter(Boolean).join(" / ");
        return {
          ...row,
          searchers,
          mesosCercant: row.dataCompr ? calcMesos(row.dataCompr) : row.mesosCercant ?? null,
        };
      })
  ), [historicData]);

  // ── KPIs ──────────────────────────────────────────────────
  const totalSearchers  = activeRows.reduce((sum, row) => sum + (row.ticket ?? 0), 0);
  const soloCount       = activeRows.filter(r => r.modalitat === "Solo").length;
  const duoCount        = activeRows.filter(r => r.modalitat !== "Solo").length;

  const getActiveSortValue = (row, key) => {
    if (key === "status") return row.statusScreening ?? "";
    if (key === "geo") return GEO_NAME[row.geo] || row.geo || "";
    if (key === "formEntrada") return row.formEntrada ?? "";
    if (key === "ticket") return row.ticket ?? 0;
    if (key === "mesosCercant") return row.mesosCercant ?? 0;
    if (key === "equityStake") return row.equityStake ?? 0;
    if (key === "dataCompr") return row.dataCompr ?? "";
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
    return [...list].sort((a, b) => {
      const va = getActiveSortValue(a, activeSort.k);
      const vb = getActiveSortValue(b, activeSort.k);
      let cmp = 0;
      if (typeof va === "number" && typeof vb === "number") cmp = va - vb;
      else cmp = String(va).localeCompare(String(vb), "ca", { sensitivity: "base" });
      if (cmp === 0) cmp = String(a.nom).localeCompare(String(b.nom), "ca", { sensitivity: "base" });
      return activeSort.d === "asc" ? cmp : -cmp;
    });
  }, [activeEntryFilter, activeGeoFilter, activeRows, activeSort, search]);
  const displayedSearchersTicket = useMemo(
    () => displayedSearchers.reduce((sum, row) => sum + (row.ticket ?? 0), 0),
    [displayedSearchers]
  );

  // ── Sankey data ───────────────────────────────────────────
  const sankeyData = useMemo(() => {
    const real = historicData.filter(r => !r.isMock);
    const sc   = real.filter(r => r.formEntrada === "Search Capital");
    const eg   = real.filter(r => r.formEntrada === "Equity Gap");

    const scBacked   = sc.filter(r => r.statusScreening === "Invertit en fase de cerca").length;
    const scAcq      = companies.filter(c => c.tipus === "SF" && c.origen === "Search Capital").length;
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
  }, [companies, historicData]);

  // ── Conversations stats ────────────────────────────────────
  const convStats = useMemo(() => {
    const real        = historicData.filter(r => !r.isMock);
    const sc          = real.filter(r => r.formEntrada === "Search Capital");
    const eg          = real.filter(r => r.formEntrada === "Equity Gap");
    const scBacked    = sc.filter(r => r.statusScreening === "Invertit en fase de cerca").length;
    const egInvertit  = eg.filter(r => r.statusScreening === "Invertit en fase d'adquisició" || r.statusScreening === "Invertit en fase de cerca").length;
    const allDescartat = real.filter(r => ["Descartat","Sobresuscrit","No tancat"].includes(r.statusScreening)).length;
    const allRevisio  = real.filter(r => ["En anàlisi","Pendent de formalitzar"].includes(r.statusScreening)).length;
    return { total: real.length, scBacked, egInvertit, allDescartat, allRevisio };
  }, [historicData]);

  const handleGeoClick = (geo) => {
    setActiveGeoFilter((current) => toggleActiveFilter(current, geo));
  };

  const handleEntryFilterClick = (entry) => {
    setActiveEntryFilter((current) => toggleActiveFilter(current, entry));
  };

  // ── Geography data (searchers only) ──────────────────────
  const GEO_COLORS = ["#2B5070","#3DC83E","#6A4C8A","#B8860B","#C62828","#1C6B1D","#2563A8","#8A6400","#007A8A"];
  const geoData = useMemo(() => {
    const m = {};
    activeRows.forEach(s => {
      if (!m[s.geo]) m[s.geo] = { geo:s.geo, name:GEO_NAME[s.geo]||s.geo, value:0, count:0 };
      m[s.geo].value += s.ticket ?? 0;
      m[s.geo].count += 1;
    });
    return Object.values(m).sort((a, b) => b.value - a.value);
  }, [activeRows]);
  const geoTotal = geoData.reduce((s, r) => s + r.value, 0);
  const t = ecTheme(TC);
  const sortActive = (k) => setActiveSort(p => ({ k, d: p.k === k && p.d === "asc" ? "desc" : "asc" }));
  const AArr = ({ k }) => <span style={{ marginLeft:3, opacity:activeSort.k===k?1:0.2, fontSize:9 }}>{activeSort.k===k&&activeSort.d==="asc"?"▲":"▼"}</span>;

  // ── Historic table ─────────────────────────────────────────
  const filteredHistoric = useMemo(() => {
    let d = [...historicData];
    if (histFilter.status !== "Tots") d = d.filter(r => r.statusScreening === histFilter.status);
    if (histFilter.geo    !== "Tots") d = d.filter(r => r.geo === histFilter.geo);
    if (histFilter.entrada !== "Tots") d = d.filter(r => r.formEntrada === histFilter.entrada);
    return [...d].sort((a, b) => {
      const va = a[histSort.k] || "", vb = b[histSort.k] || "";
      return histSort.d === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
    });
  }, [historicData, histFilter, histSort]);

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

  const reloadSearchers = async () => {
    const refreshed = await loadSearchers();
    if (!Array.isArray(refreshed)) {
      toast({ message: "No s'han pogut refrescar els searchers des de la base de dades.", type: "error" });
      return;
    }
    setHistoricData(refreshed);
    toast({ message: "Searchers recarregats des de la base de dades." });
  };

  const inp = { border:`1px solid ${TC.border}`, borderRadius:5, padding:"4px 8px", fontSize:11, color:TC.text, background:TC.card, outline:"none", fontFamily:"inherit", cursor:"pointer" };

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
    if (historicData.some(s => s.nom === nom)) {
      setError("Ja existeix un searcher amb aquest nom");
      return;
    }
    const searcher = {
      nom, tipus: values.tipus || null, modalitat: values.modalitat || null,
      geo: values.geo || null, statusScreening: values.statusScreening || null,
      formEntrada: values.formEntrada || null, introPer: null,
      searcher1: null, searcher2: null, escola1: null, escola2: null,
      ticket: parseFloat(values.ticket) || null,
      dataInici: values.dataInici || null, dataCompr: values.dataCompr || null, mesosCercant: null,
      equityStake: parseFloat(values.equityStake) || null, isMock: false,
    };
    const inserted = await insertSearcher(searcher);
    if (!inserted) { setError("Error en crear el searcher"); return; }
    setHistoricData([inserted, ...historicData]);
    setShowAddModal(false);
  };

  const handleDeleteSearcher = async (target) => {
    if (target?.id) {
      const { error } = await deleteSearcher(target.id);
      if (error) { toast({ message: "Error eliminant searcher: " + error.message, type: "error" }); return; }
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
        </span>
        <button onClick={reloadSearchers}
          style={{ background:"transparent", border:`1px solid ${TC.border}`, borderRadius:6, padding:"5px 11px", cursor:"pointer", fontSize:11, color:TC.textMid, fontFamily:"inherit" }}>
          Recarregar DB
        </button>
        <input ref={csvRef} type="file" accept=".csv" style={{ display:"none" }} onChange={handleCSV} />
        <button onClick={() => csvRef.current?.click()}
          style={{ background:TC.navy, color:"#fff", border:"none", borderRadius:7, padding:"6px 14px", cursor:"pointer", fontSize:11, fontFamily:"inherit" }}>
          ↑ Importar CSV
        </button>
      </div>

      {/* ── KPIs ── */}
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
          <div style={sec}>Participades per Forma d'Entrada i Resultat</div>

          {/* Conversations funnel strip */}
          <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:16, padding:"10px 14px", background:TC.bgAlt, borderRadius:8 }}>
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
                    borderRadius: 7,
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
          <div style={sec}>Allocation Geogràfica — Searchers (€)</div>
          <ReactECharts
            style={{ width: "100%", height: 300 }}
            opts={{ renderer: "canvas" }}
            onEvents={{
              click: (params) => {
                const geo = params?.data?.geo ?? "Tots";
                handleGeoClick(geo);
              },
            }}
            option={{
              tooltip: {
                ...t.tooltip,
                trigger: "item",
                formatter: p => `<b>${p.name}</b><br/>${fmtM(p.value)}<br/>${formatPercent(geoTotal > 0 ? (p.value / geoTotal) * 100 : 0)}% · ${(geoData.find(r => r.name === p.name)?.count ?? 0)} searcher${(geoData.find(r => r.name === p.name)?.count ?? 0) === 1 ? "" : "s"}`,
              },
              legend: { show: false },
              graphic: [{
                type: "group",
                left: "center",
                top: "middle",
                children: [
                  { type: "text", style: { text: fmtM(geoTotal), x: 0, y: -7, textAlign: "center", fill: TC.navy, fontSize: 12, fontWeight: 700, fontFamily: "'DM Mono',monospace" } },
                  { type: "text", style: { text: "Total", x: 0, y: 9, textAlign: "center", fill: TC.textLight, fontSize: 9 } },
                ],
              }],
              series: [{
                type: "pie",
                radius: ["48%", "76%"],
                center: ["50%", "50%"],
                selectedMode: false,
                labelLine: { show: false },
                label: {
                  show: true,
                  formatter: p => {
                    if (p.percent < 4) return "";
                    const flagMap = { ES:"🇪🇸", EN:"🇬🇧", IT:"🇮🇹", DE:"🇩🇪", FR:"🇫🇷", PT:"🇵🇹", NL:"🇳🇱", US:"🇺🇸", CH:"🇨🇭" };
                    return `${flagMap[p.name] || p.name} ${formatPercent(p.percent, 0)}%`;
                  },
                  fontSize: 11,
                  color: TC.textMid,
                },
                data: geoData.map((d, i) => ({
                  name: d.name,
                  value: d.value,
                  geo: d.geo,
                  itemStyle: {
                    color: GEO_COLORS[i % GEO_COLORS.length],
                    opacity: activeGeoFilter === "Tots" || activeGeoFilter === d.geo ? 1 : 0.35,
                    borderWidth: activeGeoFilter === d.geo ? 3 : 0,
                    borderColor: activeGeoFilter === d.geo ? TC.navy : "transparent",
                  },
                })),
              }],
            }}
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

      {/* ── Active Searchers table ── */}
      <div style={{ ...card, marginBottom:14 }}>
        <div style={sec}>Searchers Actius</div>
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
                  { label:"Status", k:"status" },
                  { label:"Ticket", k:"ticket", right:true },
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
            </thead>
            <tbody>
              {displayedSearchers.map((r, i) => {
                const status = r.statusScreening ?? "—";
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
                      {canEdit ? (
                        <EditableCell
                          value={status}
                          options={uniqVals("statusScreening")}
                          allowCustom optionsKey="s_status"
                          onSave={v => saveSearcherField(r, "status", v)}
                          fmt={v => <StatusBadge s={v} />}
                        />
                      ) : <StatusBadge s={status} />}
                    </td>
                    <td style={{ padding:"9px 10px", textAlign:"right", fontFamily:"'DM Mono',monospace", fontWeight:600, color:TC.navy }}>
                      {canEdit
                        ? <EditableCell value={r.ticket} type="number" align="right" fmt={fmtM} onSave={v => saveSearcherField(r, "ticket", v)} />
                        : fmtM(r.ticket)}
                    </td>
                    <td style={{ padding:"9px 10px", color:TC.textMid, fontSize:11 }}>
                      {canEdit
                        ? <EditableCell value={r.dataCompr} type="text" onSave={v => saveSearcherField(r, "dataCompr", v)} fmt={formatIsoDateDMY} emptyDisplay="—" />
                        : formatIsoDateDMY(r.dataCompr)}
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
                <td colSpan={6} style={{ padding:"9px 10px", fontWeight:700, fontSize:11, color:TC.navyLight }}>TOTAL ({displayedSearchers.length}{search.trim() || activeGeoFilter !== "Tots" || activeEntryFilter !== "Tots" ? `/${activeRows.length}` : ""} searchers)</td>
                <td style={{ padding:"9px 10px", textAlign:"right", fontFamily:"'DM Mono',monospace", fontWeight:700, color:TC.navy }}>{fmtM(displayedSearchersTicket)}</td>
                <td colSpan={3} />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* ── Historic table ── */}
      {subTab === "tots" && <div style={card}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <div style={sec}>Historial de Searchers</div>
            {canEdit && (
              <button onClick={() => setShowAddModal(true)}
                style={{ padding: "7px 14px", borderRadius: 7, border: `1.5px solid ${TC.border}`,
                  background: "transparent", color: TC.navy, cursor: "pointer",
                  fontFamily: "inherit", fontSize: 12, fontWeight: 600 }}>
                + Nou searcher
              </button>
            )}
          </div>
          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
            {/* Filters */}
            {[
              { label:"Status",   key:"status",  opts: uniq("statusScreening") },
              { label:"País",     key:"geo",      opts: ["Tots", ...Array.from(new Set(historicData.map(r=>r.geo).filter(Boolean))).sort()] },
              { label:"Entrada",  key:"entrada",  opts: ["Tots","Search Capital","Equity Gap"] },
            ].map(f => (
              <div key={f.key} style={{ display:"flex", alignItems:"center", gap:4 }}>
                <span style={{ fontSize:10, color:TC.textLight }}>{f.label}:</span>
                <select value={histFilter[f.key]} onChange={e => setHistFilter(p => ({ ...p, [f.key]: e.target.value }))} style={inp}>
                  {f.key === "status"
                    ? uniq("statusScreening").map(o => <option key={o}>{o}</option>)
                    : f.opts.map(o => <option key={o}>{o}</option>)
                  }
                </select>
              </div>
            ))}
          </div>
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
                  { label:"Tipus",        k:"tipus"          },
                  { label:"Modalitat",    k:"modalitat"      },
                  { label:"País",         k:"geo"            },
                  { label:"Status",       k:"statusScreening"},
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
            </thead>
            <tbody>
              {filteredHistoric.map((r, i) => (
                <tr key={`${r.nom}-${i}`} className="hoverable" style={{ background: i % 2 === 0 ? TC.card : TC.bgAlt }}>
                  <td style={{ padding:"7px 10px", fontWeight:500, color:TC.navy }}>
                    <EditableCell value={r.nom} type="text"
                      onSave={v => saveSearcherField(r, "nom", v)}
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
            { key: "tipus", label: "Tipus", type: "select", options: ["", "Tradicional", "Self-funded"] },
            { key: "modalitat", label: "Modalitat", type: "select", options: ["", ...SEARCHER_MODALITAT_OPTIONS] },
            { key: "geo", label: "Geografia", type: "text", placeholder: "ES, FR, ..." },
            { key: "statusScreening", label: "Status", type: "select", options: ["", ...SEARCHER_STATUS_OPTIONS] },
            { key: "formEntrada", label: "Entrada", type: "select", options: ["", ...SEARCHER_FORM_ENTRADA_OPTIONS] },
            { key: "ticket", label: "Ticket (€)", type: "number" },
            { key: "dataCompr", label: "Data compromís", type: "text", placeholder: "YYYY-MM-DD" },
            { key: "equityStake", label: "Equity stake (%)", type: "number" },
          ]}
          onSave={handleAddSearcher}
          onClose={() => setShowAddModal(false)}
        />
      )}

    </div>
  );
}
