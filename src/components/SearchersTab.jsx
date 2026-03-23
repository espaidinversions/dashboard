import React, { useMemo, useState, useRef } from "react";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Label,
} from "recharts";
import { ResponsiveSankey } from "@nivo/sankey";
import { useTheme } from "../theme.js";
import { fmtM, calcMesos, mesosColor, mesosBg, parseSearchersCSV, usePersistedState } from "../utils.js";
import { GEO_NAME, SEARCHER_STATUS_CFG } from "../config.js";
import { ACTIVE_SEARCHERS, ALL_SEARCHERS, PORTFOLIO_COMPANIES } from "../data/searchers.js";
import { FlagImg, FlagSvgLabel, AddRowModal, DeleteRowButton, EditableCell } from "./SharedComponents.jsx";
import { useAuth } from "../auth.jsx";
import { upsertSearcher, insertSearcher, deleteSearcher } from "../db.js";
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

const fmtDate = iso => {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
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

// ── main component ─────────────────────────────────────────
export function SearchersTab({ search = "" }) {
  const { tc: TC, dark } = useTheme();
  const { isSuperuser } = useAuth();
  const { toast } = useToast();
  const [showAddModal, setShowAddModal] = useState(false);

  const [historicData, setHistoricData] = usePersistedState("tc_allSearchers", ALL_SEARCHERS);
  const [histFilter, setHistFilter]     = useState({ status:"Tots", geo:"Tots", entrada:"Tots" });
  const [histSort, setHistSort]         = useState({ k:"nom", d:"asc" });
  const csvRef = useRef(null);

  // shared styles
  const card = { background:TC.card, border:`1px solid ${TC.border}`, borderRadius:12, padding:"20px 22px", boxShadow:"0 2px 12px rgba(0,0,0,.06)" };
  const th   = { padding:"9px 10px", fontSize:10, letterSpacing:"0.09em", color:TC.textLight, textTransform:"uppercase", fontWeight:600, textAlign:"left", borderBottom:`2px solid ${TC.border}`, whiteSpace:"nowrap", userSelect:"none" };
  const sec  = { fontSize:10, letterSpacing:"0.11em", color:TC.textLight, textTransform:"uppercase", marginBottom:16, fontWeight:600 };

  // ── KPIs ──────────────────────────────────────────────────
  const totalSearchers  = ACTIVE_SEARCHERS.reduce((s, r) => s + r.ticket, 0);
  const soloCount       = ACTIVE_SEARCHERS.filter(r => r.modalitat === "Solo").length;
  const duoCount        = ACTIVE_SEARCHERS.filter(r => r.modalitat !== "Solo").length;

  // ── Active searchers with dynamic mesos ───────────────────
  const activeWithMesos = useMemo(() =>
    ACTIVE_SEARCHERS.map(r => ({ ...r, mesosCercant: calcMesos(r.dataCompr) }))
  , []);

  const displayedSearchers = useMemo(() => {
    let list = activeWithMesos;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(r =>
        r.nom.toLowerCase().includes(q) ||
        r.searchers.toLowerCase().includes(q)
      );
    }
    return [...list].sort((a, b) => (a.isMock === b.isMock ? 0 : a.isMock ? -1 : 1));
  }, [activeWithMesos, search]);

  // match status from ALL_SEARCHERS
  const statusMap = useMemo(() => {
    const m = {};
    ALL_SEARCHERS.forEach(r => { m[r.nom.toLowerCase().trim()] = r.statusScreening; });
    return m;
  }, []);
  const getStatus = nom => {
    const key = nom.toLowerCase().trim();
    // try exact, then partial match
    if (statusMap[key]) return statusMap[key];
    const partial = Object.keys(statusMap).find(k => k.includes(key.split(" ")[0].toLowerCase()) || key.includes(k.split(" ")[0].toLowerCase()));
    return partial ? statusMap[partial] : "Invertit en fase de cerca";
  };

  // ── Sankey data ───────────────────────────────────────────
  const sankeyData = useMemo(() => {
    const real = ALL_SEARCHERS.filter(r => !r.isMock);
    const sc   = real.filter(r => r.formEntrada === "Search Capital");
    const eg   = real.filter(r => r.formEntrada === "Equity Gap");

    const scBacked   = sc.filter(r => r.statusScreening === "Invertit en fase de cerca").length;
    const scAcq      = PORTFOLIO_COMPANIES.filter(c => c.tipus === "SF" && c.origen === "Search Capital").length;
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
  }, []);

  // ── Conversations stats ────────────────────────────────────
  const convStats = useMemo(() => {
    const real        = ALL_SEARCHERS.filter(r => !r.isMock);
    const sc          = real.filter(r => r.formEntrada === "Search Capital");
    const eg          = real.filter(r => r.formEntrada === "Equity Gap");
    const scBacked    = sc.filter(r => r.statusScreening === "Invertit en fase de cerca").length;
    const egInvertit  = eg.filter(r => r.statusScreening === "Invertit en fase d'adquisició" || r.statusScreening === "Invertit en fase de cerca").length;
    const allDescartat = real.filter(r => ["Descartat","Sobresuscrit","No tancat"].includes(r.statusScreening)).length;
    const allRevisio  = real.filter(r => ["En anàlisi","Pendent de formalitzar"].includes(r.statusScreening)).length;
    return { total: real.length, scBacked, egInvertit, allDescartat, allRevisio };
  }, []);

  // ── Geography data (searchers only) ──────────────────────
  const GEO_COLORS = ["#2B5070","#3DC83E","#6A4C8A","#B8860B","#C62828","#1C6B1D","#2563A8","#8A6400","#007A8A"];
  const geoData = useMemo(() => {
    const m = {};
    ACTIVE_SEARCHERS.forEach(s => {
      if (!m[s.geo]) m[s.geo] = { geo:s.geo, name:GEO_NAME[s.geo]||s.geo, value:0, count:0 };
      m[s.geo].value += s.ticket;
      m[s.geo].count += 1;
    });
    return Object.values(m).sort((a, b) => b.value - a.value);
  }, []);

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

  const uniq = key => ["Tots", ...Array.from(new Set(historicData.map(r => r[key]).filter(Boolean))).sort()];

  const handleCSV = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const rows = parseSearchersCSV(ev.target.result);
        if (rows.length) {
          const mapped = rows.map(r => ({
            nom: r.nom, tipus: r.tipus, modalitat: r.modalitat, geo: r.geo,
            statusScreening: r.statusScreening, formEntrada: r.formEntrada,
            introPer: r.introPer, searcher1: r.searcher1||"", searcher2: r.searcher2||"",
            escola1: r.escola1||"", escola2: r.escola2||"",
          }));
          setHistoricData(mapped);
        }
      } catch {}
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const resetSearchers = () => { setHistoricData(ALL_SEARCHERS); };

  const hasCustomSearchers = historicData !== ALL_SEARCHERS && historicData.length !== ALL_SEARCHERS.length;

  const inp = { border:`1px solid ${TC.border}`, borderRadius:5, padding:"4px 8px", fontSize:11, color:TC.text, background:TC.card, outline:"none", fontFamily:"inherit", cursor:"pointer" };

  // ── Handlers for historic table ───────────────────────────
  const saveSearcherField = async (id, field, value) => {
    const updated = historicData.map(s => s.id === id ? { ...s, [field]: value } : s);
    setHistoricData(updated);
    const searcher = updated.find(s => s.id === id);
    if (searcher) {
      const { error } = await upsertSearcher(searcher);
      if (error) toast({ message: "Error desant canvis: " + error.message, type: "error" });
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
      dataInici: null, dataCompr: null, mesosCercant: null,
      equityStake: null, isMock: false,
    };
    const inserted = await insertSearcher(searcher);
    if (!inserted) { setError("Error en crear el searcher"); return; }
    setHistoricData([inserted, ...historicData]);
    setShowAddModal(false);
  };

  const handleDeleteSearcher = async (id) => {
    const { error } = await deleteSearcher(id);
    if (error) { toast({ message: "Error eliminant searcher: " + error.message, type: "error" }); return; }
    setHistoricData(historicData.filter(s => s.id !== id));
    toast({ message: "Searcher eliminat." });
  };

  return (
    <div style={{ padding:"0 0 40px" }}>

      {/* ── Data load bar ── */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"flex-end", gap:8, marginBottom:14 }}>
        {hasCustomSearchers && (
          <span style={{ fontSize:11, color:TC.textLight }}>
            {historicData.length} searchers carregats
          </span>
        )}
        {hasCustomSearchers && (
          <button onClick={resetSearchers}
            style={{ background:"transparent", border:`1px solid ${TC.border}`, borderRadius:6, padding:"5px 11px", cursor:"pointer", fontSize:11, color:TC.textMid, fontFamily:"inherit" }}>
            Restaurar per defecte
          </button>
        )}
        <input ref={csvRef} type="file" accept=".csv" style={{ display:"none" }} onChange={handleCSV} />
        <button onClick={() => csvRef.current?.click()}
          style={{ background:TC.navy, color:"#fff", border:"none", borderRadius:7, padding:"6px 14px", cursor:"pointer", fontSize:11, fontFamily:"inherit" }}>
          ↑ Carregar dades
        </button>
      </div>

      {/* ── KPIs ── */}
      <div className="grid-4" style={{ gap:12, marginBottom:18 }}>
        {[
          { label:"Searchers Actius",  value: ACTIVE_SEARCHERS.length,                       sub:`${soloCount} solo / ${duoCount} duo`,   accent:TC.navy },
          { label:"Capital Compromès", value: fmtM(totalSearchers),                          sub:"total search capital",                  accent:TC.green },
          { label:"Ticket Promig",     value: fmtM(totalSearchers/ACTIVE_SEARCHERS.length),  sub:"per searcher",                          accent:TC.navyLight },
          { label:"Total DB",          value: ALL_SEARCHERS.length,                          sub:"searchers en base de dades",            accent:TC.navyLight },
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
        </div>

        <div style={card}>
          <div style={sec}>Allocation Geogràfica — Searchers (€)</div>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={geoData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={58} outerRadius={92} labelLine={false}
                label={({ cx, cy, midAngle, outerRadius, percent, name }) => {
                  if (percent < 0.04) return null;
                  const R = Math.PI / 180;
                  const r = outerRadius + 18;
                  const x = cx + r * Math.cos(-midAngle * R);
                  const y = cy + r * Math.sin(-midAngle * R);
                  const flagMap = { ES:"🇪🇸", EN:"🇬🇧", IT:"🇮🇹", DE:"🇩🇪", FR:"🇫🇷", PT:"🇵🇹", NL:"🇳🇱", US:"🇺🇸", CH:"🇨🇭" };
                  return (
                    <text x={x} y={y} textAnchor="middle" dominantBaseline="middle" fontSize={11}>
                      {flagMap[name] || name} {`${(percent * 100).toFixed(0)}%`}
                    </text>
                  );
                }}
              >
                {geoData.map((_, i) => <Cell key={i} fill={GEO_COLORS[i % GEO_COLORS.length]}/>)}
                <Label content={({ viewBox }) => {
                  const { cx, cy } = viewBox;
                  const geoTotal = geoData.reduce((s, r) => s + r.value, 0);
                  return (
                    <g>
                      <text x={cx} y={cy - 7} textAnchor="middle" dominantBaseline="middle"
                        style={{ fontSize: 12, fontWeight: 700, fill: TC.navy, fontFamily: "'DM Mono',monospace" }}>
                        {fmtM(geoTotal)}
                      </text>
                      <text x={cx} y={cy + 9} textAnchor="middle" dominantBaseline="middle"
                        style={{ fontSize: 9, fill: TC.textLight }}>
                        Total
                      </text>
                    </g>
                  );
                }} />
              </Pie>
              <Tooltip content={({ active, payload }) =>
                active && payload?.length ? (
                  <div style={{ background:TC.card, border:`1px solid ${TC.border}`, borderRadius:7, padding:"10px 14px", fontSize:11 }}>
                    <div style={{ fontWeight:700, marginBottom:4 }}>{payload[0].payload.name}</div>
                    <div style={{ color:TC.navy, fontWeight:700 }}>{fmtM(payload[0].value)}</div>
                    <div style={{ color:TC.textMid, marginTop:2, fontSize:10 }}>{payload[0].payload.count} searcher{payload[0].payload.count>1?"s":""}</div>
                  </div>
                ) : null
              }/>
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Active Searchers table ── */}
      <div style={{ ...card, marginBottom:14 }}>
        <div style={sec}>Searchers Actius</div>
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
            <thead>
              <tr>
                {["Search Fund","Searchers","Modalitat","País","Status","Ticket","Data Compromís","Mesos Cercant","Equity Stake"].map(h => (
                  <th key={h} style={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayedSearchers.map((r, i) => {
                const status = getStatus(r.nom);
                return (
                  <tr key={r.nom} className="hoverable" style={{ background: i % 2 === 0 ? TC.card : TC.bgAlt, opacity: r.isMock ? 0.45 : 1 }}>
                    <td style={{ padding:"9px 10px", fontWeight:600, color:TC.navy }}>{r.nom}</td>
                    <td style={{ padding:"9px 10px", color:TC.text, fontSize:11 }}>{r.searchers}</td>
                    <td style={{ padding:"9px 10px" }}>
                      <span style={{ background:r.modalitat==="Solo"?"#E8F8E8":"#E6EDF3", color:r.modalitat==="Solo"?TC.green:TC.navy, borderRadius:20, padding:"2px 10px", fontSize:10, fontWeight:600 }}>{r.modalitat}</span>
                    </td>
                    <td style={{ padding:"9px 10px", textAlign:"center" }}><FlagImg geo={r.geo} /></td>
                    <td style={{ padding:"9px 10px" }}><StatusBadge s={status} /></td>
                    <td style={{ padding:"9px 10px", textAlign:"right", fontFamily:"'DM Mono',monospace", fontWeight:600, color:TC.navy }}>{fmtM(r.ticket)}</td>
                    <td style={{ padding:"9px 10px", color:TC.textMid, fontSize:11 }}>{fmtDate(r.dataCompr)}</td>
                    <td style={{ padding:"9px 10px", textAlign:"center" }}>
                      <span style={{
                        display:"inline-block", minWidth:32, textAlign:"center",
                        background:mesosBg(r.mesosCercant), color:mesosColor(r.mesosCercant),
                        borderRadius:20, padding:"2px 8px", fontWeight:700, fontSize:11,
                      }}>{r.mesosCercant}</span>
                    </td>
                    <td style={{ padding:"9px 10px", textAlign:"right", fontFamily:"'DM Mono',monospace", color:TC.navyLight }}>{r.equityStake.toFixed(1)}%</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ borderTop:`2px solid ${TC.border}` }}>
                <td colSpan={5} style={{ padding:"9px 10px", fontWeight:700, fontSize:11, color:TC.navyLight }}>TOTAL ({displayedSearchers.length}{search.trim() ? `/${ACTIVE_SEARCHERS.length}` : ""} searchers)</td>
                <td style={{ padding:"9px 10px", textAlign:"right", fontFamily:"'DM Mono',monospace", fontWeight:700, color:TC.navy }}>{fmtM(totalSearchers)}</td>
                <td colSpan={3} />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* ── Historic table ── */}
      <div style={card}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <div style={sec}>Historial de Searchers</div>
            {isSuperuser && (
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
                {isSuperuser && <th style={{ ...th, width: 40 }} />}
              </tr>
            </thead>
            <tbody>
              {filteredHistoric.map((r, i) => (
                <tr key={`${r.nom}-${i}`} className="hoverable" style={{ background: i % 2 === 0 ? TC.card : TC.bgAlt }}>
                  <td style={{ padding:"7px 10px", fontWeight:500, color:TC.navy }}>
                    <EditableCell value={r.nom} type="text"
                      onSave={v => saveSearcherField(r.id, "nom", v)}
                      disabled={!isSuperuser} />
                  </td>
                  <td style={{ padding:"7px 10px", color:TC.textMid, fontSize:11 }}>
                    <EditableCell value={r.tipus} type="text"
                      onSave={v => saveSearcherField(r.id, "tipus", v)}
                      disabled={!isSuperuser} />
                  </td>
                  <td style={{ padding:"7px 10px" }}>
                    <EditableCell value={r.modalitat} type="text"
                      onSave={v => saveSearcherField(r.id, "modalitat", v)}
                      disabled={!isSuperuser}
                      fmt={v => (
                        <span style={{ background:v==="Solo"?"#E8F8E8":v==="Duo"?"#E6EDF3":"#F5F0FA", color:v==="Solo"?TC.green:v==="Duo"?TC.navy:"#5A3E9A", borderRadius:20, padding:"1px 8px", fontSize:10, fontWeight:600 }}>{v}</span>
                      )} />
                  </td>
                  <td style={{ padding:"7px 10px", textAlign:"center" }}><FlagImg geo={r.geo} /></td>
                  <td style={{ padding:"7px 10px" }}><StatusBadge s={r.statusScreening} /></td>
                  <td style={{ padding:"7px 10px" }}>
                    <EditableCell value={r.formEntrada} type="text"
                      onSave={v => saveSearcherField(r.id, "formEntrada", v)}
                      disabled={!isSuperuser}
                      fmt={v => (
                        <span style={{ background:v==="Equity Gap"?"#E8F8E8":"#E6EDF3", color:v==="Equity Gap"?TC.green:TC.navy, borderRadius:20, padding:"1px 8px", fontSize:10, fontWeight:600 }}>{v}</span>
                      )} />
                  </td>
                  <td style={{ padding:"7px 10px", fontSize:11, color:TC.text }}>
                    <EditableCell value={[r.searcher1, r.searcher2].filter(Boolean).join(" / ") || "—"} type="text"
                      onSave={v => saveSearcherField(r.id, "searcher1", v)}
                      disabled={!isSuperuser} />
                  </td>
                  <td style={{ padding:"7px 10px", fontSize:11 }}>
                    {[r.escola1, r.escola2].filter(Boolean).map((e,i) => (
                      <span key={i} style={{ display:"inline-block", background:TC.bgAlt, border:`1px solid ${TC.border}`, borderRadius:4, padding:"1px 7px", fontSize:10, fontWeight:600, marginRight:3, color:TC.navy }}>{e}</span>
                    ))}
                    {!r.escola1 && !r.escola2 && <span style={{color:TC.textLight}}>—</span>}
                  </td>
                  <td style={{ padding:"7px 10px", color:TC.textMid, fontSize:11 }}>
                    <EditableCell value={r.introPer} type="text"
                      onSave={v => saveSearcherField(r.id, "introPer", v)}
                      disabled={!isSuperuser} />
                  </td>
                  {isSuperuser && (
                    <td style={{ padding: "4px 8px", textAlign: "center" }}>
                      <DeleteRowButton onDelete={() => handleDeleteSearcher(r.id)} />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showAddModal && (
        <AddRowModal
          title="Nou searcher"
          fields={[
            { key: "nom", label: "Nom", type: "text", placeholder: "Nom del searcher" },
            { key: "tipus", label: "Tipus", type: "select", options: ["", "Solo", "Duo"] },
            { key: "modalitat", label: "Modalitat", type: "select", options: ["", "Solo", "Partnership"] },
            { key: "geo", label: "Geografia", type: "text", placeholder: "ES, FR, ..." },
            { key: "ticket", label: "Ticket (€M)", type: "number" },
          ]}
          onSave={handleAddSearcher}
          onClose={() => setShowAddModal(false)}
        />
      )}

    </div>
  );
}
