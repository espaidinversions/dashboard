import React, { useState, useEffect } from "react";
import { supabase } from "../../supabase.js";
import { useTheme } from "../../theme.js";
import { useToast } from "../../toast.jsx";
import { sharedStyles } from "../SharedComponents.jsx";

const ACTION_COLORS = {
  insert: { color: "#1B5E20", bg: "#E8F5E9" },
  update: { color: "#1A237E", bg: "#E8EAF6" },
  delete: { color: "#B71C1C", bg: "#FFEBEE" },
};

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("ca-ES", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function AdminActivity() {
  const { tc } = useTheme();
  const { toast } = useToast();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [filterUser, setFilterUser] = useState("");
  const [filterTable, setFilterTable] = useState("");
  const [filterAction, setFilterAction] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data, error } = await supabase
        .from("audit_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) toast({ message: "Error carregant activitat: " + error.message, type: "error" });
      else setLogs(data ?? []);
      setLoading(false);
    }
    load();
  }, []);

  const filtered = logs.filter(l => {
    if (filterUser  && !l.user_email?.includes(filterUser)) return false;
    if (filterTable && l.table_name !== filterTable) return false;
    if (filterAction && l.action !== filterAction) return false;
    return true;
  });

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
      <h2 style={{ margin: "0 0 20px", fontSize: 18, fontWeight: 700, color: tc.navy }}>Activitat</h2>

      {/* Summary cards */}
      <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
        {[
          { label: "Canvis avui",           value: todayCount },
          { label: "Usuari més actiu",       value: topUser  ? `${topUser[0]} (${topUser[1]})`   : "—" },
          { label: "Taula més modificada",   value: topTable ? `${topTable[0]} (${topTable[1]})` : "—" },
        ].map((c, i) => (
          <div key={i} style={sharedStyles.cardPad(tc, "14px 18px")}>
            <div style={{ fontSize: 10, color: tc.textLight, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>{c.label}</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: tc.navy }}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <input placeholder="Filtrar per usuari…" value={filterUser} onChange={e => setFilterUser(e.target.value)}
          style={{ padding: "6px 10px", borderRadius: 6, border: `1.5px solid ${tc.border}`, background: tc.bg, color: tc.text, fontSize: 12, fontFamily: "inherit", width: 200 }} />
        <select value={filterTable} onChange={e => setFilterTable(e.target.value)}
          style={{ padding: "6px 10px", borderRadius: 6, border: `1.5px solid ${tc.border}`, background: tc.bg, color: tc.text, fontSize: 12, fontFamily: "inherit" }}>
          <option value="">Totes les taules</option>
          {tables.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={filterAction} onChange={e => setFilterAction(e.target.value)}
          style={{ padding: "6px 10px", borderRadius: 6, border: `1.5px solid ${tc.border}`, background: tc.bg, color: tc.text, fontSize: 12, fontFamily: "inherit" }}>
          <option value="">Totes les accions</option>
          <option value="insert">Insert</option>
          <option value="update">Update</option>
          <option value="delete">Delete</option>
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
            </tr></thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={5} style={{ padding: 32, textAlign: "center", color: tc.textLight }}>Cap resultat</td></tr>
              )}
              {filtered.map(l => {
                const cfg = ACTION_COLORS[l.action] || {};
                const isExp = expanded === l.id;
                return (
                  <React.Fragment key={l.id}>
                    <tr onClick={() => setExpanded(isExp ? null : l.id)} style={{ cursor: "pointer", background: isExp ? tc.bgAlt : "transparent" }}>
                      <td style={td}>{formatDate(l.created_at)}</td>
                      <td style={{ ...td, color: tc.textMid }}>{l.user_email || "—"}</td>
                      <td style={td}>
                        <span style={{ fontSize: 11, borderRadius: 4, padding: "2px 8px", fontWeight: 600, background: cfg.bg, color: cfg.color }}>{l.action}</span>
                      </td>
                      <td style={td}>{l.table_name}</td>
                      <td style={td}>{l.record_id}</td>
                    </tr>
                    {isExp && l.changes && (
                      <tr style={{ background: tc.bgAlt }}>
                        <td colSpan={5} style={{ padding: "8px 12px 12px 32px" }}>
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
        </div>
      )}
    </div>
  );
}
