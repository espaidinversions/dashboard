import React, { useMemo } from "react";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ReferenceLine,
} from "recharts";
import { useTheme } from "../theme.js";
import { fmtM } from "../utils.js";
import { PORTFOLIO_COMPANIES } from "../data/searchers.js";
import { FlagImg, FlagSvgLabel } from "./SharedComponents.jsx";
import { Link } from "react-router-dom";
import { slugify } from "../utils.js";

const GEO_NAME = { ES:"ESP", EN:"UK", IT:"ITA", DE:"DEU", FR:"FRA", PT:"POR", NL:"NED", US:"USA", CH:"CHE" };

const fmtDate = iso => { if (!iso) return "—"; const [y,m,d]=iso.split("-"); return `${d}/${m}/${y}`; };
const fmtM2 = v => v == null ? "—" : fmtM(v);

const ORIG_COLORS = {
  "Equity Gap":    "#5A966E",
  "Search Capital":"#3C5064",
  "Direct PE":     "#6A4C8A",
};
const GEO_COLORS = ["#3C5064","#5A966E","#6A4C8A","#B8860B","#C62828","#1D6840","#2563A8","#8A6400","#007A8A"];

// TVPI colour helpers
const tvpiColor = t => {
  if (t == null) return "#999";
  if (t < 1.0)  return "#C62828";
  if (t < 1.5)  return "#7A6000";
  return "#1D6840";
};
const tvpiBg = t => {
  if (t == null) return "#F5F5F5";
  if (t < 1.0)  return "#FDECEA";
  if (t < 1.5)  return "#FFF8E1";
  return "#E8F4EE";
};

