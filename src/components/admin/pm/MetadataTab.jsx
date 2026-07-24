import { useCallback, useEffect, useState } from "react";
import { useTheme } from "../../../theme.js";
import { useToast } from "../../../toast.jsx";
import { sharedStyles } from "../../SharedComponents.jsx";
import { loadPMPositionMetaTableResult, upsertPositionMeta } from "../../../db.js";
import { InlineInput } from "./InlineInput.jsx";

export function MetadataTab() {
  const { tc } = useTheme();
  const { toast } = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving]   = useState(false);
  const [draft, setDraft] = useState({ isin: "", nom: "", gestor: "", custodian: "" });

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await loadPMPositionMetaTableResult();
    if (error) toast({ message: "Error carregant metadades: " + error.message, type: "error" });
    setRows(data);
    setLoading(false);
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  async function save(isin, field, value) {
    const { error } = await upsertPositionMeta(isin, { [field]: value });
    if (error) { toast({ message: "Error desant: " + error.message, type: "error" }); return; }
    setRows(prev => prev.map(r => r.isin === isin ? { ...r, [field]: value } : r));
    toast({ message: "Desat", type: "success" });
  }

  async function handleAdd(e) {
    e.preventDefault();
    const isin = draft.isin.trim().toUpperCase();
    if (!isin) { toast({ message: "ISIN obligatori", type: "error" }); return; }
    setSaving(true);
    const { error } = await upsertPositionMeta(isin, {
      nom:       draft.nom.trim()       || null,
      gestor:    draft.gestor.trim()    || null,
      custodian: draft.custodian.trim() || null,
    });
    setSaving(false);
    if (error) { toast({ message: "Error afegint: " + error.message, type: "error" }); return; }
    await load();
    setShowAdd(false);
    setDraft({ isin: "", nom: "", gestor: "", custodian: "" });
    toast({ message: "Metadada afegida", type: "success" });
  }

  const th = { ...sharedStyles.th(tc), padding: "8px 10px", textAlign: "left", borderBottom: `2px solid ${tc.border}` };
  const td = { padding: "8px 10px", borderBottom: `1px solid ${tc.border}`, fontSize: 12 };
  const inp = { padding: "5px 8px", borderRadius: 4, border: `1.5px solid ${tc.border}`, background: tc.bg, color: tc.text, fontSize: 12, fontFamily: "inherit" };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <button onClick={() => setShowAdd(s => !s)}
          style={{ padding: "6px 14px", borderRadius: 6, border: "none", background: tc.navy, color: "#fff", cursor: "pointer", fontSize: 12, fontFamily: "inherit", fontWeight: 600 }}>
          {showAdd ? "✕ Cancel·la" : "＋ Afegeix"}
        </button>
      </div>

      {showAdd && (
        <form onSubmit={handleAdd} style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16, padding: "14px 16px", background: tc.bgAlt, borderRadius: 10, border: `1px solid ${tc.border}` }}>
          {[
            { key: "isin",      label: "ISIN",    placeholder: "IE00B4L5Y983" },
            { key: "nom",       label: "Nom",     placeholder: "Vanguard..." },
            { key: "gestor",    label: "Gestor",  placeholder: "Abel Font" },
            { key: "custodian", label: "Custodi", placeholder: "CaixaBank" },
          ].map(f => (
            <div key={f.key}>
              <div style={{ fontSize: 11, color: tc.textLight, marginBottom: 3, fontWeight: 600, textTransform: "uppercase" }}>{f.label}</div>
              <input value={draft[f.key]} onChange={e => setDraft(d => ({ ...d, [f.key]: e.target.value }))}
                placeholder={f.placeholder} style={{ ...inp, width: 140 }} />
            </div>
          ))}
          <div style={{ alignSelf: "flex-end" }}>
            <button type="submit" disabled={saving}
              style={{ padding: "6px 14px", borderRadius: 6, border: "none", background: tc.green, color: "#fff", cursor: "pointer", fontSize: 12, fontFamily: "inherit", fontWeight: 600 }}>
              {saving ? "…" : "Desa"}
            </button>
          </div>
        </form>
      )}

      {loading ? <div style={{ color: tc.textLight }}>Carregant…</div> : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: tc.bgAlt }}>
                {["ISIN", "Nom", "Gestor", "Custodi", "Actualitzat"].map(h => <th key={h} style={th}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={5} style={{ padding: 32, textAlign: "center", color: tc.textLight }}>Cap metadada</td></tr>}
              {rows.map(r => (
                <tr key={r.isin}>
                  <td style={{ ...td, fontFamily: "'DM Mono',monospace", fontSize: 11 }}>{r.isin}</td>
                  <td style={td}><InlineInput value={r.nom} onSave={v => save(r.isin, "nom", v)} /></td>
                  <td style={td}><InlineInput value={r.gestor} onSave={v => save(r.isin, "gestor", v)} /></td>
                  <td style={td}><InlineInput value={r.custodian} onSave={v => save(r.isin, "custodian", v)} /></td>
                  <td style={{ ...td, fontSize: 10, color: tc.textLight }}>{r.updated_at ? new Date(r.updated_at).toLocaleDateString("ca-ES") : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}


