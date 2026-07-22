import { useState } from "react";
import { useTheme } from "../../theme.js";
import { useToast } from "../../toast.jsx";
import { sharedStyles } from "../SharedComponents.jsx";
import { apiFetchJson } from "../../apiClient.js";
import { formatIsoDateTime } from "../../utils.js";
import { useDataLoader } from "../hooks/useDataLoader.js";

const TABLE_LABELS = {
  capital_calls:         "Capital Calls",
  portfolio_companies:   "Participades",
  searchers:             "Searchers",
  pipeline:              "Pipeline FY26",
  pm_transactions:       "PM Transaccions",
  pm_ter_overrides:      "PM TER Overrides",
  pm_position_meta:      "PM Metadades",
  pm_position_overrides: "PM Overrides",
  private_entities:      "Entitats Privades",
  audit_log:             "Registre d'Auditoria",
};

const ROLE_COLORS = {
  user:      { color: "#1B5E20", bg: "#E8F5E9" },
  admin:     { color: "#1A237E", bg: "#E8EAF6" },
  superuser: { color: "#7c3c00", bg: "#fff0e0" },
};
const ROLE_ORDER = ["user", "admin", "superuser"];

function StatCard({ label, value, sub }) {
  const { tc } = useTheme();
  return (
    <div style={sharedStyles.cardPad(tc, "14px 18px")}>
      <div style={{ fontSize: 11, color: tc.textLight, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: tc.navy }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: tc.textLight, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

export default function AdminSystem() {
  const { tc } = useTheme();
  const { toast } = useToast();
  const [purgeDays, setPurgeDays] = useState(90);
  const [purging, setPurging] = useState(false);

  const { data: status, loading, reload: load } = useDataLoader({
    deps: [toast],
    initialData: null,
    load: () => apiFetchJson("/api/admin/system-status"),
    onError: (e) => toast({ message: "Error carregant estat: " + e.message, type: "error" }),
  });

  const handlePurge = async () => {
    if (!confirm(`Eliminar tots els registres d'auditoria de fa més de ${purgeDays} dies? Aquesta acció no es pot desfer.`)) return;
    setPurging(true);
    try {
      const data = await apiFetchJson(`/api/admin/purge-audit?days=${purgeDays}`, { method: "DELETE" });
      toast({ message: `${data.deleted} registres eliminats (anteriors a ${new Date(data.cutoff).toLocaleDateString("ca-ES")}).` });
      await load();
    } catch (e) {
      toast({ message: "Error: " + e.message, type: "error" });
    } finally {
      setPurging(false);
    }
  };

  const th = { ...sharedStyles.th(tc), padding: "8px 12px", letterSpacing: "0.09em", textAlign: "left", borderBottom: `2px solid ${tc.border}` };
  const td = { padding: "9px 12px", borderBottom: `1px solid ${tc.border}`, fontSize: 13 };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: tc.navy }}>Sistema</h2>
        <button onClick={load} disabled={loading}
          style={{ padding: "6px 14px", borderRadius: 6, border: `1.5px solid ${tc.border}`, background: "transparent", color: tc.textMid, cursor: loading ? "not-allowed" : "pointer", fontSize: 12, fontFamily: "inherit", opacity: loading ? 0.5 : 1 }}>
          {loading ? "Carregant…" : "↻ Refrescar"}
        </button>
      </div>

      {loading && <div style={{ color: tc.textLight }}>Carregant…</div>}

      {!loading && status && (
        <>
          {/* User stats */}
          <h3 style={{ fontSize: 13, fontWeight: 700, color: tc.navy, margin: "0 0 12px 0", textTransform: "uppercase", letterSpacing: "0.06em" }}>Usuaris</h3>
          <div style={{ display: "flex", gap: 12, marginBottom: 28, flexWrap: "wrap" }}>
            <StatCard label="Total" value={status.users.total} />
            <StatCard label="Pendents d'aprovació" value={status.users.pending} />
            {ROLE_ORDER.map((role) => {
              const count = status.users.byRole?.[role] ?? 0;
              const cfg = ROLE_COLORS[role] ?? {};
              return (
                <div key={role} style={sharedStyles.cardPad(tc, "14px 18px")}>
                  <div style={{ fontSize: 11, color: tc.textLight, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>Rol</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 22, fontWeight: 700, color: tc.navy }}>{count}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, borderRadius: 4, padding: "2px 8px", background: cfg.bg, color: cfg.color }}>{role}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Table row counts */}
          <h3 style={{ fontSize: 13, fontWeight: 700, color: tc.navy, margin: "0 0 12px 0", textTransform: "uppercase", letterSpacing: "0.06em" }}>Taules de dades</h3>
          <div style={{ overflowX: "auto", marginBottom: 28 }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: tc.bgAlt }}>
                  <th style={th}>Taula</th>
                  <th style={{ ...th, textAlign: "right" }}>Files</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(TABLE_LABELS).map(([key, label]) => (
                  <tr key={key}>
                    <td style={td}>
                      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: tc.textMid }}>{key}</span>
                      <span style={{ marginLeft: 8, color: tc.text }}>{label}</span>
                    </td>
                    <td style={{ ...td, textAlign: "right", fontFamily: "'DM Mono', monospace", fontWeight: 700, color: tc.navy }}>
                      {status.tables[key] === null ? <span style={{ color: tc.textLight }}>—</span> : status.tables[key].toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Last activity */}
          {status.lastActivity && (
            <div style={{ marginBottom: 28, fontSize: 13, color: tc.textMid }}>
              Última activitat registrada: <strong style={{ color: tc.navy }}>{formatIsoDateTime(status.lastActivity)}</strong>
            </div>
          )}

          {/* Purge audit log */}
          <h3 style={{ fontSize: 13, fontWeight: 700, color: tc.navy, margin: "0 0 12px 0", textTransform: "uppercase", letterSpacing: "0.06em" }}>Manteniment</h3>
          <div style={{ ...sharedStyles.cardPad(tc, "16px 20px"), maxWidth: 480 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: tc.navy, marginBottom: 6 }}>Purgar registre d'auditoria</div>
            <div style={{ fontSize: 12, color: tc.textMid, marginBottom: 14, lineHeight: 1.5 }}>
              Elimina les entrades del registre d'auditoria anteriors a N dies. Acció irreversible.
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 12, color: tc.textMid }}>Eliminar entrades de fa més de</span>
              <select value={purgeDays} onChange={e => setPurgeDays(Number(e.target.value))}
                style={{ padding: "5px 8px", borderRadius: 6, border: `1.5px solid ${tc.border}`, background: tc.bg, color: tc.text, fontSize: 12, fontFamily: "inherit" }}>
                {[30, 60, 90, 180, 365].map(d => <option key={d} value={d}>{d} dies</option>)}
              </select>
              <button onClick={handlePurge} disabled={purging}
                style={{ padding: "6px 14px", borderRadius: 6, border: "none", background: "#C62828", color: "#fff", cursor: purging ? "not-allowed" : "pointer", fontSize: 12, fontFamily: "inherit", fontWeight: 600, opacity: purging ? 0.6 : 1 }}>
                {purging ? "Purgant…" : "Purgar"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
