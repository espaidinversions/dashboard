import React, { useMemo, useState, useEffect } from "react";
import {
  LineChart, Line, Bar, XAxis, YAxis, Tooltip,
  ReferenceLine, ResponsiveContainer, Legend, CartesianGrid,
} from "recharts";
import { useParams, useNavigate } from "react-router-dom";
import { PM_POSITIONS, PM_CLOSED } from "../data/publicMarkets.js";
import { useTheme } from "../theme.js";
import { fmtM, fmtMonth, yearsHeld, cagr } from "../utils.js";
import { PM_VALUES } from "../data/portfolioValues.js";
import { PM_CLOSED_VALUES } from "../data/pmClosedValues.js";
import { PM_TRANSACTIONS } from "../data/pmTransactions.js";
import { PM_TER } from "../data/pmTer.js";
import { loadPMOverrides, upsertPositionMeta, upsertTerOverride } from "../db.js";
import { CumulativeFlowsChart } from "./CumulativeFlowsChart.jsx";
import { PriceHistoryChart } from "./PriceHistoryChart.jsx";
import { FUND_PRICES } from "../data/fundPrices.js";

const ISIN_RE = /([A-Z]{2}[A-Z0-9]{10})/;
const cleanIsin = raw => (ISIN_RE.exec(String(raw ?? "").toUpperCase())?.[1]) ?? raw;

function KpiCard({ label, value, accent, tc }) {
  return (
    <div className="kpi-card card-hover" style={{
      background: tc.card, border: `1px solid ${tc.border}`,
      borderRadius: 12, padding: "16px 18px", flex: 1,
      borderTop: `3px solid ${accent ?? tc.navy}`,
      boxShadow: "0 2px 12px rgba(0,0,0,.06)",
    }}>
      <div style={{ fontSize: 10, letterSpacing: "0.11em", color: tc.textLight, textTransform: "uppercase", marginBottom: 6, fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: accent ?? tc.navy, letterSpacing: "-0.02em", fontFamily: "'DM Mono',monospace" }}>{value}</div>
    </div>
  );
}

