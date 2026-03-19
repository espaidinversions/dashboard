import React, { useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid, LabelList
} from "recharts";
import { PORTFOLIO_COMPANIES } from "../data/searchers.js";
import { ThemeContext, TC_DARK, TC_LIGHT, useTheme } from "../theme.js";
import { fmtM, slugify } from "../utils.js";
import { FlagImg, Logo } from "./SharedComponents.jsx";

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
  const { tc, dark, toggle } = useTheme();
  const [kpiTab, setKpiTab] = useState("rev");

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
          tvpi, rvpiEur, dpiEur, mesosOperant,
          dataCompr, multEntry, quarters = [] } = company;

  const tvpiColor = tvpi == null ? tc.textLight : tvpi < 1 ? tc.red : tvpi < 1.5 ? tc.warning : tc.green;

  const KPI_CFG = {
    rev:    { label: "Ingressos",  ltmLabel: "Ingressos LTM",  color: "#276749", actualKey: "rev",    budgetKey: "revBudget" },
    ebitda: { label: "EBITDA",     ltmLabel: "EBITDA LTM",     color: "#2B4C7E", actualKey: "ebitda", budgetKey: "ebitdaBudget" },
    dfn:    { label: "Deute Net",  ltmLabel: "Deute Net LTM",  color: "#6B2E7E", actualKey: "dfn",    budgetKey: "dfnBudget" },
  };

  const KPI_TABS = [
    { id: "rev",    label: "Ingressos" },
    { id: "ebitda", label: "EBITDA" },
    { id: "dfn",    label: "Deute Net" },
  ];

  const ltm = useMemo(() => {
    if (quarters.length === 0) return null;
    const withActuals = quarters.filter(q => q.rev != null || q.ebitda != null || q.dfn != null);
    const last4 = withActuals.slice(-4);
    const sum = key => last4.reduce((s, q) => s + (q[key] ?? 0), 0);
    return { rev: sum("rev"), ebitda: sum("ebitda"), dfn: sum("dfn"), n: last4.length };
  }, [quarters]);

  return (
    <div style={{ minHeight: "100vh", background: tc.bg, color: tc.text, fontFamily: "'Outfit',system-ui,sans-serif", fontSize: 14 }}>
      {/* Top bar */}
      <div style={{ background: tc.card, borderBottom: `1px solid ${tc.border}`, padding: "12px 32px", display: "flex", alignItems: "center", gap: 12, boxShadow: "0 1px 0 rgba(0,0,0,.06), 0 4px 16px rgba(0,0,0,.05)" }}>
        <Link to="/" style={{ display: "flex", alignItems: "center", flexShrink: 0 }}><Logo /></Link>
        <div style={{ flex: 1 }} />
        <button onClick={toggle} style={{ background: "transparent", border: `1.5px solid ${tc.border}`, borderRadius: 7, padding: "7px 12px", cursor: "pointer", fontSize: 16, color: tc.textMid, fontFamily: "inherit" }}>
          {dark ? "☀️" : "🌙"}
        </button>
      </div>
      {/* Entity bar */}
      <div style={{ background: tc.navy, padding: "0 32px", display: "flex", alignItems: "center", gap: 12, minHeight: 48 }}>
        <Link to="/investments/companies" style={{ color: "rgba(255,255,255,0.5)", textDecoration: "none", fontSize: 12, letterSpacing: "0.04em", textTransform: "uppercase", whiteSpace: "nowrap", flexShrink: 0 }}>← Inversions</Link>
        <span style={{ color: "rgba(255,255,255,0.25)", fontSize: 12 }}>/</span>
        <span style={{ fontSize: 15, fontWeight: 700, color: "#fff", letterSpacing: "-0.01em", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nom}</span>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
          <span style={{ fontSize: 10, background: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.9)", borderRadius: 4, padding: "2px 8px", fontWeight: 600, letterSpacing: "0.04em" }}>{tipus}</span>
          <span style={{ fontSize: 10, background: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.9)", borderRadius: 4, padding: "2px 8px", fontWeight: 600 }}>{segment}</span>
          {geo && <FlagImg geo={geo} size={18} />}
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

        {/* Quarterly KPIs */}
        <div style={{ background: tc.card, border: `1px solid ${tc.border}`, borderRadius: 10, padding: "20px 24px" }}>
          <div style={{ fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", color: tc.textLight, fontWeight: 600, marginBottom: 16 }}>Evolució Trimestral</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            {KPI_TABS.map(t => (
              <button key={t.id} onClick={() => setKpiTab(t.id)}
                style={{ padding: "6px 14px", borderRadius: 6, border: `1.5px solid ${kpiTab === t.id ? tc.green : tc.border}`, background: kpiTab === t.id ? (dark ? "#0E2820" : "#E8F5E9") : "transparent", color: kpiTab === t.id ? tc.green : tc.textLight, fontSize: 12, cursor: "pointer", fontFamily: "inherit", fontWeight: kpiTab === t.id ? 700 : 400 }}>
                {t.label}
              </button>
            ))}
          </div>
          {quarters.length === 0
            ? (
              <div style={{ border: `2px dashed ${tc.border}`, borderRadius: 8, padding: "48px 24px", textAlign: "center", color: tc.textLight, fontSize: 13 }}>
                Afegeix dades històriques per veure l'evolució
              </div>
            )
            : (() => {
                const cfg = KPI_CFG[kpiTab];
                const hasBudget = quarters.some(q => q[cfg.budgetKey] != null);
                const ltmVal = ltm?.[cfg.actualKey];
                return (
                  <>
                    {ltm && (
                      <div style={{ background: tc.bgAlt, borderRadius: 8, padding: "12px 16px", marginBottom: 16, display: "inline-block" }}>
                        <div style={{ fontSize: 11, color: tc.textLight, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>
                          {cfg.ltmLabel}{ltm.n < 4 ? ` (${ltm.n} trim.)` : ""}
                        </div>
                        <div style={{ fontSize: 20, fontWeight: 700, color: tc.navy, fontFamily: "'DM Mono',monospace", marginTop: 4 }}>
                          {ltmVal != null ? fmtM(ltmVal) : "—"}
                        </div>
                      </div>
                    )}
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={quarters} margin={{ top: 24, right: 8, bottom: 0, left: 0 }} barCategoryGap="20%" barGap={2}>
                        <CartesianGrid strokeDasharray="3 3" stroke={tc.border} />
                        <XAxis dataKey="q" tick={{ fontSize: 10, fill: tc.textLight }} />
                        <YAxis tickFormatter={v => fmtM(v)} tick={{ fontSize: 10, fill: tc.textLight }} width={70} />
                        <Tooltip
                          formatter={(v, name) => [fmtM(v), name === "actual" ? "Real" : "Pressupost"]}
                          labelStyle={{ color: tc.text }}
                          contentStyle={{ background: tc.card, border: `1px solid ${tc.border}`, borderRadius: 8 }}
                        />
                        {hasBudget && (
                          <Legend content={() => (
                            <div style={{ display: "flex", gap: 16, justifyContent: "center", fontSize: 11, color: tc.textMid, marginTop: 6 }}>
                              <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                                <span style={{ width: 12, height: 12, borderRadius: 2, background: cfg.color, display: "inline-block" }} />
                                Real
                              </span>
                              <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                                <span style={{ width: 12, height: 12, borderRadius: 2, background: cfg.color, opacity: 0.35, border: `1.5px dashed ${cfg.color}`, display: "inline-block" }} />
                                Pressupost
                              </span>
                            </div>
                          )} />
                        )}
                        <Bar dataKey={cfg.actualKey} name="actual" fill={cfg.color}>
                          <LabelList dataKey={cfg.actualKey} position="top" formatter={v => v != null ? fmtM(v) : ""} style={{ fontSize: 9, fill: tc.textLight }} />
                        </Bar>
                        {hasBudget && (
                          <Bar dataKey={cfg.budgetKey} name="budget" fill={cfg.color} fillOpacity={0.35}>
                            <LabelList dataKey={cfg.budgetKey} position="top" formatter={v => v != null ? fmtM(v) : ""} style={{ fontSize: 9, fill: tc.textLight }} />
                          </Bar>
                        )}
                      </BarChart>
                    </ResponsiveContainer>
                  </>
                );
              })()
          }
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
  const [dark, setDark] = useState(() => localStorage.getItem("tc_dark") === "1");
  const tc = dark ? TC_DARK : TC_LIGHT;
  return (
    <ThemeContext.Provider value={{ tc, dark, toggle: () => setDark(d => !d) }}>
      <CompanyDetailInner />
    </ThemeContext.Provider>
  );
}
