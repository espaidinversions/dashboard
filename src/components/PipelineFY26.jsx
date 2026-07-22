import { useState, useMemo, useEffect } from "react";
import ReactECharts from "../ReactECharts.jsx";
import { ecTheme } from "../echartsTheme.js";
import { fmtM, usePersistedState, readStoredJSON } from "../utils.js";
import { downloadSingleSheetXlsx } from "../utils/xlsx.js";
import { useTheme } from "../theme.js";
import { STATUS_CFG, CANAL_CFG, GCOL, SCOL, SECCOL, STCOL, CCOL, SBADGE, GBADGE, PIPELINE_STATUS_OPTIONS, PIPELINE_CANAL_OPTIONS } from "../config.js";
import { EmptyState, EditableCell, SectionHeader, tableCardStyle } from "./SharedComponents.jsx";
import { useAuth } from "../auth.jsx";
import { insertPipelineDeal, deletePipelineDeal, upsertPipelineDeal, loadPipelineDeals } from "../db.js";
import { useToast } from "../toast.jsx";
import { useCurrency } from "./hooks/useCurrency.js";
import { normalizeCapitalCallStrategy } from "../data/capitalCallStrategyModel.js";

const MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function genMonthOpts(months = 36) {
  const now = new Date();
  const opts = [""];
  for (let i = 0; i < months; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    opts.push(`${MON[d.getMonth()]} ${d.getFullYear()}`);
  }
  return opts;
}
const MONTHS_OPTS = genMonthOpts(36);

function normalizePipelineStrategy(value) {
  // Reuse the canonical strategy normalizer, but map to the pipeline's labels.
  const canonical = normalizeCapitalCallStrategy(value, "PE", null);
  if (canonical === "Fons Primari") return "Fons primari";
  if (canonical === "Fons Secundari") return "Fons secundaris";
  if (canonical === "Fons de Fons") return "Fons de fons";
  if (canonical === "Fons de Coinversió") return "Coinversions";
  return String(value ?? "").trim() || "";
}

