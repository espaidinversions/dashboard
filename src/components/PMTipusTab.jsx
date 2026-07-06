import React, { useMemo, useState } from "react";
import ReactECharts from "../ReactECharts.jsx";
import { ecTheme } from "../echartsTheme.js";
import { Link } from "react-router-dom";
import { PM_MODEL } from "../data/publicMarketsModel.js";
import { WAM_POSITIONS } from "../data/wamPositions.js";
import { TC_LIGHT, useTheme } from "../theme.js";
import { CHART_PALETTE } from "../chartColors.js";
import { fmtM, usePersistedState, yearsHeld, cagr } from "../utils.js";
import { buildClosedTransactionSummaryByIsinCustodian } from "../data/pmClosedUtils.js";
import { makePmPositionRouteId } from "../data/pmPositionRouting.js";
import { isEtfPosition } from "./publicMarkets/PublicMarketsShared.jsx";

const PM_POSITIONS = PM_MODEL.holdings.active;

const PM_FIRST_REND_YEAR = 2023;
const PM_CURRENT_YEAR    = new Date().getFullYear();

const YEAR_FIELDS = Array.from(
  { length: Math.max(PM_CURRENT_YEAR - PM_FIRST_REND_YEAR + 1, 1) },
  (_, i) => PM_FIRST_REND_YEAR + i
)
  .map(y => ({ field: `rend${y}`, label: String(y) }))
  .filter(({ field }) => PM_POSITIONS.some(p => p[field] !== undefined));

const BUCKET_TOGGLES = [
  { id: "all",           label: "Tots" },
  { id: "etfs",          label: "ETFs" },
  { id: "fgp-caixa",     label: "Fons CB" },
  { id: "fgp-bankinter", label: "Fons BK" },
  { id: "rf-wam",        label: "RF – WAM" },
  { id: "accions-ib",    label: "Accions – IB" },
];

const BUCKET_LABELS = {
  "etfs":          "ETFs · CaixaBank + Bankinter",
  "fgp-caixa":     "Fons Gestió Pròpia · CaixaBank",
  "fgp-bankinter": "Fons Gestió Pròpia · Bankinter",
  "rf-wam":        "Renda Fixa · WAM – Andbank",
  "accions-ib":    "Accions · Interactive Brokers",
};

// Sections shown when toggle === "all"
const ALL_SECTIONS = ["etfs", "fgp-caixa", "rf-wam", "accions-ib", "fgp-bankinter"];

// rendInici: always % form for all positions (script: (valorMercat-costEur)/costEur*100).
// rend${year}: mixed conventions — ETf's Espai sheet stores direct % (34.24 = 34.24%),
// Master/IB stores decimal fractions (0.199 = 19.9%). Heuristic: |v| > 0.5 → % form.
function rendPct(pos, field) {
  const v = pos[field];
  if (v == null) return null;
  if (field === "rendInici" || pos.custodian === "Andbank") return v;
  if (Math.abs(v) > 150) return null;
  return Math.abs(v) > 0.5 ? v : v * 100;
}

function getBucketPositions(bucketId) {
  switch (bucketId) {
    case "etfs":
      return PM_POSITIONS.filter(p =>
        (p.custodian === "CaixaBank" || p.custodian === "Bankinter") && isEtfPosition(p)
      );
    case "fgp-caixa":
      return PM_POSITIONS.filter(p => p.custodian === "CaixaBank" && !isEtfPosition(p));
    case "fgp-bankinter":
      return PM_POSITIONS.filter(p => p.custodian === "Bankinter" && !isEtfPosition(p));
    case "rf-wam":
      return WAM_POSITIONS;
    case "accions-ib":
      return PM_POSITIONS.filter(p => p.custodian === "Interactive Brokers");
    default:
      return [...PM_POSITIONS, ...WAM_POSITIONS];
  }
}

