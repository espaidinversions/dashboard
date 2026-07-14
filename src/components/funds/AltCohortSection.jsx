import AltCohortMatrix from "./AltCohortMatrix.jsx";
import { COMPANY_STRATEGY_LABELS } from "../../data/altCohortModel.js";
import { IncludeCompaniesToggle } from "./IncludeCompaniesToggle.jsx";
import { CheckboxToggle } from "../shared/CheckboxToggle.jsx";

/**
 * The MOIC / IRR / DPI cohort matrix for Alternatives, with the DPI and
 * companies toggles in the header. Optionally renders a second matrix for
 * companies (Search Funds + Participades) when the companies toggle is on.
 */
export function AltCohortSection({
  tc,
  matrix = null,
  companyMatrix = null,
  includeCompanies = false,
  onToggleCompanies = () => {},
  showDpi = false,
  onToggleDpi = () => {},
}) {
  // Always render: AltCohortMatrix shows an inline "Encara no hi ha dades" message
  // when the matrix is empty, so the DPI / companies toggles stay visible instead of
  // the whole section vanishing.
  return (
    <div>
      <AltCohortMatrix
        matrix={matrix}
        tc={tc}
        showDpi={showDpi}
        action={
          <div style={{ display: "inline-flex", alignItems: "center", gap: 12 }}>
            <CheckboxToggle checked={showDpi} onChange={onToggleDpi} label="Mostrar DPI" tc={tc} />
            <div style={{ width: 1, height: 16, background: tc.border }} />
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
            showDpi={showDpi}
            title={`MOIC${showDpi ? ", IRR i DPI" : " i IRR"} — Companies (Search Funds + Participades)`}
            strategyLabels={COMPANY_STRATEGY_LABELS}
          />
        </div>
      )}
    </div>
  );
}
