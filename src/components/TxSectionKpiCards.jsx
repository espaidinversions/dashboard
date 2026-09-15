export function TxSectionKpiCards({ cards, tc }) {
  return (
    <div className="grid-4" style={{ gap: 12 }}>
      {cards.map((card) => (
        <div key={card.label} style={{ background: tc.card, border: `1px solid ${tc.border}`, borderRadius: 10, padding: "14px 18px", borderTop: `3px solid ${card.accent}`, boxShadow: "0 2px 8px rgba(0,0,0,.06)" }}>
          <div style={{ fontSize: 11, letterSpacing: "0.06em", color: tc.textLight, textTransform: "uppercase", marginBottom: 4, fontWeight: 600 }}>{card.label}</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: card.accent, fontFamily: "'DM Mono',monospace" }}>{card.value}</div>
          {card.sub ? <div style={{ fontSize: 11, color: tc.textLight, marginTop: 2 }}>{card.sub}</div> : null}
        </div>
      ))}
    </div>
  );
}
