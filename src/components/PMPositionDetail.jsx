import React, { useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ReferenceLine, ResponsiveContainer, Legend, CartesianGrid,
} from "recharts";
import { useParams, useNavigate } from "react-router-dom";
import { PM_POSITIONS } from "../data/publicMarkets.js";
import { useTheme } from "../theme.js";
import { fmtM, fmtMonth, yearsHeld, cagr } from "../utils.js";
import { PM_VALUES } from "../data/portfolioValues.js";

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
  const { tc } = useTheme();

  const p = PM_POSITIONS.find(pos => pos.id === id);

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

  const isAbelFont  = p.gestor === "Abel Font";
  const pnl         = (p.valorMercat ?? 0) - (p.costEur ?? 0);
  const pnlColor    = pnl > 0 ? tc.green : pnl < 0 ? tc.red : tc.textLight;
  const msUrl       = p.isin ? `https://www.morningstar.es/es/search/results.aspx?keyword=${p.isin}` : null;
  const yh          = yearsHeld(p.dataCompra);
  const netInici    = p.rendInici != null
    ? (isAbelFont ? p.rendInici - (p.costAnual ?? 0) * yh : p.rendInici)
    : null;

  const costPct = p.costEur != null && p.valorMercat > 0
    ? Math.min(p.costEur / p.valorMercat * 100, 100) : 100;
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
        net:   isAbelFont ? p[y.field] - (p.costAnual ?? 0) : null,
      }));
  }, [p, isAbelFont]);

  const valueData = useMemo(() => {
    const custodianData = PM_VALUES[p.isin];
    if (!custodianData) return null;
    const custodians = Object.keys(custodianData).filter(c => custodianData[c].length > 0);
    if (custodians.length === 0) return null;
    const dateSet = new Set();
    custodians.forEach(c => custodianData[c].forEach(d => dateSet.add(d.date)));
    const dates = [...dateSet].sort();
    if (dates.length === 0) return null;
    return {
      custodians,
      rows: dates.map(date => {
        const row = { date };
        custodians.forEach(c => {
          row[c] = custodianData[c].find(d => d.date === date)?.value ?? null;
        });
        return row;
      }),
    };
  }, [p.isin]);

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
          <div style={{ fontSize: 22, fontWeight: 700, color: tc.navy, marginBottom: 8 }}>{p.nom}</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {p.isin && (
              <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, background: tc.bgAlt,
                             padding: "3px 8px", borderRadius: 4, color: tc.textMid, border: `1px solid ${tc.border}` }}>
                {p.isin}
              </span>
            )}
            <span style={{ fontSize: 10, background: tc.navy + "18", color: tc.navy,
                           padding: "3px 8px", borderRadius: 4, fontWeight: 700,
                           letterSpacing: "0.06em", textTransform: "uppercase" }}>
              {p.gestor}
            </span>
            {p.divisa && (
              <span style={{ fontSize: 10, background: tc.bgAlt, padding: "3px 8px", borderRadius: 4,
                             color: tc.textMid, border: `1px solid ${tc.border}`,
                             letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 600 }}>
                {p.divisa}
              </span>
            )}
            <span style={{ fontSize: 10, background: tc.bgAlt, padding: "3px 8px", borderRadius: 4,
                           color: tc.textMid, border: `1px solid ${tc.border}`,
                           letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 600 }}>
              {p.tipus}
            </span>
          </div>
        </div>
        {msUrl && (
          <a href={msUrl} target="_blank" rel="noreferrer"
            style={{ color: "#E8A020", fontSize: 20, textDecoration: "none" }} title="Morningstar">★</a>
        )}
      </div>

      {/* ── KPI row ── */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <KpiCard label="Valor mercat"  value={p.valorMercat != null ? fmtM(p.valorMercat) : "—"} accent={tc.navy} tc={tc} />
        <KpiCard label="Cost total"    value={p.costEur != null ? fmtM(p.costEur) : "—"} accent={tc.navyLight} tc={tc} />
        <KpiCard label="P&L"           value={`${pnl >= 0 ? "+" : ""}${fmtM(pnl)}`} accent={pnlColor} tc={tc} />
        <KpiCard label="Pes cartera"   value={p.pes != null ? p.pes.toFixed(1) + "%" : "—"} accent={tc.navyLight} tc={tc} />
      </div>

      {/* ── Market value over time ── */}
      {valueData && (
        <div style={card}>
          <div style={secLabel}>Valor de mercat · evolució mensual</div>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={valueData.rows} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
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
              {valueData.custodians.length > 1 && (
                <Legend wrapperStyle={{ fontSize: 10, paddingTop: 8 }} />
              )}
              {valueData.custodians.map((c, i) => (
                <Line
                  key={c}
                  dataKey={c}
                  name={c}
                  stroke={["#4E79A7", "#F28E2B", "#E15759", "#76B7B2"][i % 4]}
                  strokeWidth={2}
                  dot={false}
                  connectNulls={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Two-column: weight chart + IRR / cost ── */}
      <div style={{ display: "flex", gap: 16 }}>

        {/* LEFT: Composition + annual returns */}
        <div style={{ ...card, flex: "1 1 55%" }}>

          <div style={secLabel}>Pesos · cost vs guany</div>
          <div style={{ display: "flex", height: 22, borderRadius: 4, overflow: "hidden", marginBottom: 8 }}>
            <div style={{ width: `${costPct.toFixed(1)}%`, background: "#4E79A7" }}
                 title={`Cost: ${fmtM(p.costEur ?? 0)} (${costPct.toFixed(1)}%)`} />
            <div style={{ width: `${gainPct.toFixed(1)}%`, background: pnl >= 0 ? tc.green : tc.red }}
                 title={`${pnl >= 0 ? "Guany" : "Pèrdua"}: ${fmtM(Math.abs(pnl))} (${gainPct.toFixed(1)}%)`} />
          </div>
          <div style={{ display: "flex", gap: 16, fontSize: 10, color: tc.textLight, marginBottom: 20, letterSpacing: "0.04em" }}>
            <span><span style={{ color: "#4E79A7" }}>■</span> Cost {costPct.toFixed(1)}% · <span style={{ fontFamily: "'DM Mono',monospace" }}>{fmtM(p.costEur ?? 0)}</span></span>
            <span><span style={{ color: pnl >= 0 ? tc.green : tc.red }}>■</span> {pnl >= 0 ? "Guany" : "Pèrdua"} {gainPct.toFixed(1)}% · <span style={{ fontFamily: "'DM Mono',monospace" }}>{fmtM(Math.abs(pnl))}</span></span>
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
                  Brut − TER × {yh.toFixed(1)} anys
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
                <InfoRow label="TER anual"         value={p.costAnual != null ? p.costAnual.toFixed(2) + "%" : null} tc={tc} />
                <InfoRow label="Cost anual"
                  value={p.costAnual != null && p.costEur != null
                    ? fmtM(p.costEur * p.costAnual / 100) + "/any" : null}
                  tc={tc} />
                <InfoRow label="Data compra"       value={p.dataCompra} tc={tc} />
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

    </div>
  );
}
