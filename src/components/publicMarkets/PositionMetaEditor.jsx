import { useState } from "react";
import { TC_LIGHT } from "../../theme.js";
import { upsertPositionMeta, upsertTerOverride } from "../../db.js";
import { SectionHeader } from "../SharedComponents.jsx";

// ── Position metadata editor ──────────────────────────────────
const CUSTODIAN_OPTIONS = ["CaixaBank", "Bankinter", "Interactive Brokers", "JPMorgan", "UBS", "Abel Font", "WAM", "Andbank", "Altre"];

export function PositionMetaEditor({ p, isin, tc = TC_LIGHT, card, metaOverride, terOverride, onSaveMeta, onSaveTer }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);

  const startEdit = () => {
    setForm({
      nom:      metaOverride.nom      ?? p.nom      ?? "",
      gestor:   metaOverride.gestor   ?? p.gestor   ?? "",
      custodian: metaOverride.custodian ?? p.custodian ?? "CaixaBank",
      ter:      String(terOverride ?? p.costAnual ?? ""),
    });
    setOpen(true);
    setError(null);
    setSaved(false);
  };

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    const metaFields = {};
    if (form.nom      !== (p.nom      ?? "")) metaFields.nom      = form.nom || null;
    if (form.gestor   !== (p.gestor   ?? "")) metaFields.gestor   = form.gestor || null;
    if (form.custodian !== (p.custodian ?? "")) metaFields.custodian = form.custodian || null;

    const terVal = form.ter !== "" ? parseFloat(form.ter) : null;

    const [r1, r2] = await Promise.all([
      Object.keys(metaFields).length ? upsertPositionMeta(isin, metaFields) : Promise.resolve({ error: null }),
      terVal !== null && terVal !== (terOverride ?? p.costAnual ?? null) ? upsertTerOverride(isin, terVal) : Promise.resolve({ error: null }),
    ]);

    setSaving(false);
    if (r1.error || r2.error) return setError((r1.error ?? r2.error).message);

    if (Object.keys(metaFields).length) onSaveMeta(metaFields);
    if (terVal !== null) onSaveTer(terVal);
    setSaved(true);
    setTimeout(() => setOpen(false), 800);
  };

  const inp = {
    width: "100%", padding: "6px 10px", fontSize: 12,
    border: `1.5px solid ${tc.border}`, borderRadius: 6,
    background: tc.bg, color: tc.text, fontFamily: "inherit",
    outline: "none", boxSizing: "border-box",
  };

  return (
    <div style={card}>
      <SectionHeader
        title="Metadades"
        tc={tc}
        action={
          <button onClick={open ? () => setOpen(false) : startEdit} style={{
            padding: "3px 10px", borderRadius: 20, fontSize: 10, cursor: "pointer", fontFamily: "inherit",
            border: `1.5px solid ${tc.border}`, background: "transparent", color: tc.textLight,
          }}>{open ? "Cancel·lar" : "✏ Editar"}</button>
        }
      />

      {!open && (
        <div style={{ fontSize: 12, color: tc.textLight, marginTop: 8 }}>
          {Object.keys(metaOverride).filter(k => metaOverride[k]).length === 0 && terOverride == null
            ? "Sense sobreescriptures. Clica Editar per personalitzar nom, gestor, custodi o TER."
            : <span style={{ color: tc.green }}>✓ Sobreescriptures actives: {[
                metaOverride.nom && "Nom", metaOverride.gestor && "Gestor",
                metaOverride.custodian && "Custodi", terOverride != null && "TER",
              ].filter(Boolean).join(", ")}</span>
          }
        </div>
      )}

      {open && form && (
        <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 2 }}>
              <label style={{ fontSize: 10, fontWeight: 600, color: tc.textLight, letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 3 }}>Nom</label>
              <input value={form.nom} onChange={e => set("nom", e.target.value)} style={inp} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 10, fontWeight: 600, color: tc.textLight, letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 3 }}>TER (%)</label>
              <input type="number" step="0.001" value={form.ter} onChange={e => set("ter", e.target.value)} placeholder="0.00" style={inp} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 10, fontWeight: 600, color: tc.textLight, letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 3 }}>Gestor</label>
              <input value={form.gestor} onChange={e => set("gestor", e.target.value)} style={inp} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 10, fontWeight: 600, color: tc.textLight, letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 3 }}>Custodi</label>
              <select value={form.custodian} onChange={e => set("custodian", e.target.value)} style={inp}>
                {CUSTODIAN_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          {error && <div style={{ fontSize: 11, color: "#C62828", background: "#FDECEA", borderRadius: 6, padding: "6px 10px" }}>{error}</div>}
          {saved && <div style={{ fontSize: 11, color: tc.green }}>✓ Guardat</div>}
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button onClick={handleSave} disabled={saving} style={{
              padding: "7px 18px", borderRadius: 6, border: "none",
              background: tc.navy, color: "#fff", cursor: saving ? "default" : "pointer",
              fontFamily: "inherit", fontSize: 12, fontWeight: 600, opacity: saving ? 0.7 : 1,
            }}>{saving ? "Guardant…" : "Guardar"}</button>
          </div>
        </div>
      )}
    </div>
  );
}
