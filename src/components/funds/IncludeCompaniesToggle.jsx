import React from "react";

/** Small labeled checkbox that toggles company rows into the vehicles views. */
export function IncludeCompaniesToggle({ checked, onChange, tc }) {
  return (
    <label
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        cursor: "pointer",
        fontSize: 12,
        fontWeight: 600,
        color: tc.textMid,
        userSelect: "none",
      }}
    >
      <input
        type="checkbox"
        checked={!!checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ cursor: "pointer", accentColor: tc.navy }}
      />
      Incloure companies
    </label>
  );
}
