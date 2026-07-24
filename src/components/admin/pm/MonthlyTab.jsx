import { useCallback, useEffect, useMemo, useState } from "react";
import { useTheme } from "../../../theme.js";
import { useToast } from "../../../toast.jsx";
import { sharedStyles } from "../../SharedComponents.jsx";
import { deletePMMonthlyRow, loadPMMonthlySeriesResult, upsertPMMonthlyRow } from "../../../db.js";
import { PM_MONTHLY_STATIC, mergePmMonthly } from "../../hooks/usePmMonthly.js";
import { InlineInput } from "./InlineInput.jsx";

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

export function MonthlyTab() {
  const { tc } = useTheme();
  const { toast } = useToast();
  const [liveRows, setLiveRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving]   = useState(false);
  const [draft, setDraft] = useState(MONTHLY_EMPTY_DRAFT);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await loadPMMonthlySeriesResult();
    if (error) toast({ message: "Error carregant mesos: " + error.message, type: "error" });
    setLiveRows(data);
    setLoading(false);
  }, [toast]);

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


