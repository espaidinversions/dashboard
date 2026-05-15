import React, { useState, useRef, useEffect } from "react";
import { TC_LIGHT, useTheme } from "../theme.js";
import { readStoredJSON, writeStoredJSON } from "../utils.js";

// ── Shared style helpers ──────────────────────────────────
export const sharedStyles = {
  card: (tc = TC_LIGHT) => ({ background: tc.card, border: `1px solid ${tc.border}`, borderRadius: 10 }),
  cardPad: (tc = TC_LIGHT, pad = "20px 24px") => ({ ...sharedStyles.card(tc), padding: pad }),
  th: (tc = TC_LIGHT) => ({ padding: "10px 12px", fontSize: 11, letterSpacing: "0.05em", textTransform: "uppercase", color: tc.textLight, fontWeight: 600 }),
  sec: (tc = TC_LIGHT) => ({ fontSize: 11, letterSpacing: "0.05em", textTransform: "uppercase", color: tc.textLight, fontWeight: 600 }),
  badge: (_tc = TC_LIGHT) => ({ fontSize: 11, borderRadius: 4, padding: "2px 8px", fontWeight: 600, whiteSpace: "nowrap", display: "inline-block" }),
  kpi: (tc = TC_LIGHT) => ({ background: tc.card, border: `1px solid ${tc.border}`, borderRadius: 10, padding: "16px 20px", minWidth: 140, flex: 1 }),
  kpiLabel: (tc = TC_LIGHT) => ({ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: tc.textLight, fontWeight: 600, marginBottom: 6 }),
  kpiValue: (tc = TC_LIGHT, valueColor) => ({ fontSize: 20, fontWeight: 700, color: valueColor ?? tc.navy, fontFamily: "'DM Mono',monospace" }),
  kpiSub: (tc = TC_LIGHT) => ({ fontSize: 11, color: tc.textLight, marginTop: 4 }),
};

export const indexPageStyles = {
  page: (tc = TC_LIGHT, inline = false) => ({
    minHeight: inline ? undefined : "100vh",
    background: tc.bg,
    color: tc.text,
    fontFamily: "'Outfit',system-ui,sans-serif",
    fontSize: 14,
  }),
  topBar: (tc = TC_LIGHT) => ({
    background: tc.card,
    borderBottom: `1px solid ${tc.border}`,
    padding: "12px 32px",
    display: "flex",
    alignItems: "center",
    gap: 16,
  }),
  searchInput: (tc = TC_LIGHT) => ({
    padding: "6px 12px",
    borderRadius: 6,
    border: `1.5px solid ${tc.border}`,
    background: tc.bg,
    color: tc.text,
    fontSize: 13,
    fontFamily: "inherit",
    width: 200,
  }),
  navRow: (tc = TC_LIGHT, inline = false) => ({
    background: tc.card,
    borderBottom: `1px solid ${tc.border}`,
    padding: inline ? "0" : "0 32px",
    display: "flex",
    overflowX: "auto",
  }),
  navItem: (tc = TC_LIGHT, active = false) => ({
    background: "none",
    border: "none",
    borderBottom: `2px solid ${active ? tc.green : "transparent"}`,
    padding: "11px 20px",
    fontSize: 12,
    fontWeight: active ? 600 : 400,
    color: active ? tc.navy : tc.textMid,
    textDecoration: "none",
    fontFamily: "inherit",
    whiteSpace: "nowrap",
    cursor: "pointer",
    flexShrink: 0,
  }),
  contentWrap: {
    padding: "24px 32px",
  },
  panel: (tc = TC_LIGHT) => ({
    background: tc.card,
    border: `1px solid ${tc.border}`,
    borderRadius: 12,
    boxShadow: "0 2px 10px rgba(15, 23, 42, 0.04)",
    overflow: "hidden",
  }),
  tableScroll: {
    overflowX: "auto",
  },
  filterControl: (tc = TC_LIGHT) => ({
    width: "100%",
    padding: "4px 6px",
    borderRadius: 4,
    border: `1px solid ${tc.border}`,
    background: tc.bg,
    color: tc.text,
    fontSize: 11,
    fontFamily: "inherit",
  }),
  clearButton: (tc = TC_LIGHT) => ({
    background: "transparent",
    border: `1px solid ${tc.border}`,
    borderRadius: 4,
    padding: "2px 8px",
    cursor: "pointer",
    fontSize: 10,
    color: tc.textMid,
    fontFamily: "inherit",
  }),
};

