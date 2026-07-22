import { useState, useEffect, useCallback, useMemo } from "react";
import { useTheme } from "../../theme.js";
import { useToast } from "../../toast.jsx";
import { sharedStyles } from "../SharedComponents.jsx";
import {
  loadPMTransactions, deletePMTransaction, upsertTransaction,
  loadPMTerOverridesTable, upsertTerOverride,
  loadPMPositionMetaTable, upsertPositionMeta,
  loadPMPositionOverridesTable, upsertPMPositionOverride,
  loadPMMonthlySeries, upsertPMMonthlyRow, deletePMMonthlyRow,
  loadPMManagerOverrides, upsertPMManagerOverride,
} from "../../db.js";
import { PM_MODEL } from "../../data/publicMarketsModel.js";
import { PM_MONTHLY_STATIC, mergePmMonthly, managerOverridesFromDb } from "../hooks/usePmMonthly.js";

const PM_TRANSACTIONS_STATIC = PM_MODEL.activity.transactions;
const PM_MANAGERS_STATIC = PM_MODEL.metadata.managers;

const TABS = [
  { id: "transactions", label: "Transaccions" },
  { id: "meta",         label: "Metadades"    },
  { id: "ter",          label: "TER"          },
  { id: "overrides",    label: "Overrides"    },
  { id: "monthly",      label: "Mensual"      },
  { id: "managers",     label: "Gestors"      },
];

