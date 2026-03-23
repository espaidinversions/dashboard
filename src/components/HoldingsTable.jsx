import { PM_POSITIONS } from "../data/publicMarkets.js";
import { useTheme } from "../theme.js";
import { fmtM } from "../utils.js";

function SectionHeader({ tipus, count, total, tc }) {
  const isRV  = tipus === "RV";
  const color = isRV ? tc.navy : "#7A6000";
  const label = isRV ? "Renda Variable" : "Renda Fixa";
  return (
    <tr>
      <td colSpan={11} style={{
        padding: "8px 10px", fontWeight: 700, fontSize: 10,
        letterSpacing: "0.09em", textTransform: "uppercase",
        color, borderBottom: `2px solid ${tc.border}`,
        borderTop: `1px solid ${tc.border}`,
      }}>
        {label} · <span style={{ fontFamily: "'DM Mono',monospace" }}>{count} posicions · {fmtM(total)}</span>
      </td>
    </tr>
  );
}

function PnlCell({ v, tc }) {
  if (v == null) {
    return <td style={{ padding: "6px 10px", textAlign: "right", color: tc.textLight, fontFamily: "'DM Mono',monospace" }}>—</td>;
  }
  const color = v > 0 ? tc.green : v < 0 ? tc.red : tc.textLight;
  const bg    = v > 0 ? (tc.green + "18") : v < 0 ? (tc.red + "15") : "transparent";
  const label = (v >= 0 ? "+" : "") + v.toFixed(2) + "%";
  return (
    <td style={{ padding: "6px 10px", textAlign: "right" }}>
      <span style={{ fontFamily: "'DM Mono',monospace", fontWeight: 700, fontSize: 11, color, background: bg, borderRadius: 4, padding: "1px 5px" }}>{label}</span>
    </td>
  );
}

function DataRow({ p, zebra, tc, dark }) {
  const bg    = zebra ? (dark ? tc.bgAlt : "#f8f9fb") : tc.card;
  const msUrl = `https://www.morningstar.es/es/search/results.aspx?keyword=${p.isin}`;
  return (
    <tr className="hoverable" style={{ background: bg }}>
      <td style={{ padding: "6px 10px", fontWeight: 500, color: tc.text, fontSize: 12 }}>{p.nom}</td>
      <td style={{ padding: "6px 10px", fontSize: 11, color: tc.textLight }}>{p.gestor}</td>
      <td style={{ padding: "6px 10px", fontFamily: "'DM Mono',monospace", fontSize: 10, color: tc.textLight }}>{p.isin}</td>
      <td style={{ padding: "6px 10px", textAlign: "right", fontSize: 10, color: tc.textLight, fontFamily: "'DM Mono',monospace" }}>{p.dataCompra}</td>
      <td style={{ padding: "6px 10px", textAlign: "right", fontSize: 11, fontFamily: "'DM Mono',monospace", color: tc.textMid }}>
        {p.unitats != null ? p.unitats.toLocaleString("ca-ES") : "—"}
      </td>
      <td style={{ padding: "6px 10px", textAlign: "right", fontSize: 11, fontFamily: "'DM Mono',monospace", color: tc.textMid }}>
        {p.costEur != null ? fmtM(p.costEur) : "—"}
      </td>
      <td style={{ padding: "6px 10px", textAlign: "right", fontFamily: "'DM Mono',monospace", fontWeight: 600, color: tc.navy, fontSize: 12 }}>
        {p.valorMercat != null ? fmtM(p.valorMercat) : "—"}
      </td>
      <PnlCell v={p.rendInici} tc={tc} />
      <td style={{ padding: "6px 10px", textAlign: "right", fontSize: 11, fontFamily: "'DM Mono',monospace", color: tc.textLight }}>
        {p.pes != null ? p.pes.toFixed(1) + "%" : "—"}
      </td>
      <td style={{ padding: "6px 10px", textAlign: "right", fontSize: 10, fontFamily: "'DM Mono',monospace", color: tc.textLight }}>
        {p.costAnual != null ? p.costAnual.toFixed(2) + "%" : "—"}
      </td>
      <td style={{ padding: "6px 10px", textAlign: "center" }}>
        {p.isin ? (
          <a href={msUrl} target="_blank" rel="noreferrer"
             style={{ color: "#E8A020", fontSize: 11, textDecoration: "none" }} title="Morningstar">★</a>
        ) : null}
      </td>
    </tr>
  );
}

export function HoldingsTable() {
  const { tc, dark } = useTheme();

  const rvRows = PM_POSITIONS.filter(p => p.tipus === "RV").sort((a, b) => b.valorMercat - a.valorMercat);
  const rfRows = PM_POSITIONS.filter(p => p.tipus === "RF").sort((a, b) => b.valorMercat - a.valorMercat);

  const rvTotal = rvRows.reduce((s, p) => s + (p.valorMercat || 0), 0);
  const rfTotal = rfRows.reduce((s, p) => s + (p.valorMercat || 0), 0);

  const th = {
    padding: "8px 10px", fontSize: 10, letterSpacing: "0.09em",
    color: tc.textLight, textTransform: "uppercase", fontWeight: 600,
    borderBottom: `2px solid ${tc.border}`, whiteSpace: "nowrap",
    userSelect: "none", textAlign: "left",
  };

  return (
    <div style={{
      background: tc.card, borderRadius: 10,
      border: `1px solid ${tc.border}`,
      padding: "20px 24px",
      boxShadow: "0 2px 8px rgba(0,0,0,.06)",
    }}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", fontSize: 12, width: "100%", minWidth: 900 }}>
          <thead>
            <tr>
              <th style={{ ...th, textAlign: "left" }}>Nom</th>
              <th style={{ ...th, textAlign: "left" }}>Gestor</th>
              <th style={{ ...th, textAlign: "left" }}>ISIN</th>
              <th style={{ ...th, textAlign: "right" }}>Data compra</th>
              <th style={{ ...th, textAlign: "right" }}>Unitats</th>
              <th style={{ ...th, textAlign: "right" }}>Cost</th>
              <th style={{ ...th, textAlign: "right" }}>Valor mercat</th>
              <th style={{ ...th, textAlign: "right" }}>P&amp;L</th>
              <th style={{ ...th, textAlign: "right" }}>Pes %</th>
              <th style={{ ...th, textAlign: "right" }}>TER</th>
              <th style={{ ...th, textAlign: "center" }}>MS</th>
            </tr>
          </thead>
          <tbody>
            <SectionHeader tipus="RV" count={rvRows.length} total={rvTotal} tc={tc} dark={dark} />
            {rvRows.map((p, i) => <DataRow key={p.id} p={p} zebra={i % 2 === 1} tc={tc} dark={dark} />)}
            <SectionHeader tipus="RF" count={rfRows.length} total={rfTotal} tc={tc} dark={dark} />
            {rfRows.map((p, i) => <DataRow key={p.id} p={p} zebra={i % 2 === 1} tc={tc} dark={dark} />)}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: 10, color: tc.textLight, marginTop: 12, fontStyle: "italic" }}>
        WAM (€6.1M) i Andbank (€6.1M) gestionats directament pel gestor — posicions individuals no disponibles.
      </div>
    </div>
  );
}
