import React, { useState } from "react";
import { useTheme } from "../../theme.js";
import { useToast } from "../../toast.jsx";
import { sharedStyles } from "../SharedComponents.jsx";
import { loadAuditLog, revertChange } from "./adminApi.js";
import { formatIsoDateTime } from "../../utils.js";
import { useAuth } from "../../auth.jsx";
import { useDataLoader } from "../hooks/useDataLoader.js";

function exportCsv(logs) {
  const header = ["Data", "Usuari", "Acció", "Taula", "Registre", "Canvis"];
  const rows = logs.map(l => [
    l.created_at ?? "",
    l.user_email ?? "",
    l.action ?? "",
    l.table_name ?? "",
    l.record_id ?? "",
    l.changes ? JSON.stringify(l.changes).replace(/"/g, '""') : "",
  ]);
  const csv = [header, ...rows].map(r => r.map(v => `"${v}"`).join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const ACTION_COLORS = {
  insert: { color: "#1B5E20", bg: "#E8F5E9" },
  update: { color: "#1A237E", bg: "#E8EAF6" },
  delete: { color: "#B71C1C", bg: "#FFEBEE" },
  revert: { color: "#4A148C", bg: "#F3E5F5" },
};

const REVERTABLE_TABLES = new Set(["capital_calls", "portfolio_companies", "searchers", "pipeline"]);

export default function AdminActivity() {
  const { tc } = useTheme();
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(null);
  const [reverting, setReverting] = useState(null);
  const [filterUser, setFilterUser] = useState("");
  const [filterTable, setFilterTable] = useState("");
  const [filterAction, setFilterAction] = useState("");
  const [page, setPage] = useState(1);

  const { data, setData, loading } = useDataLoader({
    deps: [page, filterUser, filterTable, filterAction, toast],
    initialData: { logs: [], pagination: { page: 1, pageSize: 50, total: 0, totalPages: 1 } },
    load: async () => {
      const result = await loadAuditLog({
        page,
        pageSize: 50,
        user: filterUser,
        table: filterTable,
        action: filterAction,
      });
      return {
        logs: result.logs ?? [],
        pagination: result.pagination ?? { page, pageSize: 50, total: result.logs?.length ?? 0, totalPages: 1 },
      };
    },
    onError: (error) => toast({ message: "Error carregant activitat: " + error.message, type: "error" }),
  });

  const logs = data?.logs ?? [];
  const pagination = data?.pagination ?? { page: 1, pageSize: 50, total: 0, totalPages: 1 };

  const handleRevert = async (logEntry) => {
    if (!confirm(`Revertir ${logEntry.action} a ${logEntry.table_name} (${logEntry.record_id})?`)) return;
    setReverting(logEntry.id);
    try {
      await revertChange(logEntry.id);
      toast({ message: "Canvi revertit correctament." });
      setData(prev => ({ ...(prev ?? {}), logs: (prev?.logs ?? []).filter(l => l.id !== logEntry.id) }));
    } catch (e) {
      toast({ message: "Error revertint: " + e.message, type: "error" });
    } finally {
      setReverting(null);
    }
  };

  const canRevert = (l) =>
    REVERTABLE_TABLES.has(l.table_name) && ["insert", "update", "delete"].includes(l.action);

  const tables = [...new Set(logs.map(l => l.table_name).filter(Boolean))];

  // Summary cards
  const today = new Date().toISOString().slice(0, 10);
  const todayCount = logs.filter(l => l.created_at?.startsWith(today)).length;
  const userCounts = {};
  logs.forEach(l => { if (l.user_email) userCounts[l.user_email] = (userCounts[l.user_email] || 0) + 1; });
  const topUser = Object.entries(userCounts).sort((a, b) => b[1] - a[1])[0];
  const tableCounts = {};
  logs.forEach(l => { if (l.table_name) tableCounts[l.table_name] = (tableCounts[l.table_name] || 0) + 1; });
  const topTable = Object.entries(tableCounts).sort((a, b) => b[1] - a[1])[0];

  const th = { ...sharedStyles.th(tc), padding: "9px 12px", letterSpacing: "0.09em", textAlign: "left", borderBottom: `2px solid ${tc.border}`, whiteSpace: "nowrap" };
  const td = { padding: "10px 12px", borderBottom: `1px solid ${tc.border}`, fontSize: 12 };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: tc.navy }}>Activitat</h2>
        <button onClick={() => exportCsv(logs)} disabled={logs.length === 0}
          style={{ padding: "6px 14px", borderRadius: 6, border: `1.5px solid ${tc.border}`, background: "transparent", color: tc.textMid, cursor: logs.length === 0 ? "not-allowed" : "pointer", fontSize: 12, fontFamily: "inherit", opacity: logs.length === 0 ? 0.5 : 1 }}>
          ↓ CSV
        </button>
      </div>

      {/* Summary cards */}
      <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
        {[
          { label: "Canvis avui",           value: todayCount },
          { label: "Usuari més actiu",       value: topUser  ? `${topUser[0]} (${topUser[1]})`   : "—" },
          { label: "Taula més modificada",   value: topTable ? `${topTable[0]} (${topTable[1]})` : "—" },
        ].map((c, i) => (
          <div key={i} style={sharedStyles.cardPad(tc, "14px 18px")}>
            <div style={{ fontSize: 11, color: tc.textLight, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>{c.label}</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: tc.navy }}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <input placeholder="Filtrar per usuari…" value={filterUser} onChange={e => { setPage(1); setFilterUser(e.target.value); }}
          style={{ padding: "6px 10px", borderRadius: 6, border: `1.5px solid ${tc.border}`, background: tc.bg, color: tc.text, fontSize: 12, fontFamily: "inherit", width: 200 }} />
        <select value={filterTable} onChange={e => { setPage(1); setFilterTable(e.target.value); }}
          style={{ padding: "6px 10px", borderRadius: 6, border: `1.5px solid ${tc.border}`, background: tc.bg, color: tc.text, fontSize: 12, fontFamily: "inherit" }}>
          <option value="">Totes les taules</option>
          {tables.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={filterAction} onChange={e => { setPage(1); setFilterAction(e.target.value); }}
          style={{ padding: "6px 10px", borderRadius: 6, border: `1.5px solid ${tc.border}`, background: tc.bg, color: tc.text, fontSize: 12, fontFamily: "inherit" }}>
          <option value="">Totes les accions</option>
          <option value="insert">Insert</option>
          <option value="update">Update</option>
          <option value="delete">Delete</option>
          <option value="revert">Revert</option>
        </select>
      </div>

      {loading && <div style={{ color: tc.textLight }}>Carregant…</div>}

      {!loading && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr style={{ background: tc.bgAlt }}>
              <th style={th}>Data</th>
              <th style={th}>Usuari</th>
              <th style={th}>Acció</th>
              <th style={th}>Taula</th>
              <th style={th}>Registre</th>
              <th style={{ ...th, width: 48 }}></th>
            </tr></thead>
            <tbody>
              {logs.length === 0 && (
                <tr><td colSpan={6} style={{ padding: 32, textAlign: "center", color: tc.textLight }}>Cap resultat</td></tr>
              )}
              {logs.map(l => {
                const cfg = ACTION_COLORS[l.action] || {};
                const isExp = expanded === l.id;
                const isReverting = reverting === l.id;
                return (
                  <React.Fragment key={l.id}>
                    <tr onClick={() => setExpanded(isExp ? null : l.id)} style={{ cursor: "pointer", background: isExp ? tc.bgAlt : "transparent" }}>
                      <td style={td}>{formatIsoDateTime(l.created_at)}</td>
                      <td style={{ ...td, color: tc.textMid }}>{l.user_email || "—"}</td>
                      <td style={td}>
                        <span style={{ fontSize: 11, borderRadius: 4, padding: "2px 8px", fontWeight: 600, background: cfg.bg, color: cfg.color }}>{l.action}</span>
                      </td>
                      <td style={td}>{l.table_name}</td>
                      <td style={td}>{l.record_id}</td>
                      <td style={{ ...td, textAlign: "right" }} onClick={e => e.stopPropagation()}>
                        {canRevert(l) && (
                          <button
                            onClick={() => handleRevert(l)}
                            disabled={isReverting}
                            title="Revertir canvi"
                            style={{ background: "transparent", border: `1px solid ${tc.border}`, borderRadius: 4, padding: "3px 7px", cursor: isReverting ? "not-allowed" : "pointer", fontSize: 12, color: "#6A1B9A", fontFamily: "inherit", opacity: isReverting ? 0.5 : 1 }}>
                            ↩
                          </button>
                        )}
                      </td>
                    </tr>
                    {isExp && l.changes && (
                      <tr style={{ background: tc.bgAlt }}>
                        <td colSpan={6} style={{ padding: "8px 12px 12px 32px" }}>
                          <pre style={{ margin: 0, fontSize: 11, color: tc.textMid, fontFamily: "'DM Mono',monospace" }}>
                            {JSON.stringify(l.changes, null, 2)}
                          </pre>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14, color: tc.textLight, fontSize: 12 }}>
            <span>{pagination.total} registres</span>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => setPage(prev => Math.max(prev - 1, 1))}
                disabled={pagination.page <= 1}
                style={{ padding: "5px 10px", borderRadius: 6, border: `1px solid ${tc.border}`, background: "transparent", color: tc.text, cursor: pagination.page <= 1 ? "not-allowed" : "pointer", opacity: pagination.page <= 1 ? 0.5 : 1, fontFamily: "inherit", fontSize: 12 }}
              >
                Anterior
              </button>
              <span style={{ alignSelf: "center" }}>Pàgina {pagination.page} / {pagination.totalPages}</span>
              <button
                onClick={() => setPage(prev => Math.min(prev + 1, pagination.totalPages))}
                disabled={pagination.page >= pagination.totalPages}
                style={{ padding: "5px 10px", borderRadius: 6, border: `1px solid ${tc.border}`, background: "transparent", color: tc.text, cursor: pagination.page >= pagination.totalPages ? "not-allowed" : "pointer", opacity: pagination.page >= pagination.totalPages ? 0.5 : 1, fontFamily: "inherit", fontSize: 12 }}
              >
                Següent
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
