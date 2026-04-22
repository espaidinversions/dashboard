import React, { useState, useRef } from "react";
import { useTheme } from "../theme.js";
import { parseCapitalCallsCSV, parsePipelineCSV, mapCapitalCallsRows, mapLegacySearchFundRows, mapPipelineRows, mapCompanyRows, mapSearcherRows, mapFundMetaRows, mapKpiRows } from "../utils.js";
import { apiFetchJson } from "../apiClient.js";

function DataLoader({ onLoad, onClose, dataInfo }) {
  const { tc: TC } = useTheme();
  const ccRef    = useRef(null);
  const plRef    = useRef(null);
  const xlsxRef  = useRef(null);
  const [ccStatus,   setCcStatus]   = useState(null);
  const [plStatus,   setPlStatus]   = useState(null);
  const [xlsxStatus, setXlsxStatus] = useState(null);
  const [error,      setError]      = useState(null);
  const [ccDrag,     setCcDrag]     = useState(false);
  const [plDrag,     setPlDrag]     = useState(false);
  const [xlsxDrag,   setXlsxDrag]  = useState(false);
  const [closing,    setClosing]    = useState(false);

  const handleClose = () => { setClosing(true); setTimeout(onClose, 175); };

  const readXLSX = async (file) => {
    if (file.size > 10 * 1024 * 1024) { setError("El fitxer és massa gran (màxim 10 MB)."); return; }
    try {
      const XLSX = await import("xlsx");
      const buf  = await file.arrayBuffer();
      const wb   = XLSX.read(buf, { type: "array" });
      const MAX_SHEETS = 20;
      if (wb.SheetNames.length > MAX_SHEETS) {
        setError(`El fitxer té massa fulls (màxim ${MAX_SHEETS}).`);
        return;
      }
      const sheet = name => {
        const ws = wb.Sheets[name];
        return ws ? XLSX.utils.sheet_to_json(ws) : null;
      };
      const hasHeaders = (rows, headers) => Array.isArray(rows) && rows.length > 0
        && headers.every((header) => Object.prototype.hasOwnProperty.call(rows[0], header));

      let loaded = 0;
      const bundle = {};
      const ccRows = sheet("Capital Calls");
      if (hasHeaders(ccRows, ["Fons", "Categoria", "Data", "Import (€)"])) { bundle.cc = mapCapitalCallsRows(ccRows); loaded++; }
      const legacySfRows = sheet("Search_Funds");
      if (legacySfRows?.length) { bundle.ccSearchFunds = mapLegacySearchFundRows(legacySfRows); loaded++; }
      const plRows = sheet("Pipeline");
      if (hasHeaders(plRows, ["Nom", "Import", "Divisa"])) { bundle.pl = mapPipelineRows(plRows); loaded++; }
      const coRows = sheet("Participades");
      if (hasHeaders(coRows, ["Nom", "Tipus"])) { bundle.companies = mapCompanyRows(coRows); loaded++; }
      const srRows = sheet("Searchers");
      if (hasHeaders(srRows, ["Nom", "Status"])) { bundle.searchers = mapSearcherRows(srRows); loaded++; }
      const fmRows = sheet("Fund Meta");
      if (hasHeaders(fmRows, ["Fons", "TVPI"])) { bundle.fundMeta = mapFundMetaRows(fmRows); loaded++; }
      const kpiRows = sheet("KPIs Trimestral");
      if (kpiRows?.length && hasHeaders(kpiRows, ["Nom"])) { bundle.kpiTrimestral = mapKpiRows(kpiRows); loaded++; }
      if (!loaded) throw new Error("No s'ha trobat cap full reconegut (Capital Calls, Search_Funds, Pipeline, Participades, Searchers, Fund Meta, KPIs Trimestral).");
      await Promise.resolve(onLoad("xlsx", bundle));
      setXlsxStatus({ name: file.name, sheets: loaded });
      setError(null);
    } catch (err) {
      setError(`Error a ${file.name}: ${err.message}`);
      setXlsxStatus(null);
    }
  };

  const readFile = (file, parser, setStatus, key) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { setError("El fitxer és massa gran (màxim 10 MB)."); return; }
    const reader = new FileReader();
    reader.onload = async e => {
      try {
        const text = e.target.result;
        const rows = parser(text);
        if (!rows.length) throw new Error("El fitxer és buit o no té les columnes esperades.");
        await Promise.resolve(onLoad(key, rows));
        setStatus({ rows: rows.length, name: file.name });
        setError(null);
        if (key === "cc") {
          apiFetchJson("/api/capital-calls", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ csv: text }),
          }).catch(() => {});
        }
      } catch(err) {
        setError(`Error a ${file.name}: ${err.message}`);
        setStatus(null);
      }
    };
    reader.readAsText(file, "utf-8");
  };

  const makeDrop = (parser, setStatus, key, setDrag) => ({
    onDragOver:  e => { e.preventDefault(); setDrag(true); },
    onDragLeave: e => { if (!e.currentTarget.contains(e.relatedTarget)) setDrag(false); },
    onDrop:      e => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) readFile(f, parser, setStatus, key); },
  });

  const sty = {
    overlay: { position:"fixed", inset:0, background:"rgba(15,25,35,.65)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center" },
    modal:   { background:TC.card, borderRadius:14, padding:"28px 32px", width:480, boxShadow:"0 8px 40px rgba(0,0,0,.35)", fontFamily:"'Outfit',system-ui,sans-serif" },
    title:   { fontSize:16, fontWeight:700, color:TC.navy, marginBottom:4 },
    sub:     { fontSize:12, color:TC.textLight, marginBottom:22 },
    section: { marginBottom:18 },
    label:   { fontSize:11, fontWeight:600, color:TC.textMid, textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:7, display:"block" },
    desc:    { fontSize:11, color:TC.textLight, marginBottom:8 },
    btn:     { background:TC.navy, color:"#fff", border:"none", borderRadius:6, padding:"7px 16px", cursor:"pointer", fontSize:12, fontFamily:"inherit", whiteSpace:"nowrap", flexShrink:0 },
    status:  { fontSize:11, color:TC.green, fontWeight:600 },
    error:   { fontSize:11, color:TC.red, marginTop:10, background:TC.redLight, padding:"7px 10px", borderRadius:6 },
    close:   { background:"transparent", border:`1px solid ${TC.border}`, borderRadius:6, padding:"7px 18px", cursor:"pointer", fontSize:12, color:TC.textMid, fontFamily:"inherit" },
    info:    { fontSize:11, color:TC.textLight, background:TC.bgAlt, borderRadius:6, padding:"8px 12px", marginBottom:18 },
    dropZone: (active) => ({
      border: `2px dashed ${active ? TC.navy : TC.border}`,
      borderRadius: 10,
      padding: "12px 16px",
      display: "flex", alignItems: "center", gap: 12,
      background: active ? `${TC.navy}12` : "transparent",
      transition: "background 0.15s ease, border-color 0.15s ease",
      cursor: "pointer",
    }),
    hint: { fontSize:11, color:TC.textLight, marginTop:5 },
  };

  const DropZone = ({ parser, setStatus, status, fileRef, inputProps, label, dragActive, setDrag }) => (
    <div
      style={sty.dropZone(dragActive)}
      {...makeDrop(parser, setStatus, inputProps.key_, setDrag)}
      onClick={() => fileRef.current.click()}
    >
      <input ref={fileRef} type="file" accept=".csv" style={{display:"none"}}
        onChange={e=>readFile(e.target.files[0], parser, setStatus, inputProps.key_)}/>
      <span style={{fontSize:20, lineHeight:1}}>📂</span>
      <div style={{flex:1, minWidth:0}}>
        {status
          ? <span style={sty.status}>{status.name} ({status.rows} files)</span>
          : <span style={{fontSize:12, color:TC.textMid}}>{dragActive ? "Deixa anar el fitxer…" : "Fes clic o arrossega un fitxer CSV aquí"}</span>
        }
      </div>
      <button style={sty.btn} onClick={e=>{e.stopPropagation(); fileRef.current.click();}}>
        Seleccionar
      </button>
    </div>
  );

  return (
    <div className={`modal-overlay${closing ? " closing" : ""}`} style={sty.overlay} onClick={e=>{ if(e.target===e.currentTarget) handleClose(); }}>
      <div className={`modal-card${closing ? " closing" : ""}`} style={sty.modal}>
        <div style={sty.title}>Carregar dades</div>
        <div style={sty.sub}>Selecciona o arrossega els fitxers CSV per actualitzar el dashboard.</div>

        {dataInfo && (
          <div style={sty.info}>
            Dades actuals: <b>{dataInfo.ccRows} transaccions</b> · <b>{dataInfo.plRows} fons pipeline</b>
            {dataInfo.loaded && <span style={{marginLeft:6, color:TC.green}}>· Carregades {dataInfo.loaded}</span>}
          </div>
        )}

        <div style={sty.section}>
          <span style={sty.label}>Excel (tots els fulls)</span>
          <div style={sty.desc}>Fitxer exportat: <code>TurtleCapital_Data_*.xlsx</code></div>
          <div
            style={sty.dropZone(xlsxDrag)}
            onDragOver={e=>{e.preventDefault();setXlsxDrag(true);}}
            onDragLeave={e=>{if(!e.currentTarget.contains(e.relatedTarget))setXlsxDrag(false);}}
            onDrop={e=>{e.preventDefault();setXlsxDrag(false);const f=e.dataTransfer.files[0];if(f)readXLSX(f);}}
            onClick={()=>xlsxRef.current.click()}
          >
            <input ref={xlsxRef} type="file" accept=".xlsx,.xls" style={{display:"none"}} onChange={e=>{if(e.target.files[0])readXLSX(e.target.files[0]);}}/>
            <span style={{fontSize:20, lineHeight:1}}>📊</span>
            <div style={{flex:1, minWidth:0}}>
              {xlsxStatus
                ? <span style={sty.status}>{xlsxStatus.name} ({xlsxStatus.sheets} fulls carregats)</span>
                : <span style={{fontSize:12, color:TC.textMid}}>{xlsxDrag ? "Deixa anar el fitxer…" : "Fes clic o arrossega el fitxer Excel aquí"}</span>
              }
            </div>
            <button style={sty.btn} onClick={e=>{e.stopPropagation();xlsxRef.current.click();}}>
              Seleccionar
            </button>
          </div>
        </div>

        <div style={{ borderTop: `1px solid ${TC.border}`, margin: "4px 0 18px", opacity: 0.5 }}/>
        <div style={{ ...sty.sub, marginBottom: 14 }}>O carrega cada fitxer CSV individualment:</div>

        <div style={sty.section}>
          <span style={sty.label}>Capital Calls</span>
          <div style={sty.desc}>Fitxer: <code>capital-calls.csv</code></div>
          <DropZone parser={parseCapitalCallsCSV} setStatus={setCcStatus} status={ccStatus}
            fileRef={ccRef} inputProps={{key_:"cc"}} dragActive={ccDrag} setDrag={setCcDrag}/>
        </div>

        <div style={sty.section}>
          <span style={sty.label}>Pipeline</span>
          <div style={sty.desc}>Fitxer: <code>pipeline.csv</code></div>
          <DropZone parser={parsePipelineCSV} setStatus={setPlStatus} status={plStatus}
            fileRef={plRef} inputProps={{key_:"pl"}} dragActive={plDrag} setDrag={setPlDrag}/>
        </div>

        {error && <div style={sty.error}>{error}</div>}

        <div style={{display:"flex", justifyContent:"flex-end", gap:10, marginTop:8}}>
          <button style={sty.close} onClick={handleClose}>Tancar</button>
        </div>
      </div>
    </div>
  );
}

export { DataLoader };