export function PortfolioCompaniesTab({ search = "" }) {
  const { tc: TC, dark } = useTheme();
  const card = { background:TC.card, border:`1px solid ${TC.border}`, borderRadius:12, padding:"20px 22px", boxShadow:"0 2px 12px rgba(0,0,0,.06)" };
  const th   = { padding:"9px 10px", fontSize:10, letterSpacing:"0.09em", color:TC.textLight, textTransform:"uppercase", fontWeight:600, textAlign:"left", borderBottom:`2px solid ${TC.border}`, whiteSpace:"nowrap" };
  const sec  = { fontSize:10, letterSpacing:"0.11em", color:TC.textLight, textTransform:"uppercase", marginBottom:16, fontWeight:600 };

  const total    = PORTFOLIO_COMPANIES.reduce((s,r) => s + r.ticket, 0);
  const sfCompanies = PORTFOLIO_COMPANIES.filter(r => r.tipus === "SF" && (!search.trim() || r.nom.toLowerCase().includes(search.toLowerCase()) || (r.segment||"").toLowerCase().includes(search.toLowerCase())));
  const peCompanies = PORTFOLIO_COMPANIES.filter(r => r.tipus === "PE" && (!search.trim() || r.nom.toLowerCase().includes(search.toLowerCase()) || (r.segment||"").toLowerCase().includes(search.toLowerCase())));

  const valuedAll = PORTFOLIO_COMPANIES.filter(r => r.tvpi != null);
  const totalTicketValued = valuedAll.reduce((s,r) => s + r.ticket, 0);
  const wtTvpi  = valuedAll.reduce((s,r) => s + r.tvpi * r.ticket, 0) / totalTicketValued;
  const totalNAV = valuedAll.reduce((s,r) => s + (r.rvpiEur || 0) + (r.dpiEur || 0), 0);
  const tvpiAccent = wtTvpi >= 1.5 ? TC.green : wtTvpi >= 1 ? TC.orange : TC.red;

  const byGeo = useMemo(() => {
    const m = {};
    PORTFOLIO_COMPANIES.forEach(r => {
      if (!m[r.geo]) m[r.geo] = { geo:r.geo, name:GEO_NAME[r.geo]||r.geo, value:0, count:0 };
      m[r.geo].value += r.ticket;
      m[r.geo].count += 1;
    });
    return Object.values(m).sort((a,b) => b.value - a.value);
  }, []);

  const byOrigen = useMemo(() => {
    const m = {};
    PORTFOLIO_COMPANIES.forEach(r => { m[r.origen] = (m[r.origen]||0) + r.ticket; });
    return Object.entries(m).map(([name,value]) => ({ name, value }));
  }, []);

  const tvpiChartData = useMemo(() =>
    PORTFOLIO_COMPANIES
      .filter(r => r.tvpi != null)
      .sort((a,b) => b.tvpi - a.tvpi)
      .map(r => ({ name:r.nom, tvpi:r.tvpi, tipus:r.tipus }))
  , []);

  return (
    <div style={{ padding:"0 0 40px" }}>

      {/* Info note */}
      <div style={{
        background: TC.bgAlt,
        border: `1px solid ${TC.border}`,
        borderRadius: 8, padding:"10px 16px", marginBottom:18,
        display:"flex", alignItems:"center", gap:10,
        fontSize:11, color:TC.textMid,
      }}>
        <span style={{fontSize:14, flexShrink:0}}>ℹ</span>
        <span>Valoració basada en última disponible (2025Q1 / 2024Q4). Dates d'entrada PE directes aproximades. <b style={{color:TC.text}}>{valuedAll.length}/{PORTFOLIO_COMPANIES.length}</b> empreses valorades.</span>
      </div>

      {/* KPIs */}
      <div className="grid-4" style={{ gap:12, marginBottom:18 }}>
        {[
          { label:"Empreses en Cartera",  value: PORTFOLIO_COMPANIES.length,
            sub:`${sfCompanies.length} SF · ${peCompanies.length} PE directes`,     accent:TC.navy },
          { label:"Capital Desplegat",    value: fmtM(total),
            sub:"total compromisos",                                                 accent:TC.green },
          { label:"TVPI Mig Ponderat",    value: wtTvpi.toFixed(2)+"x",
            sub:`${valuedAll.length} empreses valorades`,                            accent:tvpiAccent },
          { label:"NAV Total (RVPI+DPI)", value: fmtM(totalNAV),
            sub:"valor residual + distribucions",                                    accent:TC.green },
        ].map(k => (
          <div key={k.label} style={{ ...card, padding:"16px 18px", borderTop:`3px solid ${k.accent}` }}>
            <div style={{ fontSize:10, color:TC.textLight, letterSpacing:"0.11em", textTransform:"uppercase", marginBottom:6, fontWeight:500 }}>{k.label}</div>
            <div style={{ fontSize:21, fontWeight:700, color:k.accent, marginBottom:2, letterSpacing:"-0.02em" }}>{k.value}</div>
            <div style={{ fontSize:11, color:TC.textLight }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div style={{ ...card, marginBottom:14 }}>
        <div style={sec}>Cartera d'Empreses</div>
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11 }}>
            <thead>
              <tr>
                {["Empresa","Tipus","Segment","Empresaris","Origen","País","Ticket","TVPI","Rev LTM","EBITDA LTM","Data","Mesos"].map(h=>(
                  <th key={h} style={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* SF group */}
              <tr>
                <td colSpan={12} style={{ padding:"6px 10px", fontSize:9, letterSpacing:"0.12em", textTransform:"uppercase", color:TC.textLight, fontWeight:700, background:TC.bgAlt, borderTop:`1px solid ${TC.border}` }}>
                  Search Fund — Empreses adquirides
                </td>
              </tr>
              {sfCompanies.map((r,i) => <PortRow key={r.nom} r={r} i={i} TC={TC} />)}

              {/* PE group */}
              <tr>
                <td colSpan={12} style={{ padding:"6px 10px", fontSize:9, letterSpacing:"0.12em", textTransform:"uppercase", color:TC.textLight, fontWeight:700, background:TC.bgAlt, borderTop:`1px solid ${TC.border}` }}>
                  PE Direct — Inversions directes
                </td>
              </tr>
              {peCompanies.map((r,i) => <PortRow key={r.nom} r={r} i={i} TC={TC} />)}
            </tbody>
            <tfoot>
              <tr style={{ borderTop:`2px solid ${TC.border}` }}>
                <td colSpan={6} style={{ padding:"8px 10px", fontWeight:700, fontSize:11, color:TC.navyLight }}>
                  TOTAL ({PORTFOLIO_COMPANIES.length} empreses)
                </td>
                <td style={{ padding:"8px 10px", textAlign:"right", fontFamily:"'DM Mono',monospace", fontWeight:700, color:TC.green }}>{fmtM(total)}</td>
                <td style={{ padding:"8px 10px", textAlign:"center", fontFamily:"'DM Mono',monospace", fontWeight:700, color:wtTvpi >= 1 ? TC.green : "#C62828" }}>{wtTvpi.toFixed(2)}x</td>
                <td colSpan={4}/>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Charts row 1: Geo + Origen */}
      <div className="grid-2" style={{ gap:14, marginBottom:14 }}>
        <div style={card}>
          <div style={sec}>Allocation Geogràfica</div>
          <ResponsiveContainer width="100%" height={230}>
            <PieChart>
              <Pie data={byGeo} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={85} labelLine={false} label={FlagSvgLabel}>
                {byGeo.map((_, i) => <Cell key={i} fill={GEO_COLORS[i % GEO_COLORS.length]}/>)}
              </Pie>
              <Tooltip content={({active,payload}) => active&&payload?.length ? (
                <div style={{ background:TC.card, border:`1px solid ${TC.border}`, borderRadius:7, padding:"10px 14px", fontSize:11 }}>
                  <b>{payload[0].payload.name}</b>
                  <div style={{ color:TC.green, marginTop:4 }}>{fmtM(payload[0].value)} · {payload[0].payload.count} empresa{payload[0].payload.count>1?"s":""}</div>
                </div>
              ) : null}/>
              <Legend formatter={v=><span style={{color:TC.text,fontSize:11}}>{v}</span>}/>
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div style={card}>
          <div style={sec}>Per Origen d'Entrada</div>
          <ResponsiveContainer width="100%" height={230}>
            <PieChart>
              <Pie data={byOrigen} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={85} labelLine={false}
                label={({cx,cy,midAngle,innerRadius,outerRadius,percent}) => {
                  if (percent < 0.06) return null;
                  const R=Math.PI/180, r=innerRadius+(outerRadius-innerRadius)*0.58;
                  return <text x={cx+r*Math.cos(-midAngle*R)} y={cy+r*Math.sin(-midAngle*R)} fill="#fff" textAnchor="middle" dominantBaseline="central" fontSize={10} fontWeight="700">{`${(percent*100).toFixed(0)}%`}</text>;
                }}
              >
                {byOrigen.map((e,i) => <Cell key={i} fill={ORIG_COLORS[e.name]||TC.navy}/>)}
              </Pie>
              <Tooltip content={({active,payload}) => active&&payload?.length ? (
                <div style={{ background:TC.card, border:`1px solid ${TC.border}`, borderRadius:7, padding:"10px 14px", fontSize:11 }}>
                  <b style={{color:TC.text}}>{payload[0].name}</b>
                  <div style={{ color:ORIG_COLORS[payload[0].name]||TC.navy, marginTop:4, fontWeight:700 }}>{fmtM(payload[0].value)}</div>
                  <div style={{ color:TC.textLight, fontSize:10, marginTop:2 }}>{((payload[0].value/total)*100).toFixed(1)}%</div>
                </div>
              ) : null}/>
              <Legend formatter={v=><span style={{color:TC.text,fontSize:11}}>{v}</span>}/>
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Chart row 2: TVPI per empresa */}
      <div style={card}>
        <div style={sec}>TVPI per Empresa <span style={{fontWeight:400, textTransform:"none", letterSpacing:0, color:TC.textMid, fontSize:10}}>— empreses valorades, ordenades per múltiple</span></div>
        <ResponsiveContainer width="100%" height={Math.max(260, tvpiChartData.length * 26)}>
          <BarChart data={tvpiChartData} layout="vertical" margin={{top:4, right:60, bottom:4, left:10}}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={TC.border}/>
            <XAxis type="number" domain={[0,'dataMax+0.3']} tickFormatter={v=>`${v.toFixed(1)}x`} tick={{fontSize:10, fill:TC.textLight}} axisLine={false} tickLine={false}/>
            <YAxis type="category" dataKey="name" width={110} tick={{fontSize:10, fill:TC.text}} axisLine={false} tickLine={false}/>
            <ReferenceLine x={1} stroke={TC.textLight} strokeDasharray="4 4" label={{value:"1×", position:"top", fontSize:9, fill:TC.textLight}}/>
            <Tooltip content={({active,payload}) => active&&payload?.length ? (
              <div style={{ background:TC.card, border:`1px solid ${TC.border}`, borderRadius:7, padding:"10px 14px", fontSize:11 }}>
                <b style={{color:TC.text}}>{payload[0].payload.name}</b>
                <div style={{ color:tvpiColor(payload[0].value), fontWeight:700, marginTop:4, fontSize:13 }}>{payload[0].value.toFixed(3)}×</div>
                <div style={{ color:TC.textLight, fontSize:10, marginTop:2 }}>{payload[0].payload.tipus}</div>
              </div>
            ) : null}/>
            <Bar dataKey="tvpi" radius={[0,3,3,0]} minPointSize={2}>
              {tvpiChartData.map((e,i) => (
                <Cell key={i} fill={tvpiColor(e.tvpi)}/>
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ── Row component ─────────────────────────────────────────────────────────────
function PortRow({ r, i, TC }) {
  const tdBase = { padding:"7px 10px" };
  return (
    <tr style={{ background: i%2===0 ? TC.card : TC.bgAlt }}>
      <td style={{ ...tdBase, fontWeight:600, color:TC.navy, whiteSpace:"nowrap" }}>
        <Link
          to={`/company/${slugify(r.nom)}`}
          style={{ color: "inherit", textDecoration: "none" }}
          onMouseEnter={e => e.currentTarget.style.textDecoration = "underline"}
          onMouseLeave={e => e.currentTarget.style.textDecoration = "none"}
        >
          {r.nom}
        </Link>
      </td>
      <td style={tdBase}>
        <span style={{ background:r.tipus==="SF"?"#E8EFF5":"#F3EEF8", color:r.tipus==="SF"?TC.navy:"#6A4C8A", borderRadius:20, padding:"1px 8px", fontSize:9, fontWeight:700, letterSpacing:"0.05em" }}>{r.tipus}</span>
      </td>
      <td style={{ ...tdBase, fontSize:10 }}>
        {r.segment ? <span style={{ background:TC.bg, border:`1px solid ${TC.border}`, borderRadius:4, padding:"1px 7px", fontSize:9 }}>{r.segment}</span> : "—"}
      </td>
      <td style={{ ...tdBase, color:TC.textMid, fontSize:10, maxWidth:140, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
        {r.entrepreneurs && r.entrepreneurs !== "—" ? r.entrepreneurs : <span style={{color:TC.textLight}}>—</span>}
      </td>
      <td style={tdBase}>
        <span style={{ background:r.origen==="Equity Gap"?"#E8F4EE":r.origen==="Search Capital"?"#E8EFF5":"#F3EEF8", color:r.origen==="Equity Gap"?TC.green:r.origen==="Search Capital"?TC.navy:"#6A4C8A", borderRadius:20, padding:"2px 8px", fontSize:9, fontWeight:600, whiteSpace:"nowrap" }}>{r.origen}</span>
      </td>
      <td style={{ ...tdBase, textAlign:"center" }}><FlagImg geo={r.geo} size={18}/></td>
      <td style={{ ...tdBase, textAlign:"right", fontFamily:"'DM Mono',monospace", fontWeight:700, color:TC.green }}>{fmtM(r.ticket)}</td>
      <td style={{ ...tdBase, textAlign:"center" }}>
        {r.tvpi != null
          ? <span style={{ background:tvpiBg(r.tvpi), color:tvpiColor(r.tvpi), borderRadius:20, padding:"2px 8px", fontFamily:"'DM Mono',monospace", fontWeight:700, fontSize:11, whiteSpace:"nowrap" }}>{r.tvpi.toFixed(2)}×</span>
          : <span style={{ color:TC.textLight, fontSize:10, fontStyle:"italic" }}>Pendent</span>
        }
      </td>
      <td style={{ ...tdBase, textAlign:"right", fontFamily:"'DM Mono',monospace", fontSize:10, color:TC.textMid }}>{r.rev ? fmtM(r.rev) : "—"}</td>
      <td style={{ ...tdBase, textAlign:"right", fontFamily:"'DM Mono',monospace", fontSize:10, color:r.ebitda != null && r.ebitda < 0 ? "#C62828" : TC.textMid }}>{r.ebitda != null ? fmtM(r.ebitda) : "—"}</td>
      <td style={{ ...tdBase, color:TC.textMid, fontSize:10, whiteSpace:"nowrap" }}>{fmtDate(r.dataCompr)}</td>
      <td style={{ ...tdBase, textAlign:"center" }}>
        {r.mesosOperant != null
          ? <span style={{ background:"#E8F4EE", color:TC.green, borderRadius:20, padding:"1px 7px", fontWeight:700, fontSize:10 }}>{r.mesosOperant}</span>
          : <span style={{color:TC.textLight}}>—</span>
        }
      </td>
    </tr>
  );
}
