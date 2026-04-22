import React, { useState, useEffect, useCallback } from "react";
import { useTheme } from "../../theme.js";
import { useToast } from "../../toast.jsx";
import { apiFetchJson } from "../../apiClient.js";
import {
  ACCESS_LEVELS,
  ACCESS_NONE,
  ACCESS_SUPERUSER,
  ACCESS_USER,
  ALTERNATIVES_SECTION_IDS,
  buildSectionAccessMap,
  PUBLIC_MARKETS_SUBSECTION_IDS,
  REAL_ESTATE_SUBSECTION_IDS,
  TRANSACTION_SUBSECTION_IDS,
  sectionAccessMapToDeniedSections,
  TOP_LEVEL_SECTION_IDS,
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
      { id: "tx-alt", label: "Alternatives" },
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
      const permsRes = await apiFetchJson("/api/admin/user-permissions");
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
      await apiFetchJson("/api/admin/user-permissions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          sectionRoles,
          deniedSections: sectionAccessMapToDeniedSections(sectionRoles),
        }),
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
    fontSize: 10,
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
        <div style={{ background: "#FFF3E0", border: "1px solid #FFB74D", borderRadius: 8, padding: "14px 18px", marginBottom: 20, fontSize: 13 }}>
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
        <table style={{ width: "100%", borderCollapse: "collapse", background: tc.card, borderRadius: 8, overflow: "hidden" }}>
          <thead>
            <tr style={{ background: tc.bgAlt }}>
              <th style={{ ...th, minWidth: 220 }} rowSpan={2}>Usuari</th>
              <th style={thCenter} colSpan={TOP_LEVEL_SECTION_IDS.length}>Seccions principals</th>
              <th style={{ ...thCenter, borderLeft: `2px solid ${tc.border}` }} colSpan={ALTERNATIVES_SECTION_IDS.length}>Dins d'Alternatives</th>
              <th style={{ ...thCenter, borderLeft: `2px solid ${tc.border}` }} colSpan={REAL_ESTATE_SUBSECTION_IDS.length}>Dins de Real Estate</th>
              <th style={{ ...thCenter, borderLeft: `2px solid ${tc.border}` }} colSpan={PUBLIC_MARKETS_SUBSECTION_IDS.length}>Dins de Mercats Públics</th>
              <th style={{ ...thCenter, borderLeft: `2px solid ${tc.border}` }} colSpan={TRANSACTION_SUBSECTION_IDS.length}>Transaccions</th>
              <th style={th} rowSpan={2}>Desar</th>
            </tr>
            <tr style={{ background: tc.bgAlt }}>
              {SECTION_GROUPS[0].items.map((section) => <th key={section.id} style={thCenter}>{section.label}</th>)}
              {SECTION_GROUPS[1].items.map((section, index) => (
                <th key={section.id} style={{ ...thCenter, borderLeft: index === 0 ? `2px solid ${tc.border}` : undefined }}>{section.label}</th>
              ))}
              {SECTION_GROUPS[2].items.map((section, index) => (
                <th key={section.id} style={{ ...thCenter, borderLeft: index === 0 ? `2px solid ${tc.border}` : undefined }}>{section.label}</th>
              ))}
              {SECTION_GROUPS[3].items.map((section, index) => (
                <th key={section.id} style={{ ...thCenter, borderLeft: index === 0 ? `2px solid ${tc.border}` : undefined }}>{section.label}</th>
              ))}
              {SECTION_GROUPS[4].items.map((section, index) => (
                <th key={section.id} style={{ ...thCenter, borderLeft: index === 0 ? `2px solid ${tc.border}` : undefined }}>{section.label}</th>
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
            {users.map((user) => {
              const role = getRole(user);
              const isAdmin = role === "admin";
              const access = getPermissions(user);
              const isLegacySuperuser = role === "superuser";
              return (
                <tr key={user.id} style={{ background: isAdmin ? tc.bgAlt : "transparent" }}>
                  <td style={td}>
                    <div style={{ fontWeight: 500 }}>{user.email}</div>
                    <div style={{ fontSize: 11, color: tc.textLight, marginTop: 2, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      {role}
                      {isAdmin && <span style={{ marginLeft: 6, color: tc.green, fontSize: 10 }}>accés total</span>}
                      {isLegacySuperuser && <span style={{ marginLeft: 6, color: "#B45309", fontSize: 10 }}>mode legacy</span>}
                    </div>
                  </td>
                  {SECTION_GROUPS[0].items.map((section) => (
                    <td key={section.id} style={tdCenter}>
                      {isAdmin ? (
                        <span style={{ fontSize: 11, color: tc.textLight }}>Admin</span>
                      ) : (
                        <select
                          value={access[section.id] ?? ACCESS_USER}
                          onChange={(event) => setSectionLevel(user, section.id, event.target.value)}
                          style={selectStyle}
                        >
                          {ACCESS_LEVELS.map((level) => <option key={level} value={level}>{ACCESS_LABELS[level]}</option>)}
                        </select>
                      )}
                    </td>
                  ))}
                  {SECTION_GROUPS[1].items.map((section, index) => (
                    <td key={section.id} style={{ ...tdCenter, borderLeft: index === 0 ? `2px solid ${tc.border}` : undefined }}>
                      {isAdmin ? (
                        <span style={{ fontSize: 11, color: tc.textLight }}>Admin</span>
                      ) : (
                        <select
                          value={access[section.id] ?? ACCESS_USER}
                          onChange={(event) => setSectionLevel(user, section.id, event.target.value)}
                          style={selectStyle}
                          disabled={access.alternatives === ACCESS_NONE}
                        >
                          {ACCESS_LEVELS.map((level) => <option key={level} value={level}>{ACCESS_LABELS[level]}</option>)}
                        </select>
                      )}
                    </td>
                  ))}
                  {SECTION_GROUPS[2].items.map((section, index) => (
                    <td key={section.id} style={{ ...tdCenter, borderLeft: index === 0 ? `2px solid ${tc.border}` : undefined }}>
                      {isAdmin ? (
                        <span style={{ fontSize: 11, color: tc.textLight }}>Admin</span>
                      ) : (
                        <select
                          value={access[section.id] ?? ACCESS_USER}
                          onChange={(event) => setSectionLevel(user, section.id, event.target.value)}
                          style={selectStyle}
                          disabled={access["real-estate"] === ACCESS_NONE}
                        >
                          {ACCESS_LEVELS.map((level) => <option key={level} value={level}>{ACCESS_LABELS[level]}</option>)}
                        </select>
                      )}
                    </td>
                  ))}
                  {SECTION_GROUPS[3].items.map((section, index) => (
                    <td key={section.id} style={{ ...tdCenter, borderLeft: index === 0 ? `2px solid ${tc.border}` : undefined }}>
                      {isAdmin ? (
                        <span style={{ fontSize: 11, color: tc.textLight }}>Admin</span>
                      ) : (
                        <select
                          value={access[section.id] ?? ACCESS_USER}
                          onChange={(event) => setSectionLevel(user, section.id, event.target.value)}
                          style={selectStyle}
                          disabled={access["mercats-publics"] === ACCESS_NONE}
                        >
                          {ACCESS_LEVELS.map((level) => <option key={level} value={level}>{ACCESS_LABELS[level]}</option>)}
                        </select>
                      )}
                    </td>
                  ))}
                  {SECTION_GROUPS[4].items.map((section, index) => (
                    <td key={section.id} style={{ ...tdCenter, borderLeft: index === 0 ? `2px solid ${tc.border}` : undefined }}>
                      {isAdmin ? (
                        <span style={{ fontSize: 11, color: tc.textLight }}>Admin</span>
                      ) : (
                        <select
                          value={access[section.id] ?? ACCESS_USER}
                          onChange={(event) => setSectionLevel(user, section.id, event.target.value)}
                          style={selectStyle}
                          disabled={section.id === "tx-alt" ? access.txlog === ACCESS_NONE : access["mp-transaccions"] === ACCESS_NONE}
                        >
                          {ACCESS_LEVELS.map((level) => <option key={level} value={level}>{ACCESS_LABELS[level]}</option>)}
                        </select>
                      )}
                    </td>
                  ))}
                  <td style={tdCenter}>
                    {isAdmin ? (
                      <span style={{ fontSize: 11, color: tc.textLight }}>—</span>
                    ) : (
                      <button
                        onClick={() => saveUser(user)}
                        disabled={saving === user.id || !!tableError}
                        style={{
                          padding: "4px 12px",
                          borderRadius: 5,
                          border: "none",
                          background: tc.green,
                          color: "#fff",
                          cursor: saving === user.id || tableError ? "not-allowed" : "pointer",
                          fontSize: 12,
                          fontWeight: 600,
                          fontFamily: "inherit",
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
