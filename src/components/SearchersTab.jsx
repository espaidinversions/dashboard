import React, { useMemo, useState, useRef } from "react";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
  Sankey,
} from "recharts";
import { useTheme } from "../theme.js";
import { fmtM } from "../utils.js";
import { ACTIVE_SEARCHERS, ALL_SEARCHERS } from "../data/searchers.js";
import { FlagImg, FlagSvgLabel } from "./SharedComponents.jsx";

// ── constants ──────────────────────────────────────────────
const GEO_NAME = {
  ES:"ESP", EN:"UK", IT:"ITA", DE:"DEU", FR:"FRA",
  PT:"POR", NL:"NED", US:"USA", CH:"CHE", SE:"SWE",
  MX:"MEX", PL:"POL", TR:"TUR",
};

const STATUS_CFG = {
  "Invertit en fase de cerca":     { bg:"#E8F4EE", color:"#1D6840" },
  "Invertit en fase d'adquisició": { bg:"#D0EAD8", color:"#145230" },
  "Descartat":                      { bg:"#FDECEA", color:"#B01F17" },
  "En anàlisi":                     { bg:"#FFF8E1", color:"#8A6400" },
  "Sobresuscrit":                   { bg:"#F0EEFA", color:"#5A3E9A" },
  "Pendent de formalitzar":         { bg:"#E8F0FA", color:"#2A5B9A" },
  "No tancat":                      { bg:"#F5F5F5", color:"#777"    },
};

const StatusBadge = ({ s }) => {
  const { tc: TC } = useTheme();
  const cfg = STATUS_CFG[s] || { bg:TC.border, color:TC.textMid };
  return (
    <span style={{
      background:cfg.bg, color:cfg.color,
      borderRadius:20, padding:"2px 9px",
      fontSize:10, fontWeight:600, whiteSpace:"nowrap",
    }}>{s || "—"}</span>
  );
};

// ── Mesos cercant helpers ──────────────────────────────────
const today = new Date();
const calcMesos = iso => {
  if (!iso) return 0;
  const d = new Date(iso);
  return Math.max(0, (today.getFullYear() - d.getFullYear()) * 12 + (today.getMonth() - d.getMonth()));
};
// green (0 months) → red (24 months)
const mesosColor = m => {
  const pct = Math.min(m / 24, 1); // 0→green, 1→red
  const hue = Math.round((1 - pct) * 130);  // 130=green, 0=red
  return `hsl(${hue},60%,38%)`;
};
const mesosBg = m => {
  const pct = Math.min(m / 24, 1);
  const hue = Math.round((1 - pct) * 130);
  return `hsl(${hue},60%,94%)`;
};

