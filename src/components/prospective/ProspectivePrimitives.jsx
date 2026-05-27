import React from "react";
import { colorFor, periodBg, periodColor, tdStyle, vintageStyle } from "./prospectiveUtils.js";

export function Kpi({ tc, label, value, color, sub, muted }) {
  return (
    <div style={{ background: tc.card, border: `1px solid ${tc.border}`, borderRadius: 8, padding: "13px 15px", boxShadow: tc.shadows?.card }}>
      <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: tc.textLight, fontWeight: 700 }}>{label}</div>
      <div className="num" style={{ fontSize: 20, fontWeight: 750, color: muted ? tc.textLight : color ?? tc.navy, marginTop: 5 }}>{value}</div>
      {sub ? <div style={{ fontSize: 10, color: tc.textLight, marginTop: 3 }}>{sub}</div> : null}
    </div>
  );
}

export function ChartCard({ tc, title, children, wide = false }) {
  return (
    <div style={{ gridColumn: wide ? "1 / -1" : undefined, background: tc.card, border: `1px solid ${tc.border}`, borderRadius: 8, padding: 14, boxShadow: tc.shadows?.card }}>
      <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.07em", color: tc.textLight, fontWeight: 750, marginBottom: 8 }}>{title}</div>
      {children}
    </div>
  );
}

export function Toolbar({ tc, children }) {
  return (
    <div style={{ background: tc.card, border: `1px solid ${tc.border}`, borderRadius: 8, padding: "10px 12px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", boxShadow: tc.shadows?.sm }}>
      {children}
    </div>
  );
}

export function ToolbarLabel({ tc, children }) {
  return <span style={{ fontSize: 11, color: tc.textLight, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em" }}>{children}</span>;
}

export function Segmented({ tc, value, onChange, options }) {
  return (
    <div style={{ display: "inline-flex", border: `1px solid ${tc.border}`, borderRadius: 7, overflow: "hidden", background: tc.bg }}>
      {options.map((option) => {
        const active = value === option.id;
        return (
          <button
            key={option.id}
            onClick={() => onChange(option.id)}
            style={{
              border: "none",
              borderRight: option === options[options.length - 1] ? "none" : `1px solid ${tc.border}`,
              background: active ? tc.navy : "transparent",
              color: active ? "#fff" : tc.textMid,
              padding: "6px 11px",
              fontSize: 12,
              fontWeight: active ? 700 : 600,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function PeriodPill({ tc, active, color, label, onClick }) {
  const c = colorFor(tc, color);
  return (
    <button
      onClick={onClick}
      style={{
        border: `1px solid ${c}`,
        color: c,
        background: active ? `${c}18` : "transparent",
        opacity: active ? 1 : 0.45,
        borderRadius: 999,
        padding: "4px 10px",
        fontSize: 11,
        fontWeight: 700,
        cursor: "pointer",
        fontFamily: "inherit",
      }}
    >
      {label}
    </button>
  );
}

export function MiniTag({ tc, children }) {
  return <span style={{ fontSize: 9, color: tc.textLight, border: `1px solid ${tc.border}`, background: tc.bgAlt, borderRadius: 4, padding: "1px 4px" }}>{children}</span>;
}

export function Th({ tc, children, onClick, active, dir, align = "right" }) {
  return (
    <th onClick={onClick} style={{ padding: "9px 10px", textAlign: align, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", color: active ? tc.navy : tc.textLight, background: tc.bgAlt, borderBottom: `1px solid ${tc.border}`, whiteSpace: "nowrap", cursor: onClick ? "pointer" : "default" }}>
      {children}{active ? (dir === "asc" ? " ▲" : " ▼") : ""}
    </th>
  );
}

export function YearCell({ tc, year, model, real, pctValue, total = false }) {
  let color = tc.text;
  if (real && model) color = real > model * 1.02 ? tc.green : real < model * 0.98 ? tc.red : tc.text;
  if (real && !model) color = tc.green;
  if (!real && model && periodOf(year) !== "fwd") color = tc.red;
  return (
    <td style={{ ...tdStyle(tc), background: periodBg(tc, year, total) }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
        <span style={{ fontSize: 10, color: tc.textLight }}>{model ? fmtC(model) : "-"}</span>
        <span style={{ fontSize: 12, fontWeight: 750, color }}>{real ? fmtC(real) : "-"}</span>
        {pctValue != null ? <span style={{ fontSize: 9, color: tc.textLight }}>{pctValue.toFixed(1)}%</span> : null}
      </div>
    </td>
  );
}

// fmtC needed by YearCell — import inline to avoid circular dep
function periodOf(year) {
  if (year <= 2025) return "closed";
  if (year === 2026) return "current";
  return "fwd";
}
function fmtC(value) {
  const n = Number(value) || 0;
  if (!n) return "";
  const a = Math.abs(n);
  if (a >= 1e6) return `${(n / 1e6).toFixed(0)}M€`;
  if (a >= 1e3) return `${(n / 1e3).toFixed(0)}K€`;
  return `${n.toFixed(0)}€`;
}
