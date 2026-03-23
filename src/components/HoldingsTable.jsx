import { PM_POSITIONS } from "../data/publicMarkets.js";
import { useTheme } from "../theme.js";
import { fmtM } from "../utils.js";

// ── Sub-components (module level to avoid remounts) ───────────────────────────

function SectionHeader({ tipus, count, total, tc, dark }) {
  const isRV  = tipus === "RV";
  const bg    = isRV ? (dark ? "#1E2E3D" : "#E6EDF3") : (dark ? "#2E2800" : "#FFF8E1");
  const color = isRV ? tc.navy : "#7A6000";
  const label = isRV ? "Renda Variable" : "Renda Fixa";
  return (
    <tr style={{ background: bg }}>
      <td colSpan={11} style={{ padding: "6px 10px", fontWeight: 700, fontSize: 12, color }}>
        {label} · {count} posicions · {fmtM(total)}
      </td>
    </tr>
  );
}

function PnlCell({ v, tc }) {
  if (v == null) {
    return <td style={{ padding: "5px 8px", textAlign: "right", color: tc.textLight }}>—</td>;
  }
  const color = v > 0 ? "#22a050" : v < 0 ? "#c0392b" : tc.textLight;
  const label = (v >= 0 ? "+" : "") + v.toFixed(2) + "%";
  return <td style={{ padding: "5px 8px", textAlign: "right", color, fontWeight: 700 }}>{label}</td>;
}

function DataRow({ p, zebra, tc, dark }) {
  const bg    = zebra ? (dark ? "#1a1a2e" : "#f8f8f8") : (dark ? tc.card : "#fff");
  const msUrl = `https://www.morningstar.es/es/search/results.aspx?keyword=${p.isin}`;
  return (
    <tr style={{ background: bg }}>
      <td style={{ padding: "5px 8px", fontWeight: 500, color: tc.text }}>{p.nom}</td>
      <td style={{ padding: "5px 8px", fontSize: 11, color: tc.textLight }}>{p.gestor}</td>
      <td style={{ padding: "5px 8px", fontFamily: "monospace", fontSize: 10, color: tc.textLight }}>{p.isin}</td>
      <td style={{ padding: "5px 8px", textAlign: "right", fontSize: 10, color: tc.textLight }}>{p.dataCompra}</td>
      <td style={{ padding: "5px 8px", textAlign: "right" }}>
        {p.unitats != null ? p.unitats.toLocaleString("ca-ES") : "—"}
      </td>
      <td style={{ padding: "5px 8px", textAlign: "right" }}>
        {p.costEur != null ? fmtM(p.costEur) : "—"}
      </td>
      <td style={{ padding: "5px 8px", textAlign: "right", fontWeight: 600, color: tc.navy }}>
        {p.valorMercat != null ? fmtM(p.valorMercat) : "—"}
      </td>
      <PnlCell v={p.rendInici} tc={tc} />
      <td style={{ padding: "5px 8px", textAlign: "right", color: tc.textLight }}>
        {p.pes != null ? p.pes.toFixed(1) + "%" : "—"}
      </td>
      <td style={{ padding: "5px 8px", textAlign: "right", fontSize: 10, color: tc.textLight }}>
        {p.costAnual != null ? p.costAnual.toFixed(2) + "%" : "—"}
      </td>
      <td style={{ padding: "5px 8px", textAlign: "center" }}>
        {p.isin ? (
          <a href={msUrl} target="_blank" rel="noreferrer"
             style={{ color: "#E8A020", fontSize: 11, textDecoration: "none" }} title="Morningstar">★</a>
        ) : null}
      </td>
    </tr>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function HoldingsTable() {
  const { tc, dark } = useTheme();

  const rvRows = PM_POSITIONS
    .filter(p => p.tipus === "RV")
    .sort((a, b) => b.valorMercat - a.valorMercat);
  const rfRows = PM_POSITIONS
    .filter(p => p.tipus === "RF")
    .sort((a, b) => b.valorMercat - a.valorMercat);

  const rvTotal = rvRows.reduce((s, p) => s + (p.valorMercat || 0), 0);
  const rfTotal = rfRows.reduce((s, p) => s + (p.valorMercat || 0), 0);

  const thStyle = (align = "left") => ({
    padding: "7px 8px",
    fontWeight: 600,
    fontSize: 11,
    whiteSpace: "nowrap",
    textAlign: align,
    background: tc.navy,
    color: "#fff",
  });

  return (
    <div style={{
      background: tc.card,
      borderRadius: 12,
      border: `1px solid ${tc.border}`,
      padding: "20px 24px",
    }}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", fontSize: 12, width: "100%", minWidth: 900 }}>
          <thead>
            <tr>
              <th style={thStyle("left")}>Nom</th>
              <th style={thStyle("left")}>Gestor</th>
              <th style={thStyle("left")}>ISIN</th>
              <th style={thStyle("right")}>Data compra</th>
              <th style={thStyle("right")}>Unitats</th>
              <th style={thStyle("right")}>Cost</th>
              <th style={thStyle("right")}>Valor mercat</th>
              <th style={thStyle("right")}>P&amp;L</th>
              <th style={thStyle("right")}>Pes %</th>
              <th style={thStyle("right")}>Cost anual</th>
              <th style={thStyle("center")}>MS</th>
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
