import React, { useState, useEffect, useCallback } from "react";
import { useTheme } from "../../theme.js";
import { useToast } from "../../toast.jsx";
import { apiFetchJson } from "../../apiClient.js";
import { loadUserPermissions, saveUserPermissions } from "./adminApi.js";
import {
  ACCESS_LEVELS,
  ACCESS_NONE,
  ACCESS_SUPERUSER,
  ACCESS_USER,
  ALTERNATIVES_SECTION_IDS,
  buildSectionAccessMap,
  PUBLIC_MARKETS_SUBSECTION_IDS,
  REAL_ESTATE_SUBSECTION_IDS,
  sectionAccessMapToDeniedSections,
} from "../../permissions.js";

const ACCESS_LABELS = {
  [ACCESS_NONE]: "No",
  [ACCESS_USER]: "User",
  [ACCESS_SUPERUSER]: "Superuser",
};

const SECTION_GROUPS = [
  {
    groupLabel: "Seccions principals",
    items: [
      { id: "alternatives", label: "Alternatius" },
      { id: "real-estate", label: "Real Estate" },
      { id: "mercats-publics", label: "Mercats Públics" },
    ],
  },
  {
    groupLabel: "Dins d'Alternatives",
    items: [
      { id: "fons", label: "Fons" },
      { id: "searchers", label: "Searchers" },
      { id: "companies", label: "Participades" },
      { id: "inversions", label: "Llistat d'Inversions" },
      { id: "cash-model", label: "Model Caixa" },
      { id: "txlog", label: "Transaccions" },
    ],
  },
  {
    groupLabel: "Dins de Real Estate",
    items: [
      { id: "re-directe", label: "Directe" },
      { id: "re-altres", label: "Altres Vehicles" },
    ],
  },
  {
    groupLabel: "Dins de Mercats Públics",
    items: [
      { id: "mp-resum", label: "Resum" },
      { id: "mp-rv", label: "Renda Variable" },
      { id: "mp-rf", label: "Renda Fixa" },
      { id: "mp-posicions", label: "Posicions" },
      { id: "mp-transaccions", label: "Transaccions" },
      { id: "mp-traçabilitat", label: "Traçabilitat" },
    ],
  },
  {
    groupLabel: "Transaccions",
    items: [
      { id: "tx-alt", label: "Alternatius" },
      { id: "tx-re", label: "Real Estate" },
      { id: "tx-mp", label: "Mercats Públics" },
    ],
  },
];

const ALL_SECTIONS = SECTION_GROUPS.flatMap((group) => group.items);

function normalizeStoredPermissions(role, row) {
  return buildSectionAccessMap({
    role,
    sectionRoles: row?.section_roles,
    deniedSections: row?.denied_sections,
  });
}

