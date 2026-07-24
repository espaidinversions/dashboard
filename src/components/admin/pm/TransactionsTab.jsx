import { useCallback, useEffect, useMemo, useState } from "react";
import { useTheme } from "../../../theme.js";
import { useToast } from "../../../toast.jsx";
import { sharedStyles } from "../../SharedComponents.jsx";
import { deletePMTransaction, loadPMTransactionsResult, upsertTransaction } from "../../../db.js";
import { PM_MODEL } from "../../../data/publicMarketsModel.js";

const PM_TRANSACTIONS_STATIC = PM_MODEL.activity.transactions;

export function TransactionsTab() {
  const { tc } = useTheme();
  const { toast } = useToast();
  const [manualRows, setManualRows] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [showAdd, setShowAdd]       = useState(false);
  const [saving, setSaving]         = useState(false);
  const [filterSource, setFilterSource] = useState("tots"); // "tots" | "model" | "manual"
  const [draft, setDraft] = useState({ action: "buy", date: "", isin: "", nom: "", tipus: "", custodian: "", units: "", nav: "", value_eur: "" });

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await loadPMTransactionsResult();
    if (error) toast({ message: "Error carregant transaccions: " + error.message, type: "error" });
    setManualRows(data);
    setLoading(false);
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  // Merge: static model rows (read-only) + manual Supabase rows
  // Manual rows take precedence if same id exists in model
  const allRows = useMemo(() => {
    const manualIds = new Set(manualRows.map(r => r.id));
    const modelRows = PM_TRANSACTIONS_STATIC
      .filter(r => !manualIds.has(r.id))
      .map(r => ({ ...r, _source: "model", value_eur: r.valueEur }));
    const manual = manualRows.map(r => ({ ...r, _source: "manual" }));
    return [...modelRows, ...manual].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  }, [manualRows]);

  const filtered = useMemo(() => {
    if (filterSource === "tots") return allRows;
    return allRows.filter(r => r._source === filterSource);
  }, [allRows, filterSource]);

  async function handleDelete(id) {
    const { error } = await deletePMTransaction(id);
    if (error) { toast({ message: "Error eliminant: " + error.message, type: "error" }); return; }
    setManualRows(prev => prev.filter(r => r.id !== id));
    toast({ message: "Transacció eliminada", type: "success" });
  }

  async function handleAdd(e) {
    e.preventDefault();
    if (!draft.isin || !draft.date) { toast({ message: "ISIN i data obligatoris", type: "error" }); return; }
    setSaving(true);
    const tx = {
      action: draft.action,
      date: draft.date,
      isin: draft.isin,
      nom: draft.nom || null,
      tipus: draft.tipus || null,
      custodian: draft.custodian || null,
      units: draft.units ? parseFloat(draft.units) : null,
      nav: draft.nav ? parseFloat(draft.nav) : null,
      valueEur: draft.value_eur ? parseFloat(draft.value_eur) : null,
    };
    const { error } = await upsertTransaction(tx);
    setSaving(false);
    if (error) { toast({ message: "Error afegint: " + error.message, type: "error" }); return; }
    await load();
    setShowAdd(false);
    setDraft({ action: "buy", date: "", isin: "", nom: "", tipus: "", custodian: "", units: "", nav: "", value_eur: "" });
    toast({ message: "Transacció afegida", type: "success" });
  }

  const th = { ...sharedStyles.th(tc), padding: "8px 10px", textAlign: "left", borderBottom: `2px solid ${tc.border}`, whiteSpace: "nowrap" };
  const td = { padding: "8px 10px", borderBottom: `1px solid ${tc.border}`, fontSize: 12 };
  const inp = { padding: "5px 8px", borderRadius: 4, border: `1.5px solid ${tc.border}`, background: tc.bg, color: tc.text, fontSize: 12, fontFamily: "inherit" };

  const chip = (label, active, onClick) => (
    <button key={label} onClick={onClick} style={{
      padding: "3px 10px", borderRadius: 20, fontSize: 11, cursor: "pointer", fontFamily: "inherit",
      border: `1.5px solid ${active ? tc.green : tc.border}`,
      background: active ? "#E8F8E8" : "transparent",
      color: active ? tc.green : tc.textLight, fontWeight: active ? 700 : 400,
    }}>{label}</button>
  );

  const modelCount  = allRows.filter(r => r._source === "model").length;
  const manualCount = allRows.filter(r => r._source === "manual").length;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 12, color: tc.textLight }}>
            {filtered.length} de {allRows.length} transaccions
          </span>
          {loading && <span style={{ fontSize: 11, color: tc.textLight, fontStyle: "italic" }}>· carregant manuals…</span>}
          {!loading && <><span style={{ fontSize: 11, color: tc.textLight }}>·</span>
          <span style={{ fontSize: 11, color: tc.textLight }}>{modelCount} model · {manualCount} manual</span></>}
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {chip("Totes", filterSource === "tots", () => setFilterSource("tots"))}
          {chip("Model", filterSource === "model", () => setFilterSource("model"))}
          {chip("Manual", filterSource === "manual", () => setFilterSource("manual"))}
          <button onClick={() => setShowAdd(s => !s)}
            style={{ padding: "6px 14px", borderRadius: 6, border: "none", background: tc.navy, color: "#fff", cursor: "pointer", fontSize: 12, fontFamily: "inherit", fontWeight: 600, marginLeft: 8 }}>
            {showAdd ? "✕ Cancel·la" : "＋ Afegeix manual"}
          </button>
        </div>
      </div>

      {showAdd && (
        <form onSubmit={handleAdd} style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16, padding: "14px 16px", background: tc.bgAlt, borderRadius: 10, border: `1px solid ${tc.border}` }}>
          {[
            { key: "isin", label: "ISIN", placeholder: "IE00B4L5Y983" },
            { key: "date", label: "Data", placeholder: "2024-03-15" },
            { key: "nom", label: "Nom", placeholder: "Vanguard..." },
            { key: "tipus", label: "Tipus", placeholder: "ETF" },
            { key: "custodian", label: "Custodi", placeholder: "DeGiro" },
            { key: "units", label: "Unitats", placeholder: "10.5" },
            { key: "nav", label: "NAV", placeholder: "95.20" },
            { key: "value_eur", label: "Valor EUR", placeholder: "999.60" },
          ].map(f => (
            <div key={f.key}>
              <div style={{ fontSize: 11, color: tc.textLight, marginBottom: 3, fontWeight: 600, textTransform: "uppercase" }}>{f.label}</div>
              <input value={draft[f.key]} onChange={e => setDraft(d => ({ ...d, [f.key]: e.target.value }))}
                placeholder={f.placeholder} style={{ ...inp, width: 110 }} />
            </div>
          ))}
          <div>
            <div style={{ fontSize: 11, color: tc.textLight, marginBottom: 3, fontWeight: 600, textTransform: "uppercase" }}>Acció</div>
            <select value={draft.action} onChange={e => setDraft(d => ({ ...d, action: e.target.value }))} style={inp}>
              <option value="buy">buy</option>
              <option value="sell">sell</option>
            </select>
          </div>
          <div style={{ alignSelf: "flex-end" }}>
            <button type="submit" disabled={saving}
              style={{ padding: "6px 14px", borderRadius: 6, border: "none", background: tc.green, color: "#fff", cursor: "pointer", fontSize: 12, fontFamily: "inherit", fontWeight: 600 }}>
              {saving ? "…" : "Desa"}
            </button>
          </div>
        </form>
      )}

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: tc.bgAlt }}>
              {["Data", "ISIN", "Nom", "Tipus", "Acció", "Custodi", "Unitats", "NAV", "Valor EUR", "Font", ""].map(h => (
                <th key={h} style={th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && <tr><td colSpan={11} style={{ padding: 32, textAlign: "center", color: tc.textLight }}>Cap transacció</td></tr>}
            {filtered.map(r => {
              const isModel = r._source === "model";
              const valueEur = r.value_eur ?? r.valueEur;
              return (
                  <tr key={r.id} style={{ background: isModel ? tc.bgAlt : "transparent", opacity: isModel ? 0.85 : 1 }}>
                    <td style={{ ...td, fontFamily: "'DM Mono',monospace", fontSize: 11 }}>{r.date}</td>
                    <td style={{ ...td, fontFamily: "'DM Mono',monospace", fontSize: 11 }}>{r.isin}</td>
                    <td style={{ ...td, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.nom ?? "—"}</td>
                    <td style={td}>{r.tipus ?? "—"}</td>
                    <td style={td}>
                      <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 4, fontWeight: 700, background: r.action === "buy" ? "#E8EFF5" : "#FEF3EC", color: r.action === "buy" ? tc.navy : "#B45309" }}>
                        {r.action}
                      </span>
                    </td>
                    <td style={td}>{r.custodian ?? "—"}</td>
                    <td style={{ ...td, fontFamily: "'DM Mono',monospace", fontSize: 11, textAlign: "right" }}>{r.units != null ? Number(r.units).toLocaleString("ca-ES", { maximumFractionDigits: 0 }) : "—"}</td>
                    <td style={{ ...td, fontFamily: "'DM Mono',monospace", fontSize: 11, textAlign: "right" }}>{r.nav != null ? Number(r.nav).toFixed(2) : "—"}</td>
                    <td style={{ ...td, fontFamily: "'DM Mono',monospace", fontSize: 11, textAlign: "right" }}>{valueEur != null ? `€${Number(valueEur).toFixed(0)}` : "—"}</td>
                    <td style={{ ...td, textAlign: "center" }}>
                      <span style={{
                        fontSize: 9, padding: "2px 6px", borderRadius: 4, fontWeight: 700, letterSpacing: "0.05em",
                        background: isModel ? "#E8EFF5" : "#E8F8E8",
                        color: isModel ? tc.navy : tc.green,
                      }}>
                        {isModel ? "MODEL" : "MANUAL"}
                      </span>
                    </td>
                    <td style={{ ...td, textAlign: "right" }}>
                      {!isModel && (
                        <button onClick={() => handleDelete(r.id)}
                          style={{ padding: "2px 8px", borderRadius: 4, border: `1px solid ${tc.border}`, background: "transparent", color: "#C62828", cursor: "pointer", fontSize: 11, fontFamily: "inherit" }}>
                          Elimina
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
    </div>
  );
}


