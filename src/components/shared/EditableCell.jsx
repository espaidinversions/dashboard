import { useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "../../theme.js";
import { readStoredJSON, writeStoredJSON } from "../../utils.js";

export function EditableCell({ value, onSave, type = "text", options, fmt, style = {}, align = "left", disabled = false, badgeCfg, emptyDisplay, allowCustom = false, optionsKey }) {
  const { tc } = useTheme();
  const [editing, setEditing]     = useState(false);
  const [draft,   setDraft]       = useState("");
  const [addingNew, setAddingNew] = useState(false);
  const [newDraft, setNewDraft]   = useState("");
  const ref    = useRef(null);
  const newRef = useRef(null);
  const addingNewRef = useRef(false);

  useEffect(() => { if (editing && !addingNew) ref.current?.focus(); }, [editing, addingNew]);
  useEffect(() => { if (addingNew) newRef.current?.focus(); }, [addingNew]);

  const customOpts = useMemo(() => {
    if (!optionsKey) return [];
    return readStoredJSON(`copts_${optionsKey}`, []);
  }, [optionsKey]);
  const getCustomOpts = () => customOpts;
  const saveCustomOpt = (val) => {
    if (!optionsKey) return;
    const existing = customOpts;
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

