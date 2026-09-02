import { isMockNif } from "../../data/searchersTabHelpers.js";

export function SearchersDataLoadBar({
  TC,
  historicData,
  reloadSearchers,
  exportNifExcel,
  handleNifImport,
  handleCSV,
  nifXlsRef,
  csvRef,
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8, marginBottom: 14 }}>
      <span style={{ fontSize: 11, color: TC.textLight }}>
        {historicData.length} searchers a base de dades
        {historicData.filter(r => isMockNif(r.nif)).length > 0 && (
          <span style={{ marginLeft: 6, color: "#B01F17", fontWeight: 600 }}>
            · {historicData.filter(r => isMockNif(r.nif)).length} sense NIF real
          </span>
        )}
      </span>
      <button onClick={reloadSearchers}
        style={{ background: "transparent", border: `1px solid ${TC.border}`, borderRadius: 6, padding: "5px 11px", cursor: "pointer", fontSize: 11, color: TC.textMid, fontFamily: "inherit" }}>
        Recarregar DB
      </button>
      <button onClick={exportNifExcel}
        style={{ background: "transparent", border: `1px solid ${TC.border}`, borderRadius: 6, padding: "5px 11px", cursor: "pointer", fontSize: 11, color: TC.textMid, fontFamily: "inherit" }}>
        ↓ Exportar NIFs
      </button>
      <input ref={nifXlsRef} type="file" accept=".xlsx,.xls" style={{ display: "none" }} onChange={handleNifImport} />
      <button onClick={() => nifXlsRef.current?.click()}
        style={{ background: "transparent", border: `1px solid ${TC.border}`, borderRadius: 6, padding: "5px 11px", cursor: "pointer", fontSize: 11, color: TC.textMid, fontFamily: "inherit" }}>
        ↑ Importar NIFs
      </button>
      <input ref={csvRef} type="file" accept=".csv" style={{ display: "none" }} onChange={handleCSV} />
      <button onClick={() => csvRef.current?.click()}
        style={{ background: TC.navy, color: "#fff", border: "none", borderRadius: 6, padding: "6px 14px", cursor: "pointer", fontSize: 11, fontFamily: "inherit" }}>
        ↑ Importar CSV
      </button>
    </div>
  );
}