function InfoRow({ label, value, tc }) {
  return (
    <tr>
      <td style={{ padding: "6px 0", color: tc.textLight, fontSize: 11, paddingRight: 24, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>{label}</td>
      <td style={{ padding: "6px 0", fontSize: 12, fontFamily: "'DM Mono',monospace" }}>{value ?? "—"}</td>
    </tr>
  );
}

export function PMPositionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { tc, dark } = useTheme();

  let p = PM_POSITIONS.find(pos => pos.id === id);
  let isClosed = false;
  if (!p) {
    const closed = PM_CLOSED.find(pos => pos.isin === id);
    if (closed) { p = closed; isClosed = true; }
  }

  // Supabase overrides for this position
  const [metaOverride, setMetaOverride] = useState({});
  const [terOverride, setTerOverride] = useState(null);
  const isin = p ? cleanIsin(p.isin) : null;

  useEffect(() => {
    if (!isin) return;
    loadPMOverrides().then(data => {
      if (!data) return;
      if (data.positionMeta[isin]) setMetaOverride(data.positionMeta[isin]);
      if (data.terOverrides[isin] != null) setTerOverride(data.terOverrides[isin]);
    });
  }, [isin]);

  if (!p) {
    return (
      <div style={{ padding: "60px 32px", textAlign: "center" }}>
        <div style={{ fontSize: 14, color: tc.textLight, marginBottom: 16 }}>Posició no trobada</div>
        <button onClick={() => navigate(-1)}
          style={{ background: tc.navy, color: "#fff", border: "none", borderRadius: 8,
                   padding: "8px 20px", cursor: "pointer", fontFamily: "inherit", fontSize: 13 }}>
          ← Tornar
        </button>
      </div>
    );
  }

  // Apply overrides on top of static data
  const displayNom      = metaOverride.nom      ?? p.nom;
  const displayGestor   = metaOverride.gestor   ?? p.gestor;
  const displayCustodian = metaOverride.custodian ?? p.custodian;

  const isAbelFont  = displayGestor === "Abel Font";
  const pnl         = p.costEur != null ? (p.valorMercat ?? 0) - p.costEur : null;
  const pnlColor    = pnl == null ? tc.textLight : pnl > 0 ? tc.green : pnl < 0 ? tc.red : tc.textLight;
  const msUrl       = isin ? `https://www.morningstar.es/es/search/results.aspx?keyword=${isin}` : null;
  const yh          = yearsHeld(p.dataCompra);
  const ter         = terOverride ?? PM_TER[isin] ?? p.costAnual ?? 0;
  const netInici    = p.rendInici != null
    ? (isAbelFont ? p.rendInici - ter * yh : p.rendInici)
    : null;

  const costPct = p.costEur != null && p.valorMercat > 0
    ? Math.min(p.costEur / p.valorMercat * 100, 100) : p.costEur != null ? 100 : 0;
  const gainPct = Math.max(100 - costPct, 0);

  const returnData = useMemo(() => {
    const YEARS = [
      { label: "2023", field: "rend2023" },
      { label: "2024", field: "rend2024" },
      { label: "2025", field: "rend2025" },
      { label: "2026", field: "rend2026" },
    ];
    return YEARS
      .filter(y => p[y.field] != null)
      .map(y => ({
        year:  y.label,
        brut:  p[y.field],
        net:   isAbelFont ? p[y.field] - ter : null,
      }));
  }, [p, isAbelFont]);

  const positionTxs = useMemo(
    () => PM_TRANSACTIONS.filter(t => t.isin === isin),
    [isin]
  );

  const positionValues = useMemo(() => {
    const custodianData = PM_VALUES[isin] ?? (isClosed ? PM_CLOSED_VALUES[isin] : null);
    if (!custodianData) return [];
    const monthMap = new Map();
    Object.values(custodianData).forEach(series =>
      series.forEach(({ date, value }) => {
        const month = date.slice(0, 7);
        monthMap.set(month, (monthMap.get(month) ?? 0) + value);
      })
    );
    return [...monthMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, value]) => ({ date: month, value }));
  }, [isin, isClosed]);

  const secLabel    = { fontSize: 10, letterSpacing: "0.09em", textTransform: "uppercase", color: tc.textLight, fontWeight: 600, marginBottom: 12 };
  const card        = { background: tc.card, border: `1px solid ${tc.border}`, borderRadius: 10, padding: "20px 24px", boxShadow: "0 2px 8px rgba(0,0,0,.06)" };
  const tooltipStyle = { contentStyle: { background: tc.card, border: `1px solid ${tc.border}`, borderRadius: 8 }, labelStyle: { color: tc.text, fontWeight: 600 } };

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
          <div style={{ fontSize: 22, fontWeight: 700, color: tc.navy, marginBottom: 8 }}>{displayNom}</div>
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
        <KpiCard label={isClosed ? "Valor tancament" : "Valor mercat"}   value={p.valorMercat != null ? fmtM(p.valorMercat) : "—"} accent={tc.navy} tc={tc} />
        <KpiCard label="Cost total"     value={p.costEur != null ? fmtM(p.costEur) : "—"} accent={tc.navyLight} tc={tc} />
        <KpiCard label="P&L"            value={pnl != null ? `${pnl >= 0 ? "+" : ""}${fmtM(pnl)}` : "—"} accent={pnlColor} tc={tc} />
        {p.unitats != null && (
          <KpiCard label="Participacions" value={p.unitats.toLocaleString("ca-ES")} accent={tc.navyLight} tc={tc} />
        )}
        {p.rendInici != null && (
          <KpiCard label="TWR inici"    value={(p.rendInici >= 0 ? "+" : "") + p.rendInici.toFixed(2) + "%"} accent={rendIniciColor} tc={tc} />
        )}
        {!isClosed && (
          <KpiCard label="Pes cartera"  value={p.pes != null ? p.pes.toFixed(1) + "%" : "—"} accent={tc.navyLight} tc={tc} />
        )}
      </div>

      {/* ── Historial de preus · fluxos acumulats ── */}
      <div style={card}>
        <div style={{ fontSize: 10, letterSpacing: "0.09em", textTransform: "uppercase",
          color: tc.textLight, fontWeight: 600, marginBottom: 12 }}>
          Historial de preus · fluxos acumulats
        </div>
        {isin && FUND_PRICES[isin]?.length > 0 ? (
          <PriceHistoryChart
            isin={isin}
            dataCompra={p.dataCompra}
            transactions={positionTxs}
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
      <PositionTxHistory isin={isin} tc={tc} card={card} secLabel={secLabel} />

      {/* ── Two-column: weight chart + IRR / cost ── */}
      <div style={{ display: "flex", gap: 16 }}>

        {/* LEFT: Composition + annual returns */}
        <div style={{ ...card, flex: "1 1 55%" }}>

          <div style={secLabel}>Pesos · cost vs guany</div>
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

          {returnData.length > 0 && (
            <>
              <div style={secLabel}>Rendiments anuals {isAbelFont ? "· brut vs net TER" : ""}</div>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={returnData} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={tc.border} />
                  <XAxis dataKey="year" tick={{ fontSize: 10, fill: tc.textLight }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={v => v.toFixed(1) + "%"} tick={{ fontSize: 10, fill: tc.textLight }} axisLine={false} tickLine={false} width={40} />
                  <ReferenceLine y={0} stroke={tc.border} />
                  <Tooltip {...tooltipStyle} formatter={(v, name) => [
                    (v >= 0 ? "+" : "") + v.toFixed(2) + "%",
                    name === "brut" ? "Brut" : "Net TER",
                  ]} />
                  {isAbelFont && <Legend formatter={n => n === "brut" ? "Brut" : "Net TER"} wrapperStyle={{ fontSize: 10 }} />}
                  <Line dataKey="brut" name="brut" stroke={tc.navy} strokeWidth={2} dot={{ r: 4, fill: tc.navy }} connectNulls />
                  {isAbelFont && <Line dataKey="net" name="net" stroke={tc.green} strokeWidth={2} dot={{ r: 4, fill: tc.green }} connectNulls />}
                </LineChart>
              </ResponsiveContainer>
            </>
          )}
        </div>

        {/* RIGHT: IRR + cost breakdown */}
        <div style={{ flex: "0 0 260px", display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Since-inception returns: TWR + CAGR (MWR) */}
          <div style={card}>
            <div style={secLabel}>Des d'inici</div>

            {/* TWR row */}
            <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, color: tc.textLight, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 4 }}>
                  TWR {isAbelFont ? "brut" : "total"}
                </div>
                <div style={{ fontSize: 26, fontWeight: 700, color: rendIniciColor, fontFamily: "'DM Mono',monospace", letterSpacing: "-0.02em" }}>
                  {p.rendInici != null ? (p.rendInici >= 0 ? "+" : "") + p.rendInici.toFixed(2) + "%" : "—"}
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, color: tc.textLight, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 4 }}>
                  MWR / CAGR
                </div>
                <div style={{ fontSize: 26, fontWeight: 700, color: cagrBrutColor, fontFamily: "'DM Mono',monospace", letterSpacing: "-0.02em" }}>
                  {cagrBrut != null ? (cagrBrut >= 0 ? "+" : "") + cagrBrut.toFixed(2) + "%" : "—"}
                </div>
              </div>
            </div>
            <div style={{ fontSize: 10, color: tc.textLight, marginBottom: isAbelFont && netInici != null ? 12 : 0 }}>
              {yh.toFixed(1)} anys · TWR acumulat vs CAGR anualitzat
            </div>

            {/* Net row (Abel Font only) */}
            {isAbelFont && netInici != null && (
              <div style={{ borderTop: `1px solid ${tc.border}`, paddingTop: 12, marginTop: 4 }}>
                <div style={{ fontSize: 10, color: tc.textLight, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>Net TER estimat</div>
                <div style={{ display: "flex", gap: 16 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 10, color: tc.textLight, marginBottom: 2 }}>TWR net</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: netIniciColor, fontFamily: "'DM Mono',monospace" }}>
                      {(netInici >= 0 ? "+" : "") + netInici.toFixed(2) + "%"}
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 10, color: tc.textLight, marginBottom: 2 }}>CAGR net</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: cagrNetColor, fontFamily: "'DM Mono',monospace" }}>
                      {cagrNet != null ? (cagrNet >= 0 ? "+" : "") + cagrNet.toFixed(2) + "%" : "—"}
                    </div>
                  </div>
                </div>
                <div style={{ fontSize: 10, color: tc.textLight, marginTop: 4 }}>
                  Brut − {ter.toFixed(2)}% TER × {yh.toFixed(1)} anys
                </div>
              </div>
            )}
          </div>

          {/* Cost breakdown */}
          <div style={{ ...card, flex: 1 }}>
            <div style={secLabel}>Detall de cost</div>
            <table>
              <tbody>
                <InfoRow label="Unitats"           value={p.unitats != null ? p.unitats.toLocaleString("ca-ES") : null} tc={tc} />
                <InfoRow label="Preu d'entrada"    value={p.costInici != null ? p.costInici.toFixed(4) : null} tc={tc} />
                <InfoRow label="Cost total"        value={p.costEur != null ? fmtM(p.costEur) : null} tc={tc} />
                <InfoRow label="TER anual"         value={ter > 0 ? ter.toFixed(2) + "%" : null} tc={tc} />
                <InfoRow label="Cost anual"
                  value={ter > 0 && p.costEur != null
                    ? fmtM(p.costEur * ter / 100) + "/any" : null}
                  tc={tc} />
                <InfoRow label="Data compra"       value={p.dataCompra} tc={tc} />
                {isClosed && p.any && <InfoRow label="Any tancament" value={String(p.any)} tc={tc} />}
              </tbody>
            </table>
            {isAbelFont && (
              <div style={{ fontSize: 10, color: tc.textLight, marginTop: 12, fontStyle: "italic" }}>
                Gestió externa — el TER reflecteix el cost de gestió del vehicle.
              </div>
            )}
          </div>

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

