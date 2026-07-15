import React from "react";
import { formatMultiple, multipleColor } from "../../utils.js";
import { SectionHeader, tableCardStyle } from "../SharedComponents.jsx";
import { ALT_STRATEGY_LABELS } from "../../data/altCohortModel.js";

function irrColor(irr, tc) {
  if (irr == null) return tc.textLight;
  return irr >= 0 ? tc.green : tc.red;
}

export const MATRIX_METRIC_LABELS = { tvpi: "TVPI", irr: "IRR", dpi: "DPI" };

/** A single cell showing the selected metric, or an em dash. */
function Cell({ metrics, metric, tc }) {
  const mono = { fontFamily: "'DM Mono',monospace", fontSize: 12, fontWeight: 700 };
  if (!metrics) {
    return <span style={{ color: tc.textLight }}>—</span>;
  }
  const { moic, irr, dpi } = metrics;
  if (metric === "irr") {
    return <span style={{ ...mono, color: irrColor(irr, tc) }}>{irr != null ? `${irr.toFixed(1)}%` : "—"}</span>;
  }
  if (metric === "dpi") {
    // Neutral on purpose: DPI < 1× is expected for young vintages, so red/green
    // semantics would read as failure across the matrix.
    return <span style={{ ...mono, color: tc.textMid }}>{formatMultiple(dpi)}</span>;
  }
  // Cohort MOIC is the capital-weighted TVPI, surfaced under the TVPI label.
  return <span style={{ ...mono, color: multipleColor(moic, tc) }}>{moic != null ? formatMultiple(moic) : "—"}</span>;
}

/**
 * Cross-tab of the selected metric (TVPI / IRR / DPI) by vintage (rows) and
 * strategy (columns). Presentational only — consumes buildAltCohortMatrix output.
 */
export default function AltCohortMatrix({
  matrix,
  tc,
  title,
  strategyLabels = ALT_STRATEGY_LABELS,
  action,
  metric = "tvpi",
}) {
  const { vintages, strategies, cells, totals } = matrix ?? {};
  const resolvedTitle = title
    ?? `${MATRIX_METRIC_LABELS[metric] ?? "TVPI"} per Vintage i Estratègia`;

  const headCell = {
    padding: "9px 14px",
    fontSize: 10,
    fontWeight: 700,
    color: tc.navyLight ?? tc.textLight,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    background: tc.bgAlt,
    borderBottom: `2px solid ${tc.border}`,
    whiteSpace: "nowrap",
  };
  const bodyCell = { padding: "10px 14px", textAlign: "right", borderBottom: `1px solid ${tc.border}` };
  const rowHeadCell = {
    padding: "10px 14px",
    textAlign: "left",
    fontWeight: 700,
    color: tc.textMid,
    borderBottom: `1px solid ${tc.border}`,
    whiteSpace: "nowrap",
    fontFamily: "'DM Mono',monospace",
    fontSize: 12,
  };

  return (
    <div style={{ ...tableCardStyle(tc), overflowX: "auto" }}>
      {/* tableCardStyle cards have no padding (tables bleed to the edges), so
          the header gets its own inset. */}
      <div style={{ padding: "14px 18px 0" }}>
        <SectionHeader title={resolvedTitle} tc={tc} action={action} />
      </div>
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
                    <Cell metrics={cells[`${v}|${s}`]} metric={metric} tc={tc} />
                  </td>
                ))}
                <td style={{ ...bodyCell, background: tc.bgAlt }}>
                  <Cell metrics={totals.byVintage[v]} metric={metric} tc={tc} />
                </td>
              </tr>
            ))}
            <tr style={{ background: tc.bgAlt }}>
              <td style={{ ...rowHeadCell, borderBottom: "none", fontFamily: "inherit" }}>Total</td>
              {strategies.map((s) => (
                <td key={s} style={{ ...bodyCell, borderBottom: "none" }}>
                  <Cell metrics={totals.byStrategy[s]} metric={metric} tc={tc} />
                </td>
              ))}
              <td style={{ ...bodyCell, borderBottom: "none" }}>
                <Cell metrics={totals.grand} metric={metric} tc={tc} />
              </td>
            </tr>
          </tbody>
        </table>
      )}
    </div>
  );
}
