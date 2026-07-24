import { useCallback, useEffect, useState } from "react";
import { useTheme } from "../../../theme.js";
import { useToast } from "../../../toast.jsx";
import { sharedStyles } from "../../SharedComponents.jsx";
import { loadPMPositionOverridesTableResult, upsertPMPositionOverride } from "../../../db.js";
import { InlineInput } from "./InlineInput.jsx";

const OVERRIDE_CURRENT_YEAR = new Date().getFullYear();
const OVERRIDE_REND_YEARS = [OVERRIDE_CURRENT_YEAR, OVERRIDE_CURRENT_YEAR - 1, OVERRIDE_CURRENT_YEAR - 2, OVERRIDE_CURRENT_YEAR - 3];
const OVERRIDE_EMPTY_DRAFT = {
  isin: "", valor_mercat: "", rend_inici: "", cost_anual: "", notes: "",
  ...Object.fromEntries(OVERRIDE_REND_YEARS.map(y => [`y${y}`, ""])),
};

export function OverridesTab() {
  const { tc } = useTheme();
  const { toast } = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving]   = useState(false);
  const [draft, setDraft] = useState(OVERRIDE_EMPTY_DRAFT);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await loadPMPositionOverridesTableResult();
    if (error) toast({ message: "Error carregant overrides: " + error.message, type: "error" });
    setRows(data);
    setLoading(false);
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const REND_YEARS = OVERRIDE_REND_YEARS;

  async function handleAdd(e) {
    e.preventDefault();
    const isin = draft.isin.trim().toUpperCase();
    if (!isin) { toast({ message: "ISIN obligatori", type: "error" }); return; }
    const num = s => { const n = parseFloat(s); return isNaN(n) ? null : n; };
    const rendiment = {};
    REND_YEARS.forEach(y => {
      const v = num(draft[`y${y}`]);
      if (v != null) rendiment[String(y)] = v;
    });
    const payload = {
      valorMercat: num(draft.valor_mercat),
      rendInici:   num(draft.rend_inici),
      costAnual:   num(draft.cost_anual),
      rendiment:   Object.keys(rendiment).length ? rendiment : null,
      notes:       draft.notes.trim() || null,
    };
    if (Object.values(payload).every(v => v == null)) { toast({ message: "Cal almenys un valor a sobreescriure", type: "error" }); return; }
    setSaving(true);
    const { error } = await upsertPMPositionOverride(isin, payload);
    setSaving(false);
    if (error) { toast({ message: "Error afegint: " + error.message, type: "error" }); return; }
    await load();
    setShowAdd(false);
    setDraft(OVERRIDE_EMPTY_DRAFT);
    toast({ message: "Override afegit", type: "success" });
  }

  async function save(isin, field, value, isYear = false) {
    let payload;
    if (isYear) {
      const currentRow = rows.find(r => r.isin === isin);
      const merged = { ...(currentRow?.rendiment ?? {}), [field]: value };
      payload = { rendiment: merged };
    } else {
      const camelMap = { valor_mercat: "valorMercat", rend_inici: "rendInici", cost_anual: "costAnual", notes: "notes" };
      payload = { [camelMap[field] ?? field]: value };
    }
    const { error } = await upsertPMPositionOverride(isin, payload);
    if (error) { toast({ message: "Error desant: " + error.message, type: "error" }); return; }
    setRows(prev => prev.map(r => {
      if (r.isin !== isin) return r;
      return isYear ? { ...r, rendiment: { ...(r.rendiment ?? {}), [field]: value } } : { ...r, [field]: value };
    }));
    toast({ message: "Desat", type: "success" });
  }

  const FIXED_FIELDS = [
    { key: "valor_mercat", label: "Valor Mercat €", isYear: false },
    { key: "rend_inici",   label: "Rend. Inici %",  isYear: false },
  ];
  const YEAR_FIELDS = REND_YEARS.map(y => ({ key: String(y), label: `${y} %`, isYear: true }));
  const NUMERIC_FIELDS = [
    ...FIXED_FIELDS,
    ...YEAR_FIELDS,
    { key: "cost_anual", label: "Cost Anual €", isYear: false },
  ];

  const th = { ...sharedStyles.th(tc), padding: "8px 10px", textAlign: "left", borderBottom: `2px solid ${tc.border}`, whiteSpace: "nowrap" };
  const td = { padding: "8px 10px", borderBottom: `1px solid ${tc.border}`, fontSize: 12 };
  const inp = { padding: "5px 8px", borderRadius: 4, border: `1.5px solid ${tc.border}`, background: tc.bg, color: tc.text, fontSize: 12, fontFamily: "inherit" };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 8 }}>
        <p style={{ fontSize: 12, color: tc.textLight, margin: 0 }}>
          Overrides financers per posició. S'apliquen per sobre del model generat. Clic a qualsevol cel·la per editar.
        </p>
        <button onClick={() => setShowAdd(s => !s)}
          style={{ padding: "6px 14px", borderRadius: 6, border: "none", background: tc.navy, color: "#fff", cursor: "pointer", fontSize: 12, fontFamily: "inherit", fontWeight: 600, whiteSpace: "nowrap" }}>
          {showAdd ? "✕ Cancel·la" : "＋ Afegeix"}
        </button>
      </div>

      {showAdd && (
        <form onSubmit={handleAdd} style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16, padding: "14px 16px", background: tc.bgAlt, borderRadius: 10, border: `1px solid ${tc.border}` }}>
          {[
            { key: "isin",         label: "ISIN",           placeholder: "IE00B4L5Y983", width: 140 },
            { key: "valor_mercat", label: "Valor Mercat €", placeholder: "100000",       width: 110 },
            { key: "rend_inici",   label: "Rend. Inici %",  placeholder: "12.5",         width: 90  },
            ...OVERRIDE_REND_YEARS.map(y => ({ key: `y${y}`, label: `${y} %`, placeholder: "4.2", width: 70 })),
            { key: "cost_anual",   label: "Cost Anual €",   placeholder: "0.22",         width: 90  },
            { key: "notes",        label: "Notes",          placeholder: "Font: extracte", width: 180 },
          ].map(f => (
            <div key={f.key}>
              <div style={{ fontSize: 11, color: tc.textLight, marginBottom: 3, fontWeight: 600, textTransform: "uppercase", whiteSpace: "nowrap" }}>{f.label}</div>
              <input value={draft[f.key]} onChange={e => setDraft(d => ({ ...d, [f.key]: e.target.value }))}
                placeholder={f.placeholder} style={{ ...inp, width: f.width }} />
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
                <th style={th}>ISIN</th>
                {NUMERIC_FIELDS.map(f => <th key={f.key} style={th}>{f.label}</th>)}
                <th style={th}>Notes</th>
                <th style={th}>Actualitzat</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={NUMERIC_FIELDS.length + 3} style={{ padding: 32, textAlign: "center", color: tc.textLight }}>Cap override</td></tr>}
              {rows.map(r => (
                <tr key={r.isin}>
                  <td style={{ ...td, fontFamily: "'DM Mono',monospace", fontSize: 11 }}>{r.isin}</td>
                  {NUMERIC_FIELDS.map(f => (
                    <td key={f.key} style={td}>
                      <InlineInput
                        value={f.isYear ? (r.rendiment?.[f.key] ?? null) : r[f.key]}
                        type="number"
                        onSave={v => save(r.isin, f.key, v, f.isYear)}
                      />
                    </td>
                  ))}
                  <td style={td}><InlineInput value={r.notes} onSave={v => save(r.isin, "notes", v)} style={{ width: 200 }} /></td>
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


