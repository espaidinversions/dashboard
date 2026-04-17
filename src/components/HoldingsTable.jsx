import React, { useState, useMemo, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { PM_MODEL } from "../data/publicMarketsModel.js";
import { WAM_POSITIONS } from "../data/wamPositions.js";
import { useTheme } from "../theme.js";
import { fmtM } from "../utils.js";
import { useAuth } from "../auth.jsx";
import { loadPMPositionOverrides, upsertPMPositionOverride } from "../db.js";

const PM_STATIC = [...PM_MODEL.holdings.active, ...WAM_POSITIONS];

function SectionHeader({ tipus, count, total, tc }) {
  const isRV  = tipus === "RV";
  const color = isRV ? tc.navy : "#7A6000";
  const label = isRV ? "Renda Variable" : "Renda Fixa";
  return (
    <tr>
      <td colSpan={11} style={{
        padding: "8px 10px", fontWeight: 700, fontSize: 10,
        letterSpacing: "0.09em", textTransform: "uppercase",
        color, borderBottom: `2px solid ${tc.border}`,
        borderTop: `1px solid ${tc.border}`,
      }}>
        {label} · <span style={{ fontFamily: "'DM Mono',monospace" }}>{count} posicions · {fmtM(total)}</span>
      </td>
    </tr>
  );
}

function PnlCell({ v, tc }) {
  if (v == null) {
    return <td style={{ padding: "6px 10px", textAlign: "right", color: tc.textLight, fontFamily: "'DM Mono',monospace" }}>—</td>;
  }
  const color = v > 0 ? tc.green : v < 0 ? tc.red : tc.textLight;
  const bg    = v > 0 ? (tc.green + "18") : v < 0 ? (tc.red + "15") : "transparent";
  const label = (v >= 0 ? "+" : "") + v.toFixed(2) + "%";
  return (
    <td style={{ padding: "6px 10px", textAlign: "right" }}>
      <span style={{ fontFamily: "'DM Mono',monospace", fontWeight: 700, fontSize: 11, color, background: bg, borderRadius: 4, padding: "1px 5px" }}>{label}</span>
    </td>
  );
}

/** Inline editable cell — shows value normally, becomes an input on click when canEdit=true. */
function EditableCell({ value, canEdit, onSave, renderValue, td }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState("");

  const startEdit = () => { setDraft(value != null ? String(value) : ""); setEditing(true); };
  const commit = () => {
    const n = parseFloat(draft);
    if (!isNaN(n)) onSave(n);
    setEditing(false);
  };
  const cancel = () => setEditing(false);

  if (editing) {
    return (
      <td style={{ ...td, padding: "2px 6px" }}>
        <input
          autoFocus
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); commit(); } if (e.key === "Escape") cancel(); }}
          style={{
            width: "100%", fontSize: 11, fontFamily: "'DM Mono',monospace",
            border: "1.5px solid #4A90D9", borderRadius: 3, padding: "3px 5px",
            background: "transparent", color: "inherit", outline: "none",
          }}
        />
      </td>
    );
  }
  return (
    <td
      style={{ ...td, cursor: canEdit ? "pointer" : "default", position: "relative" }}
      onClick={canEdit ? startEdit : undefined}
      title={canEdit ? "Clica per editar" : undefined}
    >
      {renderValue()}
      {canEdit && (
        <span className="edit-pencil" style={{
          position: "absolute", right: 4, top: "50%", transform: "translateY(-50%)",
          fontSize: 9, opacity: 0, transition: "opacity 0.15s", color: "#4A90D9",
          pointerEvents: "none",
        }}>✏</span>
      )}
    </td>
  );
}

