/** Small labeled checkbox used as a section-header toggle (site-standard style). */
export function CheckboxToggle({ checked, onChange, label, tc }) {
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
        whiteSpace: "nowrap",
      }}
    >
      <input
        type="checkbox"
        checked={!!checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ cursor: "pointer", accentColor: tc.navy }}
      />
      {label}
    </label>
  );
}
