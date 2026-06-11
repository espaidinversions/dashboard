import React, { useMemo, useState } from "react";
import ReactECharts from "../ReactECharts.jsx";
import { ecTheme } from "../echartsTheme.js";
import { Link } from "react-router-dom";
import { PM_MODEL } from "../data/publicMarketsModel.js";
import { TC_LIGHT, useTheme } from "../theme.js";
import { CHART_PALETTE } from "../chartColors.js";
import { fmtM, usePersistedState, yearsHeld, cagr } from "../utils.js";
import { PM_TER } from "../generated/publicMarkets/pmTer.js";
import { buildClosedTransactionSummaryByIsinCustodian, enrichClosedPosition } from "../data/pmClosedUtils.js";
import { CumulativeFlowsChart } from "./CumulativeFlowsChart.jsx";
import { buildMonthlySeriesFromNestedValues } from "../chartSeries.js";
import { makePmPositionRouteId } from "../data/pmPositionRouting.js";

const PM_POSITIONS = PM_MODEL.holdings.active;
const PM_CLOSED = PM_MODEL.holdings.closed;
const PM_MONTHLY = PM_MODEL.series.monthly;
const PM_VALUES = PM_MODEL.series.values;
const PM_TRANSACTIONS = PM_MODEL.activity.transactions;

const TOGGLES = [
  { id: "all",        label: "Tots" },
  { id: "caixabank",  label: "CaixaBank" },
  { id: "bankinter",  label: "Bankinter" },
  { id: "jpmorgan",   label: "JPMorgan" },
  { id: "ubs",        label: "UBS" },
  { id: "andbank",    label: "Andbank" },
];

// Year columns from 2023 through the current year, capped at fields present on the data.
const PM_FIRST_REND_YEAR = 2023;
const PM_CURRENT_YEAR = new Date().getFullYear();
const YEAR_FIELDS = Array.from(
  { length: Math.max(PM_CURRENT_YEAR - PM_FIRST_REND_YEAR + 1, 1) },
  (_, i) => PM_FIRST_REND_YEAR + i
)
  .map(y => ({ field: `rend${y}`, label: String(y) }))
  .filter(({ field }) => PM_POSITIONS.some(p => p[field] !== undefined));

const INITIAL_FILTERS = {
  nom: "", custodian: "",
  ...Object.fromEntries(YEAR_FIELDS.map(({ label }) => [`y${label}`, ""])),
  inici: "", cagr: "", valorMercat: "", estat: "Tots",
};


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

