import { useMemo } from "react";
import { usePersistedState } from "../../utils.js";
import { TxSection } from "../TxSection.jsx";
import { AltCohortSection } from "../funds/AltCohortSection.jsx";
import { LiquiditatSection } from "../shared/LiquiditatSection.jsx";
import { buildRealEstateCohortMatrix, RE_STRATEGY_LABELS } from "../../data/altCohortModel.js";

/**
 * Real Estate summary ("Resum") — mirrors the Alternatius Resum shape:
 * a flow chart + KPI cards (TxSection summaryOnly) over the RE transactions,
 * plus a per-vintage cohort matrix built from the RE vehicles. RE has no
 * company rows, so there is no scope/companies toggle here.
 */
export function RealEstateSummarySection({ tc, dark, reTx = [], reCompr = [], rawCC, fundMeta, estCfg, liquidityAccounts = [] }) {
  const [metric, setMetric] = usePersistedState("ui_re_matrix_metric", "tvpi");

  const matrix = useMemo(
    () => buildRealEstateCohortMatrix(rawCC, fundMeta),
    [rawCC, fundMeta],
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <TxSection
        summaryOnly
        tx={reTx}
        compr={reCompr}
        vehiclesLabel="Vehicles"
        estCfg={estCfg}
        tc={tc}
        dark={dark}
        canEdit={false}
      />
      <AltCohortSection
        tc={tc}
        matrix={matrix}
        showFundsMatrix
        hideCompaniesToggle
        fundsTitle="Resum Vehicles"
        fundsStrategyLabels={RE_STRATEGY_LABELS}
        metric={metric}
        onMetricChange={setMetric}
      />
      <LiquiditatSection accounts={liquidityAccounts} section="real-estate" tc={tc} />
    </div>
  );
}
