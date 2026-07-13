/** Small labeled toggle switch used as a section-header control (site-standard style). */
export function CheckboxToggle({ checked, onChange, label, tc }) {
  const on = !!checked;
  const trackW = 30;
  const trackH = 17;
  const knob = 13;
  const pad = 2;

  return (
    <label
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        cursor: "pointer",
        fontSize: 12,
        fontWeight: 600,
        color: tc.textMid,
        userSelect: "none",
        whiteSpace: "nowrap",
      }}
    >
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={() => onChange(!on)}
        style={{
          position: "relative",
          width: trackW,
          height: trackH,
          flexShrink: 0,
          padding: 0,
          border: `1px solid ${on ? tc.navy : tc.borderMid}`,
          borderRadius: trackH,
          background: on ? tc.navy : tc.card,
          cursor: "pointer",
          transition: "background 0.16s ease, border-color 0.16s ease",
          fontFamily: "inherit",
        }}
      >
        <span
          style={{
            position: "absolute",
            top: pad,
            left: on ? trackW - knob - pad - 2 : pad,
            width: knob,
            height: knob,
            borderRadius: "50%",
            background: on ? "#FFFFFF" : tc.textLight,
            boxShadow: tc.shadows?.sm ?? "0 1px 3px rgba(15,23,42,0.07)",
            transition: "left 0.16s ease, background 0.16s ease",
          }}
        />
      </button>
      {label}
    </label>
  );
}