function PctChip({ v, tc = TC_LIGHT }) {
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
  const [filters, setFilters] = useState(INITIAL_FILTERS);

  const secLabel     = { fontSize: 11, letterSpacing: "0.11em", textTransform: "uppercase", color: tc.textLight, fontWeight: 600, marginBottom: 12 };
  const card         = { background: tc.card, border: `1px solid ${tc.border}`, borderRadius: 10, padding: "20px 24px", boxShadow: "0 2px 8px rgba(0,0,0,.06)" };
  const th           = { padding: "8px 10px", fontSize: 10, letterSpacing: "0.09em", color: tc.textLight, textTransform: "uppercase", fontWeight: 600, borderBottom: `2px solid ${tc.border}`, whiteSpace: "nowrap" };
  const positions = useMemo(
    () => PM_POSITIONS.filter(p => p.tipus === tipus),
    [tipus]
  );

  const closedSummaryByIsin = useMemo(
    () => buildClosedTransactionSummaryByIsinCustodian(),
    []
  );

  const closedPositions = useMemo(
    () => PM_CLOSED
      .filter(p => p.tipus === tipus)
      .map(p => enrichClosedPosition(p, closedSummaryByIsin)),
    [tipus, closedSummaryByIsin]
  );

  const typePositions = positions;

  const visible = useMemo(() => {
    const base = toggle === "caixabank"  ? positions.filter(p => p.custodian === "CaixaBank")
               : toggle === "bankinter"  ? positions.filter(p => p.custodian === "Bankinter" || p.custodian === "Interactive Brokers")
               : toggle === "jpmorgan"   ? positions.filter(p => p.custodian === "JPMorgan")
               : toggle === "ubs"        ? positions.filter(p => p.custodian === "UBS" || p.custodian === "Credit Suisse")
               : toggle === "andbank"    ? positions.filter(p => p.custodian === "Andbank")
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
      .map(p => enrichClosedPosition(p, closedSummaryByIsin))
      .filter(p => p.tipus === tipus)
      .filter(p => {
        if (toggle === "all") return true;
        if (!p.custodian) return false;
        if (toggle === "caixabank") return p.custodian === "CaixaBank";
        if (toggle === "bankinter") return p.custodian === "Bankinter" || p.custodian === "Interactive Brokers";
        if (toggle === "jpmorgan") return p.custodian === "JPMorgan";
        if (toggle === "ubs") return p.custodian === "UBS" || p.custodian === "Credit Suisse";
        if (toggle === "andbank") return p.custodian === "Andbank";
        return true;
      })
      .sort((a, b) => a.nom.localeCompare(b.nom, "ca", { sensitivity: "base" }))
      .map(p => ({ ...p, _status: "closed" }));
    return [...active, ...closed];
  }, [visible, tipus, toggle, closedSummaryByIsin]);
  const filteredPositions = useMemo(() => allPositions.filter((p) => {
    const rendInici = retMode === "net" ? netRendInici(p) : p.rendInici;
    const closeDate = p.any ? `${p.any}-12-31` : null;
    const mwr = cagr(rendInici, yearsHeld(p.dataCompra, closeDate ?? undefined));
    if (filters.nom && !String(p.nom ?? "").toLowerCase().includes(filters.nom.toLowerCase())) return false;
    if (filters.custodian && !String(p.custodian ?? "").toLowerCase().includes(filters.custodian.toLowerCase())) return false;
    for (const { field, label } of YEAR_FIELDS) {
      const yearFilter = filters[`y${label}`];
      if (yearFilter && !String(retMode === "net" ? netRend(p, field) : p[field]).includes(yearFilter)) return false;
    }
    if (filters.inici && !String(rendInici ?? "").includes(filters.inici)) return false;
    if (filters.cagr && !String(mwr ?? "").includes(filters.cagr)) return false;
    if (filters.valorMercat && !String(p.valorMercat ?? "").includes(filters.valorMercat)) return false;
    if (filters.estat !== "Tots" && ((filters.estat === "Actiu") !== (p._status === "active"))) return false;
    return true;
  }), [allPositions, filters, retMode]);

  // Transactions for this asset type
  const typeTxs = useMemo(
    () => PM_TRANSACTIONS.filter(t => t.tipus === tipus),
    [tipus]
  );

  // Monthly portfolio value series for this asset type
  const typeValueSeries = useMemo(
    () => buildMonthlySeriesFromNestedValues(
      PM_VALUES,
      typePositions,
      { include: p => p?.tipus === tipus }
    ),
    [tipus, typePositions]
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
              padding: "4px 10px", borderRadius: 4,
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
              padding: "4px 10px", borderRadius: 4,
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
            <tr style={{ borderBottom: `1px solid ${tc.border}` }}>
              <th style={{ padding: "6px 10px" }} />
              <th style={{ padding: "6px 10px" }}><input value={filters.nom} onChange={e => setFilters(v => ({ ...v, nom: e.target.value }))} style={{ width:"100%", padding:"4px 6px", borderRadius:4, border:`1px solid ${tc.border}`, background:tc.bg, color:tc.text, fontSize:11, fontFamily:"inherit" }} /></th>
              <th style={{ padding: "6px 10px" }}><input value={filters.custodian} onChange={e => setFilters(v => ({ ...v, custodian: e.target.value }))} style={{ width:"100%", padding:"4px 6px", borderRadius:4, border:`1px solid ${tc.border}`, background:tc.bg, color:tc.text, fontSize:11, fontFamily:"inherit" }} /></th>
              {YEAR_FIELDS.map(({ label }) => (
                <th key={label} style={{ padding: "6px 10px" }}><input value={filters[`y${label}`]} onChange={e => setFilters(v => ({ ...v, [`y${label}`]: e.target.value }))} style={{ width:"100%", padding:"4px 6px", borderRadius:4, border:`1px solid ${tc.border}`, background:tc.bg, color:tc.text, fontSize:11, fontFamily:"inherit" }} /></th>
              ))}
              <th style={{ padding: "6px 10px" }}><input value={filters.inici} onChange={e => setFilters(v => ({ ...v, inici: e.target.value }))} style={{ width:"100%", padding:"4px 6px", borderRadius:4, border:`1px solid ${tc.border}`, background:tc.bg, color:tc.text, fontSize:11, fontFamily:"inherit" }} /></th>
              <th style={{ padding: "6px 10px" }}><input value={filters.cagr} onChange={e => setFilters(v => ({ ...v, cagr: e.target.value }))} style={{ width:"100%", padding:"4px 6px", borderRadius:4, border:`1px solid ${tc.border}`, background:tc.bg, color:tc.text, fontSize:11, fontFamily:"inherit" }} /></th>
              <th style={{ padding: "6px 10px" }}><input value={filters.valorMercat} onChange={e => setFilters(v => ({ ...v, valorMercat: e.target.value }))} style={{ width:"100%", padding:"4px 6px", borderRadius:4, border:`1px solid ${tc.border}`, background:tc.bg, color:tc.text, fontSize:11, fontFamily:"inherit" }} /></th>
              <th style={{ padding: "6px 10px" }}><select value={filters.estat} onChange={e => setFilters(v => ({ ...v, estat: e.target.value }))} style={{ width:"100%", padding:"4px 6px", borderRadius:4, border:`1px solid ${tc.border}`, background:tc.bg, color:tc.text, fontSize:11, fontFamily:"inherit" }}>{["Tots","Actiu","Discontinuat"].map(o => <option key={o} value={o}>{o}</option>)}</select></th>
            </tr>
            {filteredPositions.map((p, i) => {
              const isActive = p._status === "active";
              if (isActive) {
                const rendInici = retMode === "net" ? netRendInici(p) : p.rendInici;
                const yh        = yearsHeld(p.dataCompra);
                const mwr       = cagr(rendInici, yh);
                return (
                  <tr key={p.id} className="hoverable" style={{ borderBottom: `1px solid ${tc.border}` }}>
                    <td style={{ padding: "7px 10px" }}>
                      <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, flexShrink: 0, background: CHART_PALETTE[i % CHART_PALETTE.length] }} />
                    </td>
                    <td style={{ padding: "7px 10px" }}>
                      <Link to={`/mercats-publics/${makePmPositionRouteId(p)}`}
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
              const closeDate = p.any ? `${p.any}-12-31` : null;
              const yh = yearsHeld(p.dataCompra, closeDate ?? undefined);
              const rendInici = retMode === "net" ? netRendInici(p) : p.rendInici;
              const mwr = cagr(rendInici, yh);
              return (
                <tr key={`${p.isin}-${p.any ?? p.nom}`} className="hoverable"
                  style={{ borderBottom: `1px solid ${tc.border}`, opacity: 0.7 }}>
                  <td style={{ padding: "7px 10px" }}>
                    <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, flexShrink: 0, background: tc.border }} />
                  </td>
                  <td style={{ padding: "7px 10px" }}>
                    <Link to={`/mercats-publics/${makePmPositionRouteId(p)}`}
                      style={{ color: tc.textMid, textDecoration: "none", fontWeight: 500 }}>
                      {p.nom}
                    </Link>
                  </td>
                  <td style={{ padding: "7px 10px", color: tc.textLight, fontSize: 11 }}>{p.custodian ?? "—"}</td>
                  {YEAR_FIELDS.map(({ label }) => (
                    <td key={label} style={{ padding: "7px 10px", textAlign: "right", color: tc.textLight }}>—</td>
                  ))}
                  <td style={{ padding: "7px 10px", textAlign: "right" }}>
                    <PctChip v={rendInici} tc={tc} />
                  </td>
                  <td style={{ padding: "7px 10px", textAlign: "right" }}>
                    <PctChip v={mwr} tc={tc} />
                  </td>
                  <td style={{ padding: "7px 10px", textAlign: "right", fontFamily: "'DM Mono',monospace", color: tc.navy, fontWeight: 600, fontSize: 11 }}>
                    {p.valorMercat != null ? fmtM(p.valorMercat) : "—"}
                  </td>
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
