import { useState } from "react";
import { useTheme } from "../../theme.js";
import { TransactionsTab } from "./pm/TransactionsTab.jsx";
import { MetadataTab } from "./pm/MetadataTab.jsx";
import { TerTab } from "./pm/TerTab.jsx";
import { OverridesTab } from "./pm/OverridesTab.jsx";
import { MonthlyTab } from "./pm/MonthlyTab.jsx";
import { ManagersTab } from "./pm/ManagersTab.jsx";

const TABS = [
  { id: "transactions", label: "Transaccions" },
  { id: "meta",         label: "Metadades"    },
  { id: "ter",          label: "TER"          },
  { id: "overrides",    label: "Overrides"    },
  { id: "monthly",      label: "Mensual"      },
  { id: "managers",     label: "Gestors"      },
];

export default function AdminPMOperations() {
  const { tc } = useTheme();
  const [activeTab, setActiveTab] = useState("transactions");

  return (
    <div>
      <h2 style={{ margin: "0 0 20px", fontSize: 18, fontWeight: 700, color: tc.navy }}>Operacions Mercats Públics</h2>

      <div style={{ display: "flex", gap: 4, marginBottom: 24, borderBottom: `1px solid ${tc.border}` }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            style={{
              padding: "8px 16px", border: "none", borderBottom: `2px solid ${activeTab === t.id ? tc.green : "transparent"}`,
              background: "transparent", cursor: "pointer", fontSize: 13, fontWeight: activeTab === t.id ? 700 : 400,
              color: activeTab === t.id ? tc.navy : tc.textMid, fontFamily: "inherit", marginBottom: -1,
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === "transactions" && <TransactionsTab />}
      {activeTab === "meta"         && <MetadataTab />}
      {activeTab === "ter"          && <TerTab />}
      {activeTab === "overrides"    && <OverridesTab />}
      {activeTab === "monthly"      && <MonthlyTab />}
      {activeTab === "managers"     && <ManagersTab />}
    </div>
  );
}