// ── KPI Card ─────────────────────────────────────────────
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
          position: "absolute", right: -12, top: -12,
          width: 70, height: 70,
          background: "rgba(61,200,62,0.08)",
          borderRadius: "50%",
        }} />
        <div style={{
          fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase",
          color: "rgba(255,255,255,0.55)", fontWeight: 600, marginBottom: 6,
        }}>{label}</div>
        <div style={{
          fontSize: 22, fontWeight: 700, color: "#fff",
          fontFamily: "'DM Mono',monospace", letterSpacing: "-0.5px",
        }}>{value}</div>
        {sub && <div style={{
          fontSize: 10, color: tc.green ?? "#3DC83E", marginTop: 4, fontWeight: 500,
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
        fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase",
        color: tc.textLight, fontWeight: 600, marginBottom: 6,
      }}>{label}</div>
      <div style={{
        fontSize: 20, fontWeight: 700, color: valueColor ?? tc.navy,
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

// ── Section Header ───────────────────────────────────────
export function SectionHeader({ title, count, action, tc: tcProp }) {
  const { tc: tcTheme } = useTheme();
  const tc = tcProp ?? tcTheme;
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      paddingBottom: 10,
      borderBottom: `1px solid ${tc.border}`,
      marginBottom: 14,
    }}>
      <div style={{
        width: 3, height: 18, flexShrink: 0,
        background: tc.gradients?.green ?? "linear-gradient(180deg, #3DC83E 0%, #28A029 100%)",
        borderRadius: 2,
      }} />
      <span style={{
        fontSize: 14, fontWeight: 700, color: tc.navyDark,
        letterSpacing: "-0.01em",
      }}>{title}</span>
      {(action || count != null) && (
        <div style={{ marginLeft: "auto" }}>
          {action ?? (
            <span style={{ fontSize: 11, color: tc.textLight, fontWeight: 400 }}>
              {count}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ── Table card wrapper style ─────────────────────────────
export function tableCardStyle(tc = TC_LIGHT) {
  return {
    background: tc.card,
    borderRadius: tc.radius?.md ?? 10,
    boxShadow: tc.shadows?.card ?? "0 1px 3px rgba(15,23,42,0.06), 0 4px 16px rgba(15,23,42,0.04)",
    overflow: "hidden",
    border: `1px solid ${tc.border}`,
  };
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

export const FlagImg = ({ geo, size=22 }) => {
  if (!geo) return null;
  return (
    <img
      src={twemojiUrl(geo)}
      alt={geo}
      style={{ width:size, height:size, verticalAlign:"middle" }}
    />
  );
};

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

function hexToRgba(hex, alpha) {
  if (!hex || !hex.startsWith("#")) return `rgba(0,0,0,${alpha})`;
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function Badge({label,cfg}) {
  const { tc: TC } = useTheme();
  const s=cfg||{color:TC.textMid,bg:TC.bgAlt};
  const border = s.border ?? hexToRgba(s.color, 0.15);
  return <span style={{fontSize:11,background:s.bg,color:s.color,borderRadius:20,padding:"3px 9px",fontWeight:600,whiteSpace:"nowrap",display:"inline-block",border:`1px solid ${border}`}}>{label}</span>;
}

// ── EditableCell ──────────────────────────────────────────
// Click-to-edit cell. type: "text" | "number" | "select" | "date"
// options: string[] for select. fmt: v => display string.
// badgeCfg: object mapping values to {bg, color, border} for badge styling
// emptyDisplay: string to show when value is empty (default "—")
// allowCustom: adds "＋ Afegir nou…" at bottom of select; custom values persisted to localStorage
// optionsKey: localStorage key for custom options (required for persistence when allowCustom)
// onSave(newValue) called only when value actually changes.
export function EditableCell({ value, onSave, type = "text", options, fmt, style = {}, align = "left", disabled = false, badgeCfg, emptyDisplay, allowCustom = false, optionsKey }) {
  const { tc } = useTheme();
  const [editing, setEditing]     = useState(false);
  const [draft,   setDraft]       = useState("");
  const [addingNew, setAddingNew] = useState(false);
  const [newDraft, setNewDraft]   = useState("");
  const ref    = useRef(null);
  const newRef = useRef(null);
  const addingNewRef = useRef(false); // ref to block commit() during "add new" flow

  useEffect(() => { if (editing && !addingNew) ref.current?.focus(); }, [editing, addingNew]);
  useEffect(() => { if (addingNew) newRef.current?.focus(); }, [addingNew]);

  const getCustomOpts = () => {
    if (!optionsKey) return [];
    return readStoredJSON(`copts_${optionsKey}`, []);
  };
  const saveCustomOpt = (val) => {
    if (!optionsKey) return;
    const existing = getCustomOpts();
    if (!existing.includes(val)) {
      writeStoredJSON(`copts_${optionsKey}`, [...existing, val]);
    }
  };

  const start = () => {
    setDraft(value != null && value !== "" ? String(value) : "");
    addingNewRef.current = false;
    setAddingNew(false);
    setEditing(true);
  };

  const commit = () => {
    if (addingNewRef.current) return;
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

  const commitNew = () => {
    const val = newDraft.trim();
    addingNewRef.current = false;
    setAddingNew(false);
    setEditing(false);
    if (val) {
      saveCustomOpt(val);
      if (val !== value) onSave(val);
    }
  };

  const inputStyle = {
    background: tc.bg, color: tc.text,
    border: `1.5px solid ${tc.green}`, borderRadius: 4,
    padding: "2px 5px", fontSize: "inherit", fontFamily: "inherit",
    width: "100%", outline: "none", textAlign: align,
    ...style,
  };

  if (editing && options) {
    if (addingNew) {
      return (
        <input ref={newRef} value={newDraft} type="text"
          onChange={e => setNewDraft(e.target.value)}
          onBlur={commitNew}
          onKeyDown={e => {
            if (e.key === "Enter") commitNew();
            if (e.key === "Escape") { addingNewRef.current = false; setAddingNew(false); setEditing(false); }
          }}
          placeholder="Nou valor…"
          style={{ ...inputStyle, minWidth: 110 }}
        />
      );
    }
    const customOpts = getCustomOpts();
    const hasEmpty = options.includes("");
    const baseNoEmpty = options.filter(o => o !== "");
    const merged = [...new Set([...baseNoEmpty, ...customOpts])];
    const mergedOptions = hasEmpty ? ["", ...merged] : merged;
    return (
      <select ref={ref} value={draft}
        onChange={e => {
          if (e.target.value === "__add_new__") {
            addingNewRef.current = true;
            setAddingNew(true);
            setNewDraft("");
          } else {
            setDraft(e.target.value);
          }
        }}
        onBlur={commit}
        onKeyDown={e => { if (e.key === "Escape") setEditing(false); }}
        style={inputStyle}>
        {mergedOptions.map(o => <option key={o} value={o}>{o || "—"}</option>)}
        {allowCustom && <option value="__add_new__">＋ Afegir nou…</option>}
      </select>
    );
  }

  if (editing) {
    return (
      <input ref={ref} value={draft} type={type === "number" ? "number" : type === "date" ? "date" : "text"}
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
        <span style={{ fontSize: 12, background: s.bg, color: s.color, borderRadius: 4, padding: "3px 9px", fontWeight: 600, border: `1px solid ${s.border || s.bg}`, display: "inline-block" }}>
          {display}
        </span>
      );
    }
    return (
      <span onClick={start} title="Fes clic per editar"
        style={{ fontSize: 12, background: s.bg, color: s.color, borderRadius: 4, padding: "3px 9px", fontWeight: 600, cursor: "pointer", border: `1px solid ${s.border || s.bg}`, display: "inline-block", userSelect: "none" }}>
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
        borderRadius: 4, padding: "2px 4px", minWidth: 70,
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
          style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, border: "none",
            background: tc.red ?? "#C62828", color: "#fff", cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>
          Confirmar
        </button>
      </div>
    );
  }

  return (
    <button onClick={() => setConfirming(true)}
      style={{ background: "transparent", border: "none", cursor: "pointer",
        color: tc.textLight, fontSize: 14, padding: "2px 4px", lineHeight: 1, transition:"color 0.15s" }}
      onMouseEnter={e => { e.currentTarget.style.color="#d32f2f"; }}
      onMouseLeave={e => { e.currentTarget.style.color=tc.textLight; }}
      title="Eliminar fila">
      🗑
    </button>
  );
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

  const set = (key, val) => setValues(v => ({ ...v, [key]: val }));
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

  const inp = {
    width: "100%", padding: "7px 10px", fontSize: 13,
    border: `1.5px solid ${tc.border}`, borderRadius: 6,
    background: tc.bg, color: tc.text, fontFamily: "inherit",
    outline: "none", boxSizing: "border-box",
  };
  const inputStyleFor = (field) => ({
    ...inp,
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
                {f.label}
              </label>
              {f.type === "select" ? (
                <select value={values[f.key]} onChange={e => applyFieldChange(f, e.target.value)} style={inputStyleFor(f)} disabled={f.disabled}>
                  {(f.options ?? []).map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : f.type === "combo" ? (
                <div style={{ display: "flex", gap: 8 }}>
                  {!customOpen[f.key] ? (
                    <>
                      <select
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
                        <option value="" disabled>{f.placeholder ?? "Selecciona una opció"}</option>
                        <option value="__custom__">+ Nou valor…</option>
                        {(f.options ?? []).map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                      {values[f.key] && !(f.options ?? []).includes(values[f.key]) ? (
                        <button
                          type="button"
                          onClick={() => setCustom(f.key, true)}
                          style={{ padding: "0 12px", borderRadius: 6, border: `1.5px solid ${tc.border}`, background: "transparent", color: tc.textMid, cursor: "pointer", fontFamily: "inherit" }}
                        >
                          Edita
                        </button>
                      ) : null}
                    </>
                  ) : (
                    <>
                      <input
                        type="text"
                        value={values[f.key]}
                        onChange={e => applyFieldChange(f, e.target.value)}
                        placeholder={f.placeholder ?? ""}
                        style={{ ...inputStyleFor(f), flex: 1 }}
                        disabled={f.disabled}
                      />
                      <button
                        type="button"
                        onClick={() => setCustom(f.key, false)}
                        style={{ padding: "0 12px", borderRadius: 6, border: `1.5px solid ${tc.border}`, background: "transparent", color: tc.textMid, cursor: "pointer", fontFamily: "inherit" }}
                      >
                        Llista
                      </button>
                    </>
                  )}
                </div>
              ) : f.type === "datalist" ? (
                <>
                  <input
                    type="text"
                    value={values[f.key]}
                    onChange={e => applyFieldChange(f, e.target.value)}
                    placeholder={f.placeholder ?? ""}
                    list={`addrow-${f.key}`}
                    style={inputStyleFor(f)}
                    disabled={f.disabled}
                  />
                  <datalist id={`addrow-${f.key}`}>
                    {(f.options ?? []).map(o => <option key={o} value={o} />)}
                  </datalist>
                </>
              ) : f.type === "textarea" ? (
                <textarea
                  value={values[f.key]}
                  onChange={e => applyFieldChange(f, e.target.value)}
                  placeholder={f.placeholder ?? ""}
                  style={{ ...inputStyleFor(f), minHeight: 88, resize: "vertical" }}
                  disabled={f.disabled}
                />
              ) : (
                <input type={f.type ?? "text"} value={values[f.key]}
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
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
            <button type="button" onClick={handleClose}
              style={{ padding: "8px 16px", borderRadius: 6, border: `1.5px solid ${tc.border}`,
                background: "transparent", color: tc.textMid, cursor: "pointer",
                fontFamily: "inherit", fontSize: 13 }}>
              Cancel·lar
            </button>
            <button type="submit" disabled={saving}
              style={{ padding: "8px 16px", borderRadius: 6, border: "none",
                background: saving ? tc.navyLight : tc.navy, color: "#fff",
                cursor: saving ? "wait" : "pointer",
                fontFamily: "inherit", fontSize: 13, fontWeight: 600 }}>
              {saving ? "Desant…" : submitLabel}
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
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity:0.4 }}>
        <circle cx="11" cy="11" r="7" /><line x1="16.5" y1="16.5" x2="22" y2="22" />
      </svg>
      <span style={{ fontSize:14, fontWeight:600, color:tc.textMid }}>{message}</span>
      <span style={{ fontSize:12 }}>Prova a canviar o treure algun filtre.</span>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// SELECTOR MULTI-FONS (panel lateral/dropdown)
