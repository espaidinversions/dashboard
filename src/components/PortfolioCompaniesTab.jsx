import React, { useMemo, useState, useRef } from "react";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend, Label,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ReferenceLine,
} from "recharts";
import { useTheme } from "../theme.js";
import { fmtM, slugify, tvpiColor, tvpiBg, usePersistedState } from "../utils.js";
import { GEO_NAME } from "../config.js";
import { PORTFOLIO_COMPANIES } from "../data/searchers.js";
import { FlagImg, FlagSvgLabel, EditableCell, AddRowModal, DeleteRowButton } from "./SharedComponents.jsx";
import { Link } from "react-router-dom";
import { upsertCompany, insertCompany, deleteCompany } from "../db.js";
import { useAuth } from "../auth.jsx";
import { useToast } from "../toast.jsx";

const fmtDate = iso => { if (!iso) return "—"; const [y,m,d]=iso.split("-"); return `${d}/${m}/${y}`; };
const fmtM2 = v => v == null ? "—" : fmtM(v);

const ORIG_COLORS = {
  "Equity Gap":    "#3DC83E",
  "Search Capital":"#2B5070",
  "Direct PE":     "#6A4C8A",
};
const GEO_COLORS = ["#2B5070","#3DC83E","#6A4C8A","#B8860B","#C62828","#1C6B1D","#2563A8","#8A6400","#007A8A"];

function CenterLabel({ viewBox, value, sub, tc }) {
  const { cx, cy } = viewBox;
  return (
    <g>
      <text x={cx} y={cy - 7} textAnchor="middle" dominantBaseline="middle"
        style={{ fontSize: 13, fontWeight: 700, fill: tc.navy, fontFamily: "'DM Mono',monospace" }}>
        {value}
      </text>
      <text x={cx} y={cy + 10} textAnchor="middle" dominantBaseline="middle"
        style={{ fontSize: 9, fill: tc.textLight }}>
        {sub}
      </text>
    </g>
  );
}

