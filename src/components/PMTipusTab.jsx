import React, { useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, ReferenceLine,
} from "recharts";
import { Link } from "react-router-dom";
import { PM_POSITIONS } from "../data/publicMarkets.js";
import { useTheme } from "../theme.js";
import { fmtM, usePersistedState, yearsHeld } from "../utils.js";

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

// Annual return fields available in PM_POSITIONS
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

  const totalReturn = useMemo(() => {
    if (totalMV === 0) return null;
    let sum = 0, weight = 0;
    visible.forEach(p => {
      const net = netRendInici(p);
      if (net == null) return;
      sum    += net * p.valorMercat;
      weight += p.valorMercat;
    });
    return weight > 0 ? sum / weight : null;
  }, [visible, totalMV]);

  // Weight concentration curve: sorted by size, each point = one position
  const weightData = useMemo(() => {
    let cum = 0;
    return visible.map((p, i) => {
      const w = totalMV > 0 ? p.valorMercat / totalMV * 100 : 0;
      cum += w;
      return {
        name:    p.nom.replace(/\bUCITS\b.*/, "").replace(/\bETF\b.*/, "ETF").trim(),
        weight:  parseFloat(w.toFixed(2)),
        cum:     parseFloat(cum.toFixed(2)),
        color:   PM_COLORS[i % PM_COLORS.length],
        fullNom: p.nom,
      };
    });
  }, [visible, totalMV]);

  // Annual returns per year (only years with at least one non-null value across visible)
  const returnData = useMemo(() => {
    if (totalMV === 0) return { years: [], data: [] };
    const activeYears = YEAR_FIELDS.filter(({ field }) =>
      visible.some(p => p[field] != null)
    );
    // One data point per position, keyed by year field
    // Alternative: one data point per year, one line per position — too many lines
    // Instead: one line per year, one point per position (X = position rank)
    const data = visible.map((p, i) => {
      const point = {
        name:    p.nom.replace(/\bUCITS\b.*/, "").replace(/\bETF\b.*/, "ETF").trim(),
        fullNom: p.nom,
        color:   PM_COLORS[i % PM_COLORS.length],
      };
      activeYears.forEach(({ field, label }) => {
        const v = netRend(p, field);
        point[label] = v != null ? parseFloat(v.toFixed(2)) : undefined;
      });
      return point;
    });
    return { years: activeYears, data };
  }, [visible, totalMV]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* ── Header: toggle + total return ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
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
        <div style={{ fontSize: 11, color: tc.textLight }}>
          Rend. Inici:&nbsp;<PctChip v={totalReturn} tc={tc} />
          <span style={{ fontSize: 10, marginLeft: 6, color: tc.textLight }}>(ponderat, net TER Abel Font)</span>
        </div>
      </div>

      {/* ── Two-column: weight chart + IRR list ── */}
      <div style={{ display: "flex", gap: 16 }}>

        {/* LEFT: Weight concentration line chart */}
        <div style={{ ...card, flex: "1 1 58%" }}>
          <div style={secLabel}>Pesos cartera · concentració · <span style={{ fontFamily: "'DM Mono',monospace" }}>{fmtM(totalMV)}</span></div>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={weightData} margin={{ top: 8, right: 16, bottom: 40, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={tc.border} />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 9, fill: tc.textLight }}
                angle={-40}
                textAnchor="end"
                interval={0}
                height={60}
              />
              <YAxis
                tickFormatter={v => v.toFixed(0) + "%"}
                tick={{ fontSize: 10, fill: tc.textLight }}
                axisLine={false} tickLine={false}
                width={36}
                yAxisId="left"
              />
              <YAxis
                tickFormatter={v => v.toFixed(0) + "%"}
                tick={{ fontSize: 10, fill: tc.textLight }}
                axisLine={false} tickLine={false}
                width={36}
                yAxisId="right"
                orientation="right"
                domain={[0, 100]}
              />
              <Tooltip
                {...tooltipStyle}
                formatter={(v, name) => [v.toFixed(1) + "%", name]}
                labelFormatter={(_, payload) => payload?.[0]?.payload?.fullNom ?? ""}
              />
              <Line
                yAxisId="left"
                dataKey="weight"
                name="Pes individual"
                stroke={tc.navy}
                strokeWidth={2}
                dot={{ r: 3, fill: tc.navy }}
              />
              <Line
                yAxisId="right"
                dataKey="cum"
                name="Pes acumulat"
                stroke={tc.green}
                strokeWidth={1.5}
                dot={false}
                strokeDasharray="5 3"
              />
            </LineChart>
          </ResponsiveContainer>
          <div style={{ fontSize: 10, color: tc.textLight, marginTop: 4, fontStyle: "italic" }}>
            Pes individual (esquerra) · Acumulat (dreta, línia discontínua)
          </div>
        </div>

        {/* RIGHT: IRR per position */}
        <div style={{ ...card, flex: "0 0 260px" }}>
          <div style={secLabel}>Rendiment des d'inici</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {visible.map((p, i) => {
              const net = netRendInici(p);
              return (
                <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, flexShrink: 0, background: PM_COLORS[i % PM_COLORS.length] }} />
                  <span style={{ flex: 1, fontSize: 11, color: tc.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {p.nom}
                  </span>
                  <PctChip v={net} tc={tc} />
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* ── Annual returns line chart ── */}
      {returnData.years.length > 0 && (
        <div style={card}>
          <div style={secLabel}>Rendiment anual per posició · {returnData.years.map(y => y.label).join(" / ")} (net TER Abel Font)</div>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={returnData.data} margin={{ top: 8, right: 16, bottom: 40, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={tc.border} />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 9, fill: tc.textLight }}
                angle={-40}
                textAnchor="end"
                interval={0}
                height={60}
              />
              <YAxis
                tickFormatter={v => v.toFixed(0) + "%"}
                tick={{ fontSize: 10, fill: tc.textLight }}
                axisLine={false} tickLine={false}
                width={40}
              />
              <ReferenceLine y={0} stroke={tc.border} strokeDasharray="4 2" />
              <Tooltip
                {...tooltipStyle}
                formatter={(v, name) => [v != null ? (v >= 0 ? "+" : "") + v.toFixed(2) + "%" : "—", name]}
                labelFormatter={(_, payload) => payload?.[0]?.payload?.fullNom ?? ""}
              />
              {returnData.years.map(({ label }, i) => (
                <Line
                  key={label}
                  dataKey={label}
                  name={label}
                  stroke={[tc.navy, tc.green, "#E8A020", "#6B2E7E"][i % 4]}
                  strokeWidth={2}
                  dot={{ r: 3 }}
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
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 520 }}>
          <thead>
            <tr>
              <th style={{ ...th, width: 20 }}></th>
              <th style={{ ...th, textAlign: "left" }}>Nom</th>
              <th style={{ ...th, textAlign: "left" }}>Gestor</th>
              <th style={{ ...th, textAlign: "right" }}>Rend. Inici</th>
              <th style={{ ...th, textAlign: "right" }}>Valor mercat</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((p, i) => {
              const net = netRendInici(p);
              const rendColor = net == null ? tc.textLight : net > 0 ? tc.green : tc.red;
              return (
                <tr key={p.id} className="hoverable" style={{ borderBottom: `1px solid ${tc.border}` }}>
                  <td style={{ padding: "7px 10px" }}>
                    <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: PM_COLORS[i % PM_COLORS.length] }} />
                  </td>
                  <td style={{ padding: "7px 10px" }}>
                    <Link to={`/mercats-publics/${p.id}`}
                      style={{ color: tc.navy, textDecoration: "none", fontWeight: 500 }}>
                      {p.nom}
                    </Link>
                  </td>
                  <td style={{ padding: "7px 10px", color: tc.textLight, fontSize: 11 }}>{p.gestor}</td>
                  <td style={{ padding: "7px 10px", textAlign: "right" }}>
                    <span style={{ fontFamily: "'DM Mono',monospace", fontWeight: 700, fontSize: 11, color: rendColor }}>
                      {net != null ? (net >= 0 ? "+" : "") + net.toFixed(2) + "%" : "—"}
                    </span>
                  </td>
                  <td style={{ padding: "7px 10px", textAlign: "right", fontFamily: "'DM Mono',monospace", color: tc.navy, fontWeight: 600, fontSize: 11 }}>
                    {fmtM(p.valorMercat)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

    </div>
  );
}
