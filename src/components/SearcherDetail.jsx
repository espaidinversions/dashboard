import React, { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTheme } from "../theme.js";
import { fmtM, fmtSignedM, fmtSignedNative, formatIsoDateDMY } from "../utils.js";
import { loadSearchers, loadCapitalCalls } from "../db.js";
import { apiFetchJson } from "../apiClient.js";
import { FlagImg } from "./SharedComponents.jsx";
import { SEARCHER_STATUS_CFG, GEO_NAME } from "../config.js";
import { normalizeSearcherName } from "../data/searcherModel.js";
import { useAuth } from "../auth.jsx";

function calcMesos(dateIso) {
  if (!dateIso) return null;
  const start = new Date(dateIso);
  if (Number.isNaN(start.getTime())) return null;
  const now = new Date();
  return Math.max(0, (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth()));
}

export default function SearcherDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { tc } = useTheme();
  const { canEditSection } = useAuth();
  const canEdit = canEditSection("searchers");
  const [searcher, setSearcher] = useState(null);
  const [txRows, setTxRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingLabel, setEditingLabel] = useState(false);
  const [labelValue, setLabelValue] = useState("");
  const labelInputRef = useRef(null);

  useEffect(() => {
    Promise.all([loadSearchers(), loadCapitalCalls()]).then(([searchers, cc]) => {
      const found = searchers.find(s => String(s.id) === id);
      setSearcher(found ?? null);

      if (found) {
        const normName = normalizeSearcherName(found.nom);
        const nif = String(found.nif ?? "").trim();
        // Also match by stripping just the core token (handles "Aeqor Partners" vs "Aeqor SRL")
        const coreToken = normName.split(" ")[0];
        const ccAll = Array.isArray(cc) ? cc : [];
        const rows = ccAll
          .filter(r => r.vehicleTipus === "SF" && r.cat !== "Compromís")
          .filter(r => {
            const rNorm = normalizeSearcherName(r.fons);
            if (nif && String(r.id ?? "").trim() === nif) return true;
            if (rNorm === normName) return true;
            // Fallback: single-token core match (e.g. "aeqor" in both "Aeqor Partners" and "Aeqor SRL")
            if (coreToken && coreToken.length >= 4 && rNorm.split(" ")[0] === coreToken) return true;
            return false;
          })
          .sort((a, b) => String(b.data ?? "").localeCompare(String(a.data ?? "")));
        setTxRows(rows);
      }
      setLoading(false);
    });
  }, [id]);

  const startEditLabel = () => {
    setLabelValue(searcher.label ?? "");
    setEditingLabel(true);
    setTimeout(() => labelInputRef.current?.focus(), 0);
  };

  const saveLabel = async () => {
    const newLabel = labelValue.trim() || null;
    try {
      await apiFetchJson(`/api/searchers?id=${encodeURIComponent(searcher.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: newLabel }),
      });
      setSearcher((s) => ({ ...s, label: newLabel }));
    } catch {}
    setEditingLabel(false);
  };

  if (loading) return <div style={{ padding: 48, textAlign: "center", color: tc.textLight }}>Carregant…</div>;
  if (!searcher) return <div style={{ padding: 48, textAlign: "center", color: tc.textLight }}>Searcher no trobat.</div>;

  const statusCfg = SEARCHER_STATUS_CFG[searcher.statusScreening] ?? { bg: tc.bgAlt, color: tc.textMid };
  const mesos = searcher.mesosCercant ?? calcMesos(searcher.dataCompr);
  const totalCalls = txRows.filter(r => r.cat === "Capital Call").reduce((s, r) => s + Math.abs(Number(r.eur ?? 0)), 0);
  const totalDist = txRows.filter(r => r.cat === "Distribució" || r.cat === "Retorn Capital").reduce((s, r) => s + Math.abs(Number(r.eur ?? 0)), 0);

  const searchers = [searcher.searcher1, searcher.searcher2].filter(Boolean).join(" / ");
  const escoles = [searcher.escola1, searcher.escola2].filter(Boolean).join(" / ");

  const td = { padding: "10px 12px", fontSize: 13, borderBottom: `1px solid ${tc.border}` };

  return (
    <div style={{ minHeight: "100vh", background: tc.bg, fontFamily: "'Outfit',system-ui,sans-serif", color: tc.text }}>
      {/* Header bar */}
      <div style={{ background: tc.card, borderBottom: `1px solid ${tc.border}`, padding: "0 32px", height: 56, display: "flex", alignItems: "center", gap: 16 }}>
        <button onClick={() => navigate(-1)}
          style={{ background: "none", border: "none", cursor: "pointer", color: tc.textLight, fontSize: 20, padding: "0 4px", lineHeight: 1 }}>
          ←
        </button>
        <span style={{ fontSize: 13, color: tc.textLight }}>Searchers</span>
        <span style={{ color: tc.border }}>/</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: tc.navy }}>{searcher.nom}</span>
      </div>

      <div style={{ maxWidth: 960, margin: "0 auto", padding: "32px 24px" }}>

        {/* Title row */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 28, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
              <FlagImg geo={searcher.geo} />
              <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: tc.navy }}>{searcher.nom}</h1>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              {searcher.statusScreening && (
                <span style={{ fontSize: 11, fontWeight: 600, borderRadius: 6, padding: "3px 10px", ...statusCfg }}>
                  {searcher.statusScreening}
                </span>
              )}
              {searcher.tipus && (
                <span style={{ fontSize: 11, fontWeight: 600, borderRadius: 6, padding: "3px 10px", background: tc.bgAlt, color: tc.textMid }}>
                  {searcher.tipus}
                </span>
              )}
              {searcher.modalitat && (
                <span style={{ fontSize: 11, fontWeight: 600, borderRadius: 6, padding: "3px 10px", background: tc.bgAlt, color: tc.textMid }}>
                  {searcher.modalitat}
                </span>
              )}
              {searcher.formEntrada && (
                <span style={{ fontSize: 11, fontWeight: 600, borderRadius: 6, padding: "3px 10px", background: searcher.formEntrada === "Search Capital" ? "#E6EDF3" : "#F5F0FA", color: searcher.formEntrada === "Search Capital" ? "#2563A8" : "#6B2E7E" }}>
                  {searcher.formEntrada}
                </span>
              )}
              {/* Label badge / inline edit */}
              {editingLabel ? (
                <form onSubmit={(e) => { e.preventDefault(); saveLabel(); }} style={{ display: "flex", gap: 4, alignItems: "center" }}>
                  <input
                    ref={labelInputRef}
                    value={labelValue}
                    onChange={(e) => setLabelValue(e.target.value)}
                    onBlur={saveLabel}
                    onKeyDown={(e) => e.key === "Escape" && setEditingLabel(false)}
                    placeholder="Etiqueta…"
                    style={{ fontSize: 11, padding: "2px 8px", borderRadius: 6, border: `1px solid ${tc.border}`, fontFamily: "inherit", outline: "none", width: 160 }}
                  />
                </form>
              ) : (
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  {searcher.label && (
                    <span style={{ fontSize: 11, fontWeight: 600, borderRadius: 6, padding: "3px 10px", ...(SEARCHER_STATUS_CFG[searcher.label] ?? { bg: "#FEF3E2", color: "#8B5E00" }) }}>
                      {searcher.label}
                    </span>
                  )}
                  {canEdit && (
                    <button
                      onClick={startEditLabel}
                      title="Editar etiqueta"
                      style={{ background: "none", border: "none", cursor: "pointer", color: tc.textLight, fontSize: 12, padding: "2px 4px", lineHeight: 1, borderRadius: 4 }}
                    >
                      ✎
                    </button>
                  )}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* KPI cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 28 }}>
          {[
            { label: "Ticket",        value: fmtM(searcher.ticket),           color: tc.navy },
            { label: "Equity Stake",  value: searcher.equityStake ? `${searcher.equityStake}%` : "—", color: tc.navyLight },
            { label: "Mesos cercant", value: mesos != null ? `${mesos} m` : "—", color: tc.textMid },
            { label: "Capital cridat",value: fmtM(totalCalls),                color: tc.navy },
            { label: "Distribuït",    value: fmtM(totalDist),                 color: tc.green },
          ].map(c => (
            <div key={c.label} style={{ background: tc.card, border: `1px solid ${tc.border}`, borderRadius: 10, padding: "14px 18px", borderTop: `3px solid ${c.color}` }}>
              <div style={{ fontSize: 11, letterSpacing: "0.06em", color: tc.textLight, textTransform: "uppercase", marginBottom: 4, fontWeight: 600 }}>{c.label}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: c.color, fontFamily: "'DM Mono',monospace" }}>{c.value}</div>
            </div>
          ))}
        </div>

        {/* Info grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 28 }}>
          <div style={{ background: tc.card, border: `1px solid ${tc.border}`, borderRadius: 10, padding: "20px 24px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: tc.textLight, textTransform: "uppercase", marginBottom: 14 }}>Persones</div>
            {[
              { label: "Searcher(s)", value: searchers || "—" },
              { label: "Escola(s)",   value: escoles   || "—" },
              { label: "Intro per",   value: searcher.introPer || "—" },
              { label: "Geografia",   value: GEO_NAME[searcher.geo] ?? searcher.geo ?? "—" },
            ].map(r => (
              <div key={r.label} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "6px 0", borderBottom: `1px solid ${tc.border}` }}>
                <span style={{ fontSize: 12, color: tc.textLight, whiteSpace: "nowrap" }}>{r.label}</span>
                <span style={{ fontSize: 12, fontWeight: 500, color: tc.text, textAlign: "right" }}>{r.value}</span>
              </div>
            ))}
          </div>

          <div style={{ background: tc.card, border: `1px solid ${tc.border}`, borderRadius: 10, padding: "20px 24px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: tc.textLight, textTransform: "uppercase", marginBottom: 14 }}>Dates</div>
            {[
              { label: "Data inici",     value: formatIsoDateDMY(searcher.dataInici)  || "—" },
              { label: "Data compromís", value: formatIsoDateDMY(searcher.dataCompr)  || "—" },
              { label: "NIF",            value: searcher.nif ?? "—" },
            ].map(r => (
              <div key={r.label} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "6px 0", borderBottom: `1px solid ${tc.border}` }}>
                <span style={{ fontSize: 12, color: tc.textLight, whiteSpace: "nowrap" }}>{r.label}</span>
                <span style={{ fontSize: 12, fontWeight: 500, color: tc.text, fontFamily: r.label === "NIF" ? "'DM Mono',monospace" : "inherit" }}>{r.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Capital calls */}
        <div style={{ background: tc.card, border: `1px solid ${tc.border}`, borderRadius: 10, overflow: "hidden" }}>
          <div style={{ padding: "16px 24px", borderBottom: `1px solid ${tc.border}`, fontWeight: 700, fontSize: 14, color: tc.navy }}>
            Transaccions {txRows.length > 0 && <span style={{ fontWeight: 400, color: tc.textLight, fontSize: 12 }}>({txRows.length})</span>}
          </div>
          {txRows.length === 0 ? (
            <div style={{ padding: 32, textAlign: "center", color: tc.textLight, fontSize: 13 }}>Sense transaccions registrades</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: tc.bgAlt }}>
                    {["Data", "Tipus", "Categoria", "Import (Original)", "Import (Euros)"].map((h, i) => (
                      <th key={h} style={{ padding: "10px 12px", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: tc.textLight, fontWeight: 600, textAlign: i >= 3 ? "right" : "left", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {txRows.map((r, i) => (
                    <tr key={r._rowId ?? i} style={{ background: i % 2 === 0 ? "transparent" : tc.bgAlt }}>
                      <td style={{ ...td, color: tc.textMid }}>{formatIsoDateDMY(r.data)}</td>
                      <td style={{ ...td }}>{r.tipus || "—"}</td>
                      <td style={{ ...td }}>{r.cat || "—"}</td>
                      <td style={{ ...td, textAlign: "right", fontFamily: "'DM Mono',monospace", color: r.eur < 0 ? tc.green : tc.navyLight }}>{fmtSignedNative(r.amountNative ?? r.eur, r.divisa ?? "EUR")}</td>
                      <td style={{ ...td, textAlign: "right", fontFamily: "'DM Mono',monospace", color: r.eur < 0 ? tc.green : tc.navyLight }}>{fmtSignedM(r.eur)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
