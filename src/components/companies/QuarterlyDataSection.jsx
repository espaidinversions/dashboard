import { fmtM } from "../../utils.js";
import { EditableCell, SectionHeader, tableCardStyle } from "../SharedComponents.jsx";

export function QuarterlyDataSection({
  tc,
  quarters,
  canEdit,
  quarterFilters,
  setQuarterFilters,
  filteredQuarters,
  saveQuarterField,
  addingQuarter,
  setAddingQuarter,
  newQ,
  setNewQ,
  addQuarter,
}) {
  return (
    <>
      {/* Quarter data table (editable) */}
      {quarters.length > 0 && (
        <div style={{ ...tableCardStyle(tc), overflowX: "auto" }}>
          <SectionHeader title="Dades trimestrals" tc={tc} />
          <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 600 }}>
            <thead>
              <tr>
                {["Trimestre", "Ingressos", "EBITDA", "DFN", "Ing. Pres.", "EBITDA Pres.", "DFN Pres."].map(h => (
                  <th key={h} style={{ padding: "9px 14px", fontSize: 10, fontWeight: 700, color: tc.navyLight ?? tc.textLight, textTransform: "uppercase", letterSpacing: "0.06em", background: "#F7FAFC", borderBottom: `2px solid ${tc.border}`, whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
              <tr style={{ borderBottom: `1px solid ${tc.border}` }}>
                <th style={{ padding: "6px 8px" }}><input value={quarterFilters.trimestre} onChange={e => setQuarterFilters(v => ({ ...v, trimestre: e.target.value }))} style={{ width:"100%", padding:"4px 6px", borderRadius:4, border:`1px solid ${tc.border}`, background:tc.bg, color:tc.text, fontSize:11, fontFamily:"inherit" }} /></th>
                <th style={{ padding: "6px 8px" }}><input value={quarterFilters.ingressos} onChange={e => setQuarterFilters(v => ({ ...v, ingressos: e.target.value }))} style={{ width:"100%", padding:"4px 6px", borderRadius:4, border:`1px solid ${tc.border}`, background:tc.bg, color:tc.text, fontSize:11, fontFamily:"inherit" }} /></th>
                <th style={{ padding: "6px 8px" }}><input value={quarterFilters.ebitda} onChange={e => setQuarterFilters(v => ({ ...v, ebitda: e.target.value }))} style={{ width:"100%", padding:"4px 6px", borderRadius:4, border:`1px solid ${tc.border}`, background:tc.bg, color:tc.text, fontSize:11, fontFamily:"inherit" }} /></th>
                <th style={{ padding: "6px 8px" }}><input value={quarterFilters.dfn} onChange={e => setQuarterFilters(v => ({ ...v, dfn: e.target.value }))} style={{ width:"100%", padding:"4px 6px", borderRadius:4, border:`1px solid ${tc.border}`, background:tc.bg, color:tc.text, fontSize:11, fontFamily:"inherit" }} /></th>
                <th style={{ padding: "6px 8px" }}><input value={quarterFilters.ingPress} onChange={e => setQuarterFilters(v => ({ ...v, ingPress: e.target.value }))} style={{ width:"100%", padding:"4px 6px", borderRadius:4, border:`1px solid ${tc.border}`, background:tc.bg, color:tc.text, fontSize:11, fontFamily:"inherit" }} /></th>
                <th style={{ padding: "6px 8px" }}><input value={quarterFilters.ebitdaPress} onChange={e => setQuarterFilters(v => ({ ...v, ebitdaPress: e.target.value }))} style={{ width:"100%", padding:"4px 6px", borderRadius:4, border:`1px solid ${tc.border}`, background:tc.bg, color:tc.text, fontSize:11, fontFamily:"inherit" }} /></th>
                <th style={{ padding: "6px 8px" }}><input value={quarterFilters.dfnPress} onChange={e => setQuarterFilters(v => ({ ...v, dfnPress: e.target.value }))} style={{ width:"100%", padding:"4px 6px", borderRadius:4, border:`1px solid ${tc.border}`, background:tc.bg, color:tc.text, fontSize:11, fontFamily:"inherit" }} /></th>
              </tr>
            </thead>
            <tbody>
              {filteredQuarters.map(q => (
                <tr key={q.q} style={{ borderTop: `1px solid ${tc.border}` }}>
                  <td style={{ padding: "6px 8px", fontSize: 12, fontWeight: 600, color: tc.text, whiteSpace: "nowrap" }}>{q.q}</td>
                  <td style={{ padding: "2px 4px" }}>
                    <EditableCell value={q.rev} type="number" align="right" fmt={v => v != null ? fmtM(v) : "—"} onSave={v => saveQuarterField(q.q, "rev", v)} disabled={!canEdit} />
                  </td>
                  <td style={{ padding: "2px 4px" }}>
                    <EditableCell value={q.ebitda} type="number" align="right" fmt={v => v != null ? fmtM(v) : "—"} onSave={v => saveQuarterField(q.q, "ebitda", v)} disabled={!canEdit} />
                  </td>
                  <td style={{ padding: "2px 4px" }}>
                    <EditableCell value={q.dfn} type="number" align="right" fmt={v => v != null ? fmtM(v) : "—"} onSave={v => saveQuarterField(q.q, "dfn", v)} disabled={!canEdit} />
                  </td>
                  <td style={{ padding: "2px 4px" }}>
                    <EditableCell value={q.revBudget} type="number" align="right" fmt={v => v != null ? fmtM(v) : "—"} onSave={v => saveQuarterField(q.q, "revBudget", v)} disabled={!canEdit} />
                  </td>
                  <td style={{ padding: "2px 4px" }}>
                    <EditableCell value={q.ebitdaBudget} type="number" align="right" fmt={v => v != null ? fmtM(v) : "—"} onSave={v => saveQuarterField(q.q, "ebitdaBudget", v)} disabled={!canEdit} />
                  </td>
                  <td style={{ padding: "2px 4px" }}>
                    <EditableCell value={q.dfnBudget} type="number" align="right" fmt={v => v != null ? fmtM(v) : "—"} onSave={v => saveQuarterField(q.q, "dfnBudget", v)} disabled={!canEdit} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {canEdit && (
            <div style={{ marginTop: 12 }}>
              {!addingQuarter ? (
                <button onClick={() => setAddingQuarter(true)}
                  style={{ background: "transparent", border: `1.5px dashed ${tc.border}`, borderRadius: 6,
                    padding: "6px 14px", cursor: "pointer", fontSize: 12, color: tc.textMid,
                    fontFamily: "inherit", fontWeight: 600 }}>
                  + Nou trimestre
                </button>
              ) : (
                <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontSize: 11, color: tc.textLight, marginBottom: 3, textTransform: "uppercase" }}>Trimestre</div>
                    <select value={newQ.q} onChange={e => setNewQ(p => ({ ...p, q: e.target.value }))}
                      style={{ padding: "6px 10px", borderRadius: 6, border: `1.5px solid ${tc.border}`, background: tc.bg, color: tc.text, fontSize: 13, fontFamily: "inherit" }}>
                      {["1","2","3","4"].map(v => <option key={v} value={v}>Q{v}</option>)}
                    </select>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: tc.textLight, marginBottom: 3, textTransform: "uppercase" }}>Any</div>
                    <input type="number" value={newQ.year} onChange={e => setNewQ(p => ({ ...p, year: e.target.value }))}
                      style={{ padding: "6px 10px", borderRadius: 6, border: `1.5px solid ${tc.border}`, background: tc.bg, color: tc.text, fontSize: 13, fontFamily: "inherit", width: 80 }} />
                  </div>
                  <button onClick={addQuarter}
                    style={{ padding: "7px 14px", borderRadius: 6, border: "none", background: tc.navy, color: "#fff", cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 600 }}>
                    Afegir
                  </button>
                  <button onClick={() => setAddingQuarter(false)}
                    style={{ padding: "7px 14px", borderRadius: 6, border: `1.5px solid ${tc.border}`, background: "transparent", color: tc.textMid, cursor: "pointer", fontFamily: "inherit", fontSize: 12 }}>
                    Cancel·lar
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* "Nou trimestre" button when no quarters exist yet */}
      {quarters.length === 0 && canEdit && (
        <div style={{ marginTop: 8 }}>
          {!addingQuarter ? (
            <button onClick={() => setAddingQuarter(true)}
              style={{ background: "transparent", border: `1.5px dashed ${tc.border}`, borderRadius: 6,
                padding: "6px 14px", cursor: "pointer", fontSize: 12, color: tc.textMid,
                fontFamily: "inherit", fontWeight: 600 }}>
              + Nou trimestre
            </button>
          ) : (
            <div style={{ background: tc.card, border: `1px solid ${tc.border}`, borderRadius: 10, padding: "16px 20px" }}>
              <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontSize: 11, color: tc.textLight, marginBottom: 3, textTransform: "uppercase" }}>Trimestre</div>
                  <select value={newQ.q} onChange={e => setNewQ(p => ({ ...p, q: e.target.value }))}
                    style={{ padding: "6px 10px", borderRadius: 6, border: `1.5px solid ${tc.border}`, background: tc.bg, color: tc.text, fontSize: 13, fontFamily: "inherit" }}>
                    {["1","2","3","4"].map(v => <option key={v} value={v}>Q{v}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: tc.textLight, marginBottom: 3, textTransform: "uppercase" }}>Any</div>
                  <input type="number" value={newQ.year} onChange={e => setNewQ(p => ({ ...p, year: e.target.value }))}
                    style={{ padding: "6px 10px", borderRadius: 6, border: `1.5px solid ${tc.border}`, background: tc.bg, color: tc.text, fontSize: 13, fontFamily: "inherit", width: 80 }} />
                </div>
                <button onClick={addQuarter}
                  style={{ padding: "7px 14px", borderRadius: 6, border: "none", background: tc.navy, color: "#fff", cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 600 }}>
                  Afegir
                </button>
                <button onClick={() => setAddingQuarter(false)}
                  style={{ padding: "7px 14px", borderRadius: 6, border: `1.5px solid ${tc.border}`, background: "transparent", color: tc.textMid, cursor: "pointer", fontFamily: "inherit", fontSize: 12 }}>
                  Cancel·lar
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