// ══════════════════════════════════════════════════════════
export function PipelineFY26({ initialFunds = [], eurUsd = null, onDealsChange, chartsOnly = false }) {
  const { toEUR, toUSD } = useCurrency(eurUsd);
  const { tc: TC, dark } = useTheme();
  const { canEditSection } = useAuth();
  const canEdit = canEditSection("fons");
  const { toast } = useToast();
  const [funds,setFunds]   = useState(() => (initialFunds ?? []).map((d) => ({ ...d, strategy: normalizePipelineStrategy(d.strategy) })));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadPipelineDeals().then(data => {
      if (cancelled) return;
      if (data) {
        const normalized = data.map((d) => ({ ...d, strategy: normalizePipelineStrategy(d.strategy) }));
        setFunds(normalized);
        onDealsChange?.(normalized);
      }
      setLoading(false);
    }).catch(error => {
      if (cancelled) return;
      console.error("loadPipelineDeals failed:", error);
      toast("No s'han pogut carregar els fons del pipeline.", "error");
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const setFundsAndSync = (updater) => {
    setFunds(prev => {
      const rawNext = typeof updater === "function" ? updater(prev) : updater;
      const next = (rawNext ?? []).map((d) => ({ ...d, strategy: normalizePipelineStrategy(d.strategy) }));
      onDealsChange?.(next);
      return next;
    });
  };

  const [cur,setCur]       = usePersistedState("pl_cur", "EUR");
  const [nf,setNf]         = useState({name:"",amount:"",currency:"EUR",geography:"EU",strategy:"Fons primari",sector:"Software",status:"En estudi",canal:"Arcano",manager:"",estimatedClosing:""});
  const [form,setForm]     = useState(false);
  const [fGeo,setFGeo]     = usePersistedState("pl_fGeo",  "Tots");
  const [fStr,setFStr]     = usePersistedState("pl_fStr",  "Tots");
  const [fStat,setFStat]   = usePersistedState("pl_fStat", "Tots");
  const [fCanal,setFCanal] = usePersistedState("pl_fCanal","Tots");
  const [fSec,setFSec]     = usePersistedState("pl_fSec",  "Tots");
  const [chartF,setChartF] = useState(null);
  const [sk,setSk]         = usePersistedState("pl_sk", "name");
  const [sd,setSd]         = usePersistedState("pl_sd", "asc");

  const cv  = (a,c) => cur==="EUR"?toEUR(a,c):toUSD(a,c);
  const sym = cur==="EUR"?"€":"$";
  const active = useMemo(()=>funds.filter(f=>f.active),[funds]);
  const amt = f => f.amount || 0.33;
  const total  = useMemo(()=>active.reduce((s,f)=>s+cv(amt(f),f.currency),0),[active,cur,funds]);

  const agg = (fn,src) => {
    const m={};
    src.forEach(f=>{const k=fn(f);m[k]=(m[k]||0)+toEUR(amt(f),f.currency);});
    return Object.entries(m).map(([name,value])=>({name,value:+value.toFixed(2)}));
  };
  const byGeo  = useMemo(()=>agg(f=>f.geography,              funds.filter(f=>f.active)),[funds, toEUR]);
  const byStr  = useMemo(()=>agg(f=>f.strategy,               funds.filter(f=>f.active)),[funds, toEUR]);
  const bySec  = useMemo(()=>agg(f=>(f.sector ?? "").split(" / ")[0], funds.filter(f=>f.active)),[funds, toEUR]);
  const byStat = useMemo(()=>agg(f=>f.status,                 funds.filter(f=>f.active)),[funds, toEUR]);
  const byCanal= useMemo(()=>agg(f=>f.canal,                  funds.filter(f=>f.active)),[funds, toEUR]);

  const gOpts = ["Tots",...new Set(funds.map(f=>f.geography))];
  const sOpts = ["Tots",...new Set(funds.map(f=>f.strategy))];

  const getLS = key => readStoredJSON(`copts_${key}`, []);

  const BASE_SECTORS = ["Software","Generalista","B2B Services","Healthcare","Software / B2B"];

  const sectorOptions = useMemo(() => {
    const fromFunds = funds.map(f => f.sector).filter(Boolean);
    return Array.from(new Set([...BASE_SECTORS, ...fromFunds, ...getLS("p_sector")])).sort();
  }, [funds]);

  const canalOptions = useMemo(() => {
    const fromFunds = funds.map(f => f.canal).filter(Boolean);
    return Array.from(new Set([...PIPELINE_CANAL_OPTIONS, ...fromFunds, ...getLS("p_canal")])).sort();
  }, [funds]);

  const statusOptions = useMemo(() => {
    const fromFunds = funds.map(f => f.status).filter(Boolean);
    return Array.from(new Set([...PIPELINE_STATUS_OPTIONS, ...fromFunds, ...getLS("p_status")])).sort();
  }, [funds]);

  const filtered = useMemo(()=>{
    let l=[...funds];
    if(chartF){
      if(chartF.type==="geo")    l=l.filter(f=>f.geography===chartF.value);
      if(chartF.type==="str")    l=l.filter(f=>f.strategy===chartF.value);
      if(chartF.type==="sec")    l=l.filter(f=>(f.sector ?? "").split(" / ")[0]===chartF.value);
      if(chartF.type==="status") l=l.filter(f=>f.status===chartF.value);
      if(chartF.type==="canal")  l=l.filter(f=>f.canal===chartF.value);
    }
    if(fGeo!=="Tots")  l=l.filter(f=>f.geography===fGeo);
    if(fStr!=="Tots")  l=l.filter(f=>f.strategy===fStr);
    if(fStat!=="Tots") l=l.filter(f=>f.status===fStat);
    if(fCanal!=="Tots")l=l.filter(f=>f.canal===fCanal);
    if(fSec!=="Tots")  l=l.filter(f=>f.sector===fSec);
    l.sort((a,b)=>{
      let va=sk==="commitment"?toEUR(a.amount,a.currency):a[sk]??""
      let vb=sk==="commitment"?toEUR(b.amount,b.currency):b[sk]??""
      if(typeof va==="string")return sd==="asc"?String(va).localeCompare(String(vb)):String(vb).localeCompare(String(va));
      return sd==="asc"?va-vb:vb-va;
    });
    return l;
  },[funds,chartF,fGeo,fStr,fStat,fCanal,fSec,sk,sd]);

  const clickChart = (type,name) => setChartF(prev=>prev&&prev.type===type&&prev.value===name?null:{type,value:name});
  const isHl = (type,name) => !chartF||(chartF.type===type&&chartF.value===name);
  const sort=(k)=>{if(sk===k)setSd(d=>d==="asc"?"desc":"asc");else{setSk(k);setSd("asc");}};
  const Arr=({k})=><span style={{marginLeft:3,opacity:sk===k?1:0.2,fontSize:9}}>{sk===k&&sd==="desc"?"▼":"▲"}</span>;
  const del = async (id, name) => {
    const { error } = await deletePipelineDeal(id, name);
    if (error) { toast({ message: "Error eliminant deal: " + error.message, type: "error" }); return; }
    setFundsAndSync(p => p.filter(f => f.id !== id));
    toast({ message: "Deal eliminat." });
  };

  const upd = async (id, field, val) => {
    const normalizedVal = field === "strategy" ? normalizePipelineStrategy(val) : val;
    let updatedDeal = null;
    setFundsAndSync(p => {
      const next = p.map(f => {
        if (f.id !== id) return f;
        updatedDeal = { ...f, [field]: normalizedVal };
        return updatedDeal;
      });
      return next;
    });
    if (updatedDeal) {
      const { error } = await upsertPipelineDeal(updatedDeal);
      if (error) toast({ message: "Error desant deal: " + error.message, type: "error" });
    }
  };

  const add = async (nf) => {
    const deal = {
      name: nf.name, amount: parseFloat(nf.amount) || 0,
      currency: nf.currency, geography: nf.geography,
      strategy: normalizePipelineStrategy(nf.strategy), sector: nf.sector,
      status: nf.status, canal: nf.canal,
      manager: nf.manager || null,
      active: true, estimatedClosing: nf.estimatedClosing ?? null,
    };
    const inserted = await insertPipelineDeal(deal);
    if (!inserted) { toast({ message: "Error en crear el deal", type: "error" }); return; }
    setFundsAndSync(p => [inserted, ...p]);
  };

  const inp2={border:`1px solid ${TC.border}`,borderRadius:4,padding:"7px 10px",fontSize:13,color:TC.text,background:TC.card,width:"100%",boxSizing:"border-box",outline:"none",fontFamily:"inherit"};
  const th2={padding:"9px 14px",fontSize:10,fontWeight:700,color:TC.navyLight??TC.textLight,textTransform:"uppercase",letterSpacing:"0.06em",background:"#F7FAFC",borderBottom:`2px solid ${TC.border}`,whiteSpace:"nowrap",userSelect:"none",cursor:"pointer",textAlign:"left"};

  const kpis=[
    {label:"Compromís Total",   value:`${sym}${total.toFixed(1)}M`, sub:`${active.length} fons actius`, accent:TC.navy},
    {label:"Europa (EU)",       value:`${sym}${cv(byGeo.find(g=>g.name==="EU")?.value||0,"EUR").toFixed(1)}M`, sub:`${active.filter(f=>f.geography==="EU").length} fons`, accent:TC.green},
    {label:"Estats Units (US)", value:`${sym}${cv(byGeo.find(g=>g.name==="US")?.value||0,"EUR").toFixed(1)}M`, sub:`${active.filter(f=>f.geography==="US").length} fons`, accent:TC.navy},
    {label:"Global (EU/US)",    value:`${sym}${cv(byGeo.find(g=>g.name==="EU/US")?.value||0,"EUR").toFixed(1)}M`, sub:`${active.filter(f=>f.geography==="EU/US").length} fons`, accent:TC.navyLight},
  ];

  const greenBadgeBg = dark ? "#0A2010" : "#E8F8E8";
  const t = ecTheme(TC);
  const CPie = ({data,colors,type,title}) => (
    <div style={{background:TC.card,border:`1.5px solid ${chartF?.type===type?TC.green:TC.border}`,borderRadius:10,padding:"14px 16px",boxShadow:"0 2px 8px rgba(0,0,0,.08)",transition:"border-color 0.2s"}}>
      <div style={{fontSize:10,letterSpacing:"0.13em",color:TC.textLight,textTransform:"uppercase",marginBottom:8,fontWeight:600,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        {title}{!chartsOnly && <span style={{fontSize:9,color:TC.green,background:greenBadgeBg,padding:"1px 6px",borderRadius:4}}>clicable</span>}
      </div>
      <ReactECharts
        style={{ width: "100%", height: 165 }}
        opts={{ renderer: "canvas" }}
        onEvents={chartsOnly ? undefined : { click: params => params?.name && clickChart(type, params.name) }}
        option={{
          tooltip: {
            ...t.tooltip,
            trigger: "item",
            formatter: p => `<b>${p.name}</b><br/>${fmtM(p.value)} · ${p.percent.toFixed(1)}%`,
          },
          legend: { show: false },
          graphic: [{
            type: "group",
            left: "center",
            top: "middle",
            children: [
              { type: "text", style: { text: fmtM(data.reduce((s, r) => s + r.value, 0)), x: 0, y: -7, textAlign: "center", fill: TC.navy, fontSize: 12, fontWeight: 700, fontFamily: "'DM Mono',monospace" } },
              { type: "text", style: { text: "Total", x: 0, y: 9, textAlign: "center", fill: TC.textLight, fontSize: 9 } },
            ],
          }],
          series: [{
            type: "pie",
            radius: ["46%", "72%"],
            center: ["50%", "50%"],
            labelLine: { show: false },
            label: {
              show: true,
              formatter: p => (p.percent >= 6 ? `${p.name} ${p.percent.toFixed(0)}%` : ""),
              color: TC.textMid,
              fontSize: 10,
            },
            data: data.map(e => ({
              name: e.name,
              value: e.value,
              itemStyle: {
                color: colors[e.name] || TC.navyLight,
                opacity: isHl(type, e.name) ? 1 : 0.3,
                borderColor: chartF?.type === type && chartF?.value === e.name ? "#fff" : "transparent",
                borderWidth: 2,
              },
            })),
          }],
        }}
      />
    </div>
  );

  const exportExcel = async () => {
    await downloadSingleSheetXlsx({
      sheetName: "Pipeline FY26",
      filename: `Pipeline_FY26_${new Date().toISOString().slice(0,10)}.xlsx`,
      columns: [
        { header: "Nom",              key: "nom",       width: 28 },
        { header: "Gestor",           key: "gestor",    width: 20 },
        { header: "Compromís (orig)", key: "compOrig",  width: 14 },
        { header: "Moneda",           key: "moneda",    width: 9  },
        { header: "Compromís (€M)",   key: "compEur",   width: 15 },
        { header: "Compromís ($M)",   key: "compUsd",   width: 15 },
        { header: "Geografia",        key: "geo",       width: 10 },
        { header: "Estratègia",       key: "estrategia",width: 18 },
        { header: "Sector",           key: "sector",    width: 18 },
        { header: "Status",           key: "status",    width: 14 },
        { header: "Canal",            key: "canal",     width: 18 },
        { header: "Tancament Est.",   key: "tancament", width: 16 },
      ],
      rows: funds.map((f) => ({
        nom:        f.name,
        gestor:     f.manager || "",
        compOrig:   f.amount,
        moneda:     f.currency,
        compEur:    +toEUR(amt(f), f.currency).toFixed(3),
        compUsd:    +toUSD(amt(f), f.currency).toFixed(3),
        geo:        f.geography,
        estrategia: f.strategy,
        sector:     f.sector,
        status:     f.status,
        canal:      f.canal,
        tancament:  f.estimatedClosing || "",
      })),
    });
  };

  return (
    <div>
      {/* In the Resum sub-tab these prospective figures sit right above the
          actual-performance matrix, so they need a label of their own. Styled as
          the site's uppercase micro-label (see TxSection chart headers), not a
          bordered SectionHeader — those live inside cards. */}
      {chartsOnly && (
        <div style={{ fontSize: 11, letterSpacing: "0.13em", color: TC.textLight, textTransform: "uppercase", fontWeight: 600, marginBottom: 10 }}>
          Pipeline FY26
        </div>
      )}
      <div className="grid-4" style={{gap:14,marginBottom:18}}>
        {kpis.map((k,i)=>(
          <div key={i} style={{background:TC.card,border:`1px solid ${TC.border}`,borderRadius:10,padding:"16px 18px",borderTop:`4px solid ${k.accent}`,boxShadow:"0 2px 8px rgba(0,0,0,.08)"}}>
            <div style={{fontSize:10,letterSpacing:"0.15em",color:TC.textLight,textTransform:"uppercase",marginBottom:6}}>{k.label}</div>
            <div style={{fontSize:25,fontWeight:700,color:k.accent,marginBottom:2}}>{k.value}</div>
            <div style={{fontSize:12,color:TC.textLight}}>{k.sub}</div>
          </div>
        ))}
      </div>

      {chartF&&(
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14,background:TC.card,border:`1.5px solid ${TC.green}`,borderRadius:10,padding:"9px 16px"}}>
          <span style={{fontSize:13,color:TC.navy,fontWeight:600}}>🔍 Filtre actiu:</span>
          <span style={{fontSize:13,color:TC.green,fontWeight:700,background:greenBadgeBg,padding:"2px 10px",borderRadius:4}}>{chartF.value}</span>
          <button onClick={()=>setChartF(null)} style={{marginLeft:"auto",background:"transparent",border:`1px solid ${TC.border}`,color:TC.textMid,borderRadius:4,padding:"3px 10px",cursor:"pointer",fontSize:12,fontFamily:"inherit"}}>✕ Treure filtre</button>
        </div>
      )}

      <div className="grid-3" style={{gap:14,marginBottom:14}}>
        <CPie data={byGeo}  colors={GCOL}  type="geo"    title="Per Geografia"/>
        <CPie data={byStr}  colors={SCOL}  type="str"    title="Per Estratègia"/>
        <CPie data={byStat} colors={STCOL} type="status" title="Per Status"/>
      </div>
      <div className="grid-2" style={{gap:14,marginBottom:18}}>
        <CPie data={byCanal} colors={CCOL} type="canal" title="Per Canal"/>
        <div style={{background:TC.card,border:`1.5px solid ${chartF?.type==="sec"?TC.green:TC.border}`,borderRadius:10,padding:"14px 16px",boxShadow:"0 2px 8px rgba(0,0,0,.08)"}}>
          <div style={{fontSize:10,letterSpacing:"0.13em",color:TC.textLight,textTransform:"uppercase",marginBottom:8,fontWeight:600,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            Per Sector{!chartsOnly && <span style={{fontSize:9,color:TC.green,background:greenBadgeBg,padding:"1px 6px",borderRadius:4}}>clicable</span>}
          </div>
          <ReactECharts
            style={{ width: "100%", height: 165 }}
            opts={{ renderer: "canvas" }}
            onEvents={chartsOnly ? undefined : { click: params => params?.name && clickChart("sec", params.name) }}
            option={{
              grid: { top: 8, right: 14, bottom: 8, left: 0, containLabel: true },
              tooltip: {
                ...t.tooltip,
                trigger: "axis",
                axisPointer: { type: "shadow" },
                formatter: params => {
                  const p = params?.[0];
                  if (!p) return "";
                  return `<b>${p.name}</b><br/>${fmtM(p.value)}`;
                },
              },
              xAxis: {
                type: "value",
                axisLabel: { ...t.axisLabel, fontSize: 10 },
                splitLine: { show: false },
                axisLine: t.axisLine,
                axisTick: t.axisTick,
              },
              yAxis: {
                type: "category",
                data: bySec.map(d => d.name),
                axisLabel: { ...t.axisLabel, fontSize: 10 },
                axisLine: t.axisLine,
                axisTick: t.axisTick,
              },
              series: [{
                type: "bar",
                data: bySec.map(d => ({
                  value: d.value,
                  itemStyle: { color: SECCOL[d.name] || TC.navy, opacity: isHl("sec", d.name) ? 1 : 0.3, borderRadius: [0, 4, 4, 0] },
                })),
                barMaxWidth: 22,
              }],
            }}
          />
        </div>
      </div>

      {!chartsOnly && (<>
      {/* Taula pipeline */}
      <div style={{ ...tableCardStyle(TC), overflowX: "auto" }}>
        <SectionHeader title="Pipeline de Fons" tc={TC} action={
          <div style={{display:"flex",gap:7,alignItems:"center",flexWrap:"wrap"}}>
            {[
              {label:"Geo",    val:fGeo,   set:setFGeo,   opts:gOpts},
              {label:"Estrat.",val:fStr,   set:setFStr,   opts:sOpts},
              {label:"Sector", val:fSec,   set:setFSec,   opts:["Tots",...sectorOptions]},
              {label:"Status", val:fStat,  set:setFStat,  opts:["Tots",...statusOptions]},
              {label:"Canal",  val:fCanal, set:setFCanal, opts:["Tots",...canalOptions]},
            ].map(f=>(
              <div key={f.label} style={{display:"flex",alignItems:"center",gap:3}}>
                <span style={{fontSize:11,color:TC.textLight}}>{f.label}:</span>
                <select value={f.val} onChange={e=>f.set(e.target.value)} style={{...inp2,width:"auto",padding:"4px 7px",fontSize:12,background:TC.bgAlt,color:TC.navy,border:`1px solid ${TC.border}`}}>
                  {f.opts.map(o=><option key={o}>{o}</option>)}
                </select>
              </div>
            ))}
            <button onClick={exportExcel} style={{background:"transparent",border:`1.5px solid ${TC.border}`,color:TC.textMid,borderRadius:4,padding:"6px 13px",cursor:"pointer",fontSize:12,fontWeight:600,fontFamily:"inherit"}}>↓ Excel</button>
            {canEdit && <button onClick={()=>setForm(!form)} style={{background:TC.green,border:"none",color:"#fff",borderRadius:4,padding:"6px 13px",cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:"inherit"}}>+ Afegir Fons</button>}
          </div>
        } />
        {form&& canEdit &&(
          <div style={{background:TC.bgAlt,border:`1px solid ${TC.border}`,borderRadius:10,padding:"12px",marginBottom:12}}>
            <div style={{display:"grid",gridTemplateColumns:"2fr 1.5fr 1fr 1fr 1fr 1fr 1.5fr 1fr 1fr 1fr auto",gap:7,alignItems:"end"}}>
              {[
                {label:"Nom",key:"name",type:"input"},
                {label:"Gestor",key:"manager",type:"input"},
                {label:"M€/$",key:"amount",type:"input",it:"number"},
                {label:"Moneda",key:"currency",type:"sel",opts:["EUR","USD"]},
                {label:"Geo",key:"geography",type:"sel",opts:["EU","US","EU/US"]},
                {label:"Estratègia",key:"strategy",type:"sel",opts:["Fons primari","Coinversions","Fons secundaris","Fons de fons"]},
                {label:"Sector",key:"sector",type:"sel",opts:sectorOptions},
                {label:"Status",key:"status",type:"sel",opts:statusOptions},
                {label:"Canal",key:"canal",type:"sel",opts:canalOptions},
                {label:"Tancament Est.",key:"estimatedClosing",type:"sel",opts:MONTHS_OPTS},
              ].map(f=>(
                <div key={f.key}>
                  <div style={{fontSize:10,color:TC.textLight,marginBottom:3,fontWeight:600}}>{f.label}</div>
                  {f.type==="input"
                    ?<input type={f.it||"text"} value={nf[f.key]} onChange={e=>setNf(p=>({...p,[f.key]:e.target.value}))} style={inp2}/>
                    :<select value={nf[f.key]} onChange={e=>setNf(p=>({...p,[f.key]:e.target.value}))} style={inp2}>{f.opts.map(o=><option key={o} value={o}>{o||"— sense data"}</option>)}</select>
                  }
                </div>
              ))}
              <div>
                <div style={{fontSize:10,color:"transparent",marginBottom:3}}>·</div>
                <button onClick={async ()=>{
                  if(!nf.name||!nf.amount)return;
                  await add(nf);
                  setNf({name:"",amount:"",currency:"EUR",geography:"EU",strategy:"Fons primari",sector:"Software",status:"En estudi",canal:"Arcano",manager:"",estimatedClosing:""});
                  setForm(false);
                }} style={{background:TC.navy,border:"none",color:"#fff",borderRadius:4,padding:"8px 12px",cursor:"pointer",fontSize:14,fontWeight:700,width:"100%",fontFamily:"inherit"}}>✓</button>
              </div>
            </div>
          </div>
        )}
        {loading && <div style={{padding:"32px",textAlign:"center",color:TC.textLight,fontSize:13}}>Carregant pipeline…</div>}
        <div style={{overflowX:"auto",display:loading?"none":"block"}}>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead>
              <tr style={{background:TC.bgAlt}}>
                <th style={th2} onClick={()=>sort("name")}>Fons <Arr k="name"/></th>
                <th style={th2} onClick={()=>sort("manager")}>Gestor <Arr k="manager"/></th>
                <th style={th2} onClick={()=>sort("commitment")}>Compromís <Arr k="commitment"/></th>
                <th style={th2} onClick={()=>sort("geography")}>Geo <Arr k="geography"/></th>
                <th style={th2} onClick={()=>sort("strategy")}>Estratègia <Arr k="strategy"/></th>
                <th style={th2} onClick={()=>sort("sector")}>Sector <Arr k="sector"/></th>
                <th style={th2} onClick={()=>sort("status")}>Status <Arr k="status"/></th>
                <th style={th2} onClick={()=>sort("canal")}>Canal <Arr k="canal"/></th>
                <th style={{...th2,cursor:"pointer"}} onClick={()=>sort("estimatedClosing")}>Tancament Est. <Arr k="estimatedClosing"/></th>
                <th style={{...th2,width:26,cursor:"default"}}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length===0 && <tr><td colSpan={10}><EmptyState/></td></tr>}
              {filtered.map((f,i)=>(
                <tr key={f.id} style={{borderBottom:`1px solid ${TC.bgAlt}`,background:i%2===0?TC.card:TC.bgAlt}}>
                  <td style={{padding:"9px 10px",fontWeight:600,color:TC.text,whiteSpace:"nowrap"}}>
                    {canEdit ? (
                      <EditableCell
                        value={f.name}
                        onSave={v => upd(f.id, "name", v)}
                        style={{ minWidth: 160, whiteSpace: "nowrap" }}
                      />
                    ) : f.name}
                  </td>
                  <td style={{padding:"9px 10px",fontSize:12,color:TC.textMid,whiteSpace:"nowrap"}}>
                    {canEdit ? <EditableCell value={f.manager||""} emptyDisplay="—" onSave={v=>upd(f.id,"manager",v||null)}/> : <span style={{color:f.manager?TC.text:TC.textLight}}>{f.manager||"—"}</span>}
                  </td>
                  <td style={{padding:"9px 10px",fontFamily:"monospace",fontWeight:700,color:TC.navy,whiteSpace:"nowrap"}}>
                    {cur==="EUR"?`€${(toEUR(f.amount,f.currency)??0).toFixed(2)}M`:`$${(toUSD(f.amount,f.currency)??0).toFixed(2)}M`}
                    <span style={{fontSize:10,color:TC.textLight,marginLeft:4,fontFamily:"inherit",fontWeight:400}}>({f.currency==="EUR"?"€":"$"}{f.amount}M)</span>
                  </td>
                  <td style={{padding:"9px 10px"}}><span style={{fontSize:11,background:GBADGE[f.geography]?.bg||TC.bgAlt,color:GBADGE[f.geography]?.color||TC.navy,borderRadius:4,padding:"2px 7px",fontWeight:700}}>{f.geography}</span></td>
                  <td style={{padding:"9px 10px"}}><span style={{fontSize:11,background:SBADGE[f.strategy]?.bg||TC.bgAlt,color:SBADGE[f.strategy]?.color||TC.navy,borderRadius:4,padding:"2px 7px",fontWeight:600}}>{f.strategy}</span></td>
                  <td style={{padding:"9px 10px"}}>
                    {canEdit
                      ? <EditableCell value={f.sector} options={sectorOptions} allowCustom optionsKey="p_sector" onSave={v=>upd(f.id,"sector",v)}/>
                      : <span style={{fontSize:11,background:SECCOL[f.sector]?`${SECCOL[f.sector]}22`:TC.bgAlt,color:SECCOL[f.sector]||TC.navy,borderRadius:4,padding:"2px 7px",fontWeight:600,display:"inline-block"}}>{f.sector}</span>
                    }
                  </td>
                  <td style={{padding:"9px 10px"}}>{canEdit ? <EditableCell value={f.status} options={PIPELINE_STATUS_OPTIONS} allowCustom optionsKey="p_status" badgeCfg={STATUS_CFG} onSave={v=>upd(f.id,"status",v)}/> : <span style={{display:"block"}}>{f.status}</span>}</td>
                  <td style={{padding:"9px 10px"}}>{canEdit ? <EditableCell value={f.canal} options={PIPELINE_CANAL_OPTIONS} allowCustom optionsKey="p_canal" badgeCfg={CANAL_CFG} onSave={v=>upd(f.id,"canal",v)}/> : <span style={{display:"block"}}>{f.canal}</span>}</td>
                  <td style={{padding:"9px 10px"}}>{canEdit ? <EditableCell value={f.estimatedClosing} options={MONTHS_OPTS} emptyDisplay="— sense data" onSave={v=>upd(f.id,"estimatedClosing",v)}/> : <span>{f.estimatedClosing||""}</span>}</td>
                  <td style={{padding:"9px 10px"}}>
                    {canEdit && <button onClick={()=>del(f.id, f.name)} style={{background:"transparent",border:"none",color:TC.border,cursor:"pointer",fontSize:16,padding:0,lineHeight:1}}
                      onMouseEnter={e=>e.target.style.color="#C0392B"} onMouseLeave={e=>e.target.style.color=TC.border}>×</button>}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{borderTop:`2px solid ${TC.border}`,background:TC.bgAlt}}>
                <td colSpan={2} style={{padding:"8px 10px",fontSize:12,color:TC.textLight}}>{filtered.length} mostrats</td>
                <td style={{padding:"8px 10px",fontSize:14,fontWeight:700,color:TC.navy}}>
                  {sym}{filtered.reduce((s,f)=>s+cv(f.amount??0,f.currency),0).toFixed(2)}M
                </td>
                <td colSpan={7}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
      {/* Switch moneda */}
      <div style={{display:"flex",justifyContent:"flex-end",marginTop:10,gap:6}}>
        <span style={{fontSize:11,color:TC.textLight,alignSelf:"center"}}>Moneda:</span>
        {["EUR","USD"].map(c=>(
          <button key={c} onClick={()=>setCur(c)} style={{background:cur===c?TC.navy:"transparent",border:`1.5px solid ${TC.navy}`,color:cur===c?"#fff":TC.navy,borderRadius:4,padding:"4px 13px",cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:"inherit"}}>{c}</button>
        ))}
      </div>
      </>)}
    </div>
  );
}


// ══════════════════════════════════════════════════════════
// SELECTOR MULTI-MES
// ══════════════════════════════════════════════════════════
