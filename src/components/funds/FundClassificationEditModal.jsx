import { useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "../../theme.js";
import {
  CLASSE_OPTIONS,
  CLASSIFICATION_DIMENSIONS,
  mapToRows,
  rowsToMap,
  validateDimension,
} from "../../data/fundClassificationModel.js";

// Editor for the fund one-pager Classificació card: the categorical class plus
// four weight-map dimensions (Al·locació / Geografia / Vertical / Tipus fons).
// Each dimension is a list of {categoria, pct} rows; a dimension must either be
// empty (clears the map) or sum to exactly 100%. On save, whole-% rows are
// converted to fraction maps by rowsToMap and handed to onSave.
export function FundClassificationEditModal({ initial, onSave, onClose }) {
  const { tc } = useTheme();
  const cardRef = useRef(null);

  const [classe, setClasse] = useState(initial?.vehicleEst ?? "");
  const [dims, setDims] = useState(() =>
    Object.fromEntries(
      CLASSIFICATION_DIMENSIONS.map((d) => [d.key, mapToRows(initial?.[d.key])]),
    ),
  );
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const validations = useMemo(
    () => Object.fromEntries(CLASSIFICATION_DIMENSIONS.map((d) => [d.key, validateDimension(dims[d.key])])),
    [dims],
  );
  const allValid = Object.values(validations).every((v) => v.ok);

  const setRow = (dimKey, idx, patch) =>
    setDims((prev) => ({
      ...prev,
      [dimKey]: prev[dimKey].map((row, i) => (i === idx ? { ...row, ...patch } : row)),
    }));
  const addRow = (dimKey) =>
    setDims((prev) => ({ ...prev, [dimKey]: [...prev[dimKey], { categoria: "", pct: "" }] }));
  const removeRow = (dimKey, idx) =>
    setDims((prev) => ({ ...prev, [dimKey]: prev[dimKey].filter((_, i) => i !== idx) }));

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!allValid) {
      const firstBad = CLASSIFICATION_DIMENSIONS.find((d) => !validations[d.key].ok);
      setError(`${firstBad.label}: ${validations[firstBad.key].error}`);
      return;
    }
    const payload = { vehicleEst: classe || null };
    for (const d of CLASSIFICATION_DIMENSIONS) payload[d.key] = rowsToMap(dims[d.key]);
    setSaving(true);
    try {
      await onSave(payload, setError);
    } finally {
      setSaving(false);
    }
  };

  const labelStyle = {
    fontSize: 11, fontWeight: 600, color: tc.textLight,
    letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 6,
  };
  const inputBase = {
    padding: "6px 8px", borderRadius: 6, border: `1px solid ${tc.border}`,
    background: tc.bg, color: tc.text, fontSize: 13, fontFamily: "inherit",
  };

  return (
    <div
      className="modal-overlay"
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
    >
      <div
        className="modal-card"
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-label="Edita classificació"
        style={{ background: tc.card, borderRadius: 14, padding: "24px 26px", width: 560, maxWidth: "92vw", maxHeight: "88vh", overflowY: "auto", boxShadow: "0 8px 40px rgba(0,0,0,.25)", fontFamily: "'Outfit',system-ui,sans-serif" }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: tc.navy }}>Edita classificació</div>
          <button type="button" onClick={onClose} aria-label="Tanca" style={{ background: "transparent", border: "none", cursor: "pointer", color: tc.textLight, fontSize: 18, lineHeight: 1, fontFamily: "inherit" }}>×</button>
        </div>

        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div>
            <label style={labelStyle}>Classe</label>
            <select value={classe} onChange={(e) => setClasse(e.target.value)} style={{ ...inputBase, width: "100%" }}>
              <option value="">—</option>
              {CLASSE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>

          {CLASSIFICATION_DIMENSIONS.map((d) => {
            const rows = dims[d.key];
            const v = validations[d.key];
            const totalColor = v.empty ? tc.textLight : v.ok ? "#2E7D32" : "#C62828";
            return (
              <div key={d.key}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                  <span style={labelStyle}>{d.label}</span>
                  <span style={{ fontSize: 11, fontFamily: "'DM Mono',monospace", color: totalColor }}>
                    {v.empty ? "buit" : `${Math.round(v.total)}%`}
                  </span>
                </div>
                <datalist id={`fc-opts-${d.key}`}>
                  {d.options.map((o) => <option key={o} value={o} />)}
                </datalist>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {rows.map((row, idx) => (
                    <div key={idx} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <input
                        list={`fc-opts-${d.key}`}
                        value={row.categoria}
                        onChange={(e) => setRow(d.key, idx, { categoria: e.target.value })}
                        placeholder="Categoria"
                        style={{ ...inputBase, flex: 1 }}
                      />
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={row.pct}
                        onChange={(e) => setRow(d.key, idx, { pct: e.target.value })}
                        placeholder="%"
                        style={{ ...inputBase, width: 72, textAlign: "right", fontFamily: "'DM Mono',monospace" }}
                      />
                      <button type="button" onClick={() => removeRow(d.key, idx)} aria-label="Elimina fila" style={{ background: "transparent", border: `1px solid ${tc.border}`, borderRadius: 6, cursor: "pointer", color: tc.textLight, width: 30, height: 30, flexShrink: 0 }}>×</button>
                    </div>
                  ))}
                  <button type="button" onClick={() => addRow(d.key)} style={{ alignSelf: "flex-start", background: "transparent", border: `1px dashed ${tc.border}`, borderRadius: 6, cursor: "pointer", color: tc.textMid, fontSize: 12, padding: "5px 10px", fontFamily: "inherit" }}>+ Afegeix categoria</button>
                </div>
              </div>
            );
          })}

          {error && (
            <div style={{ fontSize: 12, color: "#C62828", background: "#FDECEA", borderRadius: 6, padding: "8px 12px" }}>{error}</div>
          )}

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button type="button" onClick={onClose} style={{ padding: "8px 16px", borderRadius: 8, border: `1.5px solid ${tc.border}`, background: "transparent", color: tc.textMid, cursor: "pointer", fontFamily: "inherit", fontSize: 13 }}>Cancel·lar</button>
            <button type="submit" disabled={saving || !allValid} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: saving || !allValid ? tc.navyLight : tc.navy, color: "#fff", cursor: saving ? "wait" : allValid ? "pointer" : "not-allowed", fontFamily: "inherit", fontSize: 13, fontWeight: 600 }}>{saving ? "Desant…" : "Desa"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
