import AltCohortMatrix, { MATRIX_METRIC_LABELS } from "./AltCohortMatrix.jsx";
import { COMPANY_STRATEGY_LABELS } from "../../data/altCohortModel.js";
import { IncludeCompaniesToggle } from "./IncludeCompaniesToggle.jsx";

const METRIC_OPTIONS = ["tvpi", "irr", "dpi"];

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
}) {
  // Always render: AltCohortMatrix shows an inline "Encara no hi ha dades" message
  // when the matrix is empty, so the header controls stay visible instead of
  // the whole section vanishing.
  return (
    <div>
      <AltCohortMatrix
        matrix={matrix}
        tc={tc}
        metric={metric}
        action={
          <div style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
            <MetricToggle metric={metric} onChange={onMetricChange} tc={tc} />
            <IncludeCompaniesToggle checked={includeCompanies} onChange={onToggleCompanies} tc={tc} />
          </div>
        }
      />
      {/* Same rule as the main matrix: keep it mounted when empty so the toggle
          visibly does something — AltCohortMatrix renders its own empty message. */}
      {includeCompanies && (
        <div style={{ marginTop: 18 }}>
          <AltCohortMatrix
            matrix={companyMatrix}
            tc={tc}
            metric={metric}
            title={`${MATRIX_METRIC_LABELS[metric] ?? "TVPI"} — Companies (Search Funds + Participades)`}
            strategyLabels={COMPANY_STRATEGY_LABELS}
          />
        </div>
      )}
    </div>
  );
}
