import { TC_LIGHT } from "../../theme.js";

export function KpiCard({ label, value, sub, valueColor, hero = false, progress, tc = TC_LIGHT }) {
  if (hero) {
    return (
      <div className="kpi-card kpi-card--hero" style={{
        background: `linear-gradient(155deg, ${tc.navy ?? "#284A67"} 0%, ${tc.navyDark ?? "#1A3348"} 100%)`,
        borderRadius: tc.radius?.xl ?? 8,
        padding: "20px 20px 16px",
        boxShadow: tc.shadows?.hero ?? "0 14px 36px rgba(26,51,72,0.26)",
        minWidth: 160,
        flex: 1,
        position: "relative",
        overflow: "hidden",
        border: `1px solid ${tc.navyDark ?? "#1A3348"}`,
        borderTop: `2px solid ${tc.brass ?? "#C7A24E"}`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <span style={{ width: 16, height: 2, background: tc.brass ?? "#C7A24E", display: "inline-block", borderRadius: 1 }} />
          <div style={{
            fontSize: "var(--text-xs)", letterSpacing: "0.10em", textTransform: "uppercase",
            color: "rgba(255,255,255,0.62)", fontWeight: 700,
          }}>{label}</div>
        </div>
        <div style={{
          fontSize: "clamp(23px, 2.3vw, 32px)", fontWeight: 500, color: "#FBFAF6",
          fontFamily: "var(--font-mono, 'IBM Plex Mono', monospace)", lineHeight: 1.05,
          letterSpacing: "-0.01em",
        }}>{value}</div>
        {sub && <div style={{
          fontSize: "var(--text-xs)", color: tc.green ?? "#3DC83E", marginTop: "var(--space-2)", fontWeight: 600,
        }}>{sub}</div>}
      </div>
    );
  }

  return (
    <div className="kpi-card card-hover" style={{
      background: tc.card,
      border: `1px solid ${tc.border}`,
      borderRadius: tc.radius?.xl ?? 8,
      padding: "15px 18px 16px",
      boxShadow: tc.shadows?.card ?? "0 1px 2px rgba(52,38,16,0.05), 0 2px 8px rgba(52,38,16,0.05)",
      minWidth: 150,
      flex: 1,
      position: "relative",
      overflow: "hidden",
    }}>
      <div style={{ position: "absolute", inset: "0 auto 0 0", width: 3, background: valueColor ?? tc.brass ?? "#AE8836", opacity: 0.9 }} />
      <div style={{
        fontSize: "var(--text-xs)", letterSpacing: "0.10em", textTransform: "uppercase",
        color: tc.textLight, fontWeight: 700, marginBottom: "var(--space-2)", paddingLeft: 3,
      }}>{label}</div>
      <div style={{
        fontSize: "var(--text-2xl)", fontWeight: 500, color: valueColor ?? tc.navy,
        fontFamily: "var(--font-mono, 'IBM Plex Mono', monospace)", lineHeight: 1.1,
        letterSpacing: "-0.01em", paddingLeft: 3,
      }}>{value}</div>
      {progress != null && (
        <div style={{ height: 3, background: tc.bgAlt, borderRadius: 2, marginTop: 10, overflow: "hidden" }}>
          <div style={{
            height: 3,
            width: `${Math.min(100, Math.max(0, progress * 100))}%`,
            background: tc.green ?? "#3DC83E",
            borderRadius: 2,
          }} />
        </div>
      )}
      {sub && <div style={{
        fontSize: "var(--text-xs)", color: tc.textLight, marginTop: "var(--space-2)", lineHeight: 1.35,
      }}>{sub}</div>}
    </div>
  );
}
