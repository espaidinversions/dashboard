import React, { useState, useMemo } from "react";
import ReactECharts from "../ReactECharts.jsx";
import { ecTheme } from "../echartsTheme.js";
import { useTheme } from "../theme.js";
import { VCPE_CFG } from "../config.js";
import { fmtM, fmtS } from "../utils.js";

export function MensualTab({filtered, fFy}) {
  const { tc: TC, dark } = useTheme();
  const [expanded,    setExpanded]    = useState(new Set()); // mesos oberts
  const [expandedTx,  setExpandedTx]  = useState(new Set()); // fons oberts per tx

  const MESOS_LOC = ["","Gen","Feb","Mar","Abr","Mai","Jun","Jul","Ago","Set","Oct","Nov","Des"];

  const th = {padding:"9px 10px",fontSize:10,letterSpacing:"0.09em",color:TC.textLight,
    textTransform:"uppercase",fontWeight:600,textAlign:"left",
    borderBottom:`2px solid ${TC.border}`,whiteSpace:"nowrap",userSelect:"none"};

  // Theme-aware row colors
  const greenRow1 = dark ? "#0E2412" : "#F0F8F0";   // expanded month row bg
  const greenRow2 = dark ? "#091C0B" : "#E8F8E8";   // expanded fund row alt
  const greenRow3 = dark ? "#071A08" : "#F4FBF4";   // expanded fund row main
  const greenRow4 = dark ? "#133218" : "#E0F2E0";   // total row
  const greenRow5 = dark ? "#091C0B" : "#F0FBF0";   // tx table bg
  const greenRow6 = dark ? "#071A08" : "#E0F2E0";   // tx table header
  const greenRow7 = dark ? "#0A1E0C" : "#E8F8E8";   // expanded header
  const rowMain   = dark ? TC.card    : "#fff";
  const rowAlt    = dark ? TC.bgAlt   : "#FAFBFC";

  // Construir dades per mes i per fons dins de cada mes
  const { byMes, fonsByMes } = useMemo(() => {
    const src = fFy !== "Tots" ? filtered : filtered.filter(r => r.any >= 2023);
    const mesMap = {};
    src.forEach(r => {
      const key = `${r.any}-${String(r.mes).padStart(2,"0")}`;
      if (!mesMap[key]) mesMap[key] = {
        key, label:`${MESOS_LOC[r.mes]} ${r.any}`,
        calls:0, dist:0, retorn:0, txs:[]
      };
      if (r.cat==="Capital Call")   mesMap[key].calls  += r.eur;
      if (r.cat==="Distribució")    mesMap[key].dist   += Math.abs(r.eur);
      if (r.cat==="Retorn Capital") mesMap[key].retorn += Math.abs(r.eur);
      mesMap[key].txs.push(r);
    });

    // Per cada mes, agrupar per fons
    const fonsMap = {};
    Object.keys(mesMap).forEach(key => {
      const fm = {};
      mesMap[key].txs.forEach(r => {
        if (!fm[r.fons]) fm[r.fons] = {fons:r.fons, vcpe:r.vcpe, est:r.est, calls:0, dist:0, retorn:0, txs:[]};
        if (r.cat==="Capital Call")   fm[r.fons].calls  += r.eur;
        if (r.cat==="Distribució")    fm[r.fons].dist   += Math.abs(r.eur);
        if (r.cat==="Retorn Capital") fm[r.fons].retorn += Math.abs(r.eur);
        fm[r.fons].txs.push(r);
      });
      fonsMap[key] = Object.values(fm).sort((a,b) => b.calls - a.calls || b.dist - a.dist);
    });

    const sorted = Object.values(mesMap).sort((a,b) => b.key.localeCompare(a.key));
    return { byMes: sorted, fonsByMes: fonsMap };
  }, [filtered, fFy]);

  const toggleMes   = key => setExpanded(p  => { const n=new Set(p); n.has(key)?n.delete(key):n.add(key); return n; });
  const toggleFonsTx = key => setExpandedTx(p => { const n=new Set(p); n.has(key)?n.delete(key):n.add(key); return n; });

  const CAT_CFG_LOCAL = {
    "Capital Call":   { color:TC.navy,      bg: dark ? "#112030" : "#E6EDF3" },
    "Distribució":    { color:TC.green,     bg: dark ? "#0A2010" : "#E8F8E8" },
    "Retorn Capital": { color:TC.greenDark, bg: dark ? "#0A2010" : "#D6EAD6" },
    "Altres":         { color:TC.textLight, bg: TC.bgAlt },
  };

  const vcpeBg = (vcpe) => dark ? (vcpe==="PE"?"#112030":vcpe==="VC"?"#0A2010":"#20163A") : (VCPE_CFG[vcpe]?.bg||TC.bgAlt);

  // Dades per al gràfic de barres
  const chartData = useMemo(() => {
    return [...byMes].sort((a,b)=>a.key.localeCompare(b.key)).map(m=>({
      label: m.label,
      "Capital Call": +m.calls.toFixed(0),
      "Distribució":  +m.dist.toFixed(0),
      "Retorn Capital": +m.retorn.toFixed(0),
    }));
  }, [byMes]);

  return (<>
    {/* ── Gràfic de barres mensual ── */}
    <div style={{background:TC.card,border:`1px solid ${TC.border}`,borderRadius:10,
      padding:"18px 20px",marginBottom:16,boxShadow:"0 2px 8px rgba(0,0,0,.08)"}}>
      <div style={{fontSize:11,letterSpacing:"0.13em",color:TC.textLight,textTransform:"uppercase",marginBottom:14,fontWeight:600}}>
        Flux Mensual {fFy!=="Tots"?fFy:"· 2023–2026"}
      </div>
      {(() => {
        const t = ecTheme(TC);
        const option = {
          grid: { top: 8, right: 8, bottom: 60, left: 0, containLabel: true },
          tooltip: { ...t.tooltip, trigger: "axis", axisPointer: { type: "shadow" } },
          legend: { bottom: 0, textStyle: { fontSize: 10, color: TC.textLight } },
          xAxis: {
            type: "category",
            data: chartData.map(d => d.label),
            axisLabel: { ...t.axisLabel, rotate: -40, interval: 0 },
            axisLine: t.axisLine,
            axisTick: t.axisTick,
          },
          yAxis: {
            type: "value",
            axisLabel: { ...t.axisLabel, formatter: v => fmtM(v) },
            splitLine: t.splitLine,
            axisLine: t.axisLine,
            axisTick: t.axisTick,
          },
          series: [
            { name: "Capital Call",   type: "bar", data: chartData.map(d => d["Capital Call"]),   itemStyle: { color: TC.navy,      borderRadius: [4,4,0,0] }, barMaxWidth: 32 },
            { name: "Distribució",    type: "bar", data: chartData.map(d => d["Distribució"]),    itemStyle: { color: TC.green,     borderRadius: [4,4,0,0] }, barMaxWidth: 32 },
            { name: "Retorn Capital", type: "bar", data: chartData.map(d => d["Retorn Capital"]), itemStyle: { color: TC.greenDark, borderRadius: [4,4,0,0] }, barMaxWidth: 32 },
          ],
        };
        return <ReactECharts option={option} style={{ width: "100%", height: 280 }} opts={{ renderer: "canvas" }} />;
      })()}
    </div>

    {/* ── Taula accordion ── */}
    <div style={{background:TC.card,border:`1px solid ${TC.border}`,borderRadius:10,
      padding:"18px",boxShadow:"0 2px 8px rgba(0,0,0,.08)"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <div style={{fontSize:11,letterSpacing:"0.13em",color:TC.textLight,textTransform:"uppercase",fontWeight:600}}>
          Detall per Mes › Fons › Transaccions
        </div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>setExpanded(new Set(byMes.map(m=>m.key)))}
            style={{background:TC.bgAlt,border:`1px solid ${TC.border}`,borderRadius:5,
              padding:"4px 12px",cursor:"pointer",fontSize:11,color:TC.textMid,fontFamily:"inherit"}}>
            Expandir tots
          </button>
          <button onClick={()=>setExpanded(new Set())}
            style={{background:TC.bgAlt,border:`1px solid ${TC.border}`,borderRadius:5,
              padding:"4px 12px",cursor:"pointer",fontSize:11,color:TC.textMid,fontFamily:"inherit"}}>
            Plegar tots
          </button>
        </div>
      </div>

      <div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead>
            <tr style={{background:TC.bgAlt}}>
              <th style={{...th,width:32}}></th>
              <th style={{...th,minWidth:120}}>Mes</th>
              <th style={{...th,textAlign:"right"}}>Capital Call</th>
              <th style={{...th,textAlign:"right"}}>Distribució</th>
              <th style={{...th,textAlign:"right"}}>Retorn Capital</th>
              <th style={{...th,textAlign:"right"}}>Total Rebut</th>
              <th style={{...th,textAlign:"right"}}>Flux Net</th>
              <th style={{...th,textAlign:"right",width:55}}>#Fons</th>
            </tr>
          </thead>
          <tbody>
            {byMes.map((mes, mi) => {
              const isOpen   = expanded.has(mes.key);
              const rebut    = mes.dist + mes.retorn;
              const net      = rebut - mes.calls;
              const fonsList = fonsByMes[mes.key] || [];

              return (
                <React.Fragment key={mes.key}>
                  {/* ── Fila mes ── */}
                  <tr
                    onClick={() => toggleMes(mes.key)}
                    style={{
                      borderBottom: isOpen ? "none" : `1px solid ${TC.bgAlt}`,
                      background: isOpen ? greenRow1 : mi%2===0?rowMain:rowAlt,
                      cursor:"pointer", transition:"background 0.15s",
                    }}
                    onMouseEnter={e=>!isOpen&&(e.currentTarget.style.background=TC.bgAlt)}
                    onMouseLeave={e=>!isOpen&&(e.currentTarget.style.background=mi%2===0?rowMain:rowAlt)}
                  >
                    <td style={{padding:"10px 10px 10px 14px",fontSize:13,color:TC.green,fontWeight:700,userSelect:"none"}}>
                      {isOpen ? "▼" : "▶"}
                    </td>
                    <td style={{padding:"10px",fontWeight:700,color:TC.text,fontSize:13}}>{mes.label}</td>
                    <td style={{padding:"10px",textAlign:"right",fontFamily:"monospace",fontSize:12,fontWeight:700,color:TC.navy}}>{mes.calls?fmtM(mes.calls):"—"}</td>
                    <td style={{padding:"10px",textAlign:"right",fontFamily:"monospace",fontSize:12,color:TC.green}}>{mes.dist?fmtM(mes.dist):"—"}</td>
                    <td style={{padding:"10px",textAlign:"right",fontFamily:"monospace",fontSize:12,color:TC.greenDark}}>{mes.retorn?fmtM(mes.retorn):"—"}</td>
                    <td style={{padding:"10px",textAlign:"right",fontFamily:"monospace",fontSize:12,fontWeight:700,color:TC.green}}>{rebut?fmtM(rebut):"—"}</td>
                    <td style={{padding:"10px",textAlign:"right",fontFamily:"monospace",fontSize:12,fontWeight:700,color:net>=0?TC.greenDark:TC.navy}}>
                      {net>=0?"+":""}{fmtM(net)}
                    </td>
                    <td style={{padding:"10px",textAlign:"right",fontSize:11,color:TC.textLight,fontWeight:600}}>
                      {fonsList.length}
                    </td>
                  </tr>

                  {/* ── Accordion: fons dins del mes ── */}
                  {isOpen && fonsList.map((f, fi) => {
                    const fKey    = `${mes.key}__${f.fons}`;
                    const txOpen  = expandedTx.has(fKey);
                    const fRebut  = f.dist + f.retorn;
                    const fNet    = fRebut - f.calls;

                    return (
                      <React.Fragment key={fKey}>
                        {/* Fila fons (nivell 2) */}
                        <tr
                          onClick={() => toggleFonsTx(fKey)}
                          style={{
                            borderBottom: txOpen ? "none" : `1px solid ${TC.green}20`,
                            background: txOpen ? greenRow2 : fi%2===0?greenRow3:greenRow1,
                            cursor:"pointer",
                          }}
                        >
                          <td style={{padding:"8px 8px 8px 28px",fontSize:11,color:TC.greenDark,fontWeight:700,userSelect:"none"}}>
                            {txOpen ? "▼" : "▶"}
                          </td>
                          <td style={{padding:"8px 10px",fontSize:12,color:TC.text,fontWeight:600,
                            maxWidth:260,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={f.fons}>
                            <span style={{color:TC.greenLight,marginRight:7,fontSize:10}}>└</span>{f.fons}
                          </td>
                          <td style={{padding:"8px 10px",textAlign:"right",fontFamily:"monospace",fontSize:12,fontWeight:700,color:TC.navy}}>{f.calls?fmtM(f.calls):"—"}</td>
                          <td style={{padding:"8px 10px",textAlign:"right",fontFamily:"monospace",fontSize:12,color:TC.green}}>{f.dist?fmtM(f.dist):"—"}</td>
                          <td style={{padding:"8px 10px",textAlign:"right",fontFamily:"monospace",fontSize:12,color:TC.greenDark}}>{f.retorn?fmtM(f.retorn):"—"}</td>
                          <td style={{padding:"8px 10px",textAlign:"right",fontFamily:"monospace",fontSize:12,fontWeight:700,color:TC.green}}>{fRebut?fmtM(fRebut):"—"}</td>
                          <td style={{padding:"8px 10px",textAlign:"right",fontFamily:"monospace",fontSize:12,fontWeight:700,color:fNet>=0?TC.greenDark:TC.navy}}>
                            {fNet>=0?"+":""}{fmtM(fNet)}
                          </td>
                          <td style={{padding:"8px 10px",textAlign:"right"}}>
                            <div style={{display:"flex",gap:4,justifyContent:"flex-end"}}>
                              <span style={{fontSize:10,background:vcpeBg(f.vcpe),color:VCPE_CFG[f.vcpe]?.color||TC.textMid,borderRadius:4,padding:"1px 5px",fontWeight:600}}>{f.vcpe}</span>
                            </div>
                          </td>
                        </tr>

                        {/* Transaccions individuals (nivell 3) */}
                        {txOpen && (
                          <tr>
                            <td colSpan={8} style={{padding:0,borderBottom:`1px solid ${TC.green}30`}}>
                              <table style={{width:"100%",borderCollapse:"collapse",background:greenRow5}}>
                                <thead>
                                  <tr style={{background:greenRow6}}>
                                    <th style={{...th,paddingLeft:60,fontSize:9,width:110}}>Data</th>
                                    <th style={{...th,fontSize:9}}>Tipus detall</th>
                                    <th style={{...th,fontSize:9}}>Categoria</th>
                                    <th style={{...th,textAlign:"right",fontSize:9}}>Import EUR</th>
                                    <th style={{...th,fontSize:9}}>Divisa orig.</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {f.txs.sort((a,b)=>a.data.localeCompare(b.data)).map((tx,ti) => {
                                    const isIn = tx.eur > 0;
                                    const cfg  = CAT_CFG_LOCAL[tx.cat] || {};
                                    return (
                                      <tr key={ti} style={{borderBottom:`1px solid ${TC.green}15`,
                                        background:ti%2===0?greenRow5:greenRow2}}>
                                        <td style={{padding:"6px 10px 6px 60px",fontSize:11,color:TC.textMid,whiteSpace:"nowrap"}}>{tx.data}</td>
                                        <td style={{padding:"6px 10px",fontSize:11,color:TC.textMid,whiteSpace:"nowrap"}}>{tx.tipus}</td>
                                        <td style={{padding:"6px 10px"}}>
                                          <span style={{fontSize:10,background:cfg.bg||TC.bgAlt,color:cfg.color||TC.textMid,
                                            borderRadius:4,padding:"1px 7px",fontWeight:600,whiteSpace:"nowrap"}}>
                                            {tx.cat}
                                          </span>
                                        </td>
                                        <td style={{padding:"6px 10px",textAlign:"right",fontFamily:"monospace",
                                          fontSize:12,fontWeight:700,color:isIn?TC.navy:TC.green}}>
                                          {!isIn&&"+ "}{fmtM(Math.abs(tx.eur))}
                                        </td>
                                        <td style={{padding:"6px 10px",fontSize:11,color:TC.textLight}}>{tx.divisa}</td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                                {f.txs.length > 1 && (
                                  <tfoot>
                                    <tr style={{background:greenRow6,borderTop:`1px solid ${TC.green}30`}}>
                                      <td colSpan={3} style={{padding:"5px 10px 5px 60px",fontSize:10,fontWeight:700,color:TC.greenDark}}>
                                        Subtotal {f.fons.length>30?f.fons.slice(0,30)+"…":f.fons}
                                      </td>
                                      <td style={{padding:"5px 10px",textAlign:"right",fontFamily:"monospace",fontSize:11,fontWeight:700,
                                        color:fNet>=0?TC.greenDark:TC.navy}}>
                                        {fNet>=0?"+":""}{fmtM(fNet)}
                                      </td>
                                      <td></td>
                                    </tr>
                                  </tfoot>
                                )}
                              </table>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}

                  {/* Total del mes (quan expandit) */}
                  {isOpen && (
                    <tr style={{borderBottom:`2px solid ${TC.green}30`}}>
                      <td colSpan={2} style={{padding:"8px 10px 8px 14px",fontSize:11,fontWeight:700,color:TC.greenDark,background:greenRow4}}>
                        TOTAL {mes.label}
                      </td>
                      <td style={{padding:"8px 10px",textAlign:"right",fontFamily:"monospace",fontSize:12,fontWeight:700,color:TC.navy,background:greenRow4}}>{mes.calls?fmtM(mes.calls):"—"}</td>
                      <td style={{padding:"8px 10px",textAlign:"right",fontFamily:"monospace",fontSize:12,fontWeight:700,color:TC.green,background:greenRow4}}>{mes.dist?fmtM(mes.dist):"—"}</td>
                      <td style={{padding:"8px 10px",textAlign:"right",fontFamily:"monospace",fontSize:12,fontWeight:700,color:TC.greenDark,background:greenRow4}}>{mes.retorn?fmtM(mes.retorn):"—"}</td>
                      <td style={{padding:"8px 10px",textAlign:"right",fontFamily:"monospace",fontSize:12,fontWeight:700,color:TC.green,background:greenRow4}}>{rebut?fmtM(rebut):"—"}</td>
                      <td style={{padding:"8px 10px",textAlign:"right",fontFamily:"monospace",fontSize:12,fontWeight:700,color:net>=0?TC.greenDark:TC.navy,background:greenRow4}}>
                        {net>=0?"+":""}{fmtM(net)}
                      </td>
                      <td style={{background:greenRow4}}></td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  </>);
}

// ══════════════════════════════════════════════════════════
// APP PRINCIPAL
// ══════════════════════════════════════════════════════════
