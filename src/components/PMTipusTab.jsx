import React, { useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, ReferenceLine, Legend,
} from "recharts";
import { Link } from "react-router-dom";
import { PM_POSITIONS } from "../data/publicMarkets.js";
import { useTheme } from "../theme.js";
import { fmtM, fmtMonth, usePersistedState, yearsHeld, cagr } from "../utils.js";
import { PM_VALUES } from "../data/portfolioValues.js";

const PM_COLORS = [
  "#4E79A7","#F28E2B","#E15759","#76B7B2","#59A14F",
  "#EDC948","#B07AA1","#FF9DA7","#9C755F","#BAB0AC",
  "#D37295","#A0CBE8",
];

const TOGGLES = [
  { id: "all",       label: "Tots" },
  { id: "directe",   label: "Directe" },
  { id: "bankinter", label: "Bankinter" },
];

const YEAR_FIELDS = [
  { field: "rend2023", label: "2023" },
  { field: "rend2024", label: "2024" },
  { field: "rend2025", label: "2025" },
  { field: "rend2026", label: "2026" },
];


function netRendInici(p) {
  if (p.rendInici == null) return null;
  return p.gestor === "Abel Font"
    ? p.rendInici - (p.costAnual ?? 0) * yearsHeld(p.dataCompra)
    : p.rendInici;
}

function netRend(p, field) {
  const v = p[field];
  if (v == null) return null;
  return p.gestor === "Abel Font" ? v - (p.costAnual ?? 0) : v;
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

  const secLabel     = { fontSize: 10, letterSpacing: "0.09em", textTransform: "uppercase", color: tc.textLight, fontWeight: 600, marginBottom: 12 };
  const card         = { background: tc.card, border: `1px solid ${tc.border}`, borderRadius: 10, padding: "20px 24px", boxShadow: "0 2px 8px rgba(0,0,0,.06)" };
  const th           = { padding: "8px 10px", fontSize: 10, letterSpacing: "0.09em", color: tc.textLight, textTransform: "uppercase", fontWeight: 600, borderBottom: `2px solid ${tc.border}`, whiteSpace: "nowrap" };
  const tooltipStyle = { contentStyle: { background: tc.card, border: `1px solid ${tc.border}`, borderRadius: 8 }, labelStyle: { color: tc.text, fontWeight: 600, fontSize: 11 } };

  const positions = useMemo(
    () => PM_POSITIONS.filter(p => p.tipus === tipus),
    [tipus]
  );

  const visible = useMemo(() => {
    const base = toggle === "directe"   ? positions.filter(p => p.gestor === "CaixaBank / UBS")
               : toggle === "bankinter" ? positions.filter(p => p.gestor === "Abel Font")
               : positions;
    return [...base].sort((a, b) => b.valorMercat - a.valorMercat);
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
        const net = netRend(p, field);
        if (net == null) return;
        sum    += net * p.valorMercat;
        weight += p.valorMercat;
      });
      return {
        year:      label,
        portfolio: weight > 0 ? parseFloat((sum / weight).toFixed(2)) : undefined,
      };
    }),
    [visible, activeYears]
  );

  // Chart 2: top 12 unique ISINs by AUM, market value over time
  // Deduplicate by ISIN first — multiple tranches of the same fund share an ISIN
  // and would produce duplicate dataKeys / overwritten chart data.
  const top12 = useMemo(() => {
    const seen = new Set();
    const out = [];
    for (const p of visible) {
      if (!seen.has(p.isin)) { seen.add(p.isin); out.push(p); }
      if (out.length >= 12) break;
    }
    return out;
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
        row[pos.isin] = total || null;
      });
      return row;
    });
  }, [top12]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* ── Header: toggle pills ── */}
      <div style={{ display: "flex", gap: 5 }}>
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
          Ponderat per valor de mercat. Abel Font net de TER. Gestors sense dades del any exclosos.
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
              <th style={{ ...th, textAlign: "left" }}>Gestor</th>
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
              const net = netRendInici(p);
              const yh  = yearsHeld(p.dataCompra);
              const mwr = cagr(net, yh);
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
                  <td style={{ padding: "7px 10px", color: tc.textLight, fontSize: 11 }}>{p.gestor}</td>
                  {YEAR_FIELDS.map(({ field }) => (
                    <td key={field} style={{ padding: "7px 10px", textAlign: "right" }}>
                      <PctChip v={netRend(p, field)} tc={tc} />
                    </td>
                  ))}
                  <td style={{ padding: "7px 10px", textAlign: "right" }}>
                    <PctChip v={net} tc={tc} />
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
          Des d'inici: retorn total acumulat. CAGR: retorn anualitzat equivalent (= MWR per posicions sense fluxos intermedis). Abel Font net de TER.
        </div>
      </div>

    </div>
  );
}
