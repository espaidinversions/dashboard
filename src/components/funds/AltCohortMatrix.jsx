import React, { useState } from "react";
import { Link } from "react-router-dom";
import { fmtM, formatMultiple, multipleColor } from "../../utils.js";
import { SectionHeader, tableCardStyle } from "../SharedComponents.jsx";
import { ALT_STRATEGY_LABELS } from "../../data/altCohortModel.js";

function irrColor(irr, tc) {
  if (irr == null) return tc.textLight;
  return irr >= 0 ? tc.green : tc.red;
}

function utilizatColor(v, tc) {
  if (v == null) return tc.textLight;
  if (v < 50) return tc.red;
  if (v < 80) return tc.warning;
  return tc.green;
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

// Same columns as the Vehicles (fons) table in FundsIndex, read-only.
const DETAIL_COLS = [
  { k: "nom",       label: "Nom",        align: "left" },
  { k: "id",        label: "NIF",        align: "left" },
  { k: "est",       label: "Estratègia", align: "left" },
  { k: "year",      label: "Any",        align: "right" },
  { k: "compromis", label: "Compromís",  align: "right" },
  { k: "cridat",    label: "Cridat",     align: "right" },
  { k: "utilizat",  label: "Utilizat",   align: "right" },
  { k: "tvpi",      label: "TVPI",       align: "right" },
  { k: "irr",       label: "IRR",        align: "right" },
  { k: "dpi",       label: "DPI",        align: "right" },
  { k: "rvpi",      label: "RVPI",       align: "right" },
  { k: "fiEnd",     label: "Fi Inv.",    align: "right" },
];

/** The commitments of one vintage, rendered with the fons-table columns. */
function VintageFundsTable({ funds, tc }) {
  const mono = { fontFamily: "'DM Mono',monospace", fontSize: 12, fontWeight: 700 };
  const td = (align) => ({ padding: "8px 12px", textAlign: align, borderBottom: `1px solid ${tc.border}`, whiteSpace: "nowrap" });
  return (
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead>
        <tr>
          {DETAIL_COLS.map(({ k, label, align }) => (
            <th key={k} style={{ padding: "7px 12px", fontSize: 10, fontWeight: 700, color: tc.navyLight ?? tc.textLight, textTransform: "uppercase", letterSpacing: "0.06em", background: tc.bgAlt, borderBottom: `1px solid ${tc.border}`, whiteSpace: "nowrap", textAlign: align }}>
              {label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {funds.map((f) => {
          const dpi = f.calls > 0 ? f.dist / f.calls : 0;
          const rvpi = f.tvpi != null ? f.tvpi - dpi : null;
          const utilizat = f.compromis > 0 ? (f.calls / f.compromis) * 100 : null;
          return (
            <tr key={f.routeId ?? f.name}>
              <td style={td("left")}>
                <Link to={`/investments/funds/${encodeURIComponent(f.routeId ?? f.id ?? f.name)}`} style={{ color: tc.navy, textDecoration: "none", fontSize: 13, fontWeight: 600 }}>
                  {f.name}
                </Link>
              </td>
              <td style={{ ...td("left"), fontSize: 12, color: tc.textMid }}>{f.id ?? "—"}</td>
              <td style={{ ...td("left"), fontSize: 12, color: tc.textMid }}>{f.est ?? "—"}</td>
              <td style={{ ...td("right"), ...mono, color: tc.textMid }}>{f.vintage}</td>
              <td style={{ ...td("right"), ...mono, color: tc.text }}>{fmtM(f.compromis)}</td>
              <td style={{ ...td("right"), ...mono, color: tc.text }}>{fmtM(f.calls)}</td>
              <td style={{ ...td("right"), ...mono, color: utilizatColor(utilizat, tc) }}>{utilizat != null ? `${utilizat.toFixed(0)}%` : "—"}</td>
              <td style={{ ...td("right"), ...mono, color: multipleColor(f.tvpi, tc) }}>{formatMultiple(f.tvpi)}</td>
              <td style={{ ...td("right"), ...mono, color: irrColor(f.irr, tc) }}>{f.irr != null ? `${f.irr.toFixed(1)}%` : "—"}</td>
              <td style={{ ...td("right"), ...mono, color: tc.textMid }}>{formatMultiple(dpi)}</td>
              <td style={{ ...td("right"), ...mono, color: tc.textMid }}>{rvpi != null ? formatMultiple(rvpi) : "—"}</td>
              <td style={{ ...td("right"), fontSize: 12, color: tc.textMid }}>{f.fiEnd ?? "—"}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/**
 * Cross-tab of the selected metric (TVPI / IRR / DPI) by vintage (rows) and
 * strategy (columns). Clicking a vintage row expands that vintage's fund
 * commitments with the fons-table columns. Presentational only — consumes
 * buildAltCohortMatrix output.
 */
export default function AltCohortMatrix({
  matrix,
  tc,
  title,
  strategyLabels = ALT_STRATEGY_LABELS,
  action,
  metric = "tvpi",
}) {
  const { vintages, strategies, cells, totals, funds } = matrix ?? {};
  const [expanded, setExpanded] = useState(null);
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

  const vintageFunds = (v) =>
    (funds ?? []).filter((f) => f.vintage === v).sort((a, b) => (b.compromis ?? 0) - (a.compromis ?? 0));

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
              <React.Fragment key={v}>
                <tr
                  onClick={() => setExpanded((prev) => (prev === v ? null : v))}
                  style={{ cursor: "pointer", background: expanded === v ? tc.bgAlt : undefined }}
                  title="Mostra els compromisos del vintage"
                >
                  <td style={rowHeadCell}>
                    <span style={{ display: "inline-block", width: 14, color: tc.textLight, fontSize: 10 }}>
                      {expanded === v ? "▼" : "▶"}
                    </span>
                    {v}
                  </td>
                  {strategies.map((s) => (
                    <td key={s} style={bodyCell}>
                      <Cell metrics={cells[`${v}|${s}`]} metric={metric} tc={tc} />
                    </td>
                  ))}
                  <td style={{ ...bodyCell, background: tc.bgAlt }}>
                    <Cell metrics={totals.byVintage[v]} metric={metric} tc={tc} />
                  </td>
                </tr>
                {expanded === v && (
                  <tr>
                    <td colSpan={strategies.length + 2} style={{ padding: 0, borderBottom: `1px solid ${tc.border}` }}>
                      <VintageFundsTable funds={vintageFunds(v)} tc={tc} />
                    </td>
                  </tr>
                )}
              </React.Fragment>
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
