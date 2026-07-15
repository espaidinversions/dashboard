/** Labeled pill toggle used as a section-header control — matches the site's
    pill-button language (e.g. the Portfoli scope pills in Dashboard.jsx). */
export function CheckboxToggle({ checked, onChange, label, tc }) {
  const on = !!checked;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      style={{
        padding: "5px 14px",
        borderRadius: 20,
        border: `1.5px solid ${on ? tc.navy : tc.border}`,
        background: on ? tc.navy : "transparent",
        color: on ? "#fff" : tc.textMid,
        cursor: "pointer",
        fontSize: 12,
        fontWeight: 600,
        fontFamily: "inherit",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </button>
  );
}