function PositionTxHistory({ isin, tc, card, secLabel }) {
  const [sortDesc, setSortDesc] = useState(true);
  const txs = useMemo(() => {
    const rows = PM_TRANSACTIONS.filter(t => t.isin === isin);
    return [...rows].sort((a, b) => {
      const cmp = (a.date ?? "").localeCompare(b.date ?? "");
      return sortDesc ? -cmp : cmp;
    });
  }, [isin, sortDesc]);

  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 14 }}>
        <div style={{ ...secLabel, flex: 1 }}>Moviments</div>
        {txs.length > 0 && (
          <button onClick={() => setSortDesc(d => !d)} style={{
            padding: "3px 10px", borderRadius: 20, fontSize: 10, cursor: "pointer", fontFamily: "inherit",
            border: `1.5px solid ${tc.border}`, background: "transparent", color: tc.textLight,
          }}>{sortDesc ? "↓ Més recent" : "↑ Més antic"}</button>
        )}
      </div>
      {txs.length === 0 && (
        <div style={{ fontSize: 12, color: tc.textLight, fontStyle: "italic" }}>Sense moviments registrats.</div>
      )}
      {txs.length > 0 && <table style={{ borderCollapse: "collapse", fontSize: 12, width: "100%" }}>
        <thead>
          <tr>
            {["Data", "Acció", "Units", "NAV", "Valor", "Custodi"].map(h => (
              <th key={h} style={{
                padding: "5px 10px", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase",
                color: tc.textLight, fontWeight: 600, borderBottom: `2px solid ${tc.border}`,
                textAlign: h === "Custodi" ? "left" : "right", whiteSpace: "nowrap",
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {txs.map(t => {
            const isBuy = t.action === "buy";
            return (
              <tr key={t.id} style={{ borderBottom: `1px solid ${tc.border}` }}>
                <td style={{ padding: "5px 10px", fontFamily: "'DM Mono',monospace", fontSize: 11, color: tc.textLight, textAlign: "right", whiteSpace: "nowrap" }}>{t.date}</td>
                <td style={{ padding: "5px 10px", textAlign: "right" }}>
                  <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4,
                    background: isBuy ? "#E8F8E8" : "#FDECEA",
                    color:      isBuy ? "#1C6B1D" : "#C62828", fontWeight: 600 }}>
                    {isBuy ? "Compra" : "Venda"}
                  </span>
                </td>
                <td style={{ padding: "5px 10px", textAlign: "right", fontFamily: "'DM Mono',monospace", fontSize: 11 }}>{t.units != null ? t.units.toLocaleString("ca-ES", { maximumFractionDigits: 0 }) : "—"}</td>
                <td style={{ padding: "5px 10px", textAlign: "right", fontFamily: "'DM Mono',monospace", fontSize: 11 }}>{t.nav != null ? t.nav.toFixed(2) : "—"}</td>
                <td style={{ padding: "5px 10px", textAlign: "right", fontFamily: "'DM Mono',monospace", fontWeight: 600, color: tc.navy }}>{t.valueEur != null ? fmtM(t.valueEur) : "—"}</td>
                <td style={{ padding: "5px 10px", fontSize: 11, color: tc.textLight }}>{t.custodian}</td>
              </tr>
            );
          })}
        </tbody>
      </table>}
    </div>
  );
}

// ── Position metadata editor ──────────────────────────────────
const CUSTODIAN_OPTIONS = ["CaixaBank", "Bankinter", "UBS", "Credit Suisse", "Abel Font", "WAM", "Andbank", "Altre"];

function PositionMetaEditor({ p, isin, tc, dark, card, secLabel, metaOverride, terOverride, onSaveMeta, onSaveTer }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);

  const startEdit = () => {
    setForm({
      nom:      metaOverride.nom      ?? p.nom      ?? "",
      gestor:   metaOverride.gestor   ?? p.gestor   ?? "",
      custodian: metaOverride.custodian ?? p.custodian ?? "CaixaBank",
      ter:      String(terOverride ?? p.costAnual ?? ""),
    });
    setOpen(true);
    setError(null);
    setSaved(false);
  };

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    const metaFields = {};
    if (form.nom      !== (p.nom      ?? "")) metaFields.nom      = form.nom || null;
    if (form.gestor   !== (p.gestor   ?? "")) metaFields.gestor   = form.gestor || null;
    if (form.custodian !== (p.custodian ?? "")) metaFields.custodian = form.custodian || null;

    const terVal = form.ter !== "" ? parseFloat(form.ter) : null;

    const [r1, r2] = await Promise.all([
      Object.keys(metaFields).length ? upsertPositionMeta(isin, metaFields) : Promise.resolve({ error: null }),
      terVal !== null && terVal !== (terOverride ?? p.costAnual ?? null) ? upsertTerOverride(isin, terVal) : Promise.resolve({ error: null }),
    ]);

    setSaving(false);
    if (r1.error || r2.error) return setError((r1.error ?? r2.error).message);

    if (Object.keys(metaFields).length) onSaveMeta(metaFields);
    if (terVal !== null) onSaveTer(terVal);
    setSaved(true);
    setTimeout(() => setOpen(false), 800);
  };

  const inp = {
    width: "100%", padding: "6px 10px", fontSize: 12,
    border: `1.5px solid ${tc.border}`, borderRadius: 7,
    background: tc.bg, color: tc.text, fontFamily: "inherit",
    outline: "none", boxSizing: "border-box",
  };

  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "center" }}>
        <div style={{ ...secLabel, flex: 1 }}>Metadades</div>
        <button onClick={open ? () => setOpen(false) : startEdit} style={{
          padding: "3px 10px", borderRadius: 20, fontSize: 10, cursor: "pointer", fontFamily: "inherit",
          border: `1.5px solid ${tc.border}`, background: "transparent", color: tc.textLight,
        }}>{open ? "Cancel·lar" : "✏ Editar"}</button>
      </div>

      {!open && (
        <div style={{ fontSize: 12, color: tc.textLight, marginTop: 8 }}>
          {Object.keys(metaOverride).filter(k => metaOverride[k]).length === 0 && terOverride == null
            ? "Sense sobreescriptures. Clica Editar per personalitzar nom, gestor, custodi o TER."
            : <span style={{ color: tc.green }}>✓ Sobreescriptures actives: {[
                metaOverride.nom && "Nom", metaOverride.gestor && "Gestor",
                metaOverride.custodian && "Custodi", terOverride != null && "TER",
              ].filter(Boolean).join(", ")}</span>
          }
        </div>
      )}

      {open && form && (
        <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 2 }}>
              <label style={{ fontSize: 10, fontWeight: 600, color: tc.textLight, letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 3 }}>Nom</label>
              <input value={form.nom} onChange={e => set("nom", e.target.value)} style={inp} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 10, fontWeight: 600, color: tc.textLight, letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 3 }}>TER (%)</label>
              <input type="number" step="0.001" value={form.ter} onChange={e => set("ter", e.target.value)} placeholder="0.00" style={inp} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 10, fontWeight: 600, color: tc.textLight, letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 3 }}>Gestor</label>
              <input value={form.gestor} onChange={e => set("gestor", e.target.value)} style={inp} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 10, fontWeight: 600, color: tc.textLight, letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 3 }}>Custodi</label>
              <select value={form.custodian} onChange={e => set("custodian", e.target.value)} style={inp}>
                {CUSTODIAN_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          {error && <div style={{ fontSize: 11, color: "#C62828", background: "#FDECEA", borderRadius: 6, padding: "6px 10px" }}>{error}</div>}
          {saved && <div style={{ fontSize: 11, color: tc.green }}>✓ Guardat</div>}
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button onClick={handleSave} disabled={saving} style={{
              padding: "7px 18px", borderRadius: 7, border: "none",
              background: tc.navy, color: "#fff", cursor: saving ? "default" : "pointer",
              fontFamily: "inherit", fontSize: 12, fontWeight: 600, opacity: saving ? 0.7 : 1,
            }}>{saving ? "Guardant…" : "Guardar"}</button>
          </div>
        </div>
      )}
    </div>
  );
}
