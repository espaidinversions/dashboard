import React, { useState, useRef, useEffect } from "react";
import { useTheme } from "../theme.js";

// ── Shared style helpers ──────────────────────────────────
export const sharedStyles = {
  card: (tc) => ({ background: tc.card, border: `1px solid ${tc.border}`, borderRadius: 10 }),
  cardPad: (tc, pad = "20px 24px") => ({ ...sharedStyles.card(tc), padding: pad }),
  th: (tc) => ({ padding: "10px 12px", fontSize: 10, letterSpacing: "0.06em", textTransform: "uppercase", color: tc.textLight, fontWeight: 600 }),
  sec: (tc) => ({ fontSize: 10, letterSpacing: "0.06em", textTransform: "uppercase", color: tc.textLight, fontWeight: 600 }),
  badge: (tc) => ({ fontSize: 11, borderRadius: 5, padding: "2px 8px", fontWeight: 600, whiteSpace: "nowrap", display: "inline-block" }),
  kpi: (tc) => ({ background: tc.card, border: `1px solid ${tc.border}`, borderRadius: 10, padding: "16px 20px", minWidth: 140, flex: 1 }),
  kpiLabel: (tc) => ({ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: tc.textLight, fontWeight: 600, marginBottom: 6 }),
  kpiValue: (tc, valueColor) => ({ fontSize: 20, fontWeight: 700, color: valueColor ?? tc.navy, fontFamily: "'DM Mono',monospace" }),
  kpiSub: (tc) => ({ fontSize: 11, color: tc.textLight, marginTop: 4 }),
};

// ── KPI Card ─────────────────────────────────────────────
export function KpiCard({ label, value, sub, valueColor, tc }) {
  return (
    <div className="kpi-card card-hover" style={sharedStyles.kpi(tc)}>
      <div style={sharedStyles.kpiLabel(tc)}>{label}</div>
      <div style={sharedStyles.kpiValue(tc, valueColor)}>{value}</div>
      {sub && <div style={sharedStyles.kpiSub(tc)}>{sub}</div>}
    </div>
  );
}

// ── Flag emoji as images via Twemoji (works on Windows) ───
// EN maps to GB (United Kingdom ISO code)
const GEO_TO_ISO = { EN:"gb" };

// Computes Twemoji SVG URL from 2-letter ISO country code
// Flag emoji codepoints = regional indicator letters (U+1F1E6 = A, …)
const twemojiUrl = (isoCode) => {
  const upper = (GEO_TO_ISO[isoCode] || isoCode).toUpperCase();
  const base = 0x1F1E6 - 65; // 65 = 'A'.charCodeAt(0)
  const cp1 = (upper.charCodeAt(0) + base).toString(16);
  const cp2 = (upper.charCodeAt(1) + base).toString(16);
  return `https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/${cp1}-${cp2}.svg`;
};

export const FlagImg = ({ geo, size=22 }) => (
  <img
    src={twemojiUrl(geo)}
    alt={geo}
    style={{ width:size, height:size, verticalAlign:"middle" }}
  />
);

// SVG <image> version for use inside Recharts pie chart labels
export const FlagSvgLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, geo }) => {
  if (percent < 0.07) return null;
  const R = Math.PI / 180;
  const r = innerRadius + (outerRadius - innerRadius) * 0.58;
  const x = cx + r * Math.cos(-midAngle * R);
  const y = cy + r * Math.sin(-midAngle * R);
  return (
    <image
      href={twemojiUrl(geo)}
      x={x - 11} y={y - 11}
      width={22} height={22}
    />
  );
};

// ── Subcomponents compartits ──────────────────────────────
export function Logo() {
  return <img src="/logo.jpg" alt="Turtle Capital" style={{height:60,objectFit:"contain"}}/>;
}

export function Badge({label,cfg}) {
  const { tc: TC } = useTheme();
  const s=cfg||{color:TC.textMid,bg:TC.bgAlt};
  return <span style={{fontSize:11,background:s.bg,color:s.color,borderRadius:5,padding:"2px 8px",fontWeight:600,whiteSpace:"nowrap",display:"inline-block"}}>{label}</span>;
}

