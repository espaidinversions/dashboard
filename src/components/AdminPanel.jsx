import React, { useState } from "react";
import { Link } from "react-router-dom";
import { ThemeContext, TC_DARK, TC_LIGHT, useTheme } from "../theme.js";
import { useAuth } from "../auth.jsx";
import AdminUsers from "./admin/AdminUsers.jsx";
import AdminActivity from "./admin/AdminActivity.jsx";
import AdminData from "./admin/AdminData.jsx";
import AdminSettings from "./admin/AdminSettings.jsx";

const NAV = [
  { id: "users",    label: "Usuaris",      icon: "👥" },
  { id: "activity", label: "Activitat",    icon: "📋" },
  { id: "data",     label: "Dades",        icon: "🗄️" },
  { id: "settings", label: "Configuració", icon: "⚙️" },
];

function AdminPanelInner() {
  const { tc } = useTheme();
  const { session } = useAuth();
  const [activeTab, setActiveTab] = useState("users");

  const token = session?.access_token;

  return (
    <div style={{ minHeight: "100vh", background: tc.bg, color: tc.text, fontFamily: "'Outfit',system-ui,sans-serif", fontSize: 14, display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ background: tc.card, borderBottom: `1px solid ${tc.border}`, padding: "12px 32px", display: "flex", alignItems: "center", gap: 16 }}>
        <Link to="/" style={{ color: tc.textLight, textDecoration: "none", fontSize: 13 }}>← Dashboard</Link>
        <span style={{ fontWeight: 700, fontSize: 16, color: tc.navy }}>Administració</span>
      </div>

      {/* Body */}
      <div style={{ display: "flex", flex: 1 }}>
        {/* Sidebar */}
        <div style={{ width: 200, background: tc.card, borderRight: `1px solid ${tc.border}`, padding: "24px 0", flexShrink: 0 }}>
          {NAV.map(n => (
            <button key={n.id} onClick={() => setActiveTab(n.id)}
              style={{
                display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "10px 24px",
                background: activeTab === n.id ? tc.bgAlt : "transparent",
                border: "none", borderLeft: `3px solid ${activeTab === n.id ? tc.green : "transparent"}`,
                cursor: "pointer", fontSize: 13, fontWeight: activeTab === n.id ? 600 : 400,
                color: activeTab === n.id ? tc.navy : tc.textMid, fontFamily: "inherit", textAlign: "left",
              }}>
              <span>{n.icon}</span>
              {n.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, padding: "32px", overflowY: "auto" }}>
          {activeTab === "users"    && <AdminUsers token={token} />}
          {activeTab === "activity" && <AdminActivity />}
          {activeTab === "data"     && <AdminData />}
          {activeTab === "settings" && <AdminSettings />}
        </div>
      </div>
    </div>
  );
}

export default function AdminPanel() {
  const [dark, setDark] = useState(() => localStorage.getItem("tc_dark") === "1");
  const tc = dark ? TC_DARK : TC_LIGHT;
  return (
    <ThemeContext.Provider value={{ tc, dark, toggle: () => setDark(d => !d) }}>
      <AdminPanelInner />
    </ThemeContext.Provider>
  );
}
