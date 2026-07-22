import { KpiCard } from "../shared/KpiCard.jsx";
import { SECTION_NAV_TARGET } from "../../data/landingModel.js";
import { formatEur } from "./landingFormat.js";

export { formatEur } from "./landingFormat.js";

function HeadlineStrip({ headline, tc }) {
  const items = headline.kind === "value"
    ? [{ label: "Valor actual", value: formatEur(headline.valorActual) }]
    : [
        { label: "Total Invertit", value: formatEur(headline.invertit) },
        { label: "Compromès pendent", value: formatEur(headline.compromesPendent) },
        { label: "Total Retornat", value: formatEur(headline.retornat) },
        { label: "# posicions", value: String(headline.nPosicions) },
      ];
  return (
    <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
      {items.map((it, i) => (
        <KpiCard key={it.label} tc={tc} hero={i === 0} label={it.label} value={it.value} />
      ))}
    </div>
  );
}

function CashflowCard({ card, tc, onNavigate }) {
  return (
    <button
      type="button"
      onClick={() => onNavigate(SECTION_NAV_TARGET[card.sectionId])}
      style={{ textAlign: "left", border: "none", background: "none", padding: 0, cursor: "pointer", width: "100%" }}
    >
      <KpiCard
        tc={tc}
        label={card.label}
        value={formatEur(card.invertit)}
        sub={`${formatEur(card.retornat)} retornat · ${card.nPosicions} posicions`}
      />
    </button>
  );
}

export function LandingTab({ model, tc, onNavigate, pmCard, chartSections }) {
  return (
    <div>
      <h1 style={{ fontSize: "var(--text-2xl)", fontWeight: 700, color: tc.navy, margin: "0 0 20px" }}>Inici</h1>
      <HeadlineStrip headline={model.headline} tc={tc} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
        {model.cards
          .filter((c) => c.kind === "cashflow")
          .map((c) => <CashflowCard key={c.sectionId} card={c} tc={tc} onNavigate={onNavigate} />)}
        {pmCard}
      </div>
      {chartSections}
    </div>
  );
}
