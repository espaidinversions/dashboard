import React from "react";
import { PM_MODEL } from "../../data/publicMarketsModel.js";
import { WAM_POSITIONS } from "../../data/wamPositions.js";
import { summarizeLatestPmValuesWithWam } from "../../data/pmValueUtils.js";
import { KpiCard } from "../shared/KpiCard.jsx";
import { formatEur } from "./landingFormat.js";

const PM_LANDING_VALOR_ACTUAL =
  summarizeLatestPmValuesWithWam(PM_MODEL.series.values, PM_MODEL.holdings.active, WAM_POSITIONS).total;

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