export function HoldingsTable() {
  const { tc, dark } = useTheme();
  const { canEdit }  = useAuth();

  const [custodianFilter, setCustodianFilter] = useState("all");
  const [tipusFilter,     setTipusFilter]     = useState("all");
  const [sortCol, setSortCol] = useState("valorMercat");
  const [sortDir, setSortDir] = useState("desc");
  const [overrides, setOverrides] = useState(new Map()); // isin → {valorMercat, rendInici, ...}

  // Load overrides from Supabase on mount
  useEffect(() => {
    loadPMPositionOverrides().then(map => { if (map) setOverrides(map); });
  }, []);

  const handleSave = useCallback(async (isin, field, value) => {
    // Optimistic update
    setOverrides(prev => {
      const next = new Map(prev);
      const existing = next.get(isin) ?? {};
      next.set(isin, { ...existing, [field]: value });
      return next;
    });
    await upsertPMPositionOverride(isin, { [field]: value });
  }, []);

  const handleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === "desc" ? "asc" : "desc");
    else { setSortCol(col); setSortDir("desc"); }
  };

  // Merge static data with overrides, then recompute pes
  const mergedPositions = useMemo(() => {
    const merged = PM_STATIC.map(p => {
      const ov = overrides.get(p.isin);
      if (!ov) return p;
      const out = { ...p, _overrideFields: new Set() };
      const ovf = out._overrideFields;
      if (ov.valorMercat != null) { out.valorMercat = ov.valorMercat; ovf.add("valorMercat"); }
      if (ov.rendInici   != null) { out.rendInici   = ov.rendInici;   ovf.add("rendInici");   }
      if (ov.rend2026    != null) { out.rend2026    = ov.rend2026;    ovf.add("rend2026");    }
      if (ov.rend2025    != null) { out.rend2025    = ov.rend2025;    ovf.add("rend2025");    }
      if (ov.rend2024    != null) { out.rend2024    = ov.rend2024;    ovf.add("rend2024");    }
      if (ov.rend2023    != null) { out.rend2023    = ov.rend2023;    ovf.add("rend2023");    }
      if (ov.costAnual   != null) { out.costAnual   = ov.costAnual;   ovf.add("costAnual");   }
      return out;
    });
    const totalVM = merged.reduce((s, p) => s + (p.valorMercat || 0), 0);
    if (totalVM > 0) {
      return merged.map(p => ({ ...p, pes: p.valorMercat != null ? (p.valorMercat / totalVM) * 100 : p.pes }));
    }
    return merged;
  }, [overrides]);

  const OverrideBadge = () => (
    <span title="Valor manual (override)" style={{
      fontSize: 8, fontWeight: 700, letterSpacing: "0.04em",
      background: "#FFF3E0", color: "#E65100",
      borderRadius: 3, padding: "1px 4px", marginLeft: 4, verticalAlign: "middle",
    }}>OV</span>
  );

  const rows = useMemo(() => {
    let all = [...mergedPositions];
    if (custodianFilter !== "all") all = all.filter(p => p.custodian === custodianFilter);
    if (tipusFilter     !== "all") all = all.filter(p => p.tipus     === tipusFilter);
    all.sort((a, b) => {
      const va = a[sortCol] ?? (sortDir === "desc" ? -Infinity : Infinity);
      const vb = b[sortCol] ?? (sortDir === "desc" ? -Infinity : Infinity);
      if (typeof va === "string") return sortDir === "desc" ? vb.localeCompare(va) : va.localeCompare(vb);
      return sortDir === "desc" ? vb - va : va - vb;
    });
    return all;
  }, [mergedPositions, custodianFilter, tipusFilter, sortCol, sortDir]);

  const th = {
    padding: "8px 10px", fontSize: 10, letterSpacing: "0.09em",
    color: tc.textLight, textTransform: "uppercase", fontWeight: 600,
    borderBottom: `2px solid ${tc.border}`, whiteSpace: "nowrap",
    userSelect: "none", cursor: "pointer",
  };

  const sortIcon = (col) => {
    if (sortCol !== col) return <span style={{ opacity: 0.3 }}> ↕</span>;
    return <span style={{ color: tc.navy }}>{sortDir === "desc" ? " ↓" : " ↑"}</span>;
  };

  const pillBtn = (active, onClick, label) => (
    <button onClick={onClick} style={{
      padding: "3px 10px", borderRadius: 5, fontSize: 11,
      border: `1.5px solid ${active ? tc.navy : tc.border}`,
      background: active ? (dark ? "#0A1A30" : "#E8F0FA") : "transparent",
      color: active ? tc.navy : tc.textLight,
      cursor: "pointer", fontFamily: "inherit",
      fontWeight: active ? 700 : 400,
    }}>{label}</button>
  );

  return (
    <div style={{
      background: tc.card, borderRadius: 10,
      border: `1px solid ${tc.border}`,
      padding: "20px 24px",
      boxShadow: "0 2px 8px rgba(0,0,0,.06)",
    }}>
      <style>{`.hoverable:hover .edit-pencil { opacity: 1 !important; }`}</style>

      {/* ── Filter pills ── */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 4 }}>
          {pillBtn(tipusFilter === "all", () => setTipusFilter("all"), "Tots")}
          {pillBtn(tipusFilter === "RV",  () => setTipusFilter("RV"),  "RV")}
          {pillBtn(tipusFilter === "RF",  () => setTipusFilter("RF"),  "RF")}
        </div>
        <div style={{ width: 1, height: 20, background: tc.border }} />
        <div style={{ display: "flex", gap: 4 }}>
          {pillBtn(custodianFilter === "all",             () => setCustodianFilter("all"),             "Tots els custodians")}
          {pillBtn(custodianFilter === "CaixaBank",       () => setCustodianFilter("CaixaBank"),       "CaixaBank")}
          {pillBtn(custodianFilter === "Bankinter",       () => setCustodianFilter("Bankinter"),       "Bankinter")}
          {pillBtn(custodianFilter === "Interactive Brokers", () => setCustodianFilter("Interactive Brokers"), "Interactive Brokers")}
          {pillBtn(custodianFilter === "JPMorgan",        () => setCustodianFilter("JPMorgan"),        "JPMorgan")}
          {pillBtn(custodianFilter === "UBS",             () => setCustodianFilter("UBS"),             "UBS")}
          {pillBtn(custodianFilter === "Credit Suisse",  () => setCustodianFilter("Credit Suisse"),   "Credit Suisse")}
          {pillBtn(custodianFilter === "Andbank",         () => setCustodianFilter("Andbank"),         "Andbank")}
        </div>
        <div style={{ fontSize: 11, color: tc.textLight, marginLeft: "auto" }}>
          {rows.length} posicions · {fmtM(rows.reduce((s, p) => s + (p.valorMercat || 0), 0))}
        </div>
      </div>

      {/* ── Table ── */}
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", fontSize: 12, width: "100%", minWidth: 900 }}>
          <thead>
            <tr>
              <th style={{ ...th, textAlign: "left"  }} onClick={() => handleSort("nom")}>
                Nom{sortIcon("nom")}
              </th>
              <th style={{ ...th, textAlign: "left"  }} onClick={() => handleSort("custodian")}>
                Custodi{sortIcon("custodian")}
              </th>
              <th style={{ ...th, textAlign: "left"  }}>Tipus</th>
              <th style={{ ...th, textAlign: "left"  }}>ISIN</th>
              <th style={{ ...th, textAlign: "right" }} onClick={() => handleSort("dataCompra")}>
                Data compra{sortIcon("dataCompra")}
              </th>
              <th style={{ ...th, textAlign: "right" }} onClick={() => handleSort("valorMercat")}>
                Valor mercat{sortIcon("valorMercat")}{canEdit && <span style={{ marginLeft: 3, fontSize: 8, opacity: 0.5 }}>✏</span>}
              </th>
              <th style={{ ...th, textAlign: "right" }} onClick={() => handleSort("rendInici")}>
                P&amp;L{sortIcon("rendInici")}{canEdit && <span style={{ marginLeft: 3, fontSize: 8, opacity: 0.5 }}>✏</span>}
              </th>
              <th style={{ ...th, textAlign: "right" }} onClick={() => handleSort("pes")}>
                Pes %{sortIcon("pes")}
              </th>
              <th style={{ ...th, textAlign: "right" }} onClick={() => handleSort("rend2026")}>
                YTD{sortIcon("rend2026")}{canEdit && <span style={{ marginLeft: 3, fontSize: 8, opacity: 0.5 }}>✏</span>}
              </th>
              <th style={{ ...th, textAlign: "right" }} onClick={() => handleSort("rend2025")}>
                2025{sortIcon("rend2025")}{canEdit && <span style={{ marginLeft: 3, fontSize: 8, opacity: 0.5 }}>✏</span>}
              </th>
              <th style={{ ...th, textAlign: "right" }} onClick={() => handleSort("costAnual")}>
                TER{sortIcon("costAnual")}{canEdit && <span style={{ marginLeft: 3, fontSize: 8, opacity: 0.5 }}>✏</span>}
              </th>
              <th style={{ ...th, textAlign: "center" }}>MS</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p, i) => {
              const zebra  = i % 2 === 1;
              const bg     = zebra ? (dark ? tc.bgAlt : "#f8f9fb") : tc.card;
              const msUrl  = `https://www.morningstar.es/es/search/results.aspx?keyword=${p.isin}`;
              const isRV   = p.tipus === "RV";
              const typColor = isRV ? "#2B5070" : "#7A6000";
              const typBg    = isRV ? "#E6EDF3" : "#FFF8E1";
              return (
                <tr key={p.id} className="hoverable" style={{ background: bg, borderBottom: `1px solid ${tc.border}` }}>
                  <td style={{ padding: "6px 10px", fontWeight: 500 }}>
                    <Link to={`/mercats-publics/${p.id}`}
                      style={{ color: tc.navy, textDecoration: "none" }}>
                      {p.nom}
                    </Link>
                  </td>
                  <td style={{ padding: "6px 10px", fontSize: 11, color: tc.textLight }}>{p.custodian}</td>
                  <td style={{ padding: "6px 10px" }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: typColor, background: typBg, borderRadius: 4, padding: "1px 6px" }}>
                      {p.tipus}
                    </span>
                  </td>
                  <td style={{ padding: "6px 10px", fontFamily: "'DM Mono',monospace", fontSize: 10, color: tc.textLight }}>{p.isin}</td>
                  <td style={{ padding: "6px 10px", textAlign: "right", fontSize: 10, color: tc.textLight, fontFamily: "'DM Mono',monospace" }}>{p.dataCompra}</td>

                  {/* Editable: valorMercat */}
                  <EditableCell
                    value={p.valorMercat}
                    canEdit={canEdit}
                    onSave={v => handleSave(p.isin, "valorMercat", v)}
                    renderValue={() => (
                      <span style={{ fontFamily: "'DM Mono',monospace", fontWeight: 600, color: tc.navy }}>
                        {p.valorMercat != null ? fmtM(p.valorMercat) : "—"}
                        {p._overrideFields?.has("valorMercat") && <OverrideBadge />}
                      </span>
                    )}
                    td={{ padding: "6px 10px", textAlign: "right" }}
                  />

                  {/* Editable: rendInici — wraps PnlCell inline */}
                  <EditableCell
                    value={p.rendInici}
                    canEdit={canEdit}
                    onSave={v => handleSave(p.isin, "rendInici", v)}
                    renderValue={() => {
                      const v = p.rendInici;
                      if (v == null) return <span style={{ color: tc.textLight, fontFamily: "'DM Mono',monospace" }}>—</span>;
                      const color = v > 0 ? tc.green : v < 0 ? tc.red : tc.textLight;
                      const bg2   = v > 0 ? (tc.green + "18") : v < 0 ? (tc.red + "15") : "transparent";
                      return <span style={{ fontFamily: "'DM Mono',monospace", fontWeight: 700, fontSize: 11, color, background: bg2, borderRadius: 4, padding: "1px 5px" }}>
                        {(v >= 0 ? "+" : "") + v.toFixed(2) + "%"}
                        {p._overrideFields?.has("rendInici") && <OverrideBadge />}
                      </span>;
                    }}
                    td={{ padding: "6px 10px", textAlign: "right" }}
                  />

                  <td style={{ padding: "6px 10px", textAlign: "right", fontSize: 11, fontFamily: "'DM Mono',monospace", color: tc.textLight }}>
                    {p.pes != null ? p.pes.toFixed(1) + "%" : "—"}
                  </td>

                  {/* Editable: rend2026 */}
                  <EditableCell
                    value={p.rend2026}
                    canEdit={canEdit}
                    onSave={v => handleSave(p.isin, "rend2026", v)}
                    renderValue={() => {
                      const v = p.rend2026;
                      if (v == null) return <span style={{ color: tc.textLight, fontFamily: "'DM Mono',monospace" }}>—</span>;
                      const color = v > 0 ? tc.green : v < 0 ? tc.red : tc.textLight;
                      const bg2   = v > 0 ? (tc.green + "18") : v < 0 ? (tc.red + "15") : "transparent";
                      return <span style={{ fontFamily: "'DM Mono',monospace", fontWeight: 700, fontSize: 11, color, background: bg2, borderRadius: 4, padding: "1px 5px" }}>
                        {(v >= 0 ? "+" : "") + v.toFixed(2) + "%"}
                        {p._overrideFields?.has("rend2026") && <OverrideBadge />}
                      </span>;
                    }}
                    td={{ padding: "6px 10px", textAlign: "right" }}
                  />

                  {/* Editable: rend2025 */}
                  <EditableCell
                    value={p.rend2025}
                    canEdit={canEdit}
                    onSave={v => handleSave(p.isin, "rend2025", v)}
                    renderValue={() => {
                      const v = p.rend2025;
                      if (v == null) return <span style={{ color: tc.textLight, fontFamily: "'DM Mono',monospace" }}>—</span>;
                      const color = v > 0 ? tc.green : v < 0 ? tc.red : tc.textLight;
                      const bg2   = v > 0 ? (tc.green + "18") : v < 0 ? (tc.red + "15") : "transparent";
                      return <span style={{ fontFamily: "'DM Mono',monospace", fontWeight: 700, fontSize: 11, color, background: bg2, borderRadius: 4, padding: "1px 5px" }}>
                        {(v >= 0 ? "+" : "") + v.toFixed(2) + "%"}
                        {p._overrideFields?.has("rend2025") && <OverrideBadge />}
                      </span>;
                    }}
                    td={{ padding: "6px 10px", textAlign: "right" }}
                  />

                  {/* Editable: costAnual (TER) */}
                  <EditableCell
                    value={p.costAnual}
                    canEdit={canEdit}
                    onSave={v => handleSave(p.isin, "costAnual", v)}
                    renderValue={() => (
                      <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: tc.textLight }}>
                        {p.costAnual != null ? p.costAnual.toFixed(2) + "%" : "—"}
                        {p._overrideFields?.has("costAnual") && <OverrideBadge />}
                      </span>
                    )}
                    td={{ padding: "6px 10px", textAlign: "right" }}
                  />

                  <td style={{ padding: "6px 10px", textAlign: "center" }}>
                    {p.isin ? (
                      <a href={msUrl} target="_blank" rel="noreferrer"
                         style={{ color: "#E8A020", fontSize: 11, textDecoration: "none" }} title="Morningstar">★</a>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ fontSize: 10, color: tc.textLight, marginTop: 12, fontStyle: "italic" }}>
        UBS, WAM i Andbank inclosos quan hi ha posicions individuals; la vista consolidada també conserva els mandats de custòdia.
      </div>
    </div>
  );
}
