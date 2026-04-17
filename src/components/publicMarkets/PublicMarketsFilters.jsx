import React from "react";

export function FilterPills({
  options,
  value,
  onChange,
  tc,
  dark,
  tone = "green",
  compact = false,
  rounded = 20,
}) {
  const activeColor = tone === "navy" ? tc.navy : tc.green;
  const activeBackground = tone === "navy"
    ? (dark ? "#0A1A30" : "#E8F0FA")
    : (dark ? "#0A2010" : "#E8F8E8");

  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {options.map(({ id, label }) => {
        const active = value === id;
        return (
          <button
            key={id}
            onClick={() => onChange(id)}
            style={{
              padding: compact ? "3px 10px" : "4px 10px",
              borderRadius: rounded,
              fontSize: compact ? 10 : 11,
              cursor: "pointer",
              fontFamily: "inherit",
              border: `1.5px solid ${active ? activeColor : tc.border}`,
              background: active ? activeBackground : "transparent",
              color: active ? activeColor : tc.textLight,
              fontWeight: active ? 700 : 400,
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
