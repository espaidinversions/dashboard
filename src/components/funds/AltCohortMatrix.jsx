import React from "react";
import { formatMultiple, multipleColor } from "../../utils.js";
import { SectionHeader, tableCardStyle } from "../SharedComponents.jsx";
import { ALT_STRATEGY_LABELS } from "../../data/altCohortModel.js";

function irrColor(irr, tc) {
  if (irr == null) return tc.textLight;
  return irr >= 0 ? tc.green : tc.red;
}

/** A single cell: MOIC stacked above IRR, or an em dash when there's no cohort. */
function Cell({ metrics, tc }) {
  if (!metrics) {
    return <span style={{ color: tc.textLight }}>—</span>;
  }
  const { moic, irr } = metrics;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2, fontFamily: "'DM Mono',monospace" }}>
      <span style={{ fontSize: 13, fontWeight: 700, color: multipleColor(moic, tc) }}>
        {moic != null ? formatMultiple(moic) : "—"}
      </span>
      <span style={{ fontSize: 11, fontWeight: 600, color: irrColor(irr, tc) }}>
        {irr != null ? `${irr.toFixed(1)}%` : "—"}
      </span>
    </div>
  );
}

/**
 * Cross-tab of MOIC & IRR by vintage (rows) and strategy (columns) for the
 * Alternatives funds. Presentational only — consumes buildAltCohortMatrix output.
 */
export default function AltCohortMatrix({
  matrix,
  tc,
  title = "MOIC i IRR per Vintage i Estratègia",
  strategyLabels = ALT_STRATEGY_LABELS,
  action,
}) {
  const { vintages, strategies, cells, totals } = matrix ?? {};

  const headCell = {
    padding: "9px 14px",
    fontSize: 10,
    fontWeight: 700,
    color: tc.navyLight ?? tc.textLight,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    background: "#F7FAFC",
    borderBottom: `2px solid ${tc.border}`,
    whiteSpace: "nowrap",
  };
  const bodyCell = { padding: "10px 14px", textAlign: "right", borderBottom: `1px solid ${tc.border}` };
  const rowHeadCell = { padding: "10px 14px", textAlign: "left", fontWeight: 700, color: tc.textMid, borderBottom: `1px solid ${tc.border}`, whiteSpace: "nowrap" };

  return (
    <div style={{ ...tableCardStyle(tc), overflowX: "auto" }}>
      <SectionHeader title={title} tc={tc} action={action} />
      {(!vintages || vintages.length === 0) ? (
        <div style={{ textAlign: "center", color: tc.textLight, padding: "32px 0" }}>
          Encara no hi ha dades per mostrar.
        </div>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ ...headCell, textAlign: "left" }}>Vintage</th>
              {strategies.map((s) => (
                <th key={s} style={{ ...headCell, textAlign: "right" }}>{strategyLabels[s] ?? s}</th>
              ))}
              <th style={{ ...headCell, textAlign: "right" }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {vintages.map((v) => (
              <tr key={v}>
                <td style={rowHeadCell}>{v}</td>
                {strategies.map((s) => (
                  <td key={s} style={bodyCell}>
                    <div style={{ display: "inline-flex", justifyContent: "flex-end", width: "100%" }}>
                      <Cell metrics={cells[`${v}|${s}`]} tc={tc} />
                    </div>
                  </td>
                ))}
                <td style={{ ...bodyCell, background: tc.bgAlt }}>
                  <div style={{ display: "inline-flex", justifyContent: "flex-end", width: "100%" }}>
                    <Cell metrics={totals.byVintage[v]} tc={tc} />
                  </div>
                </td>
              </tr>
            ))}
            <tr style={{ background: tc.bgAlt }}>
              <td style={{ ...rowHeadCell, borderBottom: "none" }}>Total</td>
              {strategies.map((s) => (
                <td key={s} style={{ ...bodyCell, borderBottom: "none" }}>
                  <div style={{ display: "inline-flex", justifyContent: "flex-end", width: "100%" }}>
                    <Cell metrics={totals.byStrategy[s]} tc={tc} />
                  </div>
                </td>
              ))}
              <td style={{ ...bodyCell, borderBottom: "none" }}>
                <div style={{ display: "inline-flex", justifyContent: "flex-end", width: "100%" }}>
                  <Cell metrics={totals.grand} tc={tc} />
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      )}
    </div>
  );
}