const fmtDate = iso => {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

// ── Sankey custom node/link ────────────────────────────────
const SANKEY_COLORS = ["#2563A8","#27A55A","#27A55A","#145230","#B01F17","#8A6400","#5A3E9A"];

const SankeyNode = ({ x, y, width, height, index, payload }) => {
  const { tc: TC } = useTheme();
  return (
    <g>
      <rect x={x} y={y} width={width} height={Math.max(height, 1)}
        fill={SANKEY_COLORS[index] || TC.navy} rx={2} opacity={0.85} />
      <text
        x={index < 2 ? x - 6 : x + width + 6}
        y={y + height / 2}
        textAnchor={index < 2 ? "end" : "start"}
        fill={TC.text} fontSize={11} fontFamily="inherit" dominantBaseline="middle"
      >
        {payload.name} ({payload.value})
      </text>
    </g>
  );
};

const SankeyLink = ({ sourceX, targetX, sourceY, targetY, sourceControlX, targetControlX, linkWidth, index }) => (
  <path
    d={`M${sourceX},${sourceY + linkWidth / 2} C${sourceControlX},${sourceY + linkWidth / 2} ${targetControlX},${targetY + linkWidth / 2} ${targetX},${targetY + linkWidth / 2}`}
    fill="none" stroke={SANKEY_COLORS[index % 2]} strokeWidth={linkWidth} strokeOpacity={0.18}
  />
);

// ── CSV parser ─────────────────────────────────────────────
function parseSearchersCSV(text) {
  const lines = text.trim().split("\n");
  const header = lines[0].split(",");
  return lines.slice(1).map(line => {
    const cols = line.split(",");
    const obj = {};
    header.forEach((h, i) => { obj[h.trim()] = (cols[i] || "").trim().replace(/^"|"$/g, ""); });
    return obj;
  });
}

// ── main component ─────────────────────────────────────────
export function SearchersTab({ search = "" }) {
  const { tc: TC, dark } = useTheme();
  const [historicData, setHistoricData] = useState(ALL_SEARCHERS);
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
    if (!search.trim()) return activeWithMesos;
    const q = search.toLowerCase();
    return activeWithMesos.filter(r =>
      r.nom.toLowerCase().includes(q) ||
      r.searchers.toLowerCase().includes(q)
    );
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
    const nodes = [
      { name:"Search Capital" }, { name:"Equity Gap" },
      { name:"Invertit cerca" }, { name:"Invertit adquisició" },
      { name:"Descartat" }, { name:"En anàlisi" }, { name:"Sobresuscrit" },
    ];
    const norm = s =>
      s.includes("adquisici") ? "Invertit adquisició" :
      s.includes("cerca")     ? "Invertit cerca" :
      s.includes("Sobre")     ? "Sobresuscrit" :
      (s.includes("anàlisi") || s.includes("Pendent")) ? "En anàlisi" : "Descartat";
    const counts = {};
    ALL_SEARCHERS.forEach(r => {
      const src = r.formEntrada.toLowerCase().includes("search") ? "Search Capital" : "Equity Gap";
      const key = `${src}|||${norm(r.statusScreening)}`;
      counts[key] = (counts[key] || 0) + 1;
    });
    const links = Object.entries(counts).map(([key, value]) => {
      const [sn, tn] = key.split("|||");
      return { source: nodes.findIndex(n => n.name === sn), target: nodes.findIndex(n => n.name === tn), value };
    }).filter(l => l.source >= 0 && l.target >= 0);
    return { nodes, links };
  }, []);

  // ── Geography data (searchers only) ──────────────────────
  const GEO_COLORS = ["#3C5064","#5A966E","#6A4C8A","#B8860B","#C62828","#1D6840","#2563A8","#8A6400","#007A8A"];
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
        if (rows.length) setHistoricData(rows.map(r => ({
          nom: r.nom, tipus: r.tipus, modalitat: r.modalitat, geo: r.geo,
          statusScreening: r.statusScreening, formEntrada: r.formEntrada,
          introPer: r.introPer, searcher1: r.searcher1||"", searcher2: r.searcher2||"",
          escola1: r.escola1||"", escola2: r.escola2||"",
        })));
      } catch {}
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const inp = { border:`1px solid ${TC.border}`, borderRadius:5, padding:"4px 8px", fontSize:11, color:TC.text, background:TC.card, outline:"none", fontFamily:"inherit", cursor:"pointer" };

  return (
    <div style={{ padding:"0 0 40px" }}>

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
                  <tr key={r.nom} style={{ background: i % 2 === 0 ? TC.card : TC.bgAlt }}>
                    <td style={{ padding:"9px 10px", fontWeight:600, color:TC.navy }}>{r.nom}</td>
                    <td style={{ padding:"9px 10px", color:TC.text, fontSize:11 }}>{r.searchers}</td>
                    <td style={{ padding:"9px 10px" }}>
                      <span style={{ background:r.modalitat==="Solo"?"#E8F4EE":"#EAF0FA", color:r.modalitat==="Solo"?TC.green:TC.navy, borderRadius:20, padding:"2px 10px", fontSize:10, fontWeight:600 }}>{r.modalitat}</span>
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

      {/* ── Sankey + Geography ── */}
      <div className="grid-2" style={{ gap:14, marginBottom:14 }}>
        <div style={card}>
          <div style={sec}>Portfolio per Forma d'Entrada i Resultat</div>
          <div style={{ overflowX:"auto" }}>
            <Sankey width={520} height={320} data={sankeyData}
              node={<SankeyNode />} link={<SankeyLink />}
              nodePadding={18} nodeWidth={14} iterations={64}
              margin={{ top:8, right:160, bottom:8, left:130 }}
            >
              <Tooltip content={({ active, payload }) =>
                active && payload?.length ? (
                  <div style={{ background:TC.card, border:`1px solid ${TC.border}`, borderRadius:7, padding:"8px 12px", fontSize:11 }}>
                    <b>{payload[0].payload.name}</b>: {payload[0].payload.value} searchers
                  </div>
                ) : null
              }/>
            </Sankey>
          </div>
        </div>

        <div style={card}>
          <div style={sec}>Allocation Geogràfica — Searchers (€)</div>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={geoData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={95} labelLine={false}
                label={FlagSvgLabel}
              >
                {geoData.map((_, i) => <Cell key={i} fill={GEO_COLORS[i % GEO_COLORS.length]}/>)}
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
              <Legend formatter={v=><span style={{color:TC.text,fontSize:11}}>{v}</span>}/>
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Historic table ── */}
      <div style={card}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
          <div style={sec}>Historial de Searchers</div>
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
            {/* CSV upload */}
            <input ref={csvRef} type="file" accept=".csv" style={{ display:"none" }} onChange={handleCSV} />
            <button onClick={() => csvRef.current?.click()}
              style={{ background:TC.navy, color:"#fff", border:"none", borderRadius:6, padding:"5px 12px", cursor:"pointer", fontSize:11, fontFamily:"inherit" }}>
              ↑ CSV
            </button>
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
              </tr>
            </thead>
            <tbody>
              {filteredHistoric.map((r, i) => (
                <tr key={`${r.nom}-${i}`} style={{ background: i % 2 === 0 ? TC.card : TC.bgAlt }}>
                  <td style={{ padding:"7px 10px", fontWeight:500, color:TC.navy }}>{r.nom}</td>
                  <td style={{ padding:"7px 10px", color:TC.textMid, fontSize:11 }}>{r.tipus}</td>
                  <td style={{ padding:"7px 10px" }}>
                    <span style={{ background:r.modalitat==="Solo"?"#E8F4EE":r.modalitat==="Duo"?"#EAF0FA":"#F5F0FA", color:r.modalitat==="Solo"?TC.green:r.modalitat==="Duo"?TC.navy:"#5A3E9A", borderRadius:20, padding:"1px 8px", fontSize:10, fontWeight:600 }}>{r.modalitat}</span>
                  </td>
                  <td style={{ padding:"7px 10px", textAlign:"center" }}><FlagImg geo={r.geo} /></td>
                  <td style={{ padding:"7px 10px" }}><StatusBadge s={r.statusScreening} /></td>
                  <td style={{ padding:"7px 10px" }}>
                    <span style={{ background:r.formEntrada==="Equity Gap"?"#E8F4EE":"#EAF0FA", color:r.formEntrada==="Equity Gap"?TC.green:TC.navy, borderRadius:20, padding:"1px 8px", fontSize:10, fontWeight:600 }}>{r.formEntrada}</span>
                  </td>
                  <td style={{ padding:"7px 10px", fontSize:11, color:TC.text }}>
                    {[r.searcher1, r.searcher2].filter(Boolean).join(" / ") || "—"}
                  </td>
                  <td style={{ padding:"7px 10px", fontSize:11 }}>
                    {[r.escola1, r.escola2].filter(Boolean).map((e,i) => (
                      <span key={i} style={{ display:"inline-block", background:TC.bgAlt, border:`1px solid ${TC.border}`, borderRadius:4, padding:"1px 7px", fontSize:10, fontWeight:600, marginRight:3, color:TC.navy }}>{e}</span>
                    ))}
                    {!r.escola1 && !r.escola2 && <span style={{color:TC.textLight}}>—</span>}
                  </td>
                  <td style={{ padding:"7px 10px", color:TC.textMid, fontSize:11 }}>{r.introPer}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
