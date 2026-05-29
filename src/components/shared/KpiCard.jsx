import React from "react";
import { TC_LIGHT } from "../../theme.js";

export function KpiCard({ label, value, sub, valueColor, hero = false, progress, tc = TC_LIGHT }) {
  if (hero) {
    return (
      <div style={{
        background: tc.navy ?? "#2B4F70",
        borderRadius: tc.radius?.lg ?? 6,
        padding: "16px 20px",
        boxShadow: "0 2px 8px rgba(43,80,112,0.20)",
        minWidth: 140,
        flex: 1,
        position: "relative",
        overflow: "hidden",
        borderBottom: `2px solid ${tc.green ?? "#3DC83E"}`,
      }}>
        <div style={{
          fontSize: "var(--text-xs)", letterSpacing: "0.08em", textTransform: "uppercase",
          color: "rgba(255,255,255,0.50)", fontWeight: 600, marginBottom: "var(--space-1)",
        }}>{label}</div>
        <div style={{
          fontSize: "var(--text-2xl)", fontWeight: 500, color: "#fff",
          fontFamily: "var(--font-mono, 'IBM Plex Mono', monospace)", letterSpacing: "-0.5px",
        }}>{value}</div>
        {sub && <div style={{
          fontSize: "var(--text-xs)", color: tc.green ?? "#3DC83E", marginTop: "var(--space-1)", fontWeight: 500,
        }}>{sub}</div>}
      </div>
    );
  }

  return (
    <div className="kpi-card card-hover" style={{
      background: tc.card,
      border: `1px solid ${tc.border}`,
      borderRadius: tc.radius?.lg ?? 6,
      padding: "16px 20px",
      boxShadow: tc.shadows?.card ?? "0 1px 2px rgba(15,23,42,0.05), 0 2px 8px rgba(15,23,42,0.04)",
      minWidth: 140,
      flex: 1,
    }}>
      <div style={{
        fontSize: "var(--text-xs)", letterSpacing: "0.08em", textTransform: "uppercase",
        color: tc.textLight, fontWeight: 600, marginBottom: "var(--space-1)",
      }}>{label}</div>
      <div style={{
        fontSize: "var(--text-xl)", fontWeight: 500, color: valueColor ?? tc.navy,
        fontFamily: "var(--font-mono, 'IBM Plex Mono', monospace)",
      }}>{value}</div>
      {progress != null && (
        <div style={{ height: 2, background: tc.bgAlt, borderRadius: 1, marginTop: 8 }}>
          <div style={{
            height: 2,
            width: `${Math.min(100, Math.max(0, progress * 100))}%`,
            background: tc.green ?? "#3DC83E",
            borderRadius: 1,
          }} />
        </div>
      )}
      {sub && <div style={{
        fontSize: 10, color: tc.textLight, marginTop: 4,
      }}>{sub}</div>}
    </div>
  );
}

