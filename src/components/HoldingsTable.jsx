import React, { useState, useMemo, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { PM_MODEL } from "../data/publicMarketsModel.js";
import { WAM_POSITIONS } from "../data/wamPositions.js";
import { makeAggregatePosition, splitIbPositions, sumMarketValue } from "../data/pmClassification.js";
import { TC_LIGHT, useTheme } from "../theme.js";
import { fmtM } from "../utils.js";
import { useAuth } from "../auth.jsx";
import { loadPMPositionOverrides, upsertPMPositionOverride } from "../db.js";
import { useToast } from "../toast.jsx";

const PM_ACTIVE = PM_MODEL.holdings.active;

function buildHoldingsRows() {
  const { etfs: ibEtfs, stocks: ibStocks } = splitIbPositions(PM_ACTIVE);
  const rows = PM_ACTIVE.filter(position => position.custodian !== "Interactive Brokers");

  if (sumMarketValue(ibEtfs) > 0) {
    rows.push(makeAggregatePosition({
      id: "aggregate-ib-etfs",
      nom: "Interactive Brokers · ETFs (agregat)",
      gestor: "Interactive Brokers",
      custodian: "Interactive Brokers",
      tipus: "RV",
      positions: ibEtfs,
    }));
  }
  if (sumMarketValue(ibStocks) > 0) {
    rows.push(makeAggregatePosition({
      id: "aggregate-ib-accions",
      nom: "Interactive Brokers · Accions (agregat)",
      gestor: "Interactive Brokers",
      custodian: "Interactive Brokers",
      tipus: "RV",
      positions: ibStocks,
    }));
  }
  if (sumMarketValue(WAM_POSITIONS) > 0) {
    rows.push(makeAggregatePosition({
      id: "aggregate-wam-andbank",
      nom: "WAM–Andbank · Renda Fixa (agregat)",
      gestor: "WAM",
      custodian: "Andbank",
      tipus: "RF",
      positions: WAM_POSITIONS,
    }));
  }
  return rows;
}

const PM_STATIC = buildHoldingsRows();

function SectionHeader({ tipus, count, total, tc = TC_LIGHT }) {
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

function PnlCell({ v, tc = TC_LIGHT }) {
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
            border: "1.5px solid #4A90D9", borderRadius: 4, padding: "3px 5px",
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

export function HoldingsTable({ assetClass = "all", title = "Posicions" } = {}) {
  const { tc, dark } = useTheme();
  const { canEditSection }  = useAuth();
  const canEdit = canEditSection("mercats-publics");
  const { toast } = useToast();

  const currentYear = new Date().getFullYear();
  const ytdKey  = `rend${currentYear}`;
  const prevKey = `rend${currentYear - 1}`;

  const [custodianFilter, setCustodianFilter] = useState("all");
  const [tipusFilter,     setTipusFilter]     = useState(assetClass === "RV" || assetClass === "RF" ? assetClass : "all");
  const [columnFilters, setColumnFilters] = useState({ nom:"", custodian:"", tipus:"Tots", isin:"", dataCompra:"", valorMercat:"", rendInici:"", pes:"", [ytdKey]:"", [prevKey]:"", costAnual:"" });
  const [sortCol, setSortCol] = useState("valorMercat");
  const [sortDir, setSortDir] = useState("desc");
  const [overrides, setOverrides] = useState(new Map()); // isin → {valorMercat, rendInici, rendiment:{}, costAnual}

  // Load overrides from Supabase on mount
  useEffect(() => {
    loadPMPositionOverrides().then(map => { if (map) setOverrides(map); });
  }, []);

  const handleSave = useCallback(async (isin, field, value) => {
    const yearMatch = /^rend(\d{4})$/.exec(field);
    setOverrides(prev => {
      const next = new Map(prev);
      const existing = next.get(isin) ?? {};
      if (yearMatch) {
        next.set(isin, { ...existing, rendiment: { ...(existing.rendiment ?? {}), [yearMatch[1]]: value } });
      } else {
        next.set(isin, { ...existing, [field]: value });
      }
      return next;
    });
    let result;
    if (yearMatch) {
      const existing = overrides.get(isin);
      result = await upsertPMPositionOverride(isin, { rendiment: { ...(existing?.rendiment ?? {}), [yearMatch[1]]: value } });
    } else {
      result = await upsertPMPositionOverride(isin, { [field]: value });
    }
    if (result?.error) toast({ message: "Error desant: " + result.error.message, type: "error" });
  }, [overrides, toast]);

  const handleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === "desc" ? "asc" : "desc");
    else { setSortCol(col); setSortDir("desc"); }
  };

  // Merge static data with overrides, then recompute pes
  const mergedPositions = useMemo(() => {
    const merged = PM_STATIC.map(p => {
      const ov = p._aggregate || !p.isin ? null : overrides.get(p.isin);
      if (!ov) return p;
      const out = { ...p, _overrideFields: new Set() };
      const ovf = out._overrideFields;
      if (ov.valorMercat != null) { out.valorMercat = ov.valorMercat; ovf.add("valorMercat"); }
      if (ov.rendInici   != null) { out.rendInici   = ov.rendInici;   ovf.add("rendInici");   }
      if (ov.rendiment)           { for (const [yr, val] of Object.entries(ov.rendiment)) { if (val != null) { out[`rend${yr}`] = val; ovf.add(`rend${yr}`); } } }
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
      borderRadius: 4, padding: "1px 4px", marginLeft: 4, verticalAlign: "middle",
    }}>OV</span>
  );

  const rows = useMemo(() => {
    let all = [...mergedPositions];
    if (custodianFilter !== "all") all = all.filter(p => p.custodian === custodianFilter);
    if (tipusFilter     !== "all") all = all.filter(p => p.tipus     === tipusFilter);
    all = all.filter((p) => {
      if (columnFilters.nom && !String(p.nom ?? "").toLowerCase().includes(columnFilters.nom.toLowerCase())) return false;
      if (columnFilters.custodian && !String(p.custodian ?? "").toLowerCase().includes(columnFilters.custodian.toLowerCase())) return false;
      if (columnFilters.tipus !== "Tots" && p.tipus !== columnFilters.tipus) return false;
      if (columnFilters.isin && !String(p.isin ?? "").toLowerCase().includes(columnFilters.isin.toLowerCase())) return false;
      if (columnFilters.dataCompra && !String(p.dataCompra ?? "").includes(columnFilters.dataCompra)) return false;
      if (columnFilters.valorMercat && !String(p.valorMercat ?? "").includes(columnFilters.valorMercat)) return false;
      if (columnFilters.rendInici && !String(p.rendInici ?? "").includes(columnFilters.rendInici)) return false;
      if (columnFilters.pes && !String(p.pes ?? "").includes(columnFilters.pes)) return false;
      if (columnFilters[ytdKey]  && !String(p[ytdKey]  ?? "").includes(columnFilters[ytdKey]))  return false;
      if (columnFilters[prevKey] && !String(p[prevKey] ?? "").includes(columnFilters[prevKey])) return false;
      if (columnFilters.costAnual && !String(p.costAnual ?? "").includes(columnFilters.costAnual)) return false;
      return true;
    });
    all.sort((a, b) => {
      const va = a[sortCol] ?? (sortDir === "desc" ? -Infinity : Infinity);
      const vb = b[sortCol] ?? (sortDir === "desc" ? -Infinity : Infinity);
      if (typeof va === "string") return sortDir === "desc" ? vb.localeCompare(va) : va.localeCompare(vb);
      return sortDir === "desc" ? vb - va : va - vb;
    });
    return all;
  }, [mergedPositions, custodianFilter, tipusFilter, sortCol, sortDir, columnFilters]);

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
      padding: "3px 10px", borderRadius: 4, fontSize: 11,
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

      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.11em", textTransform: "uppercase", color: tc.textLight, marginBottom: 12 }}>{title}</div>

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
              <th style={{ ...th, textAlign: "right" }} onClick={() => handleSort(ytdKey)}>
                YTD{sortIcon(ytdKey)}{canEdit && <span style={{ marginLeft: 3, fontSize: 8, opacity: 0.5 }}>✏</span>}
              </th>
              <th style={{ ...th, textAlign: "right" }} onClick={() => handleSort(prevKey)}>
                {currentYear - 1}{sortIcon(prevKey)}{canEdit && <span style={{ marginLeft: 3, fontSize: 8, opacity: 0.5 }}>✏</span>}
              </th>
              <th style={{ ...th, textAlign: "right" }} onClick={() => handleSort("costAnual")}>
                TER{sortIcon("costAnual")}{canEdit && <span style={{ marginLeft: 3, fontSize: 8, opacity: 0.5 }}>✏</span>}
              </th>
              <th style={{ ...th, textAlign: "center" }}>MS</th>
            </tr>
            <tr style={{ borderBottom: `1px solid ${tc.border}` }}>
              <th style={{ padding: "6px 10px" }}><input value={columnFilters.nom} onChange={e => setColumnFilters(v => ({ ...v, nom: e.target.value }))} style={{ width:"100%", padding:"4px 6px", borderRadius:4, border:`1px solid ${tc.border}`, background:tc.bg, color:tc.text, fontSize:11, fontFamily:"inherit" }} /></th>
              <th style={{ padding: "6px 10px" }}><input value={columnFilters.custodian} onChange={e => setColumnFilters(v => ({ ...v, custodian: e.target.value }))} style={{ width:"100%", padding:"4px 6px", borderRadius:4, border:`1px solid ${tc.border}`, background:tc.bg, color:tc.text, fontSize:11, fontFamily:"inherit" }} /></th>
              <th style={{ padding: "6px 10px" }}><select value={columnFilters.tipus} onChange={e => setColumnFilters(v => ({ ...v, tipus: e.target.value }))} style={{ width:"100%", padding:"4px 6px", borderRadius:4, border:`1px solid ${tc.border}`, background:tc.bg, color:tc.text, fontSize:11, fontFamily:"inherit" }}>{["Tots","RV","RF"].map(o => <option key={o} value={o}>{o}</option>)}</select></th>
              <th style={{ padding: "6px 10px" }}><input value={columnFilters.isin} onChange={e => setColumnFilters(v => ({ ...v, isin: e.target.value }))} style={{ width:"100%", padding:"4px 6px", borderRadius:4, border:`1px solid ${tc.border}`, background:tc.bg, color:tc.text, fontSize:11, fontFamily:"inherit" }} /></th>
              {["dataCompra","valorMercat","rendInici","pes",ytdKey,prevKey,"costAnual"].map((key) => (
                <th key={key} style={{ padding: "6px 10px" }}><input value={columnFilters[key] ?? ""} onChange={e => setColumnFilters(v => ({ ...v, [key]: e.target.value }))} style={{ width:"100%", padding:"4px 6px", borderRadius:4, border:`1px solid ${tc.border}`, background:tc.bg, color:tc.text, fontSize:11, fontFamily:"inherit" }} /></th>
              ))}
              <th style={{ padding: "6px 10px", textAlign:"center" }}>{Object.values(columnFilters).some(v => v !== "" && v !== "Tots") ? <button onClick={() => setColumnFilters({ nom:"", custodian:"", tipus:"Tots", isin:"", dataCompra:"", valorMercat:"", rendInici:"", pes:"", [ytdKey]:"", [prevKey]:"", costAnual:"" })} style={{ background:"transparent", border:`1px solid ${tc.border}`, borderRadius:4, padding:"2px 8px", cursor:"pointer", fontSize:10, color:tc.textMid, fontFamily:"inherit" }}>netejar</button> : null}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p, i) => {
              const zebra  = i % 2 === 1;
              const bg     = zebra ? (dark ? tc.bgAlt : "#f8f9fb") : tc.card;
              const msUrl  = p.isin ? `https://www.morningstar.es/es/search/results.aspx?keyword=${p.isin}` : null;
              const isRV   = p.tipus === "RV";
              const typColor = isRV ? "#2B5070" : "#7A6000";
              const typBg    = isRV ? "#E6EDF3" : "#FFF8E1";
              return (
                <tr key={p.id} className="hoverable" style={{ background: bg, borderBottom: `1px solid ${tc.border}` }}>
                  <td style={{ padding: "6px 10px", fontWeight: 500 }}>
                    {p._aggregate ? (
                      <span style={{ color: tc.text, fontWeight: 600 }}>{p.nom}</span>
                    ) : (
                      <Link to={`/mercats-publics/${p.id}`}
                        style={{ color: tc.navy, textDecoration: "none" }}>
                        {p.nom}
                      </Link>
                    )}
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
                    canEdit={canEdit && !p._aggregate && !!p.isin}
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
                    canEdit={canEdit && !p._aggregate && !!p.isin}
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

                  {/* Editable: YTD (current year) */}
                  <EditableCell
                    value={p[ytdKey]}
                    canEdit={canEdit && !p._aggregate && !!p.isin}
                    onSave={v => handleSave(p.isin, ytdKey, v)}
                    renderValue={() => {
                      const v = p[ytdKey];
                      if (v == null) return <span style={{ color: tc.textLight, fontFamily: "'DM Mono',monospace" }}>—</span>;
                      const color = v > 0 ? tc.green : v < 0 ? tc.red : tc.textLight;
                      const bg2   = v > 0 ? (tc.green + "18") : v < 0 ? (tc.red + "15") : "transparent";
                      return <span style={{ fontFamily: "'DM Mono',monospace", fontWeight: 700, fontSize: 11, color, background: bg2, borderRadius: 4, padding: "1px 5px" }}>
                        {(v >= 0 ? "+" : "") + v.toFixed(2) + "%"}
                        {p._overrideFields?.has(ytdKey) && <OverrideBadge />}
                      </span>;
                    }}
                    td={{ padding: "6px 10px", textAlign: "right" }}
                  />

                  {/* Editable: previous year */}
                  <EditableCell
                    value={p[prevKey]}
                    canEdit={canEdit && !p._aggregate && !!p.isin}
                    onSave={v => handleSave(p.isin, prevKey, v)}
                    renderValue={() => {
                      const v = p[prevKey];
                      if (v == null) return <span style={{ color: tc.textLight, fontFamily: "'DM Mono',monospace" }}>—</span>;
                      const color = v > 0 ? tc.green : v < 0 ? tc.red : tc.textLight;
                      const bg2   = v > 0 ? (tc.green + "18") : v < 0 ? (tc.red + "15") : "transparent";
                      return <span style={{ fontFamily: "'DM Mono',monospace", fontWeight: 700, fontSize: 11, color, background: bg2, borderRadius: 4, padding: "1px 5px" }}>
                        {(v >= 0 ? "+" : "") + v.toFixed(2) + "%"}
                        {p._overrideFields?.has(prevKey) && <OverrideBadge />}
                      </span>;
                    }}
                    td={{ padding: "6px 10px", textAlign: "right" }}
                  />

                  {/* Editable: costAnual (TER) */}
                  <EditableCell
                    value={p.costAnual}
                    canEdit={canEdit && !p._aggregate && !!p.isin}
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
        WAM–Andbank i Interactive Brokers es mostren agregats. Credit Suisse queda integrat dins UBS.
      </div>
    </div>
  );
}