function PctChip({ v, tc = TC_LIGHT }) {
  if (v == null) return <span style={{ fontSize: 11, color: tc.textLight, fontFamily: "'DM Mono',monospace" }}>—</span>;
  const pos   = v > 0.05;
  const neg   = v < -0.05;
  const color = pos ? tc.green : neg ? tc.red : tc.textLight;
  const bg    = pos ? (tc.green + "20") : neg ? (tc.red + "18") : "transparent";
  return (
    <span style={{ fontSize: 11, fontWeight: 700, color, background: bg, borderRadius: 4, padding: "1px 6px", fontFamily: "'DM Mono',monospace" }}>
      {pos ? "+" : ""}{v.toFixed(2)}%
    </span>
  );
}

export function PMTipusTab() {
  const { tc, dark } = useTheme();
  const [toggle, setToggle] = usePersistedState("pm_toggle_posicions", "all");

  const card = { background: tc.card, border: `1px solid ${tc.border}`, borderRadius: 10, padding: "20px 24px", boxShadow: "0 2px 8px rgba(0,0,0,.06)" };
  const th   = { padding: "8px 10px", fontSize: 10, letterSpacing: "0.09em", color: tc.textLight, textTransform: "uppercase", fontWeight: 600, borderBottom: `2px solid ${tc.border}`, whiteSpace: "nowrap" };
  const secLabel = { fontSize: 11, letterSpacing: "0.11em", textTransform: "uppercase", color: tc.textLight, fontWeight: 600, marginBottom: 12 };

  // eslint-disable-next-line no-unused-vars
  const _closedSummary = useMemo(() => buildClosedTransactionSummaryByIsinCustodian(), []);

  const visible = useMemo(() => {
    const base = getBucketPositions(toggle);
    return [...base].sort((a, b) => (b.valorMercat ?? 0) - (a.valorMercat ?? 0));
  }, [toggle]);

  const totalMV = useMemo(
    () => visible.reduce((s, p) => s + (p.valorMercat ?? 0), 0),
    [visible]
  );

  const activeYears = useMemo(() =>
    YEAR_FIELDS.filter(({ field }) => visible.some(p => rendPct(p, field) != null)),
    [visible]
  );

  const portfolioData = useMemo(() =>
    activeYears.map(({ field, label }) => {
      let sum = 0, weight = 0;
      visible.forEach(p => {
        const v = rendPct(p, field);
        if (v == null) return;
        sum    += v * (p.valorMercat ?? 0);
        weight += (p.valorMercat ?? 0);
      });
      return { year: label, portfolio: weight > 0 ? parseFloat((sum / weight).toFixed(2)) : undefined };
    }),
    [visible, activeYears]
  );

  const sections = toggle === "all" ? ALL_SECTIONS : [toggle];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* ── Toggle pills ── */}
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center" }}>
        {BUCKET_TOGGLES.map(t => (
          <button key={t.id} onClick={() => setToggle(t.id)}
            style={{
              padding: "4px 12px", borderRadius: 4,
              border: `1.5px solid ${toggle === t.id ? tc.green : tc.border}`,
              background: toggle === t.id ? (dark ? "#0A2010" : "#E8F8E8") : "transparent",
              color: toggle === t.id ? tc.green : tc.textLight,
              fontSize: 11, cursor: "pointer", fontFamily: "inherit",
              fontWeight: toggle === t.id ? 700 : 400,
            }}>
            {t.label}
          </button>
        ))}
        <span style={{ marginLeft: "auto", fontSize: 11, color: tc.textLight }}>
          {fmtM(totalMV)} total visible
        </span>
      </div>

      {/* ── MWR by year chart ── */}
      {portfolioData.length > 0 && (
        <div style={card}>
          <div style={secLabel}>Rendiment anual ponderat per valor de mercat</div>
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
                axisLabel: { fontSize: 10, color: tc.textLight, formatter: v => `${v >= 0 ? "+" : ""}${v.toFixed(0)}%` },
                splitLine: { lineStyle: { color: tc.border } },
                axisLine: { show: false },
                axisTick: { show: false },
              },
              series: [{
                name: "Cartera",
                type: "bar",
                data: portfolioData.map(d => d.portfolio),
                itemStyle: {
                  color: (params) => params.data >= 0 ? tc.green : tc.red,
                  borderRadius: [3, 3, 0, 0],
                },
                barMaxWidth: 48,
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
            Retorn anual ponderat per valor de mercat. Posicions sense dades de l&apos;any excloses.
          </div>
        </div>
      )}

      {/* ── Position tables by bucket ── */}
      {sections.map(bucketId => {
        const positions = getBucketPositions(bucketId)
          .sort((a, b) => (b.valorMercat ?? 0) - (a.valorMercat ?? 0));

        const bucketMV = positions.reduce((s, p) => s + (p.valorMercat ?? 0), 0);

        if (toggle !== "all" && positions.length === 0) return null;

        return (
          <div key={bucketId} style={{ ...card, overflowX: "auto" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 12 }}>
              <div style={secLabel}>{BUCKET_LABELS[bucketId]}</div>
              <span style={{ fontSize: 12, fontFamily: "'DM Mono',monospace", color: tc.navy, fontWeight: 600 }}>
                {fmtM(bucketMV)}
              </span>
            </div>
            {positions.length === 0 ? (
              <div style={{ fontSize: 12, color: tc.textLight, fontStyle: "italic" }}>Cap posició activa.</div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 680 }}>
                <thead>
                  <tr>
                    <th style={{ ...th, textAlign: "left", width: 20 }}></th>
                    <th style={{ ...th, textAlign: "left" }}>Nom</th>
                    <th style={{ ...th, textAlign: "left" }}>Custodi</th>
                    {YEAR_FIELDS.map(({ label }) => (
                      <th key={label} style={{ ...th, textAlign: "right" }}>{label}</th>
                    ))}
                    <th style={{ ...th, textAlign: "right" }}>Des d&apos;inici</th>
                    <th style={{ ...th, textAlign: "right" }}>CAGR</th>
                    <th style={{ ...th, textAlign: "right" }}>Valor mercat</th>
                  </tr>
                </thead>
                <tbody>
                  {positions.map((p, i) => {
                    const yh  = yearsHeld(p.dataCompra);
                    const mwr = cagr(p.rendInici, yh);
                    return (
                      <tr key={p.id ?? `${p.isin}-${i}`} className="hoverable"
                        style={{ borderBottom: `1px solid ${tc.border}`, background: i % 2 === 1 ? (dark ? tc.bgAlt : "#f8f9fb") : "transparent" }}>
                        <td style={{ padding: "7px 10px" }}>
                          <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: CHART_PALETTE[i % CHART_PALETTE.length] }} />
                        </td>
                        <td style={{ padding: "7px 10px" }}>
                          {p.isin ? (
                            <Link to={`/mercats-publics/${makePmPositionRouteId(p)}`}
                              style={{ color: tc.navy, textDecoration: "none", fontWeight: 500 }}>
                              {p.nom}
                            </Link>
                          ) : (
                            <span style={{ color: tc.text, fontWeight: 500 }}>{p.nom}</span>
                          )}
                        </td>
                        <td style={{ padding: "7px 10px", color: tc.textLight, fontSize: 11 }}>{p.custodian}</td>
                        {YEAR_FIELDS.map(({ field }) => (
                          <td key={field} style={{ padding: "7px 10px", textAlign: "right" }}>
                            <PctChip v={rendPct(p, field)} tc={tc} />
                          </td>
                        ))}
                        <td style={{ padding: "7px 10px", textAlign: "right" }}>
                          <PctChip v={p.rendInici} tc={tc} />
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
            )}
          </div>
        );
      })}

    </div>
  );
}
