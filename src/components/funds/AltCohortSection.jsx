import AltCohortMatrix, { MATRIX_METRIC_LABELS } from "./AltCohortMatrix.jsx";
import { COMPANY_STRATEGY_LABELS } from "../../data/altCohortModel.js";
import { IncludeCompaniesToggle } from "./IncludeCompaniesToggle.jsx";

const METRIC_OPTIONS = ["dpi", "tvpi", "irr"];

/** Segmented metric selector — same visual language as the TxSection scope toggle. */
function MetricToggle({ metric, onChange, tc }) {
  return (
    <div style={{ display: "inline-flex", border: `1px solid ${tc.border}`, borderRadius: 8, overflow: "hidden", background: tc.bg }}>
      {METRIC_OPTIONS.map((m, i) => {
        const active = metric === m;
        return (
          <button
            key={m}
            onClick={() => onChange(m)}
            style={{
              border: "none",
              borderRight: i < METRIC_OPTIONS.length - 1 ? `1px solid ${tc.border}` : "none",
              background: active ? tc.navy : "transparent",
              color: active ? "#fff" : tc.textMid,
              padding: "5px 12px",
              fontSize: 12,
              fontWeight: active ? 700 : 600,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            {MATRIX_METRIC_LABELS[m]}
          </button>
        );
      })}
    </div>
  );
}

/**
 * The cohort matrix for Alternatives with a TVPI/IRR/DPI metric selector and the
 * companies toggle in the header. Optionally renders a second matrix for
 * companies (Search Funds + Participades) when the companies toggle is on.
 */
export function AltCohortSection({
  tc,
  matrix = null,
  companyMatrix = null,
  includeCompanies = false,
  onToggleCompanies = () => {},
  metric = "tvpi",
  onMetricChange = () => {},
  hideCompaniesToggle = false, // hide the include-companies toggle when it's driven externally
  showFundsMatrix = true, // render the Fons matrix (set false to show only companies)
}) {
  // The metric toggle (and optional companies toggle) lives on the first visible
  // matrix, so it stays reachable even when only the companies matrix shows.
  const action = (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
      <MetricToggle metric={metric} onChange={onMetricChange} tc={tc} />
      {!hideCompaniesToggle && <IncludeCompaniesToggle checked={includeCompanies} onChange={onToggleCompanies} tc={tc} />}
    </div>
  );

  // Always mount at least one matrix; AltCohortMatrix renders its own inline
  // "Encara no hi ha dades" message when empty, so controls stay visible.
  return (
    <div>
      {showFundsMatrix && (
        <AltCohortMatrix
          matrix={matrix}
          tc={tc}
          metric={metric}
          title="Resum Fons"
          action={action}
        />
      )}
      {includeCompanies && (
        <div style={{ marginTop: showFundsMatrix ? 18 : 0 }}>
          <AltCohortMatrix
            matrix={companyMatrix}
            tc={tc}
            metric={metric}
            title="Resum Companyies"
            strategyLabels={COMPANY_STRATEGY_LABELS}
            action={showFundsMatrix ? undefined : action}
          />
        </div>
      )}
    </div>
  );
}
