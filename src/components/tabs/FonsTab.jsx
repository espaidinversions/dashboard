import React, { useState } from "react";
import { Link } from "react-router-dom";
import { fmtM, slugify } from "../../utils.js";
import { Badge, AddRowModal, DeleteRowButton } from "../SharedComponents.jsx";
import { FY_LIST, VCPE_CFG, EST_CFG, CAPITAL_CALL_CAT_OPTIONS, CAPITAL_CALL_VCPE_OPTIONS, CAPITAL_CALL_EST_OPTIONS, CAPITAL_CALL_TIPUS_OPTIONS } from "../../config.js";
import { makeVehicleDetailPath } from "../../data/privateRoutes.js";

const DIVISA_OPTIONS = ["EUR", "USD"];

function ccFields(fonsList, defaultFons = "") {
  return [
    { key: "fons", label: "Fons", type: "select", options: fonsList, defaultValue: defaultFons },
    { key: "cat", label: "Categoria", type: "select", options: CAPITAL_CALL_CAT_OPTIONS, defaultValue: CAPITAL_CALL_CAT_OPTIONS[0] },
    { key: "data", label: "Data", type: "date" },
    { key: "eur", label: "Import EUR", type: "number" },
    { key: "divisa", label: "Divisa", type: "select", options: DIVISA_OPTIONS, defaultValue: "EUR" },
    { key: "vcpe", label: "VC/PE/RE", type: "select", options: CAPITAL_CALL_VCPE_OPTIONS, defaultValue: CAPITAL_CALL_VCPE_OPTIONS[0] },
    { key: "est", label: "Estratègia", type: "select", options: CAPITAL_CALL_EST_OPTIONS, defaultValue: CAPITAL_CALL_EST_OPTIONS[0] },
    { key: "tipus", label: "Tipus", type: "select", options: CAPITAL_CALL_TIPUS_OPTIONS, defaultValue: CAPITAL_CALL_TIPUS_OPTIONS[0] },
  ];
}