// ── EditableCell ──────────────────────────────────────────
// Click-to-edit cell. type: "text" | "number" | "select"
// options: string[] for select. fmt: v => display string.
// badgeCfg: object mapping values to {bg, color, border} for badge styling
// emptyDisplay: string to show when value is empty (default "—")
// onSave(newValue) called only when value actually changes.
export function EditableCell({ value, onSave, type = "text", options, fmt, style = {}, align = "left", disabled = false, badgeCfg, emptyDisplay }) {
  const { tc } = useTheme();
  const [editing, setEditing] = useState(false);
  const [draft,   setDraft]   = useState("");
  const ref = useRef(null);

  useEffect(() => { if (editing) ref.current?.focus(); }, [editing]);

  const start = () => {
    setDraft(value != null && value !== "" ? String(value) : "");
    setEditing(true);
  };

  const commit = () => {
    setEditing(false);
    const trimmed = draft.trim();
    let next;
    if (type === "number") {
      next = trimmed === "" ? null : parseFloat(trimmed);
      if (isNaN(next)) return;
    } else {
      next = trimmed === "" ? null : trimmed;
    }
    if (next !== value) onSave(next);
  };

  const inputStyle = {
    background: tc.bg, color: tc.text,
    border: `1.5px solid ${tc.green}`, borderRadius: 4,
    padding: "2px 5px", fontSize: "inherit", fontFamily: "inherit",
    width: "100%", outline: "none", textAlign: align,
    ...style,
  };

  if (editing && options) {
    return (
      <select ref={ref} value={draft} onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === "Escape") setEditing(false); }}
        style={inputStyle}>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    );
  }

  if (editing) {
    return (
      <input ref={ref} value={draft} type={type === "number" ? "number" : "text"}
        onChange={e => setDraft(e.target.value)} onBlur={commit}
        onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
        style={inputStyle} />
    );
  }

  const display = fmt ? fmt(value) : (value ?? emptyDisplay ?? "—");

  // Badge mode: show styled badge with edit icon
  if (badgeCfg && value) {
    const s = badgeCfg[value] || { bg: tc.bgAlt, color: tc.textMid, border: tc.border };
    if (disabled) {
      return (
        <span style={{ fontSize: 12, background: s.bg, color: s.color, borderRadius: 5, padding: "3px 9px", fontWeight: 600, border: `1px solid ${s.border || s.bg}`, display: "inline-block" }}>
          {display}
        </span>
      );
    }
    return (
      <span onClick={start} title="Fes clic per editar"
        style={{ fontSize: 12, background: s.bg, color: s.color, borderRadius: 5, padding: "3px 9px", fontWeight: 600, cursor: "pointer", border: `1px solid ${s.border || s.bg}`, display: "inline-block", userSelect: "none" }}>
        {display} <span style={{ fontSize: 9, opacity: 0.6 }}>✎</span>
      </span>
    );
  }

  if (disabled) {
    return (
      <span style={{ display: "block", textAlign: align, padding: "1px 2px", ...style }}>
        {display}
      </span>
    );
  }

  const isEmpty = value == null || value === "";

  return (
    <span onClick={start} title="Fes clic per editar"
      style={{ cursor: "text", display: "inline-block", textAlign: align,
        borderRadius: 3, padding: "2px 4px", minWidth: 70,
        color: isEmpty ? tc.textLight : tc.text,
        ...style,
      }}>
      {isEmpty ? <span style={{ fontStyle: "italic", fontSize: 11 }}>{emptyDisplay ?? "— ✎"}</span> : display}
      {!isEmpty && <span style={{ fontSize: 9, opacity: 0.5, marginLeft: 4 }}>✎</span>}
    </span>
  );
}