export default function AdminPermissions() {
  const { tc } = useTheme();
  const { toast } = useToast();
  const [users, setUsers] = useState([]);
  const [perms, setPerms] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);
  const [tableError, setTableError] = useState(null);
  const [applying, setApplying] = useState(false);
  const [migrationSql, setMigrationSql] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setTableError(null);
    let loadedUsers = [];
    try {
      const usersRes = await apiFetchJson("/api/admin/users?pageSize=100");
      loadedUsers = usersRes.users ?? [];
      setUsers(loadedUsers);
    } catch (e) {
      toast({ message: "Error carregant usuaris: " + e.message, type: "error" });
    }
    try {
      const permsRes = await loadUserPermissions();
      const map = {};
      for (const row of permsRes.permissions ?? []) {
        const user = loadedUsers.find((candidate) => candidate.id === row.user_id);
        const role = user?.app_metadata?.role ?? "user";
        map[row.user_id] = normalizeStoredPermissions(role, row);
      }
      setPerms(map);
    } catch (e) {
      setTableError(e.message);
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => { loadData(); }, [loadData]);

  const getRole = (user) => user.app_metadata?.role ?? "user";
  const getPermissions = (user) => perms[user.id] ?? buildSectionAccessMap({ role: getRole(user) });

  const setSectionLevel = (user, sectionId, level) => {
    setPerms((prev) => {
      const next = { ...prev };
      const current = { ...getPermissions(user) };
      current[sectionId] = level;
      if (sectionId === "alternatives" && level === ACCESS_NONE) {
        ALTERNATIVES_SECTION_IDS.forEach((childId) => {
          current[childId] = ACCESS_NONE;
        });
      }
      if (sectionId === "real-estate" && level === ACCESS_NONE) {
        REAL_ESTATE_SUBSECTION_IDS.forEach((childId) => {
          current[childId] = ACCESS_NONE;
        });
      }
      if (sectionId === "mercats-publics" && level === ACCESS_NONE) {
        PUBLIC_MARKETS_SUBSECTION_IDS.forEach((childId) => {
          current[childId] = ACCESS_NONE;
        });
      }
      next[user.id] = current;
      return next;
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

  const saveUser = async (user) => {
    setSaving(user.id);
    try {
      const sectionRoles = getPermissions(user);
      await saveUserPermissions(user.id, {
        sectionRoles,
        deniedSections: sectionAccessMapToDeniedSections(sectionRoles),
      });
      toast({ message: "Permisos guardats." });
    } catch (e) {
      toast({ message: "Error guardant permisos: " + e.message, type: "error" });
    } finally {
      setSaving(null);
    }
  };

  const th = {
    padding: "7px 12px",
    textAlign: "left",
    fontSize: 11,
    fontWeight: 600,
    color: tc.textLight,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    borderBottom: `1px solid ${tc.border}`,
    whiteSpace: "nowrap",
  };
  const thCenter = { ...th, textAlign: "center" };
  const td = {
    padding: "10px 12px",
    borderBottom: `1px solid ${tc.border}`,
    fontSize: 13,
    color: tc.text,
    verticalAlign: "middle",
  };
  const tdCenter = { ...td, textAlign: "center" };
  const selectStyle = {
    padding: "4px 8px",
    borderRadius: 6,
    border: `1px solid ${tc.border}`,
    background: tc.bg,
    color: tc.text,
    fontSize: 12,
    fontFamily: "inherit",
  };

  if (loading) {
    return <div style={{ color: tc.textLight, padding: 32, textAlign: "center" }}>Carregant permisos…</div>;
  }

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: tc.navy }}>Permisos per Secció</div>
        <div style={{ fontSize: 13, color: tc.textLight, marginTop: 4 }}>
          Cada secció té tres nivells: <strong>No</strong>, <strong>User</strong> i <strong>Superuser</strong>.
          El rol global <strong>admin</strong> queda per sobre i sempre veu i edita tot.
        </div>
      </div>

      {tableError && (
        <div style={{ background: "#FFF3E0", border: "1px solid #FFB74D", borderRadius: 10, padding: "14px 18px", marginBottom: 20, fontSize: 13 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
            <div>
              <strong>Cal actualitzar la taula `user_permissions` a Supabase.</strong>
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
        <table style={{ width: "max-content", minWidth: "100%", borderCollapse: "collapse", background: tc.card, borderRadius: 10, overflow: "hidden" }}>
          <thead>
            <tr style={{ background: tc.bgAlt }}>
              <th style={{ ...th, minWidth: 200 }}>Secció</th>
              {users.map((user) => {
                const role = getRole(user);
                return (
                  <th key={user.id} style={{ ...thCenter, minWidth: 130 }}>
                    <div>{user.email}</div>
                    <div style={{ fontSize: 10, fontWeight: 400, marginTop: 2, textTransform: "uppercase", letterSpacing: "0.04em", color: role === "admin" ? tc.green : role === "superuser" ? "#B45309" : tc.textLight }}>
                      {role}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {users.length === 0 && (
              <tr>
                <td colSpan={2} style={{ ...td, textAlign: "center", color: tc.textLight }}>
                  No hi ha usuaris.
                </td>
              </tr>
            )}
            {SECTION_GROUPS.map((group, gi) => (
              <React.Fragment key={group.groupLabel}>
                <tr>
                  <td
                    colSpan={users.length + 1}
                    style={{ ...td, background: tc.bgAlt, fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: tc.textLight, borderTop: gi > 0 ? `2px solid ${tc.border}` : undefined }}
                  >
                    {group.groupLabel}
                  </td>
                </tr>
                {group.items.map((section) => (
                  <tr key={section.id}>
                    <td style={{ ...td, paddingLeft: 20 }}>{section.label}</td>
                    {users.map((user) => {
                      const isAdmin = getRole(user) === "admin";
                      const access = getPermissions(user);
                      const disabled =
                        gi === 1 ? access.alternatives === ACCESS_NONE
                        : gi === 2 ? access["real-estate"] === ACCESS_NONE
                        : gi === 3 ? access["mercats-publics"] === ACCESS_NONE
                        : gi === 4 ? (
                            section.id === "tx-alt" ? access.txlog === ACCESS_NONE
                            : section.id === "tx-re" ? access["real-estate"] === ACCESS_NONE
                            : access["mercats-publics"] === ACCESS_NONE
                          )
                        : false;
                      return (
                        <td key={user.id} style={tdCenter}>
                          {isAdmin ? (
                            <span style={{ fontSize: 11, color: tc.textLight }}>Admin</span>
                          ) : (
                            <select
                              value={access[section.id] ?? ACCESS_USER}
                              onChange={(e) => setSectionLevel(user, section.id, e.target.value)}
                              style={selectStyle}
                              disabled={disabled}
                            >
                              {ACCESS_LEVELS.map((level) => (
                                <option key={level} value={level}>{ACCESS_LABELS[level]}</option>
                              ))}
                            </select>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </React.Fragment>
            ))}
            <tr style={{ borderTop: `2px solid ${tc.border}` }}>
              <td style={{ ...td, background: tc.bgAlt }}></td>
              {users.map((user) => {
                const isAdmin = getRole(user) === "admin";
                return (
                  <td key={user.id} style={{ ...tdCenter, background: tc.bgAlt }}>
                    {isAdmin ? (
                      <span style={{ fontSize: 11, color: tc.textLight }}>—</span>
                    ) : (
                      <button
                        onClick={() => saveUser(user)}
                        disabled={saving === user.id || !!tableError}
                        style={{
                          padding: "4px 12px", borderRadius: 4, border: "none",
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
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
