import React, { useState, useMemo, useRef, useEffect } from "react";
import { useTheme } from "../theme.js";
import { fmtS } from "../utils.js";

export function MesSelector({allMesos, selectedMesos, setSelectedMesos}) {
  const { tc: TC, dark } = useTheme();
  const [open, setOpen] = useState(false);
  const [fAny, setFAny] = useState("Tots");
  const ref = useRef(null);

  useEffect(()=>{
    const h = e => { if(ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return ()=>document.removeEventListener("mousedown", h);
  },[]);

  const anys = ["Tots", ...new Set(allMesos.map(m=>String(m.any)))].sort().reverse();

  const visible = useMemo(()=>
    fAny==="Tots" ? allMesos : allMesos.filter(m=>String(m.any)===fAny)
  ,[allMesos, fAny]);

  const allSelected   = visible.every(m=>selectedMesos.has(m.key));
  const someDeselected = selectedMesos.size < allMesos.length;
  const inp = {border:`1px solid ${TC.border}`,borderRadius:5,padding:"4px 7px",fontSize:11,color:TC.text,background:TC.card,outline:"none",fontFamily:"inherit"};

  const toggle = key => setSelectedMesos(p=>{ const n=new Set(p); n.has(key)?n.delete(key):n.add(key); return n; });
  const toggleAll = () => {
    if(allSelected) setSelectedMesos(p=>{ const n=new Set(p); visible.forEach(m=>n.delete(m.key)); return n; });
    else            setSelectedMesos(p=>{ const n=new Set(p); visible.forEach(m=>n.add(m.key));    return n; });
  };
  const selectAll = () => setSelectedMesos(new Set(allMesos.map(m=>m.key)));

  const deselected = allMesos.filter(m=>!selectedMesos.has(m.key));
  const purpleBg = dark ? "#20163A" : "#F3EEF8";

  return (
    <div ref={ref} style={{position:"relative"}}>
      <button onClick={()=>setOpen(o=>!o)}
        style={{display:"flex",alignItems:"center",gap:8,background:someDeselected?purpleBg:TC.card,border:`1.5px solid ${someDeselected?TC.purple||"#6A4C8A":TC.border}`,borderRadius:7,padding:"7px 14px",cursor:"pointer",fontSize:12,color:someDeselected?TC.purple||"#6A4C8A":TC.textMid,fontWeight:someDeselected?700:400,fontFamily:"inherit",whiteSpace:"nowrap"}}>
        <span>📅 Selecció de Mesos</span>
        {someDeselected && <span style={{background:TC.purple||"#6A4C8A",color:"#fff",borderRadius:10,padding:"1px 7px",fontSize:10,fontWeight:700}}>{deselected.length} exclosos</span>}
        <span style={{fontSize:10,opacity:0.5}}>{open?"▲":"▼"}</span>
      </button>

      {open&&(
        <div style={{position:"absolute",top:"calc(100% + 6px)",right:0,zIndex:1000,background:TC.card,border:`1.5px solid ${TC.border}`,borderRadius:10,boxShadow:"0 8px 32px rgba(0,0,0,.25)",width:340,maxHeight:500,display:"flex",flexDirection:"column"}}>
          {/* Capçalera */}
          <div style={{padding:"14px 16px 10px",borderBottom:`1px solid ${TC.bgAlt}`}}>
            <div style={{fontSize:12,fontWeight:700,color:TC.navy,marginBottom:10}}>Seleccionar mesos per a l'anàlisi</div>
            <div style={{display:"flex",gap:6,alignItems:"center"}}>
              <select value={fAny} onChange={e=>setFAny(e.target.value)} style={inp}>
                {anys.map(o=><option key={o}>{o}</option>)}
              </select>
              <div style={{marginLeft:"auto",display:"flex",gap:6}}>
                <button onClick={toggleAll}
                  style={{background:TC.bgAlt,border:`1px solid ${TC.border}`,borderRadius:5,padding:"3px 9px",cursor:"pointer",fontSize:11,color:TC.textMid,fontFamily:"inherit"}}>
                  {allSelected?"Des-sel.":"Sel. tot"}
                </button>
                {someDeselected&&<button onClick={selectAll}
                  style={{background:purpleBg,border:`1px solid ${TC.purple||"#6A4C8A"}`,borderRadius:5,padding:"3px 9px",cursor:"pointer",fontSize:11,color:TC.purple||"#6A4C8A",fontFamily:"inherit",fontWeight:700}}>
                  Reset
                </button>}
              </div>
            </div>
          </div>

          {/* Llista de mesos */}
          <div style={{overflowY:"auto",flex:1,padding:"6px 0"}}>
            {visible.map(m=>{
              const sel = selectedMesos.has(m.key);
              return (
                <div key={m.key} onClick={()=>toggle(m.key)}
                  style={{display:"flex",alignItems:"center",gap:10,padding:"7px 16px",cursor:"pointer",background:!sel?"#FDECEA20":"transparent",transition:"background 0.12s"}}
                  onMouseEnter={e=>sel&&(e.currentTarget.style.background=TC.bgAlt)}
                  onMouseLeave={e=>sel&&(e.currentTarget.style.background="transparent")}>
                  <div style={{width:16,height:16,border:`2px solid ${!sel?TC.red:TC.green}`,background:!sel?"transparent":TC.green,borderRadius:4,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                    {sel&&<span style={{color:"#fff",fontSize:9,fontWeight:900}}>✓</span>}
                    {!sel&&<span style={{color:TC.red,fontSize:10,fontWeight:900}}>✕</span>}
                  </div>
                  <span style={{fontSize:12,color:!sel?TC.red:TC.text,fontWeight:sel?400:500,flex:1}}>{m.label}</span>
                  <div style={{display:"flex",gap:8,flexShrink:0,fontSize:11,color:TC.textLight}}>
                    {m.calls>0&&<span style={{color:TC.navy,fontWeight:600}}>{fmtS(m.calls)}</span>}
                    {(m.dist+m.retorn)>0&&<span style={{color:TC.green,fontWeight:600}}>+{fmtS(m.dist+m.retorn)}</span>}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Peu */}
          <div style={{padding:"10px 16px",borderTop:`1px solid ${TC.bgAlt}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span style={{fontSize:11,color:TC.textLight}}>{selectedMesos.size} / {allMesos.length} mesos seleccionats</span>
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
// ══════════════════════════════════════════════════════════
// SUBCOMPONENT: MENSUAL TAB amb accordion per fons + transaccions
// ══════════════════════════════════════════════════════════
