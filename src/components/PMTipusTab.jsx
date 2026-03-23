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
      {/* ── Header row: toggle + total return ── */}
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

      {/* ── Two-column: weight chart + IRR list ── */}
      <div style={{ display: "flex", gap: 16, marginBottom: 20 }}>

        {/* LEFT: Portfolio weight composition */}
        <div style={{
          flex: "1 1 55%", background: tc.card, borderRadius: 12,
          border: `1px solid ${tc.border}`, padding: "20px 24px",
        }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: tc.navy, marginBottom: 16 }}>
            Pesos cartera · {fmtM(totalMV)} total
          </div>

          {/* Stacked composition bar */}
          <div style={{ display: "flex", height: 28, borderRadius: 6, overflow: "hidden", marginBottom: 20 }}>
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
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {visible.map((p, i) => {
              const w = p.valorMercat / totalMV * 100;
              return (
                <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{
                    display: "inline-block", width: 10, height: 10, borderRadius: 2, flexShrink: 0,
                    background: PM_COLORS[i % PM_COLORS.length],
                  }} />
                  <span style={{ flex: 1, fontSize: 11, color: tc.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {p.nom}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: tc.navy, flexShrink: 0 }}>
                    {w.toFixed(1)}%
                  </span>
                  <span style={{ fontSize: 11, color: tc.textLight, flexShrink: 0, minWidth: 52, textAlign: "right" }}>
                    {fmtM(p.valorMercat)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT: IRR per position */}
        <div style={{
          flex: "0 0 280px", background: tc.card, borderRadius: 12,
          border: `1px solid ${tc.border}`, padding: "20px 24px",
        }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: tc.navy, marginBottom: 16 }}>
            Rendiments des d'inici
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {visible.map((p, i) => {
              const net = netRendInici(p);
              const color = net == null ? tc.textLight : net > 0 ? "#22a050" : "#c0392b";
              return (
                <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{
                    display: "inline-block", width: 10, height: 10, borderRadius: 2, flexShrink: 0,
                    background: PM_COLORS[i % PM_COLORS.length],
                  }} />
                  <span style={{ flex: 1, fontSize: 11, color: tc.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {p.nom}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 700, color, flexShrink: 0 }}>
                    {net != null ? (net >= 0 ? "+" : "") + net.toFixed(1) + "%" : "—"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

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
