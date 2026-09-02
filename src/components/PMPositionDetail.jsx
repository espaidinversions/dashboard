import { useMemo, useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { PM_MODEL } from "../data/publicMarketsModel.js";
import { useTheme } from "../theme.js";
import { fmtM, yearsHeld, cagr } from "../utils.js";
import { PM_TER } from "../generated/publicMarkets/pmTer.js";
import { loadPMOverrides, loadPMPositionOverrides } from "../db.js";
import { CumulativeFlowsChart } from "./CumulativeFlowsChart.jsx";
import { PriceHistoryChart } from "./PriceHistoryChart.jsx";
import { ALL_PRICE_SERIES } from "../data/allPrices.js";
import { buildClosedTransactionSummaryByIsinCustodian, enrichClosedPosition } from "../data/pmClosedUtils.js";
import { findActivePositionByRouteId, findClosedPositionByRouteId, makeIsinCustodianKey } from "../data/pmPositionRouting.js";
import { KpiCard, SectionHeader } from "./SharedComponents.jsx";
import { rendPct } from "../data/pmReturns.js";
import { PositionTxHistory } from "./publicMarkets/PositionTxHistory.jsx";
import { PositionMetaEditor } from "./publicMarkets/PositionMetaEditor.jsx";
import { PositionAnnualReturnsChart } from "./publicMarkets/PositionAnnualReturnsChart.jsx";
import { PositionCostBreakdown } from "./publicMarkets/PositionCostBreakdown.jsx";
import { PositionSinceInception } from "./publicMarkets/PositionSinceInception.jsx";

const PM_POSITIONS = PM_MODEL.holdings.active;
const PM_CLOSED = PM_MODEL.holdings.closed;
const PM_VALUES = PM_MODEL.series.values;
const PM_CLOSED_VALUES = PM_MODEL.series.closedValues;
const PM_TRANSACTIONS = PM_MODEL.activity.transactions;
const PM_POSITION_ID_ALIASES = PM_MODEL.metadata.positionIdAliases;

const ISIN_RE = /([A-Z]{2}[A-Z0-9]{10})/;
const cleanIsin = raw => (ISIN_RE.exec(String(raw ?? "").toUpperCase())?.[1]) ?? raw;

function PMPositionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { tc, dark } = useTheme();
  const closedSummaryByIsin = useMemo(() => buildClosedTransactionSummaryByIsinCustodian(), []);

  let p = findActivePositionByRouteId(id, PM_POSITIONS, PM_POSITION_ID_ALIASES);
  let isClosed = false;
  if (!p) {
    const closed = findClosedPositionByRouteId(id, PM_CLOSED);
    if (closed) { p = enrichClosedPosition(closed, closedSummaryByIsin); isClosed = true; }
  }

  // Supabase overrides for this position
  const [metaOverride, setMetaOverride] = useState({});
  const [terOverride, setTerOverride] = useState(null);
  const [posOverride, setPosOverride] = useState(null); // {valorMercat, rendInici, rendiment:{}, costAnual}
  const isin = p ? cleanIsin(p.isin) : null;
  const positionKey = p ? makeIsinCustodianKey(isin, p.custodian) : null;

  useEffect(() => {
    if (!isin) return;
    let cancelled = false;
    Promise.all([loadPMOverrides(), loadPMPositionOverrides()]).then(([data, posMap]) => {
      if (cancelled) return;
      if (data) {
        if (data.positionMeta[isin]) setMetaOverride(data.positionMeta[isin]);
        if (data.terOverrides[isin] != null) setTerOverride(data.terOverrides[isin]);
      }
      if (posMap?.has(isin)) setPosOverride(posMap.get(isin));
    });
    return () => { cancelled = true; };
  }, [isin]);

  // Apply financial overrides (pm_position_overrides) before any hook reads p —
  // mirrors the HoldingsTable merge.
  if (posOverride && p) {
    const merged = { ...p };
    if (posOverride.valorMercat != null) merged.valorMercat = posOverride.valorMercat;
    if (posOverride.rendInici   != null) merged.rendInici   = posOverride.rendInici;
    if (posOverride.rendiment)           { for (const [yr, val] of Object.entries(posOverride.rendiment)) { if (val != null) merged[`rend${yr}`] = val; } }
    if (posOverride.costAnual   != null) merged.costAnual   = posOverride.costAnual;
    p = merged;
  }

  const isAbelFont = (metaOverride.gestor ?? p?.gestor) === "Abel Font";
  const ter        = terOverride ?? PM_TER[isin] ?? p?.costAnual ?? 0;

  // Hooks below MUST run on every render (Rules of Hooks): keep them above the
  // not-found guard and make each null-safe. Returning early before these would
  // change the hook count between renders and crash the view.
  const returnData = useMemo(() => {
    if (!p) return [];
    const endYear = new Date().getFullYear();
    const YEARS = Array.from({ length: endYear - 2019 + 1 }, (_, i) => ({
      label: String(2019 + i),
      field: `rend${2019 + i}`,
    }));
    return YEARS
      .filter(y => p[y.field] != null)
      .map(y => {
        // brut is normalized to percent form; net subtracts annual TER (also %).
        const brut = rendPct(p, y.field);
        return { year: y.label, brut, net: isAbelFont && brut != null ? brut - ter : null };
      });
  }, [p, isAbelFont, ter]);

  const positionTxs = useMemo(() => {
    if (!isin) return [];
    return PM_TRANSACTIONS.filter(t => {
      if (t.isin !== isin) return false;
      if (!positionKey) return true;
      return makeIsinCustodianKey(t.isin, t.custodian) === positionKey;
    });
  }, [isin, positionKey]);

  const positionValues = useMemo(() => {
    if (!isin) return [];
    const custodianData = PM_VALUES[isin] ?? (isClosed ? PM_CLOSED_VALUES[isin] : null);
    if (!custodianData) return [];
    const monthMap = new Map();
    Object.entries(custodianData).forEach(([custodian, series]) => {
      if (positionKey && makeIsinCustodianKey(isin, custodian) !== positionKey) return;
      series.forEach(({ date, value }) => {
        const month = date.slice(0, 7);
        monthMap.set(month, (monthMap.get(month) ?? 0) + value);
      });
    });
    return [...monthMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, value]) => ({ date: month, value }));
  }, [isin, isClosed, positionKey]);

  if (!p) {
    return (
      <div style={{ padding: "60px 32px", textAlign: "center" }}>
        <div style={{ fontSize: 14, color: tc.textLight, marginBottom: 16 }}>Posició no trobada</div>
        <button onClick={() => navigate(-1)}
          style={{ background: tc.navy, color: "#fff", border: "none", borderRadius: 6,
                   padding: "8px 20px", cursor: "pointer", fontFamily: "inherit", fontSize: 13 }}>
          ← Tornar
        </button>
      </div>
    );
  }

  // Overrides already applied above; compute the remaining display-only values.
  const displayNom       = metaOverride.nom       ?? p.nom;
  const displayCustodian = metaOverride.custodian ?? p.custodian;
  const pnl         = p.costEur != null ? (p.valorMercat ?? 0) - p.costEur : null;
  const pnlColor    = pnl == null ? tc.textLight : pnl > 0 ? tc.green : pnl < 0 ? tc.red : tc.textLight;
  const yh          = yearsHeld(p.dataCompra, isClosed && p.any ? `${p.any}-12-31` : undefined);
  const netInici    = p.rendInici != null
    ? (isAbelFont ? p.rendInici - ter * yh : p.rendInici)
    : null;
  const costPct = p.costEur != null && p.valorMercat > 0
    ? Math.min(p.costEur / p.valorMercat * 100, 100) : p.costEur != null ? 100 : 0;
  const gainPct = Math.max(100 - costPct, 0);

  const secLabel    = { fontSize: 10, letterSpacing: "0.09em", textTransform: "uppercase", color: tc.textLight, fontWeight: 600, marginBottom: 12 };
  const card        = { background: tc.card, border: `1px solid ${tc.border}`, borderRadius: 10, padding: "20px 24px", boxShadow: "0 2px 8px rgba(0,0,0,.06)" };


  const rendIniciColor = p.rendInici == null ? tc.textLight : p.rendInici > 0 ? tc.green : tc.red;
  const netIniciColor  = netInici == null ? tc.textLight : netInici > 0 ? tc.green : tc.red;

  const cagrBrut = cagr(p.rendInici, yh);
  const cagrNet  = isAbelFont ? cagr(netInici, yh) : null;
  const cagrBrutColor = cagrBrut == null ? tc.textLight : cagrBrut > 0 ? tc.green : tc.red;
  const cagrNetColor  = cagrNet  == null ? tc.textLight : cagrNet  > 0 ? tc.green : tc.red;

  return (
    <div style={{ padding: "28px 32px 60px", maxWidth: 960, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <button onClick={() => navigate(-1)}
            style={{ background: "none", border: "none", cursor: "pointer", color: tc.textMid,
                     fontFamily: "inherit", fontSize: 11, padding: 0, marginBottom: 10,
                     letterSpacing: "0.04em", textTransform: "uppercase", fontWeight: 600 }}>
            ← Mercats Públics
          </button>
          <div style={{ fontSize: 22, fontWeight: 700, color: tc.navy, marginBottom: 8 }}>
            {displayNom}
            {metaOverride.nom && (
              <span title="Nom manual (override)" style={{ fontSize: 9, fontWeight: 700, background: "#FFF3E0", color: "#E65100", borderRadius: 4, padding: "2px 5px", marginLeft: 8, verticalAlign: "middle" }}>OV</span>
            )}
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {isClosed && (
              <span style={{ fontSize: 10, background: "#FFF3CD", color: "#7B5800",
                             padding: "3px 8px", borderRadius: 4, fontWeight: 700,
                             letterSpacing: "0.06em", textTransform: "uppercase", border: "1px solid #F5C542" }}>
                Tancat {p.any}
              </span>
            )}
            {p.isin && (
              <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, background: tc.bgAlt,
                             padding: "3px 8px", borderRadius: 4, color: tc.textMid, border: `1px solid ${tc.border}` }}>
                {p.isin}
              </span>
            )}
            {displayCustodian && (
              <span style={{ fontSize: 10, background: tc.navy + "18", color: tc.navy,
                             padding: "3px 8px", borderRadius: 4, fontWeight: 700,
                             letterSpacing: "0.06em", textTransform: "uppercase" }}>
                {displayCustodian}
                {metaOverride.custodian && <span title="Custodi manual (override)" style={{ fontSize: 8, fontWeight: 700, background: "#FFF3E0", color: "#E65100", borderRadius: 4, padding: "1px 4px", marginLeft: 5 }}>OV</span>}
              </span>
            )}
            {p.tipus && (
              <span style={{ fontSize: 10, background: tc.bgAlt, padding: "3px 8px", borderRadius: 4,
                             color: tc.textMid, border: `1px solid ${tc.border}`,
                             letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 600 }}>
                {p.tipus === "RV" ? "Renda Variable" : p.tipus === "RF" ? "Renda Fixa" : p.tipus}
              </span>
            )}
            {p.divisa && (
              <span style={{ fontSize: 10, background: tc.bgAlt, padding: "3px 8px", borderRadius: 4,
                             color: tc.textMid, border: `1px solid ${tc.border}`,
                             letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 600 }}>
                {p.divisa}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── KPI row ── */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <KpiCard label={isClosed ? "Valor tancament" : "Valor mercat"} value={p.valorMercat != null ? fmtM(p.valorMercat) : "—"} tc={tc} hero />
        <KpiCard label="Cost total" value={p.costEur != null ? fmtM(p.costEur) : "—"} valueColor={tc.navyLight} tc={tc} />
        <KpiCard label="P&L" value={pnl != null ? `${pnl >= 0 ? "+" : ""}${fmtM(pnl)}` : "—"} valueColor={pnlColor} tc={tc} />
        {p.unitats != null && (
          <KpiCard label="Participacions" value={p.unitats.toLocaleString("ca-ES")} valueColor={tc.navyLight} tc={tc} />
        )}
        {p.rendInici != null && (
          <KpiCard label="TWR inici" value={(p.rendInici >= 0 ? "+" : "") + p.rendInici.toFixed(2) + "%"} valueColor={rendIniciColor} tc={tc} />
        )}
        {!isClosed && (
          <KpiCard label="Pes cartera" value={p.pes != null ? p.pes.toFixed(1) + "%" : "—"} valueColor={tc.navyLight} tc={tc} />
        )}
      </div>

      {/* ── Historial de preus · fluxos acumulats ── */}
      <div style={card}>
        <SectionHeader title="Historial de preus · fluxos acumulats" tc={tc} />
        {isin && ALL_PRICE_SERIES[isin]?.length > 0 ? (
          <PriceHistoryChart
            isin={isin}
            dataCompra={p.dataCompra}
            transactions={positionTxs}
            valueSeries={positionValues}
            height={280}
          />
        ) : positionValues.length > 0 || positionTxs.length > 0 ? (
          <>
            <p style={{ fontSize: 10, color: tc.textLight, fontStyle: "italic", marginBottom: 8 }}>
              Sense dades de preus unitaris per a aquest ISIN. Es mostren fluxos acumulats i valor.
            </p>
            <CumulativeFlowsChart
              transactions={positionTxs}
              valuesSeries={positionValues}
              groupBy="total"
              height={220}
            />
          </>
        ) : (
          <p style={{ fontSize: 11, color: tc.textLight, fontStyle: "italic", padding: "8px 0" }}>
            Sense dades de preus disponibles per a aquesta posició.
          </p>
        )}
      </div>

      {/* ── Historial de transaccions ── */}
      <PositionTxHistory txs={positionTxs} tc={tc} card={card} secLabel={secLabel} />

      {/* ── Two-column: weight chart + IRR / cost ── */}
      <div style={{ display: "flex", gap: 16 }}>

        {/* LEFT: Composition + annual returns */}
        <div style={{ ...card, flex: "1 1 55%" }}>

          <SectionHeader title="Pesos · cost vs guany" tc={tc} />
          <div style={{ display: "flex", height: 22, borderRadius: 4, overflow: "hidden", marginBottom: 8 }}>
            <div style={{ width: `${costPct.toFixed(1)}%`, background: "#4E79A7" }}
                 title={`Cost: ${fmtM(p.costEur ?? 0)} (${costPct.toFixed(1)}%)`} />
            <div style={{ width: `${gainPct.toFixed(1)}%`, background: (pnl ?? 0) >= 0 ? tc.green : tc.red }}
                 title={pnl != null ? `${pnl >= 0 ? "Guany" : "Pèrdua"}: ${fmtM(Math.abs(pnl))} (${gainPct.toFixed(1)}%)` : "P&L desconegut"} />
          </div>
          <div style={{ display: "flex", gap: 16, fontSize: 10, color: tc.textLight, marginBottom: 20, letterSpacing: "0.04em" }}>
            <span><span style={{ color: "#4E79A7" }}>■</span> Cost {costPct.toFixed(1)}% · <span style={{ fontFamily: "'DM Mono',monospace" }}>{fmtM(p.costEur ?? 0)}</span></span>
            <span><span style={{ color: (pnl ?? 0) >= 0 ? tc.green : tc.red }}>■</span> {(pnl ?? 0) >= 0 ? "Guany" : "Pèrdua"} {gainPct.toFixed(1)}% · <span style={{ fontFamily: "'DM Mono',monospace" }}>{pnl != null ? fmtM(Math.abs(pnl)) : "—"}</span></span>
          </div>

          <PositionAnnualReturnsChart returnData={returnData} isAbelFont={isAbelFont} tc={tc} />
        </div>

        {/* RIGHT: IRR + cost breakdown */}
        <div style={{ flex: "0 0 260px", display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Since-inception returns: TWR + CAGR (MWR) */}
          <PositionSinceInception
            p={p} ter={ter} yh={yh} netInici={netInici} isAbelFont={isAbelFont}
            rendIniciColor={rendIniciColor} netIniciColor={netIniciColor}
            cagrBrut={cagrBrut} cagrNet={cagrNet} cagrBrutColor={cagrBrutColor} cagrNetColor={cagrNetColor}
            tc={tc} card={card}
          />

          {/* Cost breakdown */}
          <PositionCostBreakdown
            p={p} ter={ter} terOverride={terOverride} isAbelFont={isAbelFont}
            isClosed={isClosed} tc={tc} card={card}
          />

        </div>
      </div>

      {/* ── Editar metadades ── */}
      <PositionMetaEditor
        p={p} isin={isin} tc={tc} dark={dark} card={card} secLabel={secLabel}
        metaOverride={metaOverride} terOverride={terOverride}
        onSaveMeta={fields => setMetaOverride(prev => ({ ...prev, ...fields }))}
        onSaveTer={ter => setTerOverride(ter)}
      />

    </div>
  );
}

export default PMPositionDetail;
