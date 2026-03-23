import React, { useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ReferenceLine, ResponsiveContainer, Legend,
} from "recharts";
import { useParams, useNavigate } from "react-router-dom";
import { PM_POSITIONS } from "../data/publicMarkets.js";
import { useTheme } from "../theme.js";
import { fmtM, yearsHeld } from "../utils.js";

function KpiCard({ label, value, color, tc }) {
  return (
    <div style={{
      background: tc.card, border: `1px solid ${tc.border}`,
      borderRadius: 10, padding: "14px 18px", flex: 1,
    }}>
      <div style={{ fontSize: 10, color: tc.textLight, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: color ?? tc.navy }}>{value}</div>
    </div>
  );
}

function InfoRow({ label, value, tc }) {
  return (
    <tr>
      <td style={{ padding: "6px 0", color: tc.textLight, fontSize: 12, paddingRight: 24 }}>{label}</td>
      <td style={{ padding: "6px 0", fontWeight: 500, fontSize: 12 }}>{value ?? "—"}</td>
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
  const pnlColor    = pnl > 0 ? "#22a050" : pnl < 0 ? "#c0392b" : tc.textLight;
  const msUrl       = p.isin ? `https://www.morningstar.es/es/search/results.aspx?keyword=${p.isin}` : null;
  const yh          = yearsHeld(p.dataCompra);
  const netInici    = p.rendInici != null
    ? (isAbelFont ? p.rendInici - (p.costAnual ?? 0) * yh : p.rendInici)
    : null;

  // Composition bar: cost vs gain (% of market value)
  const costPct = p.costEur != null && p.valorMercat > 0
    ? Math.min(p.costEur / p.valorMercat * 100, 100) : 100;
  const gainPct = Math.max(100 - costPct, 0);

  // Annual return data for the chart (left panel)
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

  const rendIniciColor = p.rendInici == null ? tc.textLight
    : p.rendInici > 0 ? "#22a050" : "#c0392b";
  const netIniciColor  = netInici == null ? tc.textLight
    : netInici > 0 ? "#22a050" : "#c0392b";

  return (
    <div style={{ padding: "28px 32px 60px", maxWidth: 960, margin: "0 auto" }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <button onClick={() => navigate(-1)}
            style={{ background: "none", border: "none", cursor: "pointer", color: tc.textMid,
                     fontFamily: "inherit", fontSize: 12, padding: 0, marginBottom: 8 }}>
            ← Mercats Públics
          </button>
          <div style={{ fontSize: 22, fontWeight: 700, color: tc.navy, marginBottom: 8 }}>{p.nom}</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {p.isin && (
              <span style={{ fontFamily: "monospace", fontSize: 11, background: tc.border,
                             padding: "3px 8px", borderRadius: 4, color: tc.text }}>
                {p.isin}
              </span>
            )}
            <span style={{ fontSize: 11, background: tc.navy + "22", color: tc.navy,
                           padding: "3px 8px", borderRadius: 4, fontWeight: 600 }}>
              {p.gestor}
            </span>
            {p.divisa && (
              <span style={{ fontSize: 11, background: tc.border, padding: "3px 8px", borderRadius: 4, color: tc.textMid }}>
                {p.divisa}
              </span>
            )}
            <span style={{ fontSize: 11, background: tc.border, padding: "3px 8px", borderRadius: 4, color: tc.textMid }}>
              {p.tipus}
            </span>
          </div>
        </div>
        {msUrl && (
          <a href={msUrl} target="_blank" rel="noreferrer"
            style={{ color: "#E8A020", fontSize: 22, textDecoration: "none" }} title="Morningstar">★</a>
        )}
      </div>

      {/* ── KPI row ── */}
      <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
        <KpiCard label="Valor mercat" value={p.valorMercat != null ? fmtM(p.valorMercat) : "—"} tc={tc} />
        <KpiCard label="Cost total" value={p.costEur != null ? fmtM(p.costEur) : "—"} tc={tc} color={tc.textMid} />
        <KpiCard label="P&L" value={`${pnl >= 0 ? "+" : ""}${fmtM(pnl)}`} tc={tc} color={pnlColor} />
        <KpiCard label="Pes cartera" value={p.pes != null ? p.pes.toFixed(1) + "%" : "—"} tc={tc} color={tc.textMid} />
      </div>

      {/* ── Two-column: weight/chart + IRR ── */}
      <div style={{ display: "flex", gap: 16, marginBottom: 20 }}>

        {/* LEFT: Annual returns chart */}
        <div style={{
          flex: "1 1 55%", background: tc.card, borderRadius: 12,
          border: `1px solid ${tc.border}`, padding: "20px 24px",
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: tc.navy, marginBottom: 12 }}>
            Pesos · cost vs guany
          </div>

          {/* Composition bar: cost vs gain */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", height: 28, borderRadius: 6, overflow: "hidden", marginBottom: 8 }}>
              <div style={{ width: `${costPct.toFixed(1)}%`, background: "#4E79A7" }}
                   title={`Cost: ${fmtM(p.costEur ?? 0)} (${costPct.toFixed(1)}%)`} />
              <div style={{ width: `${gainPct.toFixed(1)}%`, background: pnl >= 0 ? "#59A14F" : "#E15759" }}
                   title={`Guany/Pèrdua: ${fmtM(pnl)} (${gainPct.toFixed(1)}%)`} />
            </div>
            <div style={{ display: "flex", gap: 16, fontSize: 11, color: tc.textLight }}>
              <span><span style={{ color: "#4E79A7" }}>■</span> Cost {costPct.toFixed(1)}% · {fmtM(p.costEur ?? 0)}</span>
              <span><span style={{ color: pnl >= 0 ? "#59A14F" : "#E15759" }}>■</span> {pnl >= 0 ? "Guany" : "Pèrdua"} {gainPct.toFixed(1)}% · {fmtM(Math.abs(pnl))}</span>
            </div>
          </div>

          {/* Annual returns chart */}
          {returnData.length > 0 && (
            <>
              <div style={{ fontSize: 12, fontWeight: 600, color: tc.navy, marginBottom: 8, marginTop: 16 }}>
                Rendiments anuals {isAbelFont ? "· brut vs net TER" : ""}
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={returnData} margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
                  <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={v => v.toFixed(1) + "%"} tick={{ fontSize: 11 }} width={42} />
                  <ReferenceLine y={0} stroke="#ccc" />
                  <Tooltip formatter={(v, name) => [
                    (v >= 0 ? "+" : "") + v.toFixed(2) + "%",
                    name === "brut" ? "Brut" : "Net TER",
                  ]} />
                  {isAbelFont && <Legend formatter={n => n === "brut" ? "Brut" : "Net TER"} />}
                  <Bar dataKey="brut" name="brut" fill="#4E79A7" />
                  {isAbelFont && <Bar dataKey="net" name="net" fill="#59A14F" />}
                </BarChart>
              </ResponsiveContainer>
            </>
          )}
        </div>

        {/* RIGHT: IRR + cost breakdown */}
        <div style={{ flex: "0 0 280px", display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Since-inception returns */}
          <div style={{
            background: tc.card, borderRadius: 12, border: `1px solid ${tc.border}`,
            padding: "20px 24px",
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: tc.navy, marginBottom: 16 }}>
              Des d'inici
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: tc.textLight, marginBottom: 4 }}>Rendiment brut</div>
              <div style={{ fontSize: 32, fontWeight: 700, color: rendIniciColor }}>
                {p.rendInici != null
                  ? (p.rendInici >= 0 ? "+" : "") + p.rendInici.toFixed(2) + "%"
                  : "—"}
              </div>
            </div>
            {isAbelFont && netInici != null && (
              <div>
                <div style={{ fontSize: 11, color: tc.textLight, marginBottom: 4 }}>Net estimat</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: netIniciColor }}>
                  {(netInici >= 0 ? "+" : "") + netInici.toFixed(2) + "%"}
                </div>
                <div style={{ fontSize: 10, color: tc.textLight, marginTop: 4 }}>
                  Brut − TER × {yh.toFixed(1)} anys
                </div>
              </div>
            )}
          </div>

          {/* Cost breakdown */}
          <div style={{
            background: tc.card, borderRadius: 12, border: `1px solid ${tc.border}`,
            padding: "20px 24px", flex: 1,
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: tc.navy, marginBottom: 12 }}>
              Detall de cost
            </div>
            <table>
              <tbody>
                <InfoRow label="Unitats" value={p.unitats != null ? p.unitats.toLocaleString("ca-ES") : null} tc={tc} />
                <InfoRow label="Preu d'entrada" value={p.costInici != null ? p.costInici.toFixed(4) : null} tc={tc} />
                <InfoRow label="Cost total" value={p.costEur != null ? fmtM(p.costEur) : null} tc={tc} />
                <InfoRow label="TER anual" value={p.costAnual != null ? p.costAnual.toFixed(2) + "%" : null} tc={tc} />
                <InfoRow label="Cost anual implícit"
                  value={p.costAnual != null && p.costEur != null
                    ? fmtM(p.costEur * p.costAnual / 100) + "/any" : null}
                  tc={tc} />
                <InfoRow label="Data compra" value={p.dataCompra} tc={tc} />
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
