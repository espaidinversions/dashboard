import React, { useState, useMemo, useRef, useEffect } from "react";
import { useTheme } from "../theme.js";
import { RAW_CC as RAW_CC_DEFAULT, VCPE_CFG, EST_CFG } from "../config.js";

// ══════════════════════════════════════════════════════════
export function FonsSelector({excluded, setExcluded, rawCC = RAW_CC_DEFAULT}) {
  const { tc: TC, dark } = useTheme();
  const [open,   setOpen]   = useState(false);
  const [search, setSearch] = useState("");
  const [fVcpe,  setFVcpe]  = useState("Tots");
  const [fEst,   setFEst]   = useState("Tots");
  const ref = useRef(null);

  // Tancar si es fa clic fora
  useEffect(()=>{
    const h = e => { if(ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return ()=>document.removeEventListener("mousedown", h);
  },[]);

  // Fons disponibles amb filtre de cerca i tipus
  const fonsMeta = useMemo(()=>{
    const m={};
    rawCC.forEach(r=>{ if(!m[r.fons]) m[r.fons]={fons:r.fons,vcpe:r.vcpe,est:r.est}; });
    return Object.values(m).sort((a,b)=>a.fons.localeCompare(b.fons));
  },[rawCC]);

  const visible = useMemo(()=>fonsMeta.filter(f=>{
    if(search && !f.fons.toLowerCase().includes(search.toLowerCase())) return false;
    if(fVcpe!=="Tots" && f.vcpe!==fVcpe) return false;
    if(fEst !=="Tots" && f.est !==fEst)  return false;
    return true;
  }),[fonsMeta,search,fVcpe,fEst]);

  const allVisible    = visible.every(f=>!excluded.has(f.fons));
  const someExcluded  = excluded.size > 0;
  const inp = {border:`1px solid ${TC.border}`,borderRadius:5,padding:"4px 7px",fontSize:11,color:TC.text,background:TC.card,outline:"none",fontFamily:"inherit"};

  const vcpeBg = (vcpe) => dark ? (vcpe==="PE"?"#1A2F45":vcpe==="VC"?"#0E2820":"#20163A") : (VCPE_CFG[vcpe]?.bg||TC.bgAlt);
  const estBg  = (est)  => dark ? "#1A2838" : (EST_CFG[est]?.bg||TC.bgAlt);

  const toggle = fons => setExcluded(p=>{ const n=new Set(p); n.has(fons)?n.delete(fons):n.add(fons); return n; });
  const toggleAll = () => {
    if(allVisible) setExcluded(p=>{ const n=new Set(p); visible.forEach(f=>n.add(f.fons)); return n; });
    else           setExcluded(p=>{ const n=new Set(p); visible.forEach(f=>n.delete(f.fons)); return n; });
  };
  const reset = () => setExcluded(new Set());

  return (
    <div ref={ref} style={{position:"relative"}}>
      <button onClick={()=>setOpen(o=>!o)}
        style={{display:"flex",alignItems:"center",gap:8,background:someExcluded?TC.yellowLight:TC.card,border:`1.5px solid ${someExcluded?TC.yellow:TC.border}`,borderRadius:7,padding:"7px 14px",cursor:"pointer",fontSize:12,color:someExcluded?TC.yellow:TC.textMid,fontWeight:someExcluded?700:400,fontFamily:"inherit",whiteSpace:"nowrap"}}>
        <span>🏦 Selecció de Fons</span>
        {someExcluded && <span style={{background:TC.yellow,color:"#fff",borderRadius:10,padding:"1px 7px",fontSize:10,fontWeight:700}}>{excluded.size} exclosos</span>}
        <span style={{fontSize:10,opacity:0.5}}>{open?"▲":"▼"}</span>
      </button>

      {open&&(
        <div style={{position:"absolute",top:"calc(100% + 6px)",right:0,zIndex:1000,background:TC.card,border:`1.5px solid ${TC.border}`,borderRadius:10,boxShadow:"0 8px 32px rgba(0,0,0,.25)",width:420,maxHeight:520,display:"flex",flexDirection:"column"}}>
          {/* Capçalera */}
          <div style={{padding:"14px 16px 10px",borderBottom:`1px solid ${TC.bgAlt}`}}>
            <div style={{fontSize:12,fontWeight:700,color:TC.navy,marginBottom:10}}>Seleccionar fons per a l'anàlisi</div>
            <input
              placeholder="🔍 Cercar fons..."
              value={search} onChange={e=>setSearch(e.target.value)}
              style={{...inp,width:"100%",padding:"7px 10px",fontSize:12,marginBottom:8,boxSizing:"border-box"}}
            />
            <div style={{display:"flex",gap:6}}>
              <select value={fVcpe} onChange={e=>setFVcpe(e.target.value)} style={inp}>
                {["Tots","PE","VC","RE"].map(o=><option key={o}>{o}</option>)}
              </select>
              <select value={fEst} onChange={e=>setFEst(e.target.value)} style={inp}>
                {["Tots","Fons Primari","Fons de Fons","SOCIMI"].map(o=><option key={o}>{o}</option>)}
              </select>
              <div style={{marginLeft:"auto",display:"flex",gap:6}}>
                <button onClick={toggleAll}
                  style={{background:TC.bgAlt,border:`1px solid ${TC.border}`,borderRadius:5,padding:"3px 9px",cursor:"pointer",fontSize:11,color:TC.textMid,fontFamily:"inherit"}}>
                  {allVisible?"Des-sel. tot":"Sel. tot"}
                </button>
                {someExcluded&&<button onClick={reset}
                  style={{background:TC.yellowLight,border:`1px solid ${TC.yellow}`,borderRadius:5,padding:"3px 9px",cursor:"pointer",fontSize:11,color:TC.yellow,fontFamily:"inherit",fontWeight:700}}>
                  Reset
                </button>}
              </div>
            </div>
          </div>

          {/* Llista */}
          <div style={{overflowY:"auto",flex:1,padding:"6px 0"}}>
            {visible.map(f=>{
              const excl = excluded.has(f.fons);
              return (
                <div key={f.fons} onClick={()=>toggle(f.fons)}
                  style={{display:"flex",alignItems:"center",gap:10,padding:"7px 16px",cursor:"pointer",background:excl?TC.redLight:"transparent",opacity:excl?0.7:1,transition:"background 0.12s"}}
                  onMouseEnter={e=>!excl&&(e.currentTarget.style.background=TC.bgAlt)}
                  onMouseLeave={e=>!excl&&(e.currentTarget.style.background="transparent")}>
                  <div style={{width:16,height:16,border:`2px solid ${excl?TC.red:TC.green}`,background:excl?"transparent":TC.green,borderRadius:4,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.15s"}}>
                    {!excl&&<span style={{color:"#fff",fontSize:9,fontWeight:900}}>✓</span>}
                    {excl&&<span style={{color:TC.red,fontSize:10,fontWeight:900}}>✕</span>}
                  </div>
                  <span style={{fontSize:12,color:excl?TC.red:TC.text,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{f.fons}</span>
                  <div style={{display:"flex",gap:4,flexShrink:0}}>
                    <span style={{fontSize:10,background:vcpeBg(f.vcpe),color:VCPE_CFG[f.vcpe]?.color||TC.textMid,borderRadius:4,padding:"1px 5px",fontWeight:600}}>{f.vcpe}</span>
                    <span style={{fontSize:10,background:estBg(f.est),color:EST_CFG[f.est]?.color||TC.textMid,borderRadius:4,padding:"1px 5px",fontWeight:600}}>{f.est?.replace("Fons ","")}</span>
                  </div>
                </div>
              );
            })}
            {visible.length===0&&<div style={{padding:"20px",textAlign:"center",color:TC.textLight,fontSize:12}}>Cap fons trobat</div>}
          </div>

          {/* Peu */}
          <div style={{padding:"10px 16px",borderTop:`1px solid ${TC.bgAlt}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span style={{fontSize:11,color:TC.textLight}}>{visible.length - visible.filter(f=>excluded.has(f.fons)).length} / {visible.length} inclosos</span>
            <button onClick={()=>setOpen(false)}
              style={{background:TC.navy,border:"none",borderRadius:6,padding:"6px 18px",cursor:"pointer",fontSize:12,color:"#fff",fontFamily:"inherit",fontWeight:600}}>
              Aplicar ✓
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// SUBCOMPONENT: PIPELINE FY26
// ══════════════════════════════════════════════════════════
