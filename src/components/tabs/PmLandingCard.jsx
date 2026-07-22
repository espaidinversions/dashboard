import { getPmLandingSummary } from "./pmLandingValue.js";
import { KpiCard } from "../shared/KpiCard.jsx";
import { formatEur } from "./landingFormat.js";

const PM_LANDING_VALOR_ACTUAL = getPmLandingSummary().valorActual;

export default function PmLandingCard({ tc, onNavigate }) {
  return (
    <button
      type="button"
      onClick={() => onNavigate("mp-resum")}
      style={{ textAlign: "left", border: "none", background: "none", padding: 0, cursor: "pointer", width: "100%" }}
    >
      <KpiCard
        tc={tc}
        label="Mercats Públics — Valor actual"
        value={formatEur(PM_LANDING_VALOR_ACTUAL)}
      />
    </button>
  );
}
