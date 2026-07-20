import React from "react";
import { usePmMonthly } from "../hooks/usePmMonthly.js";
import { KpiCard } from "../shared/KpiCard.jsx";
import { formatEur } from "./landingFormat.js";

const PM_VALUE_FIELDS = ["caixaRV", "caixaRF", "ubsRV", "ubsRF", "abelBK", "andbank"];

export default function PmLandingCard({ tc, onNavigate }) {
  const { monthly, loading } = usePmMonthly();
  const latest = Array.isArray(monthly) && monthly.length ? monthly[monthly.length - 1] : null;
  const valorActual = latest
    ? PM_VALUE_FIELDS.reduce((s, f) => s + (Number(latest[f]) || 0), 0)
    : 0;

  return (
    <button
      type="button"
      onClick={() => onNavigate("mp-resum")}
      style={{ textAlign: "left", border: "none", background: "none", padding: 0, cursor: "pointer", width: "100%" }}
    >
      <KpiCard
        tc={tc}
        label="Mercats Públics — Valor actual"
        value={loading && !latest ? "—" : formatEur(valorActual)}
        sub={latest ? latest.label : null}
      />
    </button>
  );
}
