import React, { useMemo, useState } from "react";
import ReactECharts from "../ReactECharts.jsx";
import { ecTheme } from "../echartsTheme.js";
import { Link } from "react-router-dom";
import { PM_POSITIONS, PM_CLOSED, PM_MONTHLY } from "../data/publicMarkets.js";
import { useTheme } from "../theme.js";
import { fmtM, usePersistedState, yearsHeld, cagr } from "../utils.js";
import { PM_TER } from "../data/pmTer.js";
import { PM_TRANSACTIONS } from "../data/pmTransactions.js";
import { CumulativeFlowsChart } from "./CumulativeFlowsChart.jsx";

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

const ABEL_RV_SPLIT = 0.7516;
const ABEL_RF_SPLIT = 1 - ABEL_RV_SPLIT;


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

  const allPositions = useMemo(() => {
    const active = visible.map(p => ({ ...p, _status: "active" }));
    const closed = PM_CLOSED
      .filter(p => p.tipus === tipus)
      .filter(p => {
        if (toggle === "all") return true;
        if (!p.custodian) return false;
        if (toggle === "caixabank") return p.custodian === "CaixaBank";
        if (toggle === "bankinter") return p.custodian === "Bankinter";
        return true;
      })
      .sort((a, b) => a.nom.localeCompare(b.nom, "ca", { sensitivity: "base" }))
      .map(p => ({ ...p, _status: "closed" }));
    return [...active, ...closed];
  }, [visible, tipus, toggle]);

  // Transactions for this asset type
  const typeTxs = useMemo(
    () => PM_TRANSACTIONS.filter(t => t.tipus === tipus),
    [tipus]
  );

  // Monthly portfolio value series for this asset type
  const typeValueSeries = useMemo(
    () => PM_MONTHLY.map(m => ({
      date: m.date,
      value: tipus === "RV"
        ? m.caixaRV + m.ubsRV + (m.abelBK != null ? m.abelBK * ABEL_RV_SPLIT : 0)
        : m.caixaRF + m.ubsRF + (m.abelBK != null ? m.abelBK * ABEL_RF_SPLIT : 0) + m.andbank,
    })),
    [tipus]
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
        {(() => {
          const t = ecTheme(tc);
          const option = {
            grid: { top: 8, right: 8, bottom: 32, left: 0, containLabel: true },
            tooltip: {
              ...t.tooltip,
              trigger: "axis",
              formatter: (params) => {
                const p = params[0];
                if (!p || p.value == null) return "";
                const sign = p.value >= 0 ? "+" : "";
                return `<div style="font-weight:600">${p.axisValue}</div><div>${p.marker}Cartera: ${sign}${p.value.toFixed(2)}%</div>`;
              },
            },
            xAxis: {
              type: "category",
              data: portfolioData.map(d => d.year),
              axisLabel: { fontSize: 11, color: tc.textLight },
              axisLine: { show: false },
              axisTick: { show: false },
            },
            yAxis: {
              type: "value",
              axisLabel: { fontSize: 10, color: tc.textLight, formatter: v => v.toFixed(0) + "%" },
              splitLine: { lineStyle: { color: tc.border } },
              axisLine: { show: false },
              axisTick: { show: false },
            },
            series: [{
              name: "Cartera",
              type: "line",
              data: portfolioData.map(d => d.portfolio),
              lineStyle: { color: tc.navy, width: 2 },
              itemStyle: { color: tc.navy },
              symbol: "circle", symbolSize: 8,
              connectNulls: true,
              markLine: {
                data: [{ yAxis: 0 }],
                lineStyle: { color: tc.border, type: "dashed", width: 1 },
                symbol: "none",
                label: { show: false },
              },
            }],
          };
          return <ReactECharts option={option} style={{ width: "100%", height: 200 }} opts={{ renderer: "canvas" }} />;
        })()}
        <div style={{ fontSize: 10, color: tc.textLight, marginTop: 6, fontStyle: "italic" }}>
          {retMode === "net"
            ? "Ponderat per valor de mercat. Abel Font net de TER. Posicions sense dades del any exclosos."
            : "Ponderat per valor de mercat. Retorns bruts (sense deducció TER). Posicions sense dades del any exclosos."}
        </div>
      </div>

      <div style={card}>
        <div style={secLabel}>
          Fluxos acumulats · top 5 posicions per inversió
        </div>
        <CumulativeFlowsChart
          transactions={typeTxs}
          valuesSeries={typeValueSeries}
          groupBy="position"
          topN={5}
          height={260}
        />
      </div>

      {/* ── Merged position table (active + discontinued) ── */}
      <div style={{ ...card, overflowX: "auto" }}>
        <div style={secLabel}>Totes les posicions · actives i discontinuades</div>
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
              <th style={{ ...th, textAlign: "center" }}>Estat</th>
            </tr>
          </thead>
          <tbody>
            {allPositions.map((p, i) => {
              const isActive = p._status === "active";
              if (isActive) {
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
                    <td style={{ padding: "7px 10px", textAlign: "center" }}>
                      <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 4, fontWeight: 700,
                        background: "#E8F8E8", color: "#1C6B1D" }}>
                        En cartera
                      </span>
                    </td>
                  </tr>
                );
              }
              return (
                <tr key={`${p.isin}-${p.any ?? p.nom}`} className="hoverable"
                  style={{ borderBottom: `1px solid ${tc.border}`, opacity: 0.7 }}>
                  <td style={{ padding: "7px 10px" }}>
                    <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, flexShrink: 0, background: tc.border }} />
                  </td>
                  <td style={{ padding: "7px 10px" }}>
                    <Link to={`/mercats-publics/${p.isin}`}
                      style={{ color: tc.textMid, textDecoration: "none", fontWeight: 500 }}>
                      {p.nom}
                    </Link>
                  </td>
                  <td style={{ padding: "7px 10px", color: tc.textLight, fontSize: 11 }}>{p.custodian ?? "—"}</td>
                  {YEAR_FIELDS.map(({ label }) => (
                    <td key={label} style={{ padding: "7px 10px", textAlign: "right", color: tc.textLight }}>—</td>
                  ))}
                  <td style={{ padding: "7px 10px", textAlign: "right", color: tc.textLight }}>—</td>
                  <td style={{ padding: "7px 10px", textAlign: "right", color: tc.textLight }}>—</td>
                  <td style={{ padding: "7px 10px", textAlign: "right", color: tc.textLight }}>—</td>
                  <td style={{ padding: "7px 10px", textAlign: "center" }}>
                    <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 4, fontWeight: 700,
                      background: tc.bgAlt, color: tc.textLight, border: `1px solid ${tc.border}` }}>
                      Discontinuat
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div style={{ fontSize: 10, color: tc.textLight, marginTop: 8, fontStyle: "italic" }}>
          Des d'inici: retorn total acumulat. CAGR: retorn anualitzat equivalent.{" "}
          {retMode === "net" ? "Net TER per Abel Font." : "Brut (sense deducció TER)."}
          {" "}Posicions discontinuades sense dades de rendiment.
        </div>
      </div>

    </div>
  );
}

