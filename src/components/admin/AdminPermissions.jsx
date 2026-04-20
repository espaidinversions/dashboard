import React, { useState, useEffect, useCallback } from "react";
import { useTheme } from "../../theme.js";
import { useToast } from "../../toast.jsx";
import { apiFetchJson } from "../../apiClient.js";

// Top-level sections and supra-sections within Alternatives
const SECTION_GROUPS = [
  {
    groupLabel: "Seccions principals",
    items: [
      { id: "alternatives",   label: "Alternatives" },
      { id: "real-estate",    label: "Real Estate" },
      { id: "mercats-publics", label: "Mercats Públics" },
    ],
  },
  {
    groupLabel: "Dins d'Alternatives",
    items: [
      { id: "fons",       label: "Fons" },
      { id: "searchers",  label: "Searchers" },
      { id: "companies",  label: "Participades" },
      { id: "inversions", label: "Llistat d'Inversions" },
      { id: "txlog",      label: "Transaccions" },
    ],
  },
];

const ALL_SECTIONS = SECTION_GROUPS.flatMap(g => g.items);

export default function AdminPermissions() {
  const { tc } = useTheme();
  const { toast } = useToast();
  const [users, setUsers]         = useState([]);
  const [perms, setPerms]         = useState({});   // userId → Set of denied sections
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(null);
  const [tableError, setTableError] = useState(null);
  const [applying, setApplying]   = useState(false);
  const [migrationSql, setMigrationSql] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setTableError(null);
    try {
      const usersRes = await apiFetchJson("/api/admin/users?pageSize=100");
      setUsers(usersRes.users ?? []);
    } catch (e) {
      toast({ message: "Error carregant usuaris: " + e.message, type: "error" });
    }
    try {
      const permsRes = await apiFetchJson("/api/admin/user-permissions");
      const map = {};
      for (const row of permsRes.permissions ?? []) {
        map[row.user_id] = new Set(row.denied_sections ?? []);
      }
      setPerms(map);
    } catch (e) {
      setTableError(e.message);
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => { loadData(); }, [loadData]);

  const getDenied = (userId) => perms[userId] ?? new Set();

  const toggle = (userId, sectionId) => {
    setPerms(prev => {
      const current = new Set(prev[userId] ?? []);
      if (current.has(sectionId)) current.delete(sectionId);
      else current.add(sectionId);
      return { ...prev, [userId]: current };
    });
  };

  const applyMigration = async () => {
    setApplying(true);
    try {
      const data = await apiFetchJson("/api/admin/user-permissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "apply-migration" }),
      });
      if (data.ok) {
        toast({ message: "Migració aplicada. Recarregant…" });
        setTableError(null);
        setMigrationSql(null);
        await loadData();
      } else {
        setMigrationSql(data.sql ?? null);
        toast({ message: "Cal aplicar el SQL manualment. Copia'l de la caixa de sota.", type: "error" });
      }
    } catch (e) {
      toast({ message: "Error: " + e.message, type: "error" });
    } finally {
      setApplying(false);
    }
  };

  const saveUser = async (userId) => {
    setSaving(userId);
    try {
      const denied = Array.from(getDenied(userId));
      await apiFetchJson("/api/admin/user-permissions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, deniedSections: denied }),
      });
      toast({ message: "Permisos guardats." });
    } catch (e) {
      toast({ message: "Error guardant permisos: " + e.message, type: "error" });
    } finally {
      setSaving(null);
    }
  };

  const th = {
    padding: "7px 12px", textAlign: "left", fontSize: 10,
    fontWeight: 600, color: tc.textLight, textTransform: "uppercase",
    letterSpacing: "0.05em", borderBottom: `1px solid ${tc.border}`,
    whiteSpace: "nowrap",
  };
  const thCenter = { ...th, textAlign: "center" };
  const td = {
    padding: "10px 12px", borderBottom: `1px solid ${tc.border}`,
    fontSize: 13, color: tc.text, verticalAlign: "middle",
  };
  const tdCenter = { ...td, textAlign: "center" };

  const groupHeaderStyle = (colSpan) => ({
    padding: "5px 12px", fontSize: 10, fontWeight: 700,
    textTransform: "uppercase", letterSpacing: "0.07em",
    color: tc.textLight, background: tc.bgAlt,
    borderBottom: `1px solid ${tc.border}`,
  });

  if (loading) {
    return (
      <div style={{ color: tc.textLight, padding: 32, textAlign: "center" }}>
        Carregant permisos…
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: tc.navy }}>Permisos per Secció</div>
        <div style={{ fontSize: 13, color: tc.textLight, marginTop: 4 }}>
          Desmarcar oculta la secció a l'usuari. Superusers amb accés parcial veuen i editen només les seves seccions.
          Admins veuen tot sempre i no es poden restringir.
        </div>
      </div>

      {tableError && (
        <div style={{ background: "#FFF3E0", border: "1px solid #FFB74D", borderRadius: 8, padding: "14px 18px", marginBottom: 20, fontSize: 13 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
            <div>
              <strong>Cal crear la taula user_permissions a Supabase.</strong>
              <div style={{ marginTop: 4, color: "#5D4037", fontSize: 12 }}>Error: {tableError}</div>
            </div>
            <button
              onClick={applyMigration}
              disabled={applying}
              style={{ padding: "8px 16px", borderRadius: 6, border: "none", background: "#E65100", color: "#fff", cursor: applying ? "not-allowed" : "pointer", fontSize: 12, fontWeight: 700, fontFamily: "inherit", whiteSpace: "nowrap", opacity: applying ? 0.7 : 1, flexShrink: 0 }}
            >
              {applying ? "Aplicant…" : "Aplica Migració"}
            </button>
          </div>
          {migrationSql && (
            <>
              <div style={{ marginTop: 10, fontSize: 12, color: "#BF360C" }}>
                La migració automàtica no és disponible. Copia i executa aquest SQL a <strong>Supabase Dashboard → SQL Editor</strong>:
              </div>
              <pre style={{ marginTop: 8, background: "#F5F5F5", padding: 12, borderRadius: 6, fontSize: 11, overflowX: "auto", userSelect: "all" }}>{migrationSql}</pre>
            </>
          )}
        </div>
      )}

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", background: tc.card, borderRadius: 8, overflow: "hidden" }}>
          <thead>
            {/* Group header row */}
            <tr style={{ background: tc.bgAlt }}>
              <th style={{ ...th, minWidth: 220 }} rowSpan={2}>Usuari</th>
              <th style={groupHeaderStyle()} colSpan={SECTION_GROUPS[0].items.length}>
                Seccions principals
              </th>
              <th style={{ ...groupHeaderStyle(), borderLeft: `2px solid ${tc.border}` }} colSpan={SECTION_GROUPS[1].items.length}>
                Dins d'Alternatives
              </th>
              <th style={th} rowSpan={2}>Desar</th>
            </tr>
            <tr style={{ background: tc.bgAlt }}>
              {SECTION_GROUPS[0].items.map(s => (
                <th key={s.id} style={thCenter}>{s.label}</th>
              ))}
              {SECTION_GROUPS[1].items.map((s, i) => (
                <th key={s.id} style={{ ...thCenter, borderLeft: i === 0 ? `2px solid ${tc.border}` : undefined }}>{s.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.length === 0 && (
              <tr>
                <td colSpan={ALL_SECTIONS.length + 2} style={{ ...td, textAlign: "center", color: tc.textLight }}>
                  No hi ha usuaris.
                </td>
              </tr>
            )}
            {users.map(user => {
              const role = user.app_metadata?.role ?? "user";
              const isElevated = role === "admin"; // only admins are fully locked
              const denied = getDenied(user.id);
              return (
                <tr key={user.id} style={{ background: isElevated ? tc.bgAlt : "transparent" }}>
                  <td style={td}>
                    <div style={{ fontWeight: 500 }}>{user.email}</div>
                    <div style={{ fontSize: 11, color: tc.textLight, marginTop: 2, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      {role}
                      {isElevated && (
                        <span style={{ marginLeft: 6, color: tc.green, fontSize: 10 }}>accés total</span>
                      )}
                      {role === "superuser" && getDenied(user.id).size > 0 && (
                        <span style={{ marginLeft: 6, color: "#B45309", fontSize: 10 }}>parcial</span>
                      )}
                    </div>
                  </td>
                  {SECTION_GROUPS[0].items.map(s => (
                    <td key={s.id} style={tdCenter}>
                      <input
                        type="checkbox"
                        checked={isElevated || !denied.has(s.id)}
                        disabled={isElevated}
                        onChange={() => toggle(user.id, s.id)}
                        style={{ width: 16, height: 16, cursor: isElevated ? "not-allowed" : "pointer", accentColor: tc.green }}
                      />
                    </td>
                  ))}
                  {SECTION_GROUPS[1].items.map((s, i) => (
                    <td key={s.id} style={{ ...tdCenter, borderLeft: i === 0 ? `2px solid ${tc.border}` : undefined }}>
                      <input
                        type="checkbox"
                        checked={isElevated || !denied.has(s.id)}
                        disabled={isElevated}
                        onChange={() => toggle(user.id, s.id)}
                        style={{ width: 16, height: 16, cursor: isElevated ? "not-allowed" : "pointer", accentColor: tc.green }}
                      />
                    </td>
                  ))}
                  <td style={tdCenter}>
                    {isElevated ? (
                      <span style={{ fontSize: 11, color: tc.textLight }}>—</span>
                    ) : (
                      <button
                        onClick={() => saveUser(user.id)}
                        disabled={saving === user.id || !!tableError}
                        style={{
                          padding: "4px 12px", borderRadius: 5, border: "none",
                          background: tc.green, color: "#fff",
                          cursor: saving === user.id || tableError ? "not-allowed" : "pointer",
                          fontSize: 12, fontWeight: 600, fontFamily: "inherit",
                          opacity: (saving === user.id || tableError) ? 0.5 : 1,
                        }}
                      >
                        {saving === user.id ? "…" : "Desar"}
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