function InlineInput({ value, type = "text", onSave, disabled, style }) {
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

// ── Transactions tab ──────────────────────────────────────────────────────────
function TransactionsTab() {
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
    setManualRows(await loadPMTransactions());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Merge: static model rows (read-only) + manual Supabase rows
  // Manual rows take precedence if same id exists in model
  const allRows = useMemo(() => {
    const manualIds = new Set(manualRows.map(r => r.id));
    const modelRows = PM_TRANSACTIONS_STATIC
      .filter(r => !manualIds.has(r.id))
      .map(r => ({ ...r, _source: "model", value_eur: r.valueEur ?? r.value_eur }));
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

// ── Metadata tab ──────────────────────────────────────────────────────────────
function MetadataTab() {
  const { tc } = useTheme();
  const { toast } = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving]   = useState(false);
  const [draft, setDraft] = useState({ isin: "", nom: "", gestor: "", custodian: "" });

  const load = useCallback(async () => {
    setLoading(true);
    setRows(await loadPMPositionMetaTable());
    setLoading(false);
  }, []);

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

// ── TER tab ───────────────────────────────────────────────────────────────────
function TerTab() {
  const { tc } = useTheme();
  const { toast } = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving]   = useState(false);
  const [draft, setDraft] = useState({ isin: "", ter: "", notes: "" });

  const load = useCallback(async () => {
    setLoading(true);
    setRows(await loadPMTerOverridesTable());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function save(isin, field, value) {
    const existing = rows.find(r => r.isin === isin) ?? {};
    const ter = field === "ter" ? value : existing.ter;
    const notes = field === "notes" ? value : existing.notes;
    const { error } = await upsertTerOverride(isin, ter, notes);
    if (error) { toast({ message: "Error desant: " + error.message, type: "error" }); return; }
    setRows(prev => prev.map(r => r.isin === isin ? { ...r, [field]: value } : r));
    toast({ message: "Desat", type: "success" });
  }

  async function handleAdd(e) {
    e.preventDefault();
    const isin = draft.isin.trim().toUpperCase();
    if (!isin) { toast({ message: "ISIN obligatori", type: "error" }); return; }
    const ter = parseFloat(draft.ter);
    if (isNaN(ter)) { toast({ message: "TER numèric obligatori", type: "error" }); return; }
    setSaving(true);
    const { error } = await upsertTerOverride(isin, ter, draft.notes.trim() || undefined);
    setSaving(false);
    if (error) { toast({ message: "Error afegint: " + error.message, type: "error" }); return; }
    await load();
    setShowAdd(false);
    setDraft({ isin: "", ter: "", notes: "" });
    toast({ message: "TER afegit", type: "success" });
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
            { key: "isin",  label: "ISIN",    placeholder: "IE00B4L5Y983", width: 140 },
            { key: "ter",   label: "TER (%)", placeholder: "0.22",         width: 90  },
            { key: "notes", label: "Notes",   placeholder: "Font: KIID",   width: 240 },
          ].map(f => (
            <div key={f.key}>
              <div style={{ fontSize: 11, color: tc.textLight, marginBottom: 3, fontWeight: 600, textTransform: "uppercase" }}>{f.label}</div>
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
                {["ISIN", "TER (%)", "Notes", "Actualitzat"].map(h => <th key={h} style={th}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={4} style={{ padding: 32, textAlign: "center", color: tc.textLight }}>Cap TER override</td></tr>}
              {rows.map(r => (
                <tr key={r.isin}>
                  <td style={{ ...td, fontFamily: "'DM Mono',monospace", fontSize: 11 }}>{r.isin}</td>
                  <td style={td}><InlineInput value={r.ter} type="number" onSave={v => save(r.isin, "ter", v)} /></td>
                  <td style={td}><InlineInput value={r.notes} onSave={v => save(r.isin, "notes", v)} style={{ width: 240 }} /></td>
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

// ── Overrides tab ─────────────────────────────────────────────────────────────
const OVERRIDE_CURRENT_YEAR = new Date().getFullYear();
const OVERRIDE_REND_YEARS = [OVERRIDE_CURRENT_YEAR, OVERRIDE_CURRENT_YEAR - 1, OVERRIDE_CURRENT_YEAR - 2, OVERRIDE_CURRENT_YEAR - 3];
const OVERRIDE_EMPTY_DRAFT = {
  isin: "", valor_mercat: "", rend_inici: "", cost_anual: "", notes: "",
  ...Object.fromEntries(OVERRIDE_REND_YEARS.map(y => [`y${y}`, ""])),
};

function OverridesTab() {
  const { tc } = useTheme();
  const { toast } = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving]   = useState(false);
  const [draft, setDraft] = useState(OVERRIDE_EMPTY_DRAFT);

  const load = useCallback(async () => {
    setLoading(true);
    setRows(await loadPMPositionOverridesTable());
    setLoading(false);
  }, []);

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

// ── Monthly tab ───────────────────────────────────────────────────────────────
const MONTHLY_SERIES_FIELDS = [
  { key: "caixaRV", label: "Caixa RV" },
  { key: "caixaRF", label: "Caixa RF" },
  { key: "ubsRV",   label: "UBS RV"   },
  { key: "ubsRF",   label: "UBS RF"   },
  { key: "abelBK",  label: "Abel BK"  },
  { key: "andbank", label: "Andbank"  },
];
const MONTHLY_EMPTY_DRAFT = {
  month: "",
  ...Object.fromEntries(MONTHLY_SERIES_FIELDS.map(f => [f.key, ""])),
};
const MONTH_RE = /^\d{4}-\d{2}$/;

function MonthlyTab() {
  const { tc } = useTheme();
  const { toast } = useToast();
  const [liveRows, setLiveRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving]   = useState(false);
  const [draft, setDraft] = useState(MONTHLY_EMPTY_DRAFT);

  const load = useCallback(async () => {
    setLoading(true);
    setLiveRows(await loadPMMonthlySeries());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Merge: static model months + live Supabase months (live replaces static, latest first)
  const merged = useMemo(
    () => mergePmMonthly(PM_MONTHLY_STATIC, liveRows).slice().reverse(),
    [liveRows]
  );

  async function handleAdd(e) {
    e.preventDefault();
    const month = draft.month.trim();
    if (!MONTH_RE.test(month)) { toast({ message: "Mes en format AAAA-MM obligatori", type: "error" }); return; }
    const num = s => { const n = parseFloat(s); return isNaN(n) ? null : n; };
    const row = { month };
    MONTHLY_SERIES_FIELDS.forEach(f => { row[f.key] = num(draft[f.key]); });
    setSaving(true);
    const { error } = await upsertPMMonthlyRow(row);
    setSaving(false);
    if (error) { toast({ message: "Error desant: " + error.message, type: "error" }); return; }
    await load();
    setShowAdd(false);
    setDraft(MONTHLY_EMPTY_DRAFT);
    toast({ message: "Mes desat", type: "success" });
  }

  // Inline edit: editing a static row promotes it to a live row (copy + change)
  async function saveCell(row, field, value) {
    const payload = { month: row.date };
    MONTHLY_SERIES_FIELDS.forEach(f => { payload[f.key] = f.key === field ? value : (row[f.key] ?? null); });
    const { error } = await upsertPMMonthlyRow(payload);
    if (error) { toast({ message: "Error desant: " + error.message, type: "error" }); return; }
    await load();
    toast({ message: "Desat", type: "success" });
  }

  async function handleDelete(month) {
    const { error } = await deletePMMonthlyRow(month);
    if (error) { toast({ message: "Error eliminant: " + error.message, type: "error" }); return; }
    await load();
    toast({ message: "Mes eliminat (es recupera el valor del model si existeix)", type: "success" });
  }

  const th = { ...sharedStyles.th(tc), padding: "8px 10px", textAlign: "left", borderBottom: `2px solid ${tc.border}`, whiteSpace: "nowrap" };
  const td = { padding: "8px 10px", borderBottom: `1px solid ${tc.border}`, fontSize: 12 };
  const inp = { padding: "5px 8px", borderRadius: 4, border: `1.5px solid ${tc.border}`, background: tc.bg, color: tc.text, fontSize: 12, fontFamily: "inherit" };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 8 }}>
        <p style={{ fontSize: 12, color: tc.textLight, margin: 0 }}>
          Sèrie mensual per custodi. Les files LIVE substitueixen el mes del model; els mesos nous s'afegeixen al final. Clic a una cel·la per editar.
        </p>
        <button onClick={() => setShowAdd(s => !s)}
          style={{ padding: "6px 14px", borderRadius: 6, border: "none", background: tc.navy, color: "#fff", cursor: "pointer", fontSize: 12, fontFamily: "inherit", fontWeight: 600, whiteSpace: "nowrap" }}>
          {showAdd ? "✕ Cancel·la" : "＋ Afegeix"}
        </button>
      </div>

      {showAdd && (
        <form onSubmit={handleAdd} style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16, padding: "14px 16px", background: tc.bgAlt, borderRadius: 10, border: `1px solid ${tc.border}` }}>
          {[
            { key: "month", label: "Mes", placeholder: "2026-04", width: 90 },
            ...MONTHLY_SERIES_FIELDS.map(f => ({ key: f.key, label: f.label, placeholder: "1000000", width: 110 })),
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
                <th style={th}>Mes</th>
                {MONTHLY_SERIES_FIELDS.map(f => <th key={f.key} style={{ ...th, textAlign: "right" }}>{f.label}</th>)}
                <th style={th}>Font</th>
                <th style={th}></th>
              </tr>
            </thead>
            <tbody>
              {merged.length === 0 && <tr><td colSpan={MONTHLY_SERIES_FIELDS.length + 3} style={{ padding: 32, textAlign: "center", color: tc.textLight }}>Cap mes</td></tr>}
              {merged.map(row => {
                const isLive = row._source === "live";
                return (
                  <tr key={row.date} style={{ background: isLive ? "transparent" : tc.bgAlt, opacity: isLive ? 1 : 0.85 }}>
                    <td style={{ ...td, fontFamily: "'DM Mono',monospace", fontSize: 11, whiteSpace: "nowrap" }}>{row.date} · {row.label}</td>
                    {MONTHLY_SERIES_FIELDS.map(f => (
                      <td key={f.key} style={{ ...td, textAlign: "right", fontFamily: "'DM Mono',monospace", fontSize: 11 }}>
                        <InlineInput value={row[f.key]} type="number" onSave={v => saveCell(row, f.key, v)} />
                      </td>
                    ))}
                    <td style={td}>
                      <span style={{
                        fontSize: 9, padding: "2px 6px", borderRadius: 4, fontWeight: 700, letterSpacing: "0.05em",
                        background: isLive ? "#E8F8E8" : "#E8EFF5",
                        color: isLive ? tc.green : tc.navy,
                      }}>
                        {isLive ? "LIVE" : "MODEL"}
                      </span>
                    </td>
                    <td style={{ ...td, textAlign: "right" }}>
                      {isLive && (
                        <button onClick={() => handleDelete(row.date)}
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
      )}
    </div>
  );
}

// ── Managers tab ──────────────────────────────────────────────────────────────
const MANAGER_FIELDS = [
  { key: "valorActual", label: "Valor Actual €" },
  { key: "ytd",         label: "YTD %"          },
  { key: "r2025",       label: "2025 %"         },
  { key: "r2024",       label: "2024 %"         },
  { key: "rendPct",     label: "Des d'inici %"  },
];

function ManagersTab() {
  const { tc } = useTheme();
  const { toast } = useToast();
  const [overrides, setOverrides] = useState({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setOverrides(managerOverridesFromDb(await loadPMManagerOverrides()));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function save(managerId, field, value) {
    const { error } = await upsertPMManagerOverride(managerId, { [field]: value });
    if (error) { toast({ message: "Error desant: " + error.message, type: "error" }); return; }
    setOverrides(prev => ({ ...prev, [managerId]: { ...(prev[managerId] ?? {}), [field]: value } }));
    toast({ message: "Desat", type: "success" });
  }

  const th = { ...sharedStyles.th(tc), padding: "8px 10px", textAlign: "left", borderBottom: `2px solid ${tc.border}`, whiteSpace: "nowrap" };
  const td = { padding: "8px 10px", borderBottom: `1px solid ${tc.border}`, fontSize: 12 };

  return (
    <div>
      <p style={{ fontSize: 12, color: tc.textLight, margin: "0 0 12px" }}>
        Valors efectius per gestor: override de Supabase per sobre del model estàtic. Clic a una cel·la per editar.
      </p>

      {loading ? <div style={{ color: tc.textLight }}>Carregant…</div> : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: tc.bgAlt }}>
                <th style={th}>Gestor</th>
                <th style={th}>Tipus</th>
                {MANAGER_FIELDS.map(f => <th key={f.key} style={th}>{f.label}</th>)}
                <th style={th}>Notes</th>
                <th style={th}>Font</th>
              </tr>
            </thead>
            <tbody>
              {PM_MANAGERS_STATIC.map(manager => {
                const override = overrides[manager.id] ?? {};
                const hasOverride = MANAGER_FIELDS.some(f => override[f.key] != null) || override.notes != null;
                return (
                  <tr key={manager.id}>
                    <td style={{ ...td, fontWeight: 600, color: tc.navy, whiteSpace: "nowrap" }}>{manager.nom}</td>
                    <td style={td}>{manager.tipus}</td>
                    {MANAGER_FIELDS.map(f => {
                      const effective = override[f.key] ?? manager[f.key];
                      const isOverridden = override[f.key] != null;
                      return (
                        <td key={f.key} style={{ ...td, fontFamily: "'DM Mono',monospace", fontSize: 11 }}>
                          <InlineInput
                            value={effective != null ? Number(Number(effective).toFixed(4)) : null}
                            type="number"
                            onSave={v => save(manager.id, f.key, v)}
                            style={isOverridden ? { color: tc.green, fontWeight: 700 } : undefined}
                          />
                        </td>
                      );
                    })}
                    <td style={td}><InlineInput value={override.notes} onSave={v => save(manager.id, "notes", v)} style={{ width: 160 }} /></td>
                    <td style={td}>
                      <span style={{
                        fontSize: 9, padding: "2px 6px", borderRadius: 4, fontWeight: 700, letterSpacing: "0.05em",
                        background: hasOverride ? "#E8F8E8" : "#E8EFF5",
                        color: hasOverride ? tc.green : tc.navy,
                      }}>
                        {hasOverride ? "OVERRIDE" : "MODEL"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function AdminPMOperations() {
  const { tc } = useTheme();
  const [activeTab, setActiveTab] = useState("transactions");

  return (
    <div>
      <h2 style={{ margin: "0 0 20px", fontSize: 18, fontWeight: 700, color: tc.navy }}>Operacions Mercats Públics</h2>

      <div style={{ display: "flex", gap: 4, marginBottom: 24, borderBottom: `1px solid ${tc.border}` }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            style={{
              padding: "8px 16px", border: "none", borderBottom: `2px solid ${activeTab === t.id ? tc.green : "transparent"}`,
              background: "transparent", cursor: "pointer", fontSize: 13, fontWeight: activeTab === t.id ? 700 : 400,
              color: activeTab === t.id ? tc.navy : tc.textMid, fontFamily: "inherit", marginBottom: -1,
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === "transactions" && <TransactionsTab />}
      {activeTab === "meta"         && <MetadataTab />}
      {activeTab === "ter"          && <TerTab />}
      {activeTab === "overrides"    && <OverridesTab />}
      {activeTab === "monthly"      && <MonthlyTab />}
      {activeTab === "managers"     && <ManagersTab />}
    </div>
  );
}
