import React from "react";
import { TC_LIGHT } from "../../theme.js";

export function KpiCard({ label, value, sub, valueColor, hero = false, progress, tc = TC_LIGHT }) {
  if (hero) {
    return (
      <div style={{
        background: tc.gradients?.navy ?? "linear-gradient(135deg, #2B5070 0%, #1C3A52 100%)",
        borderRadius: tc.radius?.lg ?? 14,
        padding: "16px 20px",
        boxShadow: "0 4px 16px rgba(43,80,112,0.25)",
        minWidth: 140,
        flex: 1,
        position: "relative",
        overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 2,
          background: tc.gradients?.green ?? "linear-gradient(90deg, #3DC83E 0%, #28A029 100%)",
          borderRadius: `${tc.radius?.lg ?? 14}px ${tc.radius?.lg ?? 14}px 0 0`,
        }} />
        <div style={{
          fontSize: "var(--text-xs)", letterSpacing: "0.08em", textTransform: "uppercase",
          color: "rgba(255,255,255,0.55)", fontWeight: 600, marginBottom: "var(--space-1)",
        }}>{label}</div>
        <div style={{
          fontSize: "var(--text-2xl)", fontWeight: 700, color: "#fff",
          fontFamily: "'DM Mono',monospace", letterSpacing: "-0.5px",
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
      borderRadius: tc.radius?.lg ?? 14,
      padding: "16px 20px",
      boxShadow: tc.shadows?.card ?? "0 1px 3px rgba(15,23,42,0.06), 0 4px 16px rgba(15,23,42,0.04)",
      minWidth: 140,
      flex: 1,
    }}>
      <div style={{
        fontSize: "var(--text-xs)", letterSpacing: "0.08em", textTransform: "uppercase",
        color: tc.textLight, fontWeight: 600, marginBottom: "var(--space-1)",
      }}>{label}</div>
      <div style={{
        fontSize: "var(--text-xl)", fontWeight: 700, color: valueColor ?? tc.navy,
        fontFamily: "'DM Mono',monospace",
      }}>{value}</div>
      {progress != null && (
        <div style={{ height: 3, background: tc.bgAlt, borderRadius: 2, marginTop: 8 }}>
          <div style={{
            height: 3,
            width: `${Math.min(100, Math.max(0, progress * 100))}%`,
            background: tc.gradients?.green ?? "linear-gradient(90deg, #3DC83E 0%, #28A029 100%)",
            borderRadius: 2,
          }} />
        </div>
      )}
      {sub && <div style={{
        fontSize: 10, color: tc.textLight, marginTop: 4,
      }}>{sub}</div>}
    </div>
  );
}

