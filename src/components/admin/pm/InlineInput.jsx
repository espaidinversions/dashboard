import { useState } from "react";
import { useTheme } from "../../../theme.js";

export function InlineInput({ value, type = "text", onSave, disabled, style }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const { tc } = useTheme();

  function commit() {
    setEditing(false);
    const v = type === "number" ? parseFloat(draft) : draft;
    if (v !== value) onSave(isNaN(v) ? null : v);
  }

  if (!editing) {
    return (
      <span
        onClick={disabled ? undefined : () => { setDraft(value ?? ""); setEditing(true); }}
        style={{ cursor: disabled ? "default" : "pointer", minWidth: 40, display: "inline-block", padding: "1px 4px", borderRadius: 4, ...(disabled ? {} : { background: tc.bgAlt }), ...style }}
      >
        {value ?? <span style={{ color: tc.textLight }}>—</span>}
      </span>
    );
  }

  return (
    <input
      autoFocus
      type={type}
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
      style={{ padding: "2px 6px", borderRadius: 4, border: `1.5px solid ${tc.green}`, background: tc.bg, color: tc.text, fontSize: 12, fontFamily: "inherit", width: 100, ...style }}
    />
  );
}