export function DeleteRowButton({ onDelete }) {
  const { tc } = useTheme();
  const [confirming, setConfirming] = useState(false);
  const containerRef = useRef(null);

  const handleBlur = (e) => {
    if (!containerRef.current?.contains(e.relatedTarget)) {
      setConfirming(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Escape") setConfirming(false);
  };

  if (confirming) {
    return (
      <div ref={containerRef} tabIndex={-1} onBlur={handleBlur} onKeyDown={handleKeyDown}
        style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 11, color: tc.textMid }}>Eliminar?</span>
        <button onClick={onDelete}
          style={{ fontSize: 11, padding: "2px 8px", borderRadius: 5, border: "none",
            background: tc.red ?? "#C62828", color: "#fff", cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>
          Confirmar
        </button>
      </div>
    );
  }

  return (
    <button onClick={() => setConfirming(true)}
      style={{ background: "transparent", border: "none", cursor: "pointer",
        color: tc.textLight, fontSize: 14, padding: "2px 4px", lineHeight: 1 }}
      title="Eliminar fila">
      🗑
    </button>
  );
}

export function AddRowModal({ fields, onSave, onClose, title = "Nou registre" }) {
  const { tc } = useTheme();
  const [values, setValues] = useState(() =>
    Object.fromEntries(fields.map(f => [f.key, f.defaultValue ?? ""]))
  );
  const [error, setError] = useState(null);
  const [closing, setClosing] = useState(false);
  const handleClose = () => { setClosing(true); setTimeout(onClose, 175); };

  const set = (key, val) => setValues(v => ({ ...v, [key]: val }));

  const inp = {
    width: "100%", padding: "7px 10px", fontSize: 13,
    border: `1.5px solid ${tc.border}`, borderRadius: 7,
    background: tc.bg, color: tc.text, fontFamily: "inherit",
    outline: "none", boxSizing: "border-box",
  };

  const submit = (e) => {
    e.preventDefault();
    setError(null);
    onSave(values, setError);
  };

  return (
    <div className={`modal-overlay${closing ? " closing" : ""}`}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex",
        alignItems: "center", justifyContent: "center", zIndex: 1000 }}
      onClick={e => { if (e.target === e.currentTarget) handleClose(); }}>
      <div className={`modal-card${closing ? " closing" : ""}`}
        style={{ background: tc.card, borderRadius: 14, padding: "28px 28px 24px",
          width: 420, maxWidth: "90vw", boxShadow: "0 8px 40px rgba(0,0,0,.25)",
          fontFamily: "'Outfit',system-ui,sans-serif" }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: tc.navy, marginBottom: 20 }}>{title}</div>
        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {fields.map(f => (
            <div key={f.key}>
              <label style={{ fontSize: 11, fontWeight: 600, color: tc.textLight,
                letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 4 }}>
                {f.label}
              </label>
              {f.type === "select" ? (
                <select value={values[f.key]} onChange={e => set(f.key, e.target.value)} style={inp}>
                  {(f.options ?? []).map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : (
                <input type={f.type ?? "text"} value={values[f.key]}
                  onChange={e => set(f.key, e.target.value)}
                  placeholder={f.placeholder ?? ""}
                  style={inp} />
              )}
            </div>
          ))}
          {error && (
            <div style={{ fontSize: 12, color: "#C62828", background: "#FDECEA",
              borderRadius: 7, padding: "8px 12px" }}>{error}</div>
          )}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
            <button type="button" onClick={handleClose}
              style={{ padding: "8px 16px", borderRadius: 7, border: `1.5px solid ${tc.border}`,
                background: "transparent", color: tc.textMid, cursor: "pointer",
                fontFamily: "inherit", fontSize: 13 }}>
              Cancel·lar
            </button>
            <button type="submit"
              style={{ padding: "8px 16px", borderRadius: 7, border: "none",
                background: tc.navy, color: "#fff", cursor: "pointer",
                fontFamily: "inherit", fontSize: 13, fontWeight: 600 }}>
              Afegir
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function EmptyState({ message = "Cap resultat amb els filtres actuals." }) {
  const { tc } = useTheme();
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
      padding:"48px 24px", color:tc.textLight, gap:10 }}>
      <span style={{ fontSize:32 }}>🔍</span>
      <span style={{ fontSize:14, fontWeight:600, color:tc.textMid }}>{message}</span>
      <span style={{ fontSize:12 }}>Prova a canviar o treure algun filtre.</span>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// SELECTOR MULTI-FONS (panel lateral/dropdown)
