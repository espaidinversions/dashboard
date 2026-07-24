import { useCallback, useEffect, useState } from "react";
import { useTheme } from "../../../theme.js";
import { useToast } from "../../../toast.jsx";
import { sharedStyles } from "../../SharedComponents.jsx";
import { loadPMManagerOverridesResult, upsertPMManagerOverride } from "../../../db.js";
import { PM_MODEL } from "../../../data/publicMarketsModel.js";
import { managerOverridesFromDb } from "../../hooks/usePmMonthly.js";
import { InlineInput } from "./InlineInput.jsx";

const PM_MANAGERS_STATIC = PM_MODEL.metadata.managers;

const MANAGER_FIELDS = [
  { key: "valorActual", label: "Valor Actual €" },
  { key: "ytd",         label: "YTD %"          },
  { key: "r2025",       label: "2025 %"         },
  { key: "r2024",       label: "2024 %"         },
  { key: "rendPct",     label: "Des d'inici %"  },
];

export function ManagersTab() {
  const { tc } = useTheme();
  const { toast } = useToast();
  const [overrides, setOverrides] = useState({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await loadPMManagerOverridesResult();
    if (error) toast({ message: "Error carregant gestors: " + error.message, type: "error" });
    setOverrides(managerOverridesFromDb(data));
    setLoading(false);
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  async function save(managerId, field, value) {
    const { error } = await upsertPMManagerOverride(managerId, { [field]: value });
    if (error) { toast({ message: "Error desant: " + error.message, type: "error" }); return; }
    setOverrides(prev => ({ ...prev, [managerId]: { ...(prev[managerId] ?? {}), [field]: value } }));
    toast({ message: "Desat", type: "success" });
  }

  const th = { ...sharedStyles.th(tc), padding: "8px 10px", textAlign: "left", borderBottom: `2px solid ${tc.border}`, whiteSpace: "nowrap" };
  const td = { padding: "8px 10px", borderBottom: `1px solid ${tc.border}`, fontSize: 12 };

  return (
    <div>
      <p style={{ fontSize: 12, color: tc.textLight, margin: "0 0 12px" }}>
        Valors efectius per gestor: override de Supabase per sobre del model estàtic. Clic a una cel·la per editar.
      </p>

      {loading ? <div style={{ color: tc.textLight }}>Carregant…</div> : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: tc.bgAlt }}>
                <th style={th}>Gestor</th>
                <th style={th}>Tipus</th>
                {MANAGER_FIELDS.map(f => <th key={f.key} style={th}>{f.label}</th>)}
                <th style={th}>Notes</th>
                <th style={th}>Font</th>
              </tr>
            </thead>
            <tbody>
              {PM_MANAGERS_STATIC.map(manager => {
                const override = overrides[manager.id] ?? {};
                const hasOverride = MANAGER_FIELDS.some(f => override[f.key] != null) || override.notes != null;
                return (
                  <tr key={manager.id}>
                    <td style={{ ...td, fontWeight: 600, color: tc.navy, whiteSpace: "nowrap" }}>{manager.nom}</td>
                    <td style={td}>{manager.tipus}</td>
                    {MANAGER_FIELDS.map(f => {
                      const effective = override[f.key] ?? manager[f.key];
                      const isOverridden = override[f.key] != null;
                      return (
                        <td key={f.key} style={{ ...td, fontFamily: "'DM Mono',monospace", fontSize: 11 }}>
                          <InlineInput
                            value={effective != null ? Number(Number(effective).toFixed(4)) : null}
                            type="number"
                            onSave={v => save(manager.id, f.key, v)}
                            style={isOverridden ? { color: tc.green, fontWeight: 700 } : undefined}
                          />
                        </td>
                      );
                    })}
                    <td style={td}><InlineInput value={override.notes} onSave={v => save(manager.id, "notes", v)} style={{ width: 160 }} /></td>
                    <td style={td}>
                      <span style={{
                        fontSize: 9, padding: "2px 6px", borderRadius: 4, fontWeight: 700, letterSpacing: "0.05em",
                        background: hasOverride ? "#E8F8E8" : "#E8EFF5",
                        color: hasOverride ? tc.green : tc.navy,
                      }}>
                        {hasOverride ? "OVERRIDE" : "MODEL"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}


