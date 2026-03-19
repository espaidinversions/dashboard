import React, { useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine, Cell
} from "recharts";
import { RAW_CC as RAW_CC_DEFAULT, FUND_META as FUND_META_DEFAULT } from "../config.js";
import { ThemeContext, TC_DARK, TC_LIGHT, useTheme } from "../theme.js";
import { fmtM, slugify } from "../utils.js";
import { Badge, Logo } from "./SharedComponents.jsx";

const CAT_CFG = {
  "Capital Call":   { color: "#2B4C7E", bg: "#E8EFF5" },
  "Distribució":    { color: "#276749", bg: "#E8F5E9" },
  "Retorn Capital": { color: "#1E5738", bg: "#D6EAE0" },
  "Compromís":      { color: "#6B8CAE", bg: "#EAF0F6" },
  "Altres":         { color: "#999",    bg: "#F0F0F0" },
};

function KpiCard({ label, value, sub, tc, valueColor }) {
  return (
    <div style={{ background: tc.card, border: `1px solid ${tc.border}`, borderRadius: 10, padding: "16px 20px", minWidth: 160, flex: 1 }}>
      <div style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: tc.textLight, fontWeight: 600, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: valueColor ?? tc.navy, fontFamily: "'DM Mono',monospace" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: tc.textLight, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function FundDetailInner() {
  const { id } = useParams();
  const { tc, dark, toggle } = useTheme();

  const rawCC = useMemo(() => {
    try {
      const s = localStorage.getItem("tc_rawCC");
      return s ? JSON.parse(s) : RAW_CC_DEFAULT;
    } catch { return RAW_CC_DEFAULT; }
  }, []);

  const fundMeta = useMemo(() => {
    try {
      const s = localStorage.getItem("tc_fundMeta");
      return s ? JSON.parse(s) : FUND_META_DEFAULT;
    } catch { return FUND_META_DEFAULT; }
  }, []);

  // Find all transactions for this fund
  const txs = useMemo(
    () => rawCC.filter(r => slugify(r.fons) === id),
    [rawCC, id]
  );

  if (txs.length === 0) {
    return (
      <div style={{ minHeight: "100vh", background: tc.bg, color: tc.text, fontFamily: "'Outfit',system-ui,sans-serif", padding: 32 }}>
        <Link to="/investments" style={{ color: tc.textLight, textDecoration: "none", fontSize: 13 }}>← Inversions</Link>
        <div style={{ marginTop: 48, textAlign: "center", color: tc.textLight }}>Fons no trobat.</div>
      </div>
    );
  }

  const fundName = txs[0].fons;
  const vcpe = txs[0].vcpe;
  const est = txs[0].est;

  // KPI sums
  const compromis = txs.filter(r => r.cat === "Compromís").reduce((s, r) => s + r.eur, 0);
  const calls     = txs.filter(r => r.cat === "Capital Call").reduce((s, r) => s + r.eur, 0);
  const dist      = txs.filter(r => r.cat === "Distribució" || r.cat === "Retorn Capital").reduce((s, r) => s + Math.abs(r.eur), 0);
  const net       = dist - calls;
  const utilPct   = compromis > 0 ? (calls / compromis * 100).toFixed(1) + "%" : null;

  const meta = fundMeta.find(m => m.fons === fundName);
  const tvpiFund = meta?.tvpi ?? null;
  const dpiFund = calls > 0 ? dist / calls : 0;
  const rvpiFund = tvpiFund != null ? tvpiFund - dpiFund : null;
  const multipleColor = v => v == null ? tc.textLight : v < 1 ? tc.red : v < 1.5 ? tc.warning : tc.green;
  const fmtX = v => v != null ? `${v.toFixed(2)}×` : "—";

  const [chartView, setChartView] = useState("quarterly");

  // J-curve data: grouped by quarter or year; bars = period flows, line = cumulative net
  const jCurveData = useMemo(() => {
    const relevant = txs.filter(r =>
      r.cat === "Capital Call" || r.cat === "Distribució" || r.cat === "Retorn Capital"
    );
    const map = new Map();
    for (const r of relevant) {
      const [y, m] = r.data.split("-").map(Number);
      const key = chartView === "annual"
        ? String(y)
        : `Q${Math.ceil(m / 3)} ${y}`;
      if (!map.has(key)) map.set(key, { period: key, sortKey: chartView === "annual" ? y * 10 : y * 10 + Math.ceil(m / 3), calls: 0, dist: 0 });
      const entry = map.get(key);
      if (r.cat === "Capital Call") entry.calls += r.eur;
      else entry.dist += Math.abs(r.eur);
    }
    const sorted = Array.from(map.values()).sort((a, b) => a.sortKey - b.sortKey);
    let cumNet = 0;
    return sorted.map(p => {
      cumNet += p.dist - p.calls;
      return { period: p.period, calls: -p.calls, dist: p.dist, cumNet };
    });
  }, [txs, chartView]);

  // Transaction log: sorted newest first
  const txLog = [...txs].sort((a, b) => b.data.localeCompare(a.data));

  const vcpeCfg = {
    "PE": { color: "#2B4C7E", bg: "#E8EFF5" },
    "VC": { color: "#276749", bg: "#E8F5E9" },
    "RE": { color: "#6B2E7E", bg: "#F3EEF8" },
  };
  const estCfg = {
    "Fons Primari": { color: "#2B4C7E", bg: "#E8EFF5" },
    "Fons de Fons": { color: "#276749", bg: "#D6EAE0" },
    "SOCIMI":       { color: "#6B2E7E", bg: "#F3EEF8" },
  };

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
        <Link to="/investments/funds" style={{ color: "rgba(255,255,255,0.5)", textDecoration: "none", fontSize: 12, letterSpacing: "0.04em", textTransform: "uppercase", whiteSpace: "nowrap", flexShrink: 0 }}>← Inversions</Link>
        <span style={{ color: "rgba(255,255,255,0.25)", fontSize: 12 }}>/</span>
        <span style={{ fontSize: 15, fontWeight: 700, color: "#fff", letterSpacing: "-0.01em", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{fundName}</span>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <Badge label={vcpe} cfg={vcpeCfg[vcpe] || {}} />
          <Badge label={est}  cfg={estCfg[est]   || {}} />
        </div>
      </div>

      <div style={{ padding: "24px 32px", display: "flex", flexDirection: "column", gap: 24 }}>
        {/* KPI cards */}
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          <KpiCard label="Compromís"      value={compromis ? fmtM(compromis) : "—"} tc={tc} />
          <KpiCard label="Capital Cridat" value={fmtM(calls)} sub={utilPct ? `${utilPct} del compromís` : null} tc={tc} />
          <KpiCard label="Distribucions"  value={dist ? fmtM(dist) : "—"} tc={tc} />
          <KpiCard label="Net"            value={(net >= 0 ? "+" : "") + fmtM(net)} tc={tc} />
          <KpiCard label="TVPI" value={fmtX(tvpiFund)} sub="Inputat manualment" valueColor={multipleColor(tvpiFund)} tc={tc} />
          <KpiCard label="DPI"  value={fmtX(dpiFund)}  valueColor={multipleColor(dpiFund)}  tc={tc} />
          <KpiCard label="RVPI" value={fmtX(rvpiFund)} valueColor={multipleColor(rvpiFund)} tc={tc} />
        </div>

        {/* J-curve */}
        <div style={{ background: tc.card, border: `1px solid ${tc.border}`, borderRadius: 10, padding: "20px 24px" }}>
          <div style={{ display: "flex", alignItems: "center", marginBottom: 16 }}>
            <div style={{ fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", color: tc.textLight, fontWeight: 600, flex: 1 }}>J-curve</div>
            <div style={{ display: "flex", gap: 4 }}>
              {["quarterly", "annual"].map(v => (
                <button key={v} onClick={() => setChartView(v)}
                  style={{ padding: "4px 10px", borderRadius: 5, border: `1.5px solid ${chartView === v ? tc.green : tc.border}`, background: chartView === v ? (dark ? "#0E2820" : "#E8F5E9") : "transparent", color: chartView === v ? tc.green : tc.textLight, fontSize: 11, cursor: "pointer", fontFamily: "inherit", fontWeight: chartView === v ? 700 : 400 }}>
                  {v === "quarterly" ? "Trimestral" : "Anual"}
                </button>
              ))}
            </div>
          </div>
          {jCurveData.length === 0
            ? <div style={{ textAlign: "center", color: tc.textLight, padding: "32px 0" }}>Encara no hi ha aportacions registrades.</div>
            : (
              <ResponsiveContainer width="100%" height={260}>
                <ComposedChart data={jCurveData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap="30%" barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke={tc.border} />
                  <ReferenceLine y={0} stroke={tc.border} strokeWidth={1.5} />
                  <XAxis dataKey="period" tick={{ fontSize: 10, fill: tc.textLight }} />
                  <YAxis tickFormatter={v => (v < 0 ? "−" : "") + fmtM(Math.abs(v))} tick={{ fontSize: 10, fill: tc.textLight }} width={70} />
                  <Tooltip
                    formatter={(v, name) => {
                      const label = name === "calls" ? "Capital Cridat" : name === "dist" ? "Distribucions" : "Net Acumulat";
                      return [(v < 0 ? "−" : "+") + fmtM(Math.abs(v)), label];
                    }}
                    labelStyle={{ color: tc.text }}
                    contentStyle={{ background: tc.card, border: `1px solid ${tc.border}`, borderRadius: 8 }}
                  />
                  <Bar dataKey="calls" name="calls" fill="#2B4C7E" fillOpacity={0.8} />
                  <Bar dataKey="dist"  name="dist"  fill="#276749" fillOpacity={0.8} />
                  <Line dataKey="cumNet" name="cumNet" type="monotone" stroke="#E8A020" strokeWidth={2} dot={{ r: 3, fill: "#E8A020" }} />
                </ComposedChart>
              </ResponsiveContainer>
            )
          }
        </div>

        {/* Transaction log */}
        <div style={{ background: tc.card, border: `1px solid ${tc.border}`, borderRadius: 10, padding: "20px 24px" }}>
          <div style={{ fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", color: tc.textLight, fontWeight: 600, marginBottom: 16 }}>
            Transaccions · {txLog.length}
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: tc.bgAlt }}>
                {["Data", "Tipus", "Categoria", "Import"].map(h => (
                  <th key={h} style={{ padding: "10px 12px", textAlign: h === "Import" ? "right" : "left", fontSize: 11, letterSpacing: "0.08em", color: tc.textLight, textTransform: "uppercase", fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {txLog.map((r, i) => {
                const cfg = CAT_CFG[r.cat] || {};
                return (
                  <tr key={`${r.data}-${r.cat}-${r.eur}`} style={{ borderBottom: `1px solid ${tc.border}`, background: i % 2 === 0 ? "transparent" : tc.bgAlt }}>
                    <td style={{ padding: "10px 12px", fontSize: 12, color: tc.textMid }}>{r.data}</td>
                    <td style={{ padding: "10px 12px", fontSize: 12, color: tc.textMid }}>{r.tipus}</td>
                    <td style={{ padding: "10px 12px" }}>
                      <span style={{ fontSize: 10, background: cfg.bg || tc.bgAlt, color: cfg.color || tc.textMid, borderRadius: 4, padding: "2px 8px", fontWeight: 600 }}>
                        {r.cat}
                      </span>
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "'DM Mono',monospace", fontSize: 12, fontWeight: 700, color: r.eur > 0 ? tc.navy : tc.green }}>
                      {r.eur < 0 && "+ "}{fmtM(Math.abs(r.eur))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function FundDetail() {
  const [dark, setDark] = useState(() => localStorage.getItem("tc_dark") === "1");
  const tc = dark ? TC_DARK : TC_LIGHT;
  return (
    <ThemeContext.Provider value={{ tc, dark, toggle: () => setDark(d => !d) }}>
      <FundDetailInner />
    </ThemeContext.Provider>
  );
}