export function PortfolioCompaniesTab({ search = "" }) {
  const { tc: TC, dark } = useTheme();
  const { isSuperuser } = useAuth();
  const { toast } = useToast();
  const [showAddModal, setShowAddModal] = useState(false);

  const card = { background:TC.card, border:`1px solid ${TC.border}`, borderRadius:12, padding:"20px 22px", boxShadow:"0 2px 12px rgba(0,0,0,.06)" };
  const th   = { padding:"9px 10px", fontSize:10, letterSpacing:"0.09em", color:TC.textLight, textTransform:"uppercase", fontWeight:600, textAlign:"left", borderBottom:`2px solid ${TC.border}`, whiteSpace:"nowrap" };
  const sec  = { fontSize:10, letterSpacing:"0.11em", color:TC.textLight, textTransform:"uppercase", marginBottom:16, fontWeight:600 };

  const [companies, setCompanies] = usePersistedState("tc_portfolioCompanies", PORTFOLIO_COMPANIES);
  const fileRef = useRef(null);

  const handleFile = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target.result);
        if (Array.isArray(data) && data.length) {
          setCompanies(data);
        }
      } catch {}
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const resetCompanies = () => { setCompanies(PORTFOLIO_COMPANIES); };

  const hasCustomData = companies !== PORTFOLIO_COMPANIES && companies.length !== PORTFOLIO_COMPANIES.length;

  const saveField = async (nom, field, value) => {
    const updated = companies.map(c => c.nom === nom ? { ...c, [field]: value } : c);
    setCompanies(updated);
    const company = updated.find(c => c.nom === nom);
    if (company) {
      const { error } = await upsertCompany(company);
      if (error) toast({ message: "Error desant canvis: " + error.message, type: "error" });
    }
  };

  const handleAdd = async (values, setError) => {
    const nom = values.nom?.trim();
    if (!nom) { setError("El nom és obligatori"); return; }
    if (companies.some(c => c.nom === nom)) {
      setError("Ja existeix una empresa amb aquest nom");
      return;
    }
    const company = {
      nom, tipus: values.tipus || null, segment: values.segment || null,
      entrepreneurs: values.entrepreneurs || null, origen: values.origen || null,
      geo: values.geo || null, ticket: parseFloat(values.ticket) || null,
      tvpi: null, rvpiEur: null, dpiEur: null, rev: null, ebitda: null,
      dfn: null, grossEV: null, multEntry: null, dataCompr: null,
      mesosOperant: null, isMock: false, quarters: [],
    };
    const inserted = await insertCompany(company);
    if (!inserted) { setError("Error en crear l'empresa"); return; }
    setCompanies([inserted, ...companies]);
    setShowAddModal(false);
  };

  const handleDelete = async (id, nom) => {
    const { error } = await deleteCompany(id);
    if (error) { toast({ message: "Error eliminant empresa: " + error.message, type: "error" }); return; }
    setCompanies(companies.filter(c => c.nom !== nom));
    toast({ message: `"${nom}" eliminada.` });
  };

  const filtered = search.trim()
    ? companies.filter(r =>
        r.nom.toLowerCase().includes(search.toLowerCase()) ||
        (r.segment||"").toLowerCase().includes(search.toLowerCase())
      )
    : companies;

  const total    = filtered.reduce((s,r) => s + r.ticket, 0);
  const totalAll = companies.reduce((s,r) => s + r.ticket, 0);
  const sfCompanies = filtered.filter(r => r.tipus === "SF");
  const peCompanies = filtered.filter(r => r.tipus === "PE");

  const valuedAll = filtered.filter(r => r.tvpi != null);
  const totalTicketValued = valuedAll.reduce((s,r) => s + r.ticket, 0);
  const wtTvpi  = valuedAll.length > 0 ? valuedAll.reduce((s,r) => s + r.tvpi * r.ticket, 0) / totalTicketValued : 0;
  const totalNAV = valuedAll.reduce((s,r) => s + (r.rvpiEur || 0) + (r.dpiEur || 0), 0);
  const tvpiAccent = wtTvpi >= 1.5 ? TC.green : wtTvpi >= 1 ? TC.orange : TC.red;

  const byGeo = useMemo(() => {
    const m = {};
    filtered.forEach(r => {
      if (!m[r.geo]) m[r.geo] = { geo:r.geo, name:GEO_NAME[r.geo]||r.geo, value:0, count:0 };
      m[r.geo].value += r.ticket;
      m[r.geo].count += 1;
    });
    return Object.values(m).sort((a,b) => b.value - a.value);
  }, [search]);

  const byOrigen = useMemo(() => {
    const m = {};
    filtered.forEach(r => { m[r.origen] = (m[r.origen]||0) + r.ticket; });
    return Object.entries(m).map(([name,value]) => ({ name, value }));
  }, [search]);

  const tvpiChartData = useMemo(() =>
    filtered
      .filter(r => r.tvpi != null)
      .sort((a,b) => b.tvpi - a.tvpi)
      .map(r => ({ name:r.nom, tvpi:r.tvpi, tipus:r.tipus }))
  , [search]);

  return (
    <div style={{ padding:"0 0 40px" }}>

      {/* ── Data load bar ── */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"flex-end", gap:8, marginBottom:14 }}>
        {isSuperuser && (
          <button onClick={() => setShowAddModal(true)}
            style={{ padding: "7px 14px", borderRadius: 7, border: `1.5px solid ${TC.border}`,
              background: "transparent", color: TC.navy, cursor: "pointer",
              fontFamily: "inherit", fontSize: 12, fontWeight: 600 }}>
            + Nova participada
          </button>
        )}
        {hasCustomData && (
          <span style={{ fontSize:11, color:TC.textLight }}>
            {companies.length} participades carregades
          </span>
        )}
        {hasCustomData && (
          <button onClick={resetCompanies}
            style={{ background:"transparent", border:`1px solid ${TC.border}`, borderRadius:6, padding:"5px 11px", cursor:"pointer", fontSize:11, color:TC.textMid, fontFamily:"inherit" }}>
            Restaurar per defecte
          </button>
        )}
        <input ref={fileRef} type="file" accept=".json" style={{ display:"none" }} onChange={handleFile} />
        <button onClick={() => fileRef.current?.click()}
          style={{ background:TC.navy, color:"#fff", border:"none", borderRadius:7, padding:"6px 14px", cursor:"pointer", fontSize:11, fontFamily:"inherit" }}>
          ↑ Carregar dades
        </button>
      </div>

      {/* Info note */}
      <div style={{
        background: TC.bgAlt,
        border: `1px solid ${TC.border}`,
        borderRadius: 8, padding:"10px 16px", marginBottom:18,
        display:"flex", alignItems:"center", gap:10,
        fontSize:11, color:TC.textMid,
      }}>
        <span style={{fontSize:14, flexShrink:0}}>ℹ</span>
        <span>Valoració basada en última disponible (2025Q1 / 2024Q4). Dates d'entrada PE directes aproximades. <b style={{color:TC.text}}>{valuedAll.length}/{companies.length}</b> participades valorades.</span>
      </div>

      {/* KPIs */}
      <div className="grid-4" style={{ gap:12, marginBottom:18 }}>
        {[
          { label:"Participades",  value: filtered.length,
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

      {/* Charts row 1: Geo + Origen */}
      <div className="grid-2" style={{ gap:14, marginBottom:14 }}>
        <div style={card}>
          <div style={sec}>Allocation Geogràfica</div>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={byGeo} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={52} outerRadius={82} labelLine={false}
                label={({ cx, cy, midAngle, innerRadius, outerRadius, percent, geo, name }) => {
                  if (percent < 0.04) return null;
                  const R = Math.PI / 180;
                  const r = outerRadius + 18;
                  const x = cx + r * Math.cos(-midAngle * R);
                  const y = cy + r * Math.sin(-midAngle * R);
                  // flag emoji from name (geo code)
                  const flagMap = { ES:"🇪🇸", EN:"🇬🇧", IT:"🇮🇹", DE:"🇩🇪", FR:"🇫🇷", PT:"🇵🇹", NL:"🇳🇱", US:"🇺🇸", CH:"🇨🇭" };
                  return (
                    <text x={x} y={y} textAnchor="middle" dominantBaseline="middle" fontSize={11}>
                      {flagMap[name] || name} {`${(percent * 100).toFixed(0)}%`}
                    </text>
                  );
                }}
              >
                {byGeo.map((_, i) => <Cell key={i} fill={GEO_COLORS[i % GEO_COLORS.length]}/>)}
                <Label content={(props) => <CenterLabel {...props} value={fmtM(total)} sub="Total" tc={TC} />} />
              </Pie>
              <Tooltip content={({active,payload}) => active&&payload?.length ? (
                <div style={{ background:TC.card, border:`1px solid ${TC.border}`, borderRadius:7, padding:"10px 14px", fontSize:11 }}>
                  <b>{payload[0].payload.name}</b>
                  <div style={{ color:TC.green, marginTop:4 }}>{fmtM(payload[0].value)} · {payload[0].payload.count} empresa{payload[0].payload.count>1?"s":""}</div>
                </div>
              ) : null}/>
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div style={card}>
          <div style={sec}>Per Origen d'Entrada</div>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={byOrigen} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={52} outerRadius={82} labelLine={false}
                label={({ cx, cy, midAngle, outerRadius, percent, name }) => {
                  if (percent < 0.04) return null;
                  const R = Math.PI / 180;
                  const r = outerRadius + 18;
                  const x = cx + r * Math.cos(-midAngle * R);
                  const y = cy + r * Math.sin(-midAngle * R);
                  const short = name === "Search Capital" ? "Search Cap." : name;
                  return (
                    <text x={x} y={y} textAnchor="middle" dominantBaseline="middle" fontSize={10}
                      fill={ORIG_COLORS[name] || TC.navy} fontWeight="600">
                      {short} {`${(percent * 100).toFixed(0)}%`}
                    </text>
                  );
                }}
              >
                {byOrigen.map((e,i) => <Cell key={i} fill={ORIG_COLORS[e.name]||TC.navy}/>)}
                <Label content={(props) => <CenterLabel {...props} value={fmtM(total)} sub="Total" tc={TC} />} />
              </Pie>
              <Tooltip content={({active,payload}) => active&&payload?.length ? (
                <div style={{ background:TC.card, border:`1px solid ${TC.border}`, borderRadius:7, padding:"10px 14px", fontSize:11 }}>
                  <b style={{color:TC.text}}>{payload[0].name}</b>
                  <div style={{ color:ORIG_COLORS[payload[0].name]||TC.navy, marginTop:4, fontWeight:700 }}>{fmtM(payload[0].value)}</div>
                  <div style={{ color:TC.textLight, fontSize:10, marginTop:2 }}>{((payload[0].value/totalAll)*100).toFixed(1)}%</div>
                </div>
              ) : null}/>
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Chart row 2: TVPI per empresa */}
      <div style={{ ...card, marginBottom:14 }}>
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

      {/* Table */}
      <div style={{ ...card, marginBottom:14 }}>
        <div style={sec}>Participades</div>
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11 }}>
            <thead>
              <tr>
                {["Empresa","Tipus","Segment","Empresaris","Origen","País","Ticket","TVPI","Rev LTM","EBITDA LTM","Data","Mesos"].map(h=>(
                  <th key={h} style={th}>{h}</th>
                ))}
                {isSuperuser && <th style={{ ...th, width: 40 }} />}
              </tr>
            </thead>
            <tbody>
              {[...sfCompanies, ...peCompanies].map((r,i) => (
                <PortRow key={r.nom} r={r} i={i} TC={TC}
                  isSuperuser={isSuperuser}
                  saveField={saveField}
                  handleDelete={handleDelete}
                />
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop:`2px solid ${TC.border}` }}>
                <td colSpan={6} style={{ padding:"8px 10px", fontWeight:700, fontSize:11, color:TC.navyLight }}>
                  TOTAL ({filtered.length} empreses)
                </td>
                <td style={{ padding:"8px 10px", textAlign:"right", fontFamily:"'DM Mono',monospace", fontWeight:700, color:TC.green }}>{fmtM(total)}</td>
                <td style={{ padding:"8px 10px", textAlign:"center", fontFamily:"'DM Mono',monospace", fontWeight:700, color:wtTvpi >= 1 ? TC.green : "#C62828" }}>{wtTvpi.toFixed(2)}x</td>
                <td colSpan={isSuperuser ? 5 : 4}/>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {showAddModal && (
        <AddRowModal
          title="Nova participada"
          fields={[
            { key: "nom", label: "Nom", type: "text", placeholder: "Nom de l'empresa" },
            { key: "tipus", label: "Tipus", type: "select", options: ["", "Searcher", "Direct", "Co-inversió"], defaultValue: "" },
            { key: "segment", label: "Segment", type: "text" },
            { key: "geo", label: "Geografia", type: "text", placeholder: "ES, FR, ..." },
            { key: "ticket", label: "Ticket (€M)", type: "number" },
          ]}
          onSave={handleAdd}
          onClose={() => setShowAddModal(false)}
        />
      )}

    </div>
  );
}

