import React, { useState, useEffect, useCallback } from "react";
import { useTheme } from "../../theme.js";
import { useToast } from "../../toast.jsx";

const ROLES = ["user", "superuser", "admin"];

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("ca-ES", { day: "2-digit", month: "short", year: "numeric" });
}

export default function AdminUsers({ token }) {
  const { tc } = useTheme();
  const { toast } = useToast();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [subTab, setSubTab] = useState("active");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("user");
  const [inviting, setInviting] = useState(false);

  const getAuthHeader = () => ({ "Authorization": `Bearer ${token}`, "Content-Type": "application/json" });

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users", { headers: getAuthHeader() });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setUsers(json.users);
    } catch (e) {
      toast({ message: "Error carregant usuaris: " + e.message, type: "error" });
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const changeRole = async (id, role) => {
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: "PATCH", headers: getAuthHeader(), body: JSON.stringify({ role }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setUsers(prev => prev.map(u => u.id === id ? { ...u, user_metadata: { ...u.user_metadata, role } } : u));
      toast({ message: "Rol actualitzat." });
    } catch (e) {
      toast({ message: "Error: " + e.message, type: "error" });
    }
  };

  const deleteUser = async (id, email) => {
    if (!confirm(`Eliminar l'usuari ${email}?`)) return;
    try {
      const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE", headers: getAuthHeader() });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setUsers(prev => prev.filter(u => u.id !== id));
      toast({ message: `Usuari ${email} eliminat.` });
    } catch (e) {
      toast({ message: "Error: " + e.message, type: "error" });
    }
  };

  const approveUser = async (id) => {
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: "PATCH", headers: getAuthHeader(),
        body: JSON.stringify({ email_confirm: true }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
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
      const res = await fetch("/api/admin/users", {
        method: "POST", headers: getAuthHeader(),
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      toast({ message: `Invitació enviada a ${inviteEmail.trim()}.` });
      setInviteEmail("");
      setInviteRole("user");
    } catch (e) {
      toast({ message: "Error: " + e.message, type: "error" });
    } finally {
      setInviting(false);
    }
  };

  const active  = users.filter(u => u.email_confirmed_at);
  const pending = users.filter(u => !u.email_confirmed_at);

  const th = { padding: "9px 12px", fontSize: 10, letterSpacing: "0.09em", color: tc.textLight, textTransform: "uppercase", fontWeight: 600, textAlign: "left", borderBottom: `2px solid ${tc.border}`, whiteSpace: "nowrap" };
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
                    <select value={u.user_metadata?.role || "user"} onChange={e => changeRole(u.id, e.target.value)}
                      style={{ padding: "4px 8px", borderRadius: 5, border: `1px solid ${tc.border}`, background: tc.bg, color: tc.text, fontFamily: "inherit", fontSize: 12 }}>
                      {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </td>
                  <td style={{ ...td, fontSize: 12, color: tc.textMid }}>{formatDate(u.last_sign_in_at)}</td>
                  <td style={{ ...td, fontSize: 12, color: tc.textMid }}>{formatDate(u.created_at)}</td>
                  <td style={td}>
                    <button onClick={() => deleteUser(u.id, u.email)}
                      style={{ background: "transparent", border: `1px solid ${tc.border}`, borderRadius: 5, padding: "3px 8px", cursor: "pointer", fontSize: 11, color: "#C62828", fontFamily: "inherit" }}>
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
                      <td style={{ ...td, fontSize: 12, color: tc.textMid }}>{formatDate(u.created_at)}</td>
                      <td style={td}>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button onClick={() => approveUser(u.id)}
                            style={{ padding: "4px 10px", borderRadius: 5, border: "none", background: tc.green, color: "#fff", cursor: "pointer", fontSize: 11, fontFamily: "inherit", fontWeight: 600 }}>
                            Aprovar
                          </button>
                          <button onClick={() => deleteUser(u.id, u.email)}
                            style={{ padding: "4px 10px", borderRadius: 5, border: `1px solid ${tc.border}`, background: "transparent", color: tc.textMid, cursor: "pointer", fontSize: 11, fontFamily: "inherit" }}>
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
              style={{ width: "100%", padding: "8px 12px", borderRadius: 7, border: `1.5px solid ${tc.border}`, background: tc.bg, color: tc.text, fontSize: 13, fontFamily: "inherit", boxSizing: "border-box" }} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: tc.textLight, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>Rol</label>
            <select value={inviteRole} onChange={e => setInviteRole(e.target.value)}
              style={{ padding: "8px 12px", borderRadius: 7, border: `1.5px solid ${tc.border}`, background: tc.bg, color: tc.text, fontSize: 13, fontFamily: "inherit" }}>
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <button type="submit" disabled={inviting}
            style={{ padding: "9px 20px", borderRadius: 7, border: "none", background: tc.navy, color: "#fff", cursor: inviting ? "not-allowed" : "pointer", fontSize: 13, fontFamily: "inherit", fontWeight: 600, opacity: inviting ? 0.7 : 1, alignSelf: "flex-start" }}>
            {inviting ? "Enviant…" : "Enviar invitació"}
          </button>
        </form>
      )}
    </div>
  );
}
