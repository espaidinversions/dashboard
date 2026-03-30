import React, { useMemo, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, ReferenceLine, Legend,
} from "recharts";
import { Link, useNavigate } from "react-router-dom";
import { PM_POSITIONS, PM_CLOSED } from "../data/publicMarkets.js";
import { useTheme } from "../theme.js";
import { fmtM, fmtMonth, usePersistedState, yearsHeld, cagr } from "../utils.js";
import { PM_VALUES } from "../data/portfolioValues.js";
import { PM_TER } from "../data/pmTer.js";

const PM_COLORS = [
  "#4E79A7","#F28E2B","#E15759","#76B7B2","#59A14F",
  "#EDC948","#B07AA1","#FF9DA7","#9C755F","#BAB0AC",
  "#D37295","#A0CBE8",
];

const TOGGLES = [
  { id: "all",        label: "Tots" },
  { id: "caixabank",  label: "CaixaBank" },
  { id: "bankinter",  label: "Bankinter" },
];

const YEAR_FIELDS = [
  { field: "rend2023", label: "2023" },
  { field: "rend2024", label: "2024" },
  { field: "rend2025", label: "2025" },
  { field: "rend2026", label: "2026" },
];


function getTer(p) {
  return PM_TER[p.isin] ?? p.costAnual ?? 0;
}

function netRendInici(p) {
  if (p.rendInici == null) return null;
  return p.gestor === "Abel Font"
    ? p.rendInici - getTer(p) * yearsHeld(p.dataCompra)
    : p.rendInici;
}

function netRend(p, field) {
  const v = p[field];
  if (v == null) return null;
  return p.gestor === "Abel Font" ? v - getTer(p) : v;
}

function PctChip({ v, tc }) {
  if (v == null) return <span style={{ fontSize: 11, color: tc.textLight, fontFamily: "'DM Mono',monospace" }}>—</span>;
  const pos   = v > 0.005;
  const neg   = v < -0.005;
  const color = pos ? tc.green : neg ? tc.red : tc.textLight;
  const bg    = pos ? (tc.green + "20") : neg ? (tc.red + "18") : "transparent";
  return (
    <span style={{ fontSize: 11, fontWeight: 700, color, background: bg, borderRadius: 4, padding: "1px 6px", fontFamily: "'DM Mono',monospace" }}>
      {pos ? "+" : ""}{v.toFixed(2)}%
    </span>
  );
}

