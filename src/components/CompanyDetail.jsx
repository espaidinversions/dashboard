import React, { useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { PORTFOLIO_COMPANIES } from "../data/searchers.js";
import { ThemeContext, TC_DARK, TC_LIGHT, useTheme } from "../theme.js";
import { fmtM, slugify } from "../utils.js";
import { FlagImg } from "./SharedComponents.jsx";

function KpiCard({ label, value, sub, valueColor, tc }) {
  return (
    <div style={{ background: tc.card, border: `1px solid ${tc.border}`, borderRadius: 10, padding: "16px 20px", minWidth: 130, flex: 1 }}>
      <div style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: tc.textLight, fontWeight: 600, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: valueColor || tc.navy, fontFamily: "'DM Mono',monospace" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: tc.textLight, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function CompanyDetailInner() {
  const { id } = useParams();
  const { tc, dark } = useTheme();
  const [kpiTab, setKpiTab] = useState("tvpi");

  const company = useMemo(
    () => PORTFOLIO_COMPANIES.find(c => slugify(c.nom) === id),
    [id]
  );

  if (!company) {
    return (
      <div style={{ minHeight: "100vh", background: tc.bg, color: tc.text, fontFamily: "'Outfit',system-ui,sans-serif", padding: 32 }}>
        <Link to="/investments" style={{ color: tc.textLight, textDecoration: "none", fontSize: 13 }}>← Inversions</Link>
        <div style={{ marginTop: 48, textAlign: "center", color: tc.textLight }}>Empresa no trobada.</div>
      </div>
    );
  }

  const { nom, tipus, segment, entrepreneurs, origen, geo, ticket,
          tvpi, rvpiEur, dpiEur, mesosOperant, rev, ebitda,
          dataCompr, multEntry } = company;

  const tvpiColor = tvpi == null ? tc.textLight : tvpi < 1 ? "#E53E3E" : tvpi < 1.5 ? "#D69E2E" : tc.green;
  const margin = rev && ebitda ? `${(ebitda / rev * 100).toFixed(1)}% marge` : null;

  const KPI_TABS = [
    { id: "tvpi", label: "TVPI" },
    { id: "rev", label: "Ingressos" },
    { id: "ebitda", label: "EBITDA" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: tc.bg, color: tc.text, fontFamily: "'Outfit',system-ui,sans-serif", fontSize: 14 }}>
      {/* Header */}
      <div style={{ background: tc.card, borderBottom: `1px solid ${tc.border}`, padding: "12px 32px", display: "flex", alignItems: "center", gap: 16 }}>
        <Link to="/investments" style={{ color: tc.textLight, textDecoration: "none", fontSize: 13 }}>← Inversions</Link>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 18, fontWeight: 700, color: tc.navy, letterSpacing: "-0.02em" }}>{nom}</span>
            <span style={{ fontSize: 11, background: tc.bgAlt, color: tc.textMid, borderRadius: 4, padding: "2px 8px", fontWeight: 600 }}>{tipus}</span>
            <span style={{ fontSize: 11, background: tc.bgAlt, color: tc.textMid, borderRadius: 4, padding: "2px 8px", fontWeight: 600 }}>{segment}</span>
            {geo && <FlagImg geo={geo} size={18} />}
          </div>
          {entrepreneurs && <div style={{ fontSize: 12, color: tc.textLight, marginTop: 3 }}>{entrepreneurs}</div>}
        </div>
      </div>

      <div style={{ padding: "24px 32px", display: "flex", flexDirection: "column", gap: 24 }}>
        {/* KPI cards */}
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          <KpiCard label="Ticket"        value={fmtM(ticket)} tc={tc} />
          <KpiCard label="TVPI"          value={tvpi != null ? `${tvpi.toFixed(2)}×` : "—"} valueColor={tvpiColor} tc={tc} />
          <KpiCard label="RVPI"          value={fmtM(rvpiEur ?? 0)} tc={tc} />
          <KpiCard label="DPI"           value={fmtM(dpiEur ?? 0)} tc={tc} />
          <KpiCard label="Mesos operant" value={mesosOperant ?? "—"} tc={tc} />
        </div>

        {/* Operative metrics */}
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          <div style={{ background: tc.card, border: `1px solid ${tc.border}`, borderRadius: 10, padding: "16px 20px", flex: 1 }}>
            <div style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: tc.textLight, fontWeight: 600, marginBottom: 6 }}>Ingressos LTM</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: tc.navy, fontFamily: "'DM Mono',monospace" }}>{rev != null ? fmtM(rev) : "—"}</div>
            {margin && <div style={{ fontSize: 11, color: tc.textLight, marginTop: 4 }}>{margin}</div>}
          </div>
          <div style={{ background: tc.card, border: `1px solid ${tc.border}`, borderRadius: 10, padding: "16px 20px", flex: 1 }}>
            <div style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: tc.textLight, fontWeight: 600, marginBottom: 6 }}>EBITDA LTM</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: tc.navy, fontFamily: "'DM Mono',monospace" }}>{ebitda != null ? fmtM(ebitda) : "—"}</div>
          </div>
        </div>

        {/* KPI evolution (placeholder) */}
        <div style={{ background: tc.card, border: `1px solid ${tc.border}`, borderRadius: 10, padding: "20px 24px" }}>
          <div style={{ fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", color: tc.textLight, fontWeight: 600, marginBottom: 16 }}>Evolució KPIs</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            {KPI_TABS.map(t => (
              <button key={t.id} onClick={() => setKpiTab(t.id)}
                style={{ padding: "6px 14px", borderRadius: 6, border: `1.5px solid ${kpiTab === t.id ? tc.green : tc.border}`, background: kpiTab === t.id ? (dark ? "#0E2820" : "#E8F5E9") : "transparent", color: kpiTab === t.id ? tc.green : tc.textLight, fontSize: 12, cursor: "pointer", fontFamily: "inherit", fontWeight: kpiTab === t.id ? 700 : 400 }}>
                {t.label}
              </button>
            ))}
          </div>
          <div style={{ border: `2px dashed ${tc.border}`, borderRadius: 8, padding: "48px 24px", textAlign: "center", color: tc.textLight, fontSize: 13 }}>
            Afegeix dades històriques per veure l'evolució
          </div>
        </div>

        {/* Entry info */}
        <div style={{ background: tc.card, border: `1px solid ${tc.border}`, borderRadius: 10, padding: "20px 24px" }}>
          <div style={{ fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", color: tc.textLight, fontWeight: 600, marginBottom: 12 }}>Entrada</div>
          <div style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>
            {[
              ["Data d'entrada", dataCompr || "—"],
              ["Múltiple entrada", multEntry != null ? `${multEntry}×` : "—"],
              ["Origen", origen || "—"],
              ["Emprenedors", entrepreneurs || "—"],
            ].map(([label, val]) => (
              <div key={label}>
                <div style={{ fontSize: 11, color: tc.textLight, marginBottom: 3 }}>{label}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: tc.text }}>{val}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CompanyDetail() {
  const { dark } = useTheme();
  return (
    <ThemeContext.Provider value={dark ? TC_DARK : TC_LIGHT}>
      <CompanyDetailInner />
    </ThemeContext.Provider>
  );
}
