import React, { useState } from "react";
import { Link } from "react-router-dom";
import { ThemeContext, TC_DARK, TC_LIGHT, useTheme } from "../theme.js";
import { readStoredFlag } from "../utils.js";
import { useAuth } from "../auth.jsx";
import AdminUsers from "./admin/AdminUsers.jsx";
import AdminActivity from "./admin/AdminActivity.jsx";
import AdminData from "./admin/AdminData.jsx";
import AdminSettings from "./admin/AdminSettings.jsx";
import AdminEntities from "./admin/AdminEntities.jsx";
import AdminPMOperations from "./admin/AdminPMOperations.jsx";
import AdminSystem from "./admin/AdminSystem.jsx";

const NAV_BASE = [
  { id: "users",     label: "Usuaris",      icon: "👥" },
  { id: "activity",  label: "Activitat",    icon: "📋" },
  { id: "data",      label: "Dades",        icon: "🗄️" },
  { id: "entities",  label: "Entitats",     icon: "🏢" },
  { id: "pm",        label: "PM Operacions",icon: "📈" },
  { id: "settings",  label: "Configuració", icon: "⚙️" },
];
const NAV_SUPERUSER = { id: "system", label: "Sistema", icon: "🔧" };

function AdminPanelInner() {
  const { tc } = useTheme();
  const { isAdmin } = useAuth();
  const NAV = isAdmin ? [...NAV_BASE, NAV_SUPERUSER] : NAV_BASE;
  const [activeTab, setActiveTab] = useState("users");

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
          {activeTab === "users"    && <AdminUsers />}
          {activeTab === "activity" && <AdminActivity />}
          {activeTab === "data"     && <AdminData />}
          {activeTab === "entities" && <AdminEntities />}
          {activeTab === "pm"       && <AdminPMOperations />}
          {activeTab === "settings" && <AdminSettings />}
          {activeTab === "system"   && <AdminSystem />}
        </div>
      </div>
    </div>
  );
}

export default function AdminPanel() {
  const [dark, setDark] = useState(() => readStoredFlag("tc_dark"));
  const tc = dark ? TC_DARK : TC_LIGHT;
  return (
    <ThemeContext.Provider value={{ tc, dark, toggle: () => setDark(d => !d) }}>
      <AdminPanelInner />
    </ThemeContext.Provider>
  );
}
