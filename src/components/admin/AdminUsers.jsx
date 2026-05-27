import React, { useState } from "react";
import { useTheme } from "../../theme.js";
import { useToast } from "../../toast.jsx";
import { sharedStyles } from "../SharedComponents.jsx";
import { apiFetchJson } from "../../apiClient.js";
import { formatIsoDate } from "../../utils.js";
import { useAuth } from "../../auth.jsx";
import { useDataLoader } from "../hooks/useDataLoader.js";

const ROLES = ["user", "superuser", "admin"];

const ROLE_COLORS = {
  admin:     { color: "#1A237E", bg: "#E8EAF6" },
  user:      { color: "#1B5E20", bg: "#E8F5E9" },
  superuser: { color: "#7c3c00", bg: "#fff0e0" },
};

export default function AdminUsers() {
  const { tc } = useTheme();
  const { toast } = useToast();
  const { isAdmin } = useAuth();
  const [subTab, setSubTab] = useState("active");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("user");
  const [inviting, setInviting] = useState(false);
  const [page, setPage] = useState(1);

  const {
    data,
    setData,
    loading,
    reload: loadUsers,
  } = useDataLoader({
    deps: [page, toast],
    initialData: { users: [], pagination: { page: 1, pageSize: 25, total: 0, totalPages: 1 } },
    onError: (e) => toast({ message: "Error carregant usuaris: " + e.message, type: "error" }),
    load: async () => {
      const json = await apiFetchJson(`/api/admin/users?page=${page}&pageSize=25`);
      return {
        users: json.users ?? [],
        pagination: json.pagination ?? { page, pageSize: 25, total: json.users?.length ?? 0, totalPages: 1 },
      };
    },
  });

  const users = data?.users ?? [];
  const pagination = data?.pagination ?? { page: 1, pageSize: 25, total: 0, totalPages: 1 };

  const getRole = (u) => u.app_metadata?.role ?? "user";
  const userEndpoint = (id) => `/api/admin/users?id=${encodeURIComponent(id)}`;

  const changeRole = async (id, role) => {
    try {
      await apiFetchJson(userEndpoint(id), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      setData(prev => ({
        ...(prev ?? {}),
        users: (prev?.users ?? []).map(u => u.id === id ? {
          ...u,
          app_metadata: { ...u.app_metadata, role },
        } : u),
      }));
      toast({ message: "Rol actualitzat." });
    } catch (e) {
      toast({ message: "Error: " + e.message, type: "error" });
    }
  };

  const deleteUser = async (id, email) => {
    if (!confirm(`Eliminar l'usuari ${email}?`)) return;
    try {
      await apiFetchJson(userEndpoint(id), { method: "DELETE" });
      setData(prev => {
        const nextUsers = (prev?.users ?? []).filter(u => u.id !== id);
        const nextPagination = { ...(prev?.pagination ?? pagination) };
        nextPagination.total = Math.max((nextPagination.total ?? nextUsers.length) - 1, 0);
        return { ...(prev ?? {}), users: nextUsers, pagination: nextPagination };
      });
      toast({ message: `Usuari ${email} eliminat.` });
    } catch (e) {
      toast({ message: "Error: " + e.message, type: "error" });
    }
  };

  const approveUser = async (id) => {
    try {
      await apiFetchJson(userEndpoint(id), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email_confirm: true }),
      });
      await loadUsers();
      toast({ message: "Usuari aprovat." });
    } catch (e) {
      toast({ message: "Error: " + e.message, type: "error" });
    }
  };

  const handleInvite = async (e) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviting(true);
    try {
      await apiFetchJson("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });
      toast({ message: `Invitació enviada a ${inviteEmail.trim()}.` });
      setInviteEmail("");
      setInviteRole(isAdmin ? "user" : "user");
      if (page !== 1) setPage(1);
      else await loadUsers();
    } catch (e) {
      toast({ message: "Error: " + e.message, type: "error" });
    } finally {
      setInviting(false);
    }
  };

  const active  = users.filter(u => u.email_confirmed_at);
  const pending = users.filter(u => !u.email_confirmed_at);

  const th = { ...sharedStyles.th(tc), padding: "9px 12px", letterSpacing: "0.09em", textAlign: "left", borderBottom: `2px solid ${tc.border}`, whiteSpace: "nowrap" };
  const td = { padding: "10px 12px", borderBottom: `1px solid ${tc.border}` };

  return (
    <div>
      <h2 style={{ margin: "0 0 20px", fontSize: 18, fontWeight: 700, color: tc.navy }}>Usuaris</h2>

      {/* Sub-tabs */}
      <div style={{ display: "flex", gap: 0, borderBottom: `1px solid ${tc.border}`, marginBottom: 24 }}>
        {[
          { id: "active",  label: `Actius (${active.length})` },
          { id: "pending", label: `Pendents (${pending.length})` },
          { id: "invite",  label: "Convidar" },
        ].map(t => (
          <button key={t.id} onClick={() => setSubTab(t.id)}
            style={{ background: "none", border: "none", borderBottom: `2px solid ${subTab === t.id ? tc.green : "transparent"}`, padding: "8px 20px", cursor: "pointer", fontSize: 13, fontWeight: subTab === t.id ? 600 : 400, color: subTab === t.id ? tc.navy : tc.textMid, fontFamily: "inherit" }}>
            {t.label}
          </button>
        ))}
      </div>

      {loading && <div style={{ color: tc.textLight }}>Carregant…</div>}

      {/* Active users */}
      {!loading && subTab === "active" && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr style={{ background: tc.bgAlt }}>
              <th style={th}>Email</th>
              <th style={th}>Rol</th>
              <th style={th}>Últim accés</th>
              <th style={th}>Registre</th>
              <th style={{ ...th, width: 40 }}></th>
            </tr></thead>
            <tbody>
              {active.map(u => (
                <tr key={u.id}>
                  <td style={td}>{u.email}</td>
                  <td style={td}>
                    {isAdmin ? (
                      <select value={getRole(u)} onChange={e => changeRole(u.id, e.target.value)}
                        style={{ padding: "4px 8px", borderRadius: 4, border: `1px solid ${tc.border}`, background: tc.bg, color: tc.text, fontFamily: "inherit", fontSize: 12 }}>
                        {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    ) : (
                      <span style={{ fontSize: 11, fontWeight: 700, borderRadius: 4, padding: "2px 8px", ...(ROLE_COLORS[getRole(u)] ?? {}) }}>
                        {getRole(u)}
                      </span>
                    )}
                  </td>
                  <td style={{ ...td, fontSize: 12, color: tc.textMid }}>{formatIsoDate(u.last_sign_in_at)}</td>
                  <td style={{ ...td, fontSize: 12, color: tc.textMid }}>{formatIsoDate(u.created_at)}</td>
                  <td style={td}>
                    <button onClick={() => deleteUser(u.id, u.email)}
                      style={{ background: "transparent", border: `1px solid ${tc.border}`, borderRadius: 4, padding: "3px 8px", cursor: "pointer", fontSize: 11, color: "#C62828", fontFamily: "inherit" }}>
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14, color: tc.textLight, fontSize: 12 }}>
            <span>{pagination.total} usuaris</span>
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

      {/* Pending users */}
      {!loading && subTab === "pending" && (
        pending.length === 0
          ? <div style={{ color: tc.textLight }}>Cap usuari pendent de confirmació.</div>
          : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr style={{ background: tc.bgAlt }}>
                  <th style={th}>Email</th>
                  <th style={th}>Registre</th>
                  <th style={{ ...th, width: 180 }}>Accions</th>
                </tr></thead>
                <tbody>
                  {pending.map(u => (
                    <tr key={u.id}>
                      <td style={td}>{u.email}</td>
                      <td style={{ ...td, fontSize: 12, color: tc.textMid }}>{formatIsoDate(u.created_at)}</td>
                      <td style={td}>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button onClick={() => approveUser(u.id)}
                            style={{ padding: "4px 10px", borderRadius: 4, border: "none", background: tc.green, color: "#fff", cursor: "pointer", fontSize: 11, fontFamily: "inherit", fontWeight: 600 }}>
                            Aprovar
                          </button>
                          <button onClick={() => deleteUser(u.id, u.email)}
                            style={{ padding: "4px 10px", borderRadius: 4, border: `1px solid ${tc.border}`, background: "transparent", color: tc.textMid, cursor: "pointer", fontSize: 11, fontFamily: "inherit" }}>
                            Rebutjar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
      )}

      {/* Invite */}
      {subTab === "invite" && (
        <form onSubmit={handleInvite} style={{ maxWidth: 400, display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={{ fontSize: 11, color: tc.textLight, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>Email</label>
            <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} required
              placeholder="usuari@domini.com"
              style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: `1.5px solid ${tc.border}`, background: tc.bg, color: tc.text, fontSize: 13, fontFamily: "inherit", boxSizing: "border-box" }} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: tc.textLight, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>Rol</label>
            <select value={inviteRole} onChange={e => setInviteRole(e.target.value)} disabled={!isAdmin}
              style={{ padding: "8px 12px", borderRadius: 6, border: `1.5px solid ${tc.border}`, background: tc.bg, color: tc.text, fontSize: 13, fontFamily: "inherit" }}>
              {(isAdmin ? ROLES : ["user"]).map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            {!isAdmin && (
              <div style={{ marginTop: 6, fontSize: 11, color: tc.textLight }}>
                Només els admins poden assignar rols elevats.
              </div>
            )}
          </div>
          <button type="submit" disabled={inviting}
            style={{ padding: "9px 20px", borderRadius: 6, border: "none", background: tc.navy, color: "#fff", cursor: inviting ? "not-allowed" : "pointer", fontSize: 13, fontFamily: "inherit", fontWeight: 600, opacity: inviting ? 0.7 : 1, alignSelf: "flex-start" }}>
            {inviting ? "Enviant…" : "Enviar invitació"}
          </button>
        </form>
      )}
    </div>
  );
}
