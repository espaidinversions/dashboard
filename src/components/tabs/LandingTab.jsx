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
    <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
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
    <div className="tab-panel" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <section className="surface-card" style={{ padding: "22px 24px 24px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, background: tc.green }} />
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 20, marginBottom: 18, flexWrap: "wrap" }}>
          <div style={{ minWidth: 260 }}>
            <div style={{ fontSize: 11, color: tc.textLight, textTransform: "uppercase", letterSpacing: "0.11em", fontWeight: 750, marginBottom: 6 }}>Inici</div>
            <h1 style={{ fontFamily: "var(--font-display)", fontSize: 34, lineHeight: 1.05, fontWeight: 350, color: tc.navyDark, margin: 0 }}>Cartera consolidada</h1>
          </div>
          <div style={{ color: tc.textLight, fontSize: 13, maxWidth: 360, lineHeight: 1.45 }}>
            Vista resum de capital, retorns i exposició per secció.
          </div>
        </div>
        <HeadlineStrip headline={model.headline} tc={tc} />
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 }}>
        {model.cards
          .filter((c) => c.kind === "cashflow")
          .map((c) => <CashflowCard key={c.sectionId} card={c} tc={tc} onNavigate={onNavigate} />)}
        {pmCard}
      </div>
      {chartSections}
    </div>
  );
}
