import React, { useMemo } from "react";
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

function netRendInici(p) {
  if (p.rendInici == null) return null;
  return p.gestor === "Abel Font"
    ? p.rendInici - (p.costAnual ?? 0) * yearsHeld(p.dataCompra)
    : p.rendInici;
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

  const secLabel = { fontSize: 10, letterSpacing: "0.09em", textTransform: "uppercase", color: tc.textLight, fontWeight: 600, marginBottom: 12 };
  const card     = { background: tc.card, border: `1px solid ${tc.border}`, borderRadius: 10, padding: "20px 24px", boxShadow: "0 2px 8px rgba(0,0,0,.06)" };
  const th       = { padding: "8px 10px", fontSize: 10, letterSpacing: "0.09em", color: tc.textLight, textTransform: "uppercase", fontWeight: 600, borderBottom: `2px solid ${tc.border}`, whiteSpace: "nowrap" };

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

        {/* LEFT: Portfolio weight composition */}
        <div style={{ ...card, flex: "1 1 55%" }}>
          <div style={secLabel}>Pesos cartera · <span style={{ fontFamily: "'DM Mono',monospace" }}>{fmtM(totalMV)}</span></div>

          {/* Stacked composition bar */}
          <div style={{ display: "flex", height: 24, borderRadius: 5, overflow: "hidden", marginBottom: 18 }}>
            {visible.map((p, i) => (
              <div key={p.id}
                style={{
                  width: `${(p.valorMercat / totalMV * 100).toFixed(3)}%`,
                  background: PM_COLORS[i % PM_COLORS.length],
                  flexShrink: 0,
                }}
                title={`${p.nom}: ${(p.valorMercat / totalMV * 100).toFixed(1)}%`}
              />
            ))}
          </div>

          {/* Legend rows */}
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {visible.map((p, i) => {
              const w = p.valorMercat / totalMV * 100;
              return (
                <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, flexShrink: 0, background: PM_COLORS[i % PM_COLORS.length] }} />
                  <span style={{ flex: 1, fontSize: 11, color: tc.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {p.nom}
                  </span>
                  <span style={{ fontSize: 11, fontFamily: "'DM Mono',monospace", color: tc.textMid, flexShrink: 0 }}>
                    {w.toFixed(1)}%
                  </span>
                  <span style={{ fontSize: 11, fontFamily: "'DM Mono',monospace", color: tc.textLight, flexShrink: 0, minWidth: 52, textAlign: "right" }}>
                    {fmtM(p.valorMercat)}
                  </span>
                </div>
              );
            })}
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