// ── Row component ─────────────────────────────────────────────────────────────
function PortRow({ r, i, TC, isSuperuser, saveField, handleDelete }) {
  const tdBase = { padding:"7px 10px" };
  return (
    <tr className="hoverable" style={{ background: i%2===0 ? TC.card : TC.bgAlt }}>
      <td style={{ ...tdBase, fontWeight:600, color:TC.navy, whiteSpace:"nowrap" }}>
        <Link
          to={`/company/${slugify(r.nom)}`}
          style={{ color: "inherit", textDecoration: "none" }}
          onMouseEnter={e => e.currentTarget.style.textDecoration = "underline"}
          onMouseLeave={e => e.currentTarget.style.textDecoration = "none"}
        >
          <EditableCell value={r.nom} type="text"
            onSave={v => saveField(r.nom, "nom", v)}
            disabled={!isSuperuser} />
        </Link>
      </td>
      <td style={tdBase}>
        <EditableCell value={r.tipus} type="text"
          onSave={v => saveField(r.nom, "tipus", v)}
          disabled={!isSuperuser}
          fmt={v => (
            <span style={{ background:v==="SF"?"#E6EDF3":"#F3EEF8", color:v==="SF"?TC.navy:"#6A4C8A", borderRadius:20, padding:"1px 8px", fontSize:9, fontWeight:700, letterSpacing:"0.05em" }}>{v}</span>
          )} />
      </td>
      <td style={{ ...tdBase, fontSize:10 }}>
        <EditableCell value={r.segment} type="text"
          onSave={v => saveField(r.nom, "segment", v)}
          disabled={!isSuperuser}
          fmt={v => v ? <span style={{ background:TC.bg, border:`1px solid ${TC.border}`, borderRadius:4, padding:"1px 7px", fontSize:9 }}>{v}</span> : "—"} />
      </td>
      <td style={{ ...tdBase, color:TC.textMid, fontSize:10, maxWidth:140, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
        <EditableCell value={r.entrepreneurs} type="text"
          onSave={v => saveField(r.nom, "entrepreneurs", v)}
          disabled={!isSuperuser}
          fmt={v => v && v !== "—" ? v : <span style={{color:TC.textLight}}>—</span>} />
      </td>
      <td style={tdBase}>
        <EditableCell value={r.origen} type="text"
          onSave={v => saveField(r.nom, "origen", v)}
          disabled={!isSuperuser}
          fmt={v => (
            <span style={{ background:v==="Equity Gap"?"#E8F8E8":v==="Search Capital"?"#E6EDF3":"#F3EEF8", color:v==="Equity Gap"?TC.green:v==="Search Capital"?TC.navy:"#6A4C8A", borderRadius:20, padding:"2px 8px", fontSize:9, fontWeight:600, whiteSpace:"nowrap" }}>{v}</span>
          )} />
      </td>
      <td style={{ ...tdBase, textAlign:"center" }}><FlagImg geo={r.geo} size={18}/></td>
      <td style={{ ...tdBase, textAlign:"right", fontFamily:"'DM Mono',monospace", fontWeight:700, color:TC.green }}>
        <EditableCell value={r.ticket} type="number" align="right"
          fmt={v => v != null ? fmtM(v) : "—"}
          onSave={v => saveField(r.nom, "ticket", v)}
          disabled={!isSuperuser} />
      </td>
      <td style={{ ...tdBase, textAlign:"center" }}>
        {r.tvpi != null
          ? <span style={{ background:tvpiBg(r.tvpi), color:tvpiColor(r.tvpi), borderRadius:20, padding:"2px 8px", fontFamily:"'DM Mono',monospace", fontWeight:700, fontSize:11, whiteSpace:"nowrap" }}>{r.tvpi.toFixed(2)}×</span>
          : <span style={{ color:TC.textLight, fontSize:10, fontStyle:"italic" }}>Pendent</span>
        }
      </td>
      <td style={{ ...tdBase, textAlign:"right", fontFamily:"'DM Mono',monospace", fontSize:10, color:TC.textMid }}>
        <EditableCell value={r.rev} type="number" align="right"
          fmt={v => v ? fmtM(v) : "—"}
          onSave={v => saveField(r.nom, "rev", v)}
          disabled={!isSuperuser} />
      </td>
      <td style={{ ...tdBase, textAlign:"right", fontFamily:"'DM Mono',monospace", fontSize:10, color:r.ebitda != null && r.ebitda < 0 ? "#C62828" : TC.textMid }}>
        <EditableCell value={r.ebitda} type="number" align="right"
          fmt={v => v != null ? fmtM(v) : "—"}
          onSave={v => saveField(r.nom, "ebitda", v)}
          disabled={!isSuperuser} />
      </td>
      <td style={{ ...tdBase, color:TC.textMid, fontSize:10, whiteSpace:"nowrap" }}>
        <EditableCell value={r.dataCompr} type="text"
          onSave={v => saveField(r.nom, "dataCompr", v)}
          disabled={!isSuperuser}
          fmt={v => fmtDate(v)} />
      </td>
      <td style={{ ...tdBase, textAlign:"center" }}>
        {r.mesosOperant != null
          ? <span style={{ background:"#E8F8E8", color:TC.green, borderRadius:20, padding:"1px 7px", fontWeight:700, fontSize:10 }}>{r.mesosOperant}</span>
          : <span style={{color:TC.textLight}}>—</span>
        }
      </td>
      {isSuperuser && (
        <td style={{ padding: "4px 8px", textAlign: "center" }}>
          <DeleteRowButton onDelete={() => handleDelete(r.id, r.nom)} />
        </td>
      )}
    </tr>
  );
}
