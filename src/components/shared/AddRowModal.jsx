import React, { useEffect, useState } from "react";
import { useTheme } from "../../theme.js";

/**
 * Normalizes a user-typed number into a JS-parseable string:
 * - supports optional leading "-" (or parentheses for negatives)
 * - supports "." or "," as decimal separator (last separator wins)
 * - strips grouping separators (".", ",", spaces, apostrophes)
 *
 * Returned value is:
 * - "" (empty) for empty/invalid input
 * - "-" while user is mid-typing a negative number
 * - otherwise a string like "-1234.56" or "1234"
 */
function normalizeNumericInput(raw) {
  const input = String(raw ?? "");
  const trimmed = input.trim();
  if (!trimmed) return "";

  const parenNegative = trimmed.startsWith("(") && trimmed.endsWith(")");
  const sign = (parenNegative || trimmed.startsWith("-")) ? "-" : "";

  // Keep digits and separators only
  const cleaned = trimmed
    .replace(/[()]/g, "")
    .replace(/\s+/g, "")
    .replace(/[^0-9.,']/g, "")
    .replace(/'/g, "");

  // Allow mid-typing a negative sign without digits yet
  if (sign === "-" && cleaned === "") return "-";

  const dotCount = (cleaned.match(/\./g) ?? []).length;
  const lastDot = cleaned.lastIndexOf(".");
  const lastComma = cleaned.lastIndexOf(",");

  let intPart, fracPart, hasDecimal;

  if (lastComma !== -1) {
    // Comma present → comma is decimal separator, all dots are thousand separators
    intPart = cleaned.slice(0, lastComma).replace(/\./g, "");
    fracPart = cleaned.slice(lastComma + 1).replace(/[^\d]/g, "");
    hasDecimal = true;
  } else if (dotCount > 1) {
    // Multiple dots, no comma → all dots are thousand separators (European style)
    // A trailing dot means the user is about to type a decimal part
    intPart = cleaned.replace(/\./g, "");
    fracPart = "";
    hasDecimal = cleaned.endsWith(".");
  } else if (lastDot !== -1) {
    // Single dot, no comma → dot is the decimal separator
    intPart = cleaned.slice(0, lastDot);
    fracPart = cleaned.slice(lastDot + 1).replace(/[^\d]/g, "");
    hasDecimal = true;
  } else {
    intPart = cleaned;
    fracPart = "";
    hasDecimal = false;
  }

  intPart = intPart.replace(/[^\d]/g, "");
  if (!intPart && !fracPart) return sign ? "-" : "";

  return hasDecimal ? `${sign}${intPart || "0"}.${fracPart}` : `${sign}${intPart}`;
}

function formatDisplayValue(normalized) {
  if (!normalized || normalized === "-") return normalized ?? "";
  const hasTrailingDot = normalized.endsWith(".");
  const base = hasTrailingDot ? normalized.slice(0, -1) : normalized;
  const num = Number(base);
  if (!isFinite(num)) return normalized;
  const dotIdx = base.indexOf(".");
  const fracDigits = dotIdx >= 0 ? base.length - dotIdx - 1 : 0;
  const formatted = num.toLocaleString("ca-ES", {
    minimumFractionDigits: fracDigits,
    maximumFractionDigits: fracDigits,
  });
  return hasTrailingDot ? formatted + "," : formatted;
}

export function AddRowModal({ fields, onSave, onClose, title = "Nou registre", submitLabel = "Afegir" }) {
  const { tc } = useTheme();
  const [values, setValues] = useState(() =>
    Object.fromEntries(fields.map(f => [f.key, f.defaultValue ?? ""]))
  );
  const [customOpen, setCustomOpen] = useState(() =>
    Object.fromEntries(fields.filter(f => f.type === "combo").map(f => [f.key, false]))
  );
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [closing, setClosing] = useState(false);
  const handleClose = () => { setClosing(true); setTimeout(onClose, 175); };

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") { setClosing(true); setTimeout(onClose, 175); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const setCustom = (key, val) => setCustomOpen(v => ({ ...v, [key]: val }));
  const applyFieldChange = (field, nextValue) => {
    setValues((current) => {
      const next = { ...current, [field.key]: nextValue };
      if (typeof field.onChange === "function") {
        return field.onChange(nextValue, next, {
          setValue: (targetKey, targetValue) => { next[targetKey] = targetValue; },
        }) ?? next;
      }
      return next;
    });
  };

  const inputStyleFor = (field) => ({
    ...(typeof field.inputStyle === "function" ? field.inputStyle(values) : field.inputStyle),
  });

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await onSave(values, setError);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`modal-overlay${closing ? " closing" : ""}`}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex",
        alignItems: "center", justifyContent: "center", zIndex: 1000 }}
      >
      <div className={`modal-card${closing ? " closing" : ""}`}
        style={{ background: tc.card, borderRadius: 14, padding: "28px 28px 24px",
          width: 420, maxWidth: "90vw", boxShadow: "0 8px 40px rgba(0,0,0,.25)",
          fontFamily: "'Outfit',system-ui,sans-serif" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: tc.navy }}>{title}</div>
          <button
            type="button"
            onClick={handleClose}
            style={{ background: "transparent", border: "none", cursor: "pointer", color: tc.textLight, fontSize: 18, lineHeight: 1, padding: "0 2px", fontFamily: "inherit" }}
            aria-label="Tanca"
          >×</button>
        </div>
        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {fields.filter(f => !f.visible || f.visible(values)).map(f => (
            <div key={f.key}>
              <label style={{ fontSize: 11, fontWeight: 600, color: tc.textLight,
                letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 4 }}>
                {typeof f.label === "function" ? f.label(values) : f.label}
              </label>
              {f.type === "select" ? (
                <select className="modal-input" value={values[f.key]} onChange={e => applyFieldChange(f, e.target.value)} style={inputStyleFor(f)} disabled={f.disabled}>
                  {(f.options ?? []).map(o =>
                    o && typeof o === "object"
                      ? <optgroup key={o.group} label={o.group}>{o.items.map(i => <option key={i} value={i}>{i}</option>)}</optgroup>
                      : <option key={o} value={o}>{o}</option>
                  )}
                </select>
              ) : f.type === "combo" ? (
                <div style={{ display: "flex", gap: 8 }}>
                  {!customOpen[f.key] ? (
                    <select
                      className="modal-input"
                      value={(f.options ?? []).includes(values[f.key]) ? values[f.key] : ""}
                      onChange={e => {
                        if (e.target.value === "__custom__") {
                          setCustom(f.key, true);
                        } else {
                          applyFieldChange(f, e.target.value);
                        }
                      }}
                      style={{ ...inputStyleFor(f), flex: 1 }}
                      disabled={f.disabled}
                    >
                      <option value="">—</option>
                      <option value="__custom__">Nou…</option>
                      {(f.options ?? []).map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : (
                    <>
                      <input
                        className="modal-input"
                        value={values[f.key]}
                        onChange={e => applyFieldChange(f, e.target.value)}
                        placeholder={f.placeholder ?? ""}
                        style={{ ...inputStyleFor(f), flex: 1 }}
                        list={`addrow-${f.key}`}
                        disabled={f.disabled}
                      />
                      <button
                        type="button"
                        onClick={() => setCustom(f.key, false)}
                        style={{ padding: "0 10px", borderRadius: 8, border: `1px solid ${tc.border}`, background: "transparent", cursor: "pointer", color: tc.textLight }}
                      >
                        ↩
                      </button>
                      <datalist id={`addrow-${f.key}`}>
                        {(f.options ?? []).map(o => <option key={o} value={o} />)}
                      </datalist>
                    </>
                  )}
                </div>
              ) : f.type === "textarea" ? (
                <textarea
                  className="modal-input"
                  value={values[f.key]}
                  onChange={e => applyFieldChange(f, e.target.value)}
                  placeholder={f.placeholder ?? ""}
                  style={{ ...inputStyleFor(f), minHeight: 88, resize: "vertical" }}
                  disabled={f.disabled}
                />
              ) : f.type === "number" ? (
                <input
                  className="modal-input"
                  type="text"
                  inputMode="decimal"
                  value={formatDisplayValue(String(values[f.key] ?? ""))}
                  onChange={e => applyFieldChange(f, normalizeNumericInput(e.target.value))}
                  placeholder={f.placeholder ?? ""}
                  style={{ ...inputStyleFor(f), fontFamily: "'DM Mono',monospace" }}
                  disabled={f.disabled}
                />
              ) : (
                <input className="modal-input" type={f.type ?? "text"} value={values[f.key]}
                  onChange={e => applyFieldChange(f, e.target.value)}
                  placeholder={f.placeholder ?? ""}
                  style={inputStyleFor(f)}
                  disabled={f.disabled} />
              )}
              {f.hint && (() => {
                const h = typeof f.hint === "function" ? f.hint(values) : f.hint;
                if (!h) return null;
                const { text, valid } = typeof h === "string" ? { text: h, valid: true } : h;
                return (
                  <div style={{ fontSize: 11, marginTop: 4, color: valid ? tc.textLight : "#C62828", fontFamily: "'DM Mono',monospace" }}>
                    {text}
                  </div>
                );
              })()}
            </div>
          ))}
          {error && (
            <div style={{ fontSize: 12, color: "#C62828", background: "#FDECEA",
              borderRadius: 6, padding: "8px 12px" }}>{error}</div>
          )}
          <div style={{ display: "flex", gap: "var(--space-2)", justifyContent: "flex-end", marginTop: "var(--space-1)" }}>
            <button type="button" onClick={handleClose}
              className="btn-secondary"
              style={{ padding: "var(--space-2) var(--space-4)", borderRadius: "var(--radius-md)", border: `1.5px solid ${tc.border}`,
                background: "transparent", color: tc.textMid, cursor: "pointer",
                fontFamily: "inherit", fontSize: "var(--text-sm)" }}>
              Cancel·lar
            </button>
            <button type="submit" disabled={saving}
              className="btn-primary"
              style={{ padding: "var(--space-2) var(--space-4)", borderRadius: "var(--radius-md)", border: "none",
                background: saving ? tc.navyLight : tc.navy, color: "#fff",
                cursor: saving ? "wait" : "pointer",
                fontFamily: "inherit", fontSize: "var(--text-sm)", fontWeight: 600 }}>
              {saving ? "Desant…" : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
