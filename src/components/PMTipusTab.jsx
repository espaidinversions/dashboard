import React, { useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ReferenceLine, ResponsiveContainer,
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

const YEAR_DEFS = [
  { field: "rend2023", label: "2023" },
  { field: "rend2024", label: "2024" },
  { field: "rend2025", label: "2025" },
  { field: "rend2026", label: "2026" },
];

const TOGGLES = [
  { id: "all",       label: "Tots" },
  { id: "directe",   label: "Directe" },
  { id: "bankinter", label: "Bankinter" },
];

function netRend(p, rendField) {
  const gross = p[rendField];
  if (gross == null) return null;
  return p.gestor === "Abel Font" ? gross - (p.costAnual ?? 0) : gross;
}

function netRendInici(p) {
  if (p.rendInici == null) return null;
  return p.gestor === "Abel Font"
    ? p.rendInici - (p.costAnual ?? 0) * yearsHeld(p.dataCompra)
    : p.rendInici;
}

// Custom tooltip — only show positions with non-zero contribution for this year
function AttribTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const items = payload
    .filter(e => e.value !== 0 && e.value != null)
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
    .slice(0, 12); // cap at 12 to avoid overflow
  return (
    <div style={{
      background: "#fff", border: "1px solid #ddd", borderRadius: 8,
      padding: "10px 14px", fontSize: 11, maxWidth: 280,
    }}>
      <div style={{ fontWeight: 700, marginBottom: 6 }}>{label}</div>
      {items.map(e => (
        <div key={e.dataKey} style={{ display: "flex", justifyContent: "space-between", gap: 16, marginBottom: 2 }}>
          <span style={{ color: e.fill }}>■</span>
          <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.name}</span>
          <span style={{ fontWeight: 600, color: e.value >= 0 ? "#22a050" : "#c0392b" }}>
            {(e.value >= 0 ? "+" : "") + e.value.toFixed(2) + "%"}
          </span>
        </div>
      ))}
      {payload.filter(e => e.value !== 0).length > 12 && (
        <div style={{ color: "#999", marginTop: 4 }}>+{payload.filter(e => e.value !== 0).length - 12} més…</div>
      )}
    </div>
  );
}

export function PMTipusTab({ tipus }) {
  const { tc } = useTheme();
  const [toggle, setToggle] = usePersistedState(`pm_toggle_${tipus}`, "all");

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

  const chartData = useMemo(() => {
    if (totalMV === 0) return [];
    return YEAR_DEFS.map(({ field, label }) => {
      const point = { year: label };
      visible.forEach(p => {
        const net = netRend(p, field);
        if (net == null) return;
        point[p.id] = parseFloat((net * (p.valorMercat / totalMV)).toFixed(4));
      });
      return point;
    });
  }, [visible, totalMV]);

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

  const returnColor = totalReturn == null ? tc.textLight
    : totalReturn > 0 ? "#22a050" : "#c0392b";

  return (
    <div>
      {/* ── Header row: toggle + return label ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 6 }}>
          {TOGGLES.map(t => (
            <button key={t.id} onClick={() => setToggle(t.id)}
              style={{
                background: toggle === t.id ? tc.navy : "transparent",
                color: toggle === t.id ? "#fff" : tc.textMid,
                border: `1.5px solid ${toggle === t.id ? tc.navy : tc.border}`,
                borderRadius: 20, padding: "5px 14px", fontSize: 11,
                cursor: "pointer", fontFamily: "inherit",
              }}>
              {t.label}
            </button>
          ))}
        </div>
        {totalReturn != null && (
          <div style={{ fontSize: 12, color: tc.textLight }}>
            Rend. Inici:&nbsp;
            <span style={{ fontWeight: 700, color: returnColor }}>
              {(totalReturn >= 0 ? "+" : "") + totalReturn.toFixed(2) + "%"}
            </span>
            <span style={{ fontSize: 10, marginLeft: 4 }}>(ponderat, net TER Abel Font)</span>
          </div>
        )}
      </div>

      {/* ── Attribution chart ── */}
      <div style={{
        background: tc.card, borderRadius: 12, border: `1px solid ${tc.border}`,
        padding: "20px 24px", marginBottom: 20,
      }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: tc.navy, marginBottom: 12 }}>
          Contribució per posició · rendiments {toggle === "bankinter" ? "nets TER" : "bruts (Directe) / nets TER (Bankinter)"}
        </div>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={chartData} margin={{ top: 8, right: 32, bottom: 8, left: 8 }}>
            <XAxis dataKey="year" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={v => v.toFixed(1) + "%"} tick={{ fontSize: 11 }} width={42} />
            <ReferenceLine y={0} stroke="#ccc" />
            <Tooltip content={<AttribTooltip />} />
            {visible.map((p, i) => (
              <Bar key={p.id} dataKey={p.id} stackId="a"
                   fill={PM_COLORS[i % PM_COLORS.length]} name={p.nom} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── Position list ── */}
      <div style={{
        background: tc.card, borderRadius: 12, border: `1px solid ${tc.border}`,
        padding: "20px 24px",
      }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: tc.navy, marginBottom: 12 }}>
          Posicions · ordenades per valor de mercat
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${tc.border}` }}>
              <th style={{ textAlign: "left",  padding: "5px 8px", fontWeight: 600, color: tc.textLight, fontSize: 11 }}></th>
              <th style={{ textAlign: "left",  padding: "5px 8px", fontWeight: 600, color: tc.textLight, fontSize: 11 }}>Nom</th>
              <th style={{ textAlign: "left",  padding: "5px 8px", fontWeight: 600, color: tc.textLight, fontSize: 11 }}>Gestor</th>
              <th style={{ textAlign: "right", padding: "5px 8px", fontWeight: 600, color: tc.textLight, fontSize: 11 }}>Rend. Inici</th>
              <th style={{ textAlign: "right", padding: "5px 8px", fontWeight: 600, color: tc.textLight, fontSize: 11 }}>Valor mercat</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((p, i) => {
              const net = netRendInici(p);
              const rendColor = net == null ? tc.textLight : net > 0 ? "#22a050" : "#c0392b";
              return (
                <tr key={p.id} style={{ borderBottom: `1px solid ${tc.border}` }}>
                  <td style={{ padding: "6px 8px", width: 16 }}>
                    <span style={{
                      display: "inline-block", width: 10, height: 10, borderRadius: 2,
                      background: PM_COLORS[i % PM_COLORS.length],
                    }} />
                  </td>
                  <td style={{ padding: "6px 8px" }}>
                    <Link to={`/mercats-publics/${p.id}`}
                      style={{ color: tc.navy, textDecoration: "none", fontWeight: 500 }}>
                      {p.nom}
                    </Link>
                  </td>
                  <td style={{ padding: "6px 8px", color: tc.textLight, fontSize: 11 }}>{p.gestor}</td>
                  <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 600, color: rendColor }}>
                    {net != null ? (net >= 0 ? "+" : "") + net.toFixed(2) + "%" : "—"}
                  </td>
                  <td style={{ padding: "6px 8px", textAlign: "right" }}>{fmtM(p.valorMercat)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
