import React, { useState, useEffect, useMemo } from "react";
import { useTheme } from "../../theme.js";
import { useToast } from "../../toast.jsx";
import { sharedStyles } from "../SharedComponents.jsx";
import { loadPrivateEntities, renamePrivateEntity } from "../../db.js";

const KIND_LABELS = { company: "Empresa", vehicle: "Vehicle" };
const MATCH_COLORS = {
  manual:      { bg: "#E8EAF6", color: "#1A237E" },
  normalized:  { bg: "#E8F5E9", color: "#1B5E20" },
  workbook_id: { bg: "#FFF8E1", color: "#E65100" },
  fallback:    { bg: "#FFEBEE", color: "#B71C1C" },
};

export default function AdminEntities() {
  const { tc } = useTheme();
  const { toast } = useToast();
  const [entities, setEntities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterKind, setFilterKind] = useState("");
  const [filterMatch, setFilterMatch] = useState("");
  const [editId, setEditId] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    loadPrivateEntities()
      .then(setEntities)
      .catch(err => toast({ message: "Error carregant entitats: " + err.message, type: "error" }))
      .finally(() => setLoading(false));
  }, [toast]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return entities.filter(e => {
      if (filterKind && e.kind !== filterKind) return false;
      if (filterMatch && e.match_type !== filterMatch) return false;
      if (q && !e.canonical_name.toLowerCase().includes(q) && !e.id.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [entities, search, filterKind, filterMatch]);

  const matchTypes = useMemo(() => [...new Set(entities.map(e => e.match_type).filter(Boolean))].sort(), [entities]);

  function startEdit(entity) {
    setEditId(entity.id);
    setEditValue(entity.canonical_name);
  }

  function cancelEdit() {
    setEditId(null);
    setEditValue("");
  }

  async function saveEdit(entityId) {
    const trimmed = editValue.trim();
    if (!trimmed) return;
    setSaving(true);
    const { error } = await renamePrivateEntity(entityId, trimmed);
    setSaving(false);
    if (error) {
      toast({ message: "Error canviant el nom: " + error.message, type: "error" });
      return;
    }
    setEntities(prev => prev.map(e => e.id === entityId ? { ...e, canonical_name: trimmed } : e));
    setEditId(null);
    toast({ message: "Nom actualitzat", type: "success" });
  }

  const th = { ...sharedStyles.th(tc), padding: "9px 12px", textAlign: "left", borderBottom: `2px solid ${tc.border}`, whiteSpace: "nowrap" };
  const td = { padding: "9px 12px", borderBottom: `1px solid ${tc.border}`, fontSize: 12 };

  const fallbackCount  = entities.filter(e => e.match_type === "fallback").length;
  const vehicleCount   = entities.filter(e => e.kind === "vehicle").length;
  const companyCount   = entities.filter(e => e.kind === "company").length;

  return (
    <div>
      <h2 style={{ margin: "0 0 20px", fontSize: 18, fontWeight: 700, color: tc.navy }}>Registre d'Entitats</h2>

      {/* Summary */}
      <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
        {[
          { label: "Total",          value: entities.length },
          { label: "Vehicles",       value: vehicleCount },
          { label: "Empreses",       value: companyCount },
          { label: "Sense NIF real", value: fallbackCount, warn: fallbackCount > 0 },
        ].map((c, i) => (
          <div key={i} style={{ ...sharedStyles.cardPad(tc, "14px 18px"), borderLeft: c.warn ? `3px solid ${tc.red ?? "#d32f2f"}` : undefined }}>
            <div style={{ fontSize: 10, color: tc.textLight, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>{c.label}</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: c.warn ? (tc.red ?? "#d32f2f") : tc.navy }}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <input
          placeholder="Cerca per nom o ID…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ padding: "6px 10px", borderRadius: 6, border: `1.5px solid ${tc.border}`, background: tc.bg, color: tc.text, fontSize: 12, fontFamily: "inherit", width: 240 }}
        />
        <select value={filterKind} onChange={e => setFilterKind(e.target.value)}
          style={{ padding: "6px 10px", borderRadius: 6, border: `1.5px solid ${tc.border}`, background: tc.bg, color: tc.text, fontSize: 12, fontFamily: "inherit" }}>
          <option value="">Tots els tipus</option>
          <option value="vehicle">Vehicle</option>
          <option value="company">Empresa</option>
        </select>
        <select value={filterMatch} onChange={e => setFilterMatch(e.target.value)}
          style={{ padding: "6px 10px", borderRadius: 6, border: `1.5px solid ${tc.border}`, background: tc.bg, color: tc.text, fontSize: 12, fontFamily: "inherit" }}>
          <option value="">Tots els matchs</option>
          {matchTypes.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <span style={{ alignSelf: "center", fontSize: 12, color: tc.textLight }}>{filtered.length} entitats</span>
      </div>

      {loading && <div style={{ color: tc.textLight }}>Carregant…</div>}

      {!loading && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: tc.bgAlt }}>
                <th style={th}>ID / NIF</th>
                <th style={th}>Nom canònic</th>
                <th style={th}>Tipus</th>
                <th style={th}>Match</th>
                <th style={th}>ISIN</th>
                <th style={th}>País</th>
                <th style={{ ...th, width: 80 }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={7} style={{ padding: 32, textAlign: "center", color: tc.textLight }}>Cap resultat</td></tr>
              )}
              {filtered.map(e => {
                const isEditing = editId === e.id;
                const matchCfg = MATCH_COLORS[e.match_type] ?? {};
                return (
                  <tr key={e.id} style={{ background: isEditing ? tc.bgAlt : "transparent" }}>
                    <td style={{ ...td, fontFamily: "'DM Mono',monospace", fontSize: 11, color: tc.textLight }}>{e.id}</td>
                    <td style={td}>
                      {isEditing ? (
                        <input
                          autoFocus
                          value={editValue}
                          onChange={ev => setEditValue(ev.target.value)}
                          onKeyDown={ev => { if (ev.key === "Enter") saveEdit(e.id); if (ev.key === "Escape") cancelEdit(); }}
                          style={{ padding: "4px 8px", borderRadius: 5, border: `1.5px solid ${tc.green}`, background: tc.bg, color: tc.text, fontSize: 12, fontFamily: "inherit", width: "100%", minWidth: 200 }}
                        />
                      ) : (
                        <span style={{ fontWeight: 500 }}>{e.canonical_name}</span>
                      )}
                    </td>
                    <td style={td}>{KIND_LABELS[e.kind] ?? e.kind}</td>
                    <td style={td}>
                      <span style={{ fontSize: 10, borderRadius: 4, padding: "2px 7px", fontWeight: 600, ...matchCfg }}>{e.match_type ?? "—"}</span>
                    </td>
                    <td style={{ ...td, fontFamily: "'DM Mono',monospace", fontSize: 11, color: tc.textLight }}>{e.isin ?? "—"}</td>
                    <td style={{ ...td, color: tc.textMid }}>{e.country ?? "—"}</td>
                    <td style={{ ...td, textAlign: "right" }}>
                      {isEditing ? (
                        <span style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                          <button onClick={() => saveEdit(e.id)} disabled={saving}
                            style={{ padding: "3px 10px", borderRadius: 5, border: "none", background: tc.green, color: "#fff", cursor: "pointer", fontSize: 11, fontFamily: "inherit", fontWeight: 600 }}>
                            {saving ? "…" : "Desa"}
                          </button>
                          <button onClick={cancelEdit}
                            style={{ padding: "3px 8px", borderRadius: 5, border: `1px solid ${tc.border}`, background: "transparent", color: tc.textMid, cursor: "pointer", fontSize: 11, fontFamily: "inherit" }}>
                            ✕
                          </button>
                        </span>
                      ) : (
                        <button onClick={() => startEdit(e)}
                          style={{ padding: "3px 10px", borderRadius: 5, border: `1px solid ${tc.border}`, background: "transparent", color: tc.textMid, cursor: "pointer", fontSize: 11, fontFamily: "inherit" }}>
                          Reanomena
                        </button>
                      )}
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