export function PMTipusTab({ tipus }) {
  const { tc, dark } = useTheme();
  const [toggle, setToggle] = usePersistedState(`pm_toggle_${tipus}`, "all");
  const [retMode, setRetMode] = useState("brut");

  const secLabel     = { fontSize: 10, letterSpacing: "0.09em", textTransform: "uppercase", color: tc.textLight, fontWeight: 600, marginBottom: 12 };
  const card         = { background: tc.card, border: `1px solid ${tc.border}`, borderRadius: 10, padding: "20px 24px", boxShadow: "0 2px 8px rgba(0,0,0,.06)" };
  const th           = { padding: "8px 10px", fontSize: 10, letterSpacing: "0.09em", color: tc.textLight, textTransform: "uppercase", fontWeight: 600, borderBottom: `2px solid ${tc.border}`, whiteSpace: "nowrap" };
  const tooltipStyle = { contentStyle: { background: tc.card, border: `1px solid ${tc.border}`, borderRadius: 8 }, labelStyle: { color: tc.text, fontWeight: 600, fontSize: 11 } };

  const positions = useMemo(
    () => PM_POSITIONS.filter(p => p.tipus === tipus),
    [tipus]
  );

  const visible = useMemo(() => {
    const base = toggle === "caixabank"  ? positions.filter(p => p.custodian === "CaixaBank")
               : toggle === "bankinter"  ? positions.filter(p => p.custodian === "Bankinter")
               : positions;
    return [...base].sort((a, b) => (b.valorMercat ?? 0) - (a.valorMercat ?? 0));
  }, [positions, toggle]);

  const totalMV = useMemo(
    () => visible.reduce((s, p) => s + (p.valorMercat || 0), 0),
    [visible]
  );

  // Years that have at least one non-null value across visible positions
  const activeYears = useMemo(() =>
    YEAR_FIELDS.filter(({ field }) => visible.some(p => p[field] != null)),
    [visible]
  );

  // Chart 1: portfolio weighted return per year (X = year, one line)
  const portfolioData = useMemo(() =>
    activeYears.map(({ field, label }) => {
      let sum = 0, weight = 0;
      visible.forEach(p => {
        const v = retMode === "net" ? netRend(p, field) : p[field];
        if (v == null) return;
        sum    += v * p.valorMercat;
        weight += p.valorMercat;
      });
      return {
        year:      label,
        portfolio: weight > 0 ? parseFloat((sum / weight).toFixed(2)) : undefined,
      };
    }),
    [visible, activeYears, retMode]
  );

  // Chart 2: top 12 unique ISINs by AUM, market value over time
  // Sum all tranches per ISIN for correct ranking (multiple tranches share an ISIN).
  const top12 = useMemo(() => {
    const isinTotals = new Map();
    const isinRep = new Map();
    for (const p of visible) {
      isinTotals.set(p.isin, (isinTotals.get(p.isin) ?? 0) + p.valorMercat);
      if (!isinRep.has(p.isin)) isinRep.set(p.isin, p);
    }
    return [...isinTotals.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([isin]) => isinRep.get(isin));
  }, [visible]);

  const mvChartData = useMemo(() => {
    if (Object.keys(PM_VALUES).length === 0) return null;
    const dateSet = new Set();
    top12.forEach(pos => {
      const custodians = PM_VALUES[pos.isin];
      if (!custodians) return;
      Object.values(custodians).forEach(series => series.forEach(d => dateSet.add(d.date)));
    });
    const dates = [...dateSet].sort();
    if (dates.length === 0) return null;
    return dates.map(date => {
      const row = { date };
      top12.forEach(pos => {
        const custodians = PM_VALUES[pos.isin];
        if (!custodians) { row[pos.isin] = null; return; }
        const total = Object.values(custodians)
          .map(s => s.find(d => d.date === date)?.value ?? 0)
          .reduce((a, b) => a + b, 0);
        row[pos.isin] = total > 0 ? total : null;
      });
      return row;
    });
  }, [top12]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* ── Header: toggle pills ── */}
      <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
        {TOGGLES.map(t => (
          <button key={t.id} onClick={() => setToggle(t.id)}
            style={{
              padding: "4px 10px", borderRadius: 5,
              border: `1.5px solid ${toggle === t.id ? tc.green : tc.border}`,
              background: toggle === t.id ? (dark ? "#0A2010" : "#E8F8E8") : "transparent",
              color: toggle === t.id ? tc.green : tc.textLight,
              fontSize: 11, cursor: "pointer", fontFamily: "inherit",
              fontWeight: toggle === t.id ? 700 : 400,
            }}>
            {t.label}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        {[{ id: "brut", label: "Brut" }, { id: "net", label: "Net TER" }].map(t => (
          <button key={t.id} onClick={() => setRetMode(t.id)}
            style={{
              padding: "4px 10px", borderRadius: 5,
              border: `1.5px solid ${retMode === t.id ? tc.navy : tc.border}`,
              background: retMode === t.id ? (dark ? "#0A1A30" : "#E8F0FA") : "transparent",
              color: retMode === t.id ? tc.navy : tc.textLight,
              fontSize: 11, cursor: "pointer", fontFamily: "inherit",
              fontWeight: retMode === t.id ? 700 : 400,
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Chart 1: portfolio weighted return over time ── */}
      <div style={card}>
        <div style={secLabel}>Rendiment ponderat per any · cartera visible</div>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={portfolioData} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={tc.border} />
            <XAxis dataKey="year" tick={{ fontSize: 11, fill: tc.textLight }} axisLine={false} tickLine={false} />
            <YAxis
              tickFormatter={v => v.toFixed(0) + "%"}
              tick={{ fontSize: 10, fill: tc.textLight }}
              axisLine={false} tickLine={false} width={40}
            />
            <ReferenceLine y={0} stroke={tc.border} strokeDasharray="4 2" />
            <Tooltip
              {...tooltipStyle}
              formatter={v => [(v >= 0 ? "+" : "") + v.toFixed(2) + "%", "Cartera"]}
            />
            <Line
              dataKey="portfolio"
              name="Cartera"
              stroke={tc.navy}
              strokeWidth={2.5}
              dot={{ r: 5, fill: tc.navy }}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
        <div style={{ fontSize: 10, color: tc.textLight, marginTop: 6, fontStyle: "italic" }}>
          {retMode === "net"
            ? "Ponderat per valor de mercat. Abel Font net de TER. Gestors sense dades del any exclosos."
            : "Ponderat per valor de mercat. Retorns bruts (sense deducció TER). Gestors sense dades del any exclosos."}
        </div>
      </div>

      {/* ── Chart 2: market value over time ── */}
      {mvChartData && (
        <div style={card}>
          <div style={secLabel}>
            Valor de mercat · top {top12.length} posicions per AUM
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={mvChartData} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={tc.border} />
              <XAxis
                dataKey="date"
                tickFormatter={fmtMonth}
                tick={{ fontSize: 9, fill: tc.textLight }}
                axisLine={false} tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tickFormatter={v => fmtM(v)}
                tick={{ fontSize: 10, fill: tc.textLight }}
                axisLine={false} tickLine={false} width={60}
              />
              <Tooltip
                {...tooltipStyle}
                formatter={(v, name) => [v != null ? fmtM(v) : "—", name]}
                labelFormatter={fmtMonth}
              />
              <Legend wrapperStyle={{ fontSize: 9, paddingTop: 8 }} />
              {top12.map((p, i) => (
                <Line
                  key={p.isin}
                  dataKey={p.isin}
                  name={p.nom.replace(/\bUCITS\b.*/, "").replace(/\bETF\b.*$/, "ETF").trim()}
                  stroke={PM_COLORS[i % PM_COLORS.length]}
                  strokeWidth={1.5}
                  dot={false}
                  connectNulls={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Position list ── */}
      <div style={{ ...card, overflowX: "auto" }}>
        <div style={secLabel}>Posicions · ordenades per valor de mercat</div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 760 }}>
          <thead>
            <tr>
              <th style={{ ...th, width: 20 }}></th>
              <th style={{ ...th, textAlign: "left" }}>Nom</th>
              <th style={{ ...th, textAlign: "left" }}>Custodi</th>
              {YEAR_FIELDS.map(({ label }) => (
                <th key={label} style={{ ...th, textAlign: "right" }}>{label}</th>
              ))}
              <th style={{ ...th, textAlign: "right" }}>Des d'inici</th>
              <th style={{ ...th, textAlign: "right" }}>CAGR</th>
              <th style={{ ...th, textAlign: "right" }}>Valor mercat</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((p, i) => {
              const rendInici = retMode === "net" ? netRendInici(p) : p.rendInici;
              const yh        = yearsHeld(p.dataCompra);
              const mwr       = cagr(rendInici, yh);
              return (
                <tr key={p.id} className="hoverable" style={{ borderBottom: `1px solid ${tc.border}` }}>
                  <td style={{ padding: "7px 10px" }}>
                    <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, flexShrink: 0, background: PM_COLORS[i % PM_COLORS.length] }} />
                  </td>
                  <td style={{ padding: "7px 10px" }}>
                    <Link to={`/mercats-publics/${p.id}`}
                      style={{ color: tc.navy, textDecoration: "none", fontWeight: 500 }}>
                      {p.nom}
                    </Link>
                  </td>
                  <td style={{ padding: "7px 10px", color: tc.textLight, fontSize: 11 }}>{p.custodian}</td>
                  {YEAR_FIELDS.map(({ field }) => (
                    <td key={field} style={{ padding: "7px 10px", textAlign: "right" }}>
                      <PctChip v={retMode === "net" ? netRend(p, field) : p[field]} tc={tc} />
                    </td>
                  ))}
                  <td style={{ padding: "7px 10px", textAlign: "right" }}>
                    <PctChip v={rendInici} tc={tc} />
                  </td>
                  <td style={{ padding: "7px 10px", textAlign: "right" }}>
                    <PctChip v={mwr} tc={tc} />
                  </td>
                  <td style={{ padding: "7px 10px", textAlign: "right", fontFamily: "'DM Mono',monospace", color: tc.navy, fontWeight: 600, fontSize: 11 }}>
                    {fmtM(p.valorMercat)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div style={{ fontSize: 10, color: tc.textLight, marginTop: 8, fontStyle: "italic" }}>
          Des d'inici: retorn total acumulat. CAGR: retorn anualitzat equivalent. {retMode === "net" ? "Net TER per Abel Font." : "Brut (sense deducció TER)."}
        </div>
      </div>

      {/* ── Closed positions ── */}
      <ClosedPositions tipus={tipus} tc={tc} secLabel={secLabel} card={card} th={th} />

    </div>
  );
}

function ClosedPositions({ tipus, tc, secLabel, card, th }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const byYear = useMemo(() => {
    const rows = PM_CLOSED.filter(p => p.tipus === tipus);
    const map = new Map();
    rows.forEach(p => {
      if (!map.has(p.any)) map.set(p.any, []);
      map.get(p.any).push(p);
    });
    return [...map.entries()].sort((a, b) => b[0] - a[0]);
  }, [tipus]);

  // Build aggregate chart data: total value across all closed positions per month
  const chartData = useMemo(() => {
    const allIsins = byYear.flatMap(([, rows]) => rows.map(p => p.isin));
    const dateMap = new Map();
    allIsins.forEach(isin => {
      const custodians = PM_VALUES[isin];
      if (!custodians) return;
      Object.values(custodians).forEach(series =>
        series.forEach(({ date, value }) => {
          dateMap.set(date, (dateMap.get(date) ?? 0) + value);
        })
      );
    });
    if (dateMap.size === 0) return null;
    return [...dateMap.entries()].sort(([a], [b]) => a.localeCompare(b))
      .map(([date, value]) => ({ date, value }));
  }, [byYear]);

  if (byYear.length === 0) return null;
  const total = byYear.reduce((s, [, rows]) => s + rows.length, 0);
  const tooltipStyle = { contentStyle: { background: tc.card, border: `1px solid ${tc.border}`, borderRadius: 8 }, labelStyle: { color: tc.text, fontWeight: 600, fontSize: 11 } };

  return (
    <div style={{ ...card, opacity: 0.85 }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", userSelect: "none" }}
      >
        <div style={secLabel}>Posicions tancades · {total} vehicles</div>
        <span style={{ fontSize: 11, color: tc.textLight, marginLeft: "auto" }}>{open ? "▲" : "▼"}</span>
      </div>

      {open && chartData && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 10, color: tc.textLight, letterSpacing: "0.07em", marginBottom: 6 }}>Valor de mercat agregat (posicions tancades)</div>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={chartData} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={tc.border} />
              <XAxis dataKey="date" tickFormatter={fmtMonth} tick={{ fontSize: 9, fill: tc.textLight }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis tickFormatter={v => fmtM(v)} tick={{ fontSize: 10, fill: tc.textLight }} axisLine={false} tickLine={false} width={60} />
              <Tooltip {...tooltipStyle} formatter={v => [fmtM(v), "Valor"]} labelFormatter={fmtMonth} />
              <Line dataKey="value" stroke={tc.textLight} strokeWidth={1.5} dot={false} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {open && byYear.map(([year, rows]) => (
        <div key={year} style={{ marginTop: 16 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: tc.textLight, letterSpacing: "0.07em", marginBottom: 6 }}>
            Tancat {year} · {rows.length} posicions
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
            <thead>
              <tr>
                <th style={{ ...th, textAlign: "left" }}>Nom</th>
                <th style={{ ...th, textAlign: "left" }}>ISIN</th>
                <th style={{ ...th, textAlign: "left" }}>Custodi</th>
                <th style={{ ...th, textAlign: "center" }}>Dades</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(p => (
                <tr key={p.isin}
                  onClick={() => navigate(`/mercats-publics/${p.isin}`)}
                  style={{ borderBottom: `1px solid ${tc.border}`, cursor: "pointer" }}
                  onMouseEnter={e => e.currentTarget.style.background = tc.bgAlt}
                  onMouseLeave={e => e.currentTarget.style.background = ""}
                >
                  <td style={{ padding: "5px 10px", color: tc.text }}>{p.nom}</td>
                  <td style={{ padding: "5px 10px", fontFamily: "'DM Mono',monospace", color: tc.textLight, fontSize: 10 }}>{p.isin}</td>
                  <td style={{ padding: "5px 10px", color: tc.textLight }}>{p.custodian || "—"}</td>
                  <td style={{ padding: "5px 10px", textAlign: "center" }}>
                    <span style={{ fontSize: 10, color: tc.navy }}>→</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