export function FonsTab({ tc, dark, FONS_MAP2, baseTx, vcpeCfg, estCfg, catCfg, canEdit, onInsertCC, onUpdateCC, onDeleteCC }) {
  const [expandedFons, setExpandedFons] = useState(new Set());
  const [sortFons, setSortFons] = useState("fons");
  const [sortFonsDir, setSortFonsDir] = useState("desc");
  const [ccChartF, setCcChartF] = useState(null);
  const [addModalFons, setAddModalFons] = useState(null); // fons name → open add modal
  const [editModalRow, setEditModalRow] = useState(null); // rawCC row → open edit modal

  const fonsList = FONS_MAP2.map(f => f.fons);

  async function handleAddCC(values, setError) {
    if (!values.fons || !values.data || !values.eur) { setError("Fons, data i import són obligatoris."); return; }
    const { error } = await onInsertCC({ ...values, eur: parseFloat(values.eur) });
    if (error) { setError(error.message); return; }
    setAddModalFons(null);
  }

  async function handleEditCC(values, setError) {
    if (!values.data || !values.eur) { setError("Data i import són obligatoris."); return; }
    const { error } = await onUpdateCC(editModalRow._rowId, { ...values, eur: parseFloat(values.eur) });
    if (error) { setError(error.message); return; }
    setEditModalRow(null);
  }

  async function handleDeleteCC(r) {
    if (!r._rowId) return;
    await onDeleteCC(r._rowId);
  }

  const rowExpandBg = dark ? "#0A1810" : "#F0FAF2";
  const rowExpandHeader = dark ? "#0A2010" : "#E0F4E8";
  const rowExpandBorder = dark ? "#1A3020" : "#C0E0C8";
  const rowExpandAlt = dark ? "#0D1A12" : "#F4FAF7";
  const greenBadgeBg = dark ? "#0A2010" : "#E8F8E8";

  const clickCcChart = (type, val) => setCcChartF(p => p && p.type === type && p.value === val ? null : { type, value: val });
  const isCcHl = (type, val) => !ccChartF || (ccChartF.type === type && ccChartF.value === val);
  const toggleExpand = fons => setExpandedFons(p => { const n = new Set(p); n.has(fons) ? n.delete(fons) : n.add(fons); return n; });
  const sortBy = k => {
    if (sortFons === k) setSortFonsDir(d => d === "asc" ? "desc" : "asc");
    else { setSortFons(k); setSortFonsDir("desc"); }
  };
  const FAr = ({ k }) => <span style={{ marginLeft: 3, opacity: sortFons === k ? 1 : 0.2, fontSize: 9 }}>
    {sortFons === k && sortFonsDir === "asc" ? "▲" : "▼"}
  </span>;

  const fonsFiltered = FONS_MAP2.filter(f => {
    if (ccChartF) {
      if (ccChartF.type === "vcpe" && f.vcpe !== ccChartF.value) return false;
      if (ccChartF.type === "est" && f.est !== ccChartF.value) return false;
    }
    return true;
  });

  const sorted = [...fonsFiltered].sort((a, b) => {
    let va = a[sortFons], vb = b[sortFons];
    if (typeof va === "string") {
      return sortFonsDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
    }
    return sortFonsDir === "asc" ? va - vb : vb - va;
  });

  const ccByFy = FY_LIST.map(fy => {
    const rows = baseTx.filter(r => r.fy === fy);
    const calls = rows.filter(r => r.cat === "Capital Call").reduce((s, r) => s + r.eur, 0);
    const dist = rows.filter(r => r.cat === "Distribució" || r.cat === "Retorn Capital").reduce((s, r) => s + Math.abs(r.eur), 0);
    return { fy: fy.replace("FY ", ""), "Capital Call": +calls.toFixed(0), "Retornat": +dist.toFixed(0) };
  }).filter(r => r["Capital Call"] || r["Retornat"]);

  const ccByVcpe = (() => {
    const m = {};
    baseTx.filter(r => r.cat === "Capital Call").forEach(r => { m[r.vcpe] = (m[r.vcpe] || 0) + r.eur; });
    return Object.entries(m).map(([name, value]) => ({ name, value: +value.toFixed(0) }));
  })();

  const ccByEst = (() => {
    const m = {};
    baseTx.filter(r => r.cat === "Capital Call" && r.est).forEach(r => { m[r.est] = (m[r.est] || 0) + r.eur; });
    return Object.entries(m).map(([name, value]) => ({ name, value: +value.toFixed(0) }));
  })();

  const totalCalls = fonsFiltered.reduce((s, f) => s + f.calls, 0);
  const totalCompr = fonsFiltered.reduce((s, f) => s + f.compr, 0);
  const totalDist = fonsFiltered.reduce((s, f) => s + f.dist, 0);
  const totalRetorn = fonsFiltered.reduce((s, f) => s + f.retorn, 0);
  const totalNet = totalDist + totalRetorn - totalCalls;

  const th = { padding: "8px 10px", fontSize: 10, letterSpacing: "0.08em", color: tc.textLight, textTransform: "uppercase", fontWeight: 600, whiteSpace: "nowrap" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Mini charts */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
        {[
          { title: "Per Any", data: ccByFy, colors: { "Capital Call": tc.navy, "Retornat": tc.green }, type: "fy" },
          { title: "Per VC/PE/RE", data: ccByVcpe, colors: { "PE": tc.navy, "VC": tc.green, "RE": "#6A4C8A" }, type: "vcpe" },
          { title: "Per Estratègia", data: ccByEst, colors: { "Fons Primari": tc.navy, "Fons de Fons": tc.green, "SOCIMI": "#6A4C8A" }, type: "est" },
        ].map((c, i) => (
          <div key={i} style={{ background: tc.card, border: `1px solid ${tc.border}`, borderRadius: 10, padding: "14px 16px" }}>
            <div style={{ fontSize: 10, color: tc.textLight, textTransform: "uppercase", marginBottom: 10, fontWeight: 600 }}>{c.title}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {c.data.map(d => (
                <button key={d.name} onClick={() => clickCcChart(c.type, d.name)}
                  style={{
                    padding: "3px 10px", borderRadius: 6, border: `1.5px solid ${ccChartF?.type === c.type && ccChartF?.value === d.name ? tc.green : tc.border}`,
                    background: ccChartF?.type === c.type && ccChartF?.value === d.name ? greenBadgeBg : "transparent",
                    color: ccChartF?.type === c.type && ccChartF?.value === d.name ? tc.green : tc.textMid,
                    fontSize: 11, cursor: "pointer", fontFamily: "inherit", fontWeight: 600
                  }}>
                  {d.name} · {fmtM(d.value)}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Main table */}
      <div style={{ background: tc.card, border: `1px solid ${tc.border}`, borderRadius: 10, boxShadow: "0 2px 8px rgba(0,0,0,.08)" }}>
        <div style={{ padding: "14px 18px", borderBottom: `1px solid ${tc.border}` }}>
          <span style={{ fontSize: 11, color: tc.textLight, textTransform: "uppercase", fontWeight: 600 }}>Fons · {fonsFiltered.length}</span>
          {ccChartF && (
            <button onClick={() => setCcChartF(null)} style={{ marginLeft: 12, background: "transparent", border: "none", cursor: "pointer", fontSize: 11, color: tc.green, fontFamily: "inherit" }}>
              ✕ Netejar
            </button>
          )}
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: tc.bgAlt }}>
                {[
                  { k: "fons", l: "Fons", w: "20%" },
                  { k: "compr", l: "Compromís", right: true },
                  { k: "calls", l: "Cridat", right: true },
                  { k: "pct", l: "%", right: true },
                  { k: "dist", l: "Dist", right: true },
                  { k: "retorn", l: "Retorn", right: true },
                  { k: "rebut", l: "DPI", right: true },
                  { k: "net", l: "Net", right: true },
                  { k: "vcpe", l: "VC/PE", center: true },
                  { k: "est", l: "Est", center: true },
                ].map(h => (
                  <th key={h.k} onClick={() => sortBy(h.k)}
                    style={{ ...th, textAlign: h.right ? "right" : h.center ? "center" : "left", cursor: "pointer", padding: "8px 10px" }}>
                    {h.l}<FAr k={h.k} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((f, i) => {
                const isExp = expandedFons.has(f.fons);
                const rebut = f.calls > 0 ? f.dist / f.calls : 0;
                const moviments = baseTx.filter(r => r.fons === f.fons);
                const pct = f.compr > 0 ? (f.calls / f.compr * 100).toFixed(1) + "%" : "—";
                return (
                  <React.Fragment key={f.fons}>
                    <tr
                      onClick={() => toggleExpand(f.fons)}
                      style={{ cursor: "pointer", background: i % 2 === 0 ? "transparent" : tc.bgAlt, borderBottom: `1px solid ${tc.border}` }}
                      className="hoverable"
                    >
                      <td style={{ padding: "10px 10px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ color: tc.textMid, fontSize: 12 }}>{isExp ? "▼" : "▶"}</span>
                          <Link to={makeVehicleDetailPath(f)} onClick={e => e.stopPropagation()}
                            style={{ color: tc.navy, fontWeight: 600, fontSize: 13, textDecoration: "none" }}>
                            {f.fons}
                          </Link>
                        </div>
                      </td>
                      <td style={{ padding: "10px 10px", textAlign: "right", fontFamily: "'DM Mono',monospace", fontSize: 12, color: tc.navyLight }}>{fmtM(f.compr)}</td>
                      <td style={{ padding: "10px 10px", textAlign: "right", fontFamily: "'DM Mono',monospace", fontSize: 12, color: tc.navy }}>{fmtM(f.calls)}</td>
                      <td style={{ padding: "10px 10px", textAlign: "right", fontSize: 11, color: tc.textMid }}>{pct}</td>
                      <td style={{ padding: "10px 10px", textAlign: "right", fontFamily: "'DM Mono',monospace", fontSize: 12, color: tc.green }}>{f.dist ? fmtM(f.dist) : "—"}</td>
                      <td style={{ padding: "10px 10px", textAlign: "right", fontFamily: "'DM Mono',monospace", fontSize: 12, color: tc.greenDark }}>{f.retorn ? fmtM(f.retorn) : "—"}</td>
                      <td style={{ padding: "10px 10px", textAlign: "right", fontFamily: "'DM Mono',monospace", fontSize: 12, fontWeight: 700, color: tc.green }}>{rebut ? fmtM(rebut) : "—"}</td>
                      <td style={{ padding: "10px 10px", textAlign: "right", fontFamily: "'DM Mono',monospace", fontSize: 12, fontWeight: 700, color: f.net >= 0 ? tc.greenDark : tc.navy }}>{f.net >= 0 ? "+" : ""}{fmtM(f.net)}</td>
                      <td style={{ padding: "10px 10px" }}><Badge label={f.vcpe} cfg={VCPE_CFG[f.vcpe]} /></td>
                      <td style={{ padding: "10px 10px" }}><Badge label={f.est} cfg={EST_CFG[f.est]} /></td>
                    </tr>
                    {isExp && (
                      <tr key={`exp-${i}`} style={{ borderBottom: `2px solid ${tc.green}` }}>
                        <td colSpan={12} style={{ padding: 0, background: rowExpandBg }}>
                          <div style={{ padding: "0 16px 14px 52px" }}>
                            <div style={{ fontSize: 10, letterSpacing: "0.12em", color: tc.green, textTransform: "uppercase", fontWeight: 700, padding: "10px 0 8px" }}>
                              Moviments · {moviments.length} transaccions
                            </div>
                            {moviments.length === 0
                              ? <div style={{ fontSize: 12, color: tc.textLight, padding: "8px 0" }}>Cap moviment amb els filtres actuals.</div>
                              : <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                  <thead>
                                    <tr style={{ background: rowExpandHeader }}>
                                      {["Data", "Tipus", "Categoria", "FY", "Import EUR", ...(canEdit ? [""] : [])].map(h => (
                                        <th key={h} style={{ padding: "6px 10px", fontSize: 10, letterSpacing: "0.08em", color: tc.greenDark, textTransform: "uppercase", fontWeight: 600, textAlign: h === "Import EUR" ? "right" : "left", whiteSpace: "nowrap", borderBottom: `1px solid ${rowExpandBorder}` }}>{h}</th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {moviments.map((r, mi) => {
                                      const isIn = r.eur > 0;
                                      const cfg = catCfg[r.cat] || {};
                                      return (
                                        <tr key={mi} style={{ borderBottom: `1px solid ${rowExpandBorder}`, background: mi % 2 === 0 ? "transparent" : rowExpandAlt }}>
                                          <td style={{ padding: "6px 10px", fontSize: 11, color: tc.textMid, whiteSpace: "nowrap" }}>{r.data}</td>
                                          <td style={{ padding: "6px 10px", fontSize: 11, color: tc.textMid, whiteSpace: "nowrap" }}>{r.tipus}</td>
                                          <td style={{ padding: "6px 10px" }}>
                                            <span style={{ fontSize: 10, background: cfg.bg || tc.bgAlt, color: cfg.color || tc.textMid, borderRadius: 4, padding: "1px 7px", fontWeight: 600 }}>{r.cat}</span>
                                          </td>
                                          <td style={{ padding: "6px 10px", fontSize: 11, color: tc.textLight }}>{r.fy}</td>
                                          <td style={{ padding: "6px 10px", textAlign: "right", fontFamily: "'DM Mono',monospace", fontSize: 12, fontWeight: 700, color: isIn ? tc.navy : tc.green }}>
                                            {!isIn && "+ "}{fmtM(Math.abs(r.eur))}
                                          </td>
                                          {canEdit && (
                                            <td style={{ padding: "4px 8px", whiteSpace: "nowrap" }}>
                                              {r._rowId && (
                                                <span style={{ display: "flex", gap: 4 }}>
                                                  <button onClick={() => setEditModalRow(r)}
                                                    style={{ padding: "2px 8px", borderRadius: 4, border: `1px solid ${rowExpandBorder}`, background: "transparent", color: tc.textMid, cursor: "pointer", fontSize: 10, fontFamily: "inherit" }}>
                                                    Edita
                                                  </button>
                                                  <DeleteRowButton onDelete={() => handleDeleteCC(r)} />
                                                </span>
                                              )}
                                            </td>
                                          )}
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                            }
                            {canEdit && (
                              <div style={{ paddingTop: 8 }}>
                                <button onClick={() => setAddModalFons(f.fons)}
                                  style={{ padding: "4px 12px", borderRadius: 4, border: `1px solid ${rowExpandBorder}`, background: "transparent", color: tc.green, cursor: "pointer", fontSize: 11, fontFamily: "inherit", fontWeight: 600 }}>
                                  ＋ Afegeix moviment
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: `2px solid ${tc.border}`, background: tc.bgAlt }}>
                <td style={{ padding: "9px 10px", fontSize: 12, fontWeight: 700 }}>TOTAL ({fonsFiltered.length} fons)</td>
                <td style={{ padding: "9px 10px", textAlign: "right", fontFamily: "'DM Mono',monospace", fontWeight: 700, color: tc.navyLight, fontSize: 12 }}>{fmtM(totalCompr)}</td>
                <td style={{ padding: "9px 10px", textAlign: "right", fontFamily: "'DM Mono',monospace", fontWeight: 700, color: tc.navy, fontSize: 12 }}>{fmtM(totalCalls)}</td>
                <td style={{ padding: "9px 10px", textAlign: "right", fontSize: 11, color: tc.textMid }}>{totalCompr > 0 ? (totalCalls / totalCompr * 100).toFixed(1) + "%" : "—"}</td>
                <td style={{ padding: "9px 10px", textAlign: "right", fontFamily: "'DM Mono',monospace", fontWeight: 700, color: tc.green, fontSize: 12 }}>{fmtM(totalDist)}</td>
                <td style={{ padding: "9px 10px", textAlign: "right", fontFamily: "'DM Mono',monospace", fontWeight: 700, color: tc.greenDark, fontSize: 12 }}>{fmtM(totalRetorn)}</td>
                <td style={{ padding: "9px 10px", textAlign: "right", fontFamily: "'DM Mono',monospace", fontWeight: 700, color: tc.green, fontSize: 12 }}>{fmtM(totalDist + totalRetorn)}</td>
                <td style={{ padding: "9px 10px", textAlign: "right", fontFamily: "'DM Mono',monospace", fontWeight: 700, fontSize: 12 }}>{(totalNet >= 0 ? "+" : "") + fmtM(totalNet)}</td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
      {addModalFons && (
        <AddRowModal
          title={`Nou moviment · ${addModalFons}`}
          fields={ccFields(fonsList, addModalFons)}
          onSave={handleAddCC}
          onClose={() => setAddModalFons(null)}
        />
      )}

      {editModalRow && (
        <AddRowModal
          title={`Edita moviment · ${editModalRow.fons}`}
          fields={ccFields(fonsList, editModalRow.fons).map(f => ({
            ...f,
            defaultValue: editModalRow[f.key] ?? f.defaultValue ?? "",
          }))}
          onSave={handleEditCC}
          onClose={() => setEditModalRow(null)}
        />
      )}
    </div>
  );
}
