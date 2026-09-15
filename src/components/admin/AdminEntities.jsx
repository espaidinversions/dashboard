import { useMemo, useState } from "react";
import { useTheme } from "../../theme.js";
import { useToast } from "../../toast.jsx";
import { sharedStyles } from "../SharedComponents.jsx";
import { loadPrivateEntities, renamePrivateEntity, updateEntityId, updateEntityVehicleEst, updateEntityFiscalName, deleteVehicle, deleteCompanyEntity, mergePrivateEntities } from "../../db.js";
import { useDataLoader } from "../hooks/useDataLoader.js";
import { downloadSingleSheetXlsx } from "../../utils/xlsx.js";
import { CAPITAL_CALL_STRATEGY_OPTIONS } from "../../data/capitalCallStrategyModel.js";
import { dedupeKey, isMockId, KIND_LABELS, MATCH_COLORS } from "./entityDedupe.js";
import { AdminEntitiesDuplicates } from "./AdminEntitiesDuplicates.jsx";
import { AdminEntitiesDeleteDialog } from "./AdminEntitiesDeleteDialog.jsx";

export default function AdminEntities() {
  const { tc } = useTheme();
  const { toast } = useToast();
  const { data: entities = [], setData: setEntities, loading } = useDataLoader({
    deps: [toast],
    initialData: [],
    load: loadPrivateEntities,
    onError: (err) => toast({ message: "Error carregant entitats: " + err.message, type: "error" }),
  });
  const [tab, setTab] = useState("list"); // "list" | "duplicates"
  const [search, setSearch] = useState("");
  const [filterKind, setFilterKind] = useState("");
  const [filterMatch, setFilterMatch] = useState("");
  const [editId, setEditId] = useState(null);
  const [editValues, setEditValues] = useState({ name: "", entityId: "", fiscal_name: "", vehicle_est: "" });
  const [saving, setSaving] = useState(false);
  const [savingEstId, setSavingEstId] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null); // entity or null
  const [deleting, setDeleting] = useState(false);
  const [merging, setMerging] = useState(false);

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

  // Groups with 2+ entities sharing a normalized name, where at least one is a mock ID.
  const duplicateGroups = useMemo(() => {
    const groups = new Map();
    for (const e of entities) {
      const key = dedupeKey(e.canonical_name);
      if (!key) continue;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(e);
    }
    return [...groups.values()]
      .filter(g => g.length > 1 && g.some(e => isMockId(e.id)))
      .map(g => {
        const keeper = g.find(e => !isMockId(e.id)) ?? g.find(e => e.match_type !== "fallback") ?? g[0];
        const dups = g.filter(e => e !== keeper);
        return { keeper, dups };
      });
  }, [entities]);

  async function mergeGroup(keeper, dups) {
    setMerging(true);
    let anyError = false;
    for (const dup of dups) {
      const { error } = await mergePrivateEntities(dup.id, keeper.id);
      if (error) {
        toast({ message: `Error fusionant "${dup.canonical_name}": ${error.message}`, type: "error" });
        anyError = true;
      } else {
        setEntities(prev => prev.filter(e => e.id !== dup.id));
      }
    }
    setMerging(false);
    if (!anyError) toast({ message: `Fusionat correctament a "${keeper.canonical_name}"`, type: "success" });
  }

  async function mergeAllDuplicates() {
    // Snapshot before starting — entities state changes mid-loop as merges complete
    const snapshot = duplicateGroups.slice();
    setMerging(true);
    let merged = 0, errors = 0;
    const toRemove = new Set();
    for (const { keeper, dups } of snapshot) {
      for (const dup of dups) {
        const { error } = await mergePrivateEntities(dup.id, keeper.id);
        if (error) { errors++; }
        else { merged++; toRemove.add(dup.id); }
      }
    }
    if (toRemove.size > 0) setEntities(prev => prev.filter(e => !toRemove.has(e.id)));
    setMerging(false);
    toast({ message: `${merged} duplicats fusionats${errors ? `, ${errors} errors` : ""}`, type: errors ? "error" : "success" });
  }

  function startEdit(entity) {
    setEditId(entity.id);
    setEditValues({
      name: entity.canonical_name,
      entityId: entity.id,
      fiscal_name: entity.fiscal_name ?? "",
      vehicle_est: entity.vehicle_est ?? "",
    });
  }

  function cancelEdit() {
    setEditId(null);
  }

  async function saveVehicleEstInline(entityId, nextEst) {
    setSavingEstId(entityId);
    const { error } = await updateEntityVehicleEst(entityId, nextEst);
    setSavingEstId(null);
    if (error) {
      toast({ message: "Error desant tipus vehicle (tx): " + error.message, type: "error" });
      return;
    }
    setEntities((prev) => prev.map((e) => e.id === entityId ? { ...e, vehicle_est: nextEst || null } : e));
    toast({ message: "Desat", type: "success" });
  }

  async function saveEdit(originalId) {
    const name      = editValues.name.trim();
    const newId     = editValues.entityId.trim();
    const fiscalName = editValues.fiscal_name.trim();
    const vehicleEst = editValues.vehicle_est.trim();

    if (!name) { toast({ message: "El nom no pot estar buit", type: "error" }); return; }
    if (!newId) { toast({ message: "El NIF no pot estar buit", type: "error" }); return; }

    setSaving(true);
    let errors = [];

    // 1. Rename if changed
    const origEntity = entities.find(e => e.id === originalId);
    if (origEntity && name !== origEntity.canonical_name) {
      const { error } = await renamePrivateEntity(originalId, name);
      if (error) errors.push("Nom: " + error.message);
      else setEntities(prev => prev.map(e => e.id === originalId ? { ...e, canonical_name: name } : e));
    }

    // 2. Update fiscal name if changed
    if (origEntity && fiscalName !== (origEntity.fiscal_name ?? "")) {
      const { error } = await updateEntityFiscalName(originalId, fiscalName);
      if (error) errors.push("Nom fiscal: " + error.message);
      else setEntities(prev => prev.map(e => e.id === originalId ? { ...e, fiscal_name: fiscalName || null } : e));
    }

    // 2.5 Update per-entity transaction strategy override if changed
    if (origEntity && vehicleEst !== String(origEntity.vehicle_est ?? "")) {
      const { error } = await updateEntityVehicleEst(originalId, vehicleEst);
      if (error) errors.push("Tipus de vehicle (tx): " + error.message);
      else setEntities(prev => prev.map(e => e.id === originalId ? { ...e, vehicle_est: vehicleEst || null } : e));
    }

    // 3. Update id (NIF) last — changes the key used for lookups above
    if (newId !== originalId) {
      const { error } = await updateEntityId(originalId, newId);
      if (error) errors.push("NIF: " + error.message);
      else setEntities(prev => prev.map(e => e.id === originalId ? { ...e, id: newId } : e));
    }

    setSaving(false);
    if (errors.length > 0) {
      toast({ message: "Errors: " + errors.join("; "), type: "error" });
    } else {
      toast({ message: "Desat", type: "success" });
      setEditId(null);
    }
  }

  async function confirmAndDelete() {
    if (!confirmDelete) return;
    setDeleting(true);
    const { error } = confirmDelete.kind === "company"
      ? await deleteCompanyEntity(confirmDelete.id)
      : await deleteVehicle(confirmDelete.id);
    setDeleting(false);
    if (error) {
      toast({ message: "Error eliminant: " + error.message, type: "error" });
    } else {
      setEntities(prev => prev.filter(e => e.id !== confirmDelete.id));
      const label = confirmDelete.kind === "company" ? "Empresa" : "Vehicle";
      toast({ message: `${label} "${confirmDelete.canonical_name}" eliminat`, type: "success" });
    }
    setConfirmDelete(null);
  }

  async function exportXlsx() {
    const rows = entities.map(e => ({
      id:             e.id,
      canonical_name: e.canonical_name,
      fiscal_name:    e.fiscal_name ?? "",
      kind:           e.kind,
      match_type:     e.match_type ?? "",
      nif:            e.nif ?? "",
      vehicle_est:    e.vehicle_est ?? "",
      isin:           e.isin ?? "",
      country:        e.country ?? "",
    }));
    await downloadSingleSheetXlsx({
      sheetName: "Entitats",
      filename: "entitats.xlsx",
      columns: [
        { header: "id",             key: "id",             width: 40 },
        { header: "canonical_name", key: "canonical_name", width: 40 },
        { header: "fiscal_name",    key: "fiscal_name",    width: 40 },
        { header: "kind",           key: "kind",           width: 10 },
        { header: "match_type",     key: "match_type",     width: 12 },
        { header: "nif",            key: "nif",            width: 16 },
        { header: "vehicle_est",    key: "vehicle_est",    width: 22 },
        { header: "isin",           key: "isin",           width: 14 },
        { header: "country",        key: "country",        width: 8  },
      ],
      rows,
    });
  }

  const th = { ...sharedStyles.th(tc), padding: "9px 12px", textAlign: "left", borderBottom: `2px solid ${tc.border}`, whiteSpace: "nowrap" };
  const td = { padding: "9px 12px", borderBottom: `1px solid ${tc.border}`, fontSize: 12 };

  const fallbackCount  = entities.filter(e => e.match_type === "fallback").length;
  const vehicleCount   = entities.filter(e => e.kind === "vehicle").length;
  const companyCount   = entities.filter(e => e.kind === "company").length;

  const tabStyle = (active) => ({
    padding: "6px 16px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 12, fontFamily: "inherit",
    fontWeight: active ? 700 : 400,
    background: active ? tc.navy : "transparent",
    color: active ? "#fff" : tc.textMid,
  });

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: tc.navy }}>Registre d'Entitats</h2>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <button style={tabStyle(tab === "list")} onClick={() => setTab("list")}>Llista</button>
          <button style={{ ...tabStyle(tab === "duplicates"), ...(duplicateGroups.length > 0 ? { color: tab === "duplicates" ? "#fff" : (tc.red ?? "#d32f2f"), borderColor: tc.red ?? "#d32f2f" } : {}) }}
            onClick={() => setTab("duplicates")}>
            Duplicats {duplicateGroups.length > 0 && `(${duplicateGroups.length})`}
          </button>
          <button onClick={exportXlsx} disabled={entities.length === 0}
            style={{ padding: "6px 14px", borderRadius: 6, border: `1px solid ${tc.border}`, background: "transparent", color: tc.textMid, cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>
            Exporta XLSX
          </button>
        </div>
      </div>

      {/* Summary */}
      <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
        {[
          { label: "Total",          value: entities.length },
          { label: "Vehicles",       value: vehicleCount },
          { label: "Empreses",       value: companyCount },
          { label: "Sense NIF real", value: fallbackCount, warn: fallbackCount > 0 },
        ].map((c, i) => (
          <div key={i} style={{ ...sharedStyles.cardPad(tc, "14px 18px"), borderLeft: c.warn ? `3px solid ${tc.red ?? "#d32f2f"}` : undefined }}>
            <div style={{ fontSize: 11, color: tc.textLight, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>{c.label}</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: c.warn ? (tc.red ?? "#d32f2f") : tc.navy }}>{c.value}</div>
          </div>
        ))}
      </div>

      {tab === "duplicates" && (
        <AdminEntitiesDuplicates
          tc={tc}
          duplicateGroups={duplicateGroups}
          merging={merging}
          mergeGroup={mergeGroup}
          mergeAllDuplicates={mergeAllDuplicates}
        />
      )}

      {tab === "list" && <>
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
                <th style={th}>NIF</th>
                <th style={th}>Nom canònic</th>
                <th style={th}>Nom fiscal</th>
                <th style={th}>Tipus vehicle (tx)</th>
                <th style={th}>Tipus</th>
                <th style={th}>Match</th>
                <th style={th}>ISIN</th>
                <th style={th}>País</th>
                <th style={{ ...th, width: 100 }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={9} style={{ padding: 32, textAlign: "center", color: tc.textLight }}>Cap resultat</td></tr>
              )}
              {filtered.map(e => {
                const isEditing = editId === e.id;
                const matchCfg = MATCH_COLORS[e.match_type] ?? {};
                const inputStyle = { padding: "4px 8px", borderRadius: 4, border: `1.5px solid ${tc.green}`, background: tc.bg, color: tc.text, fontSize: 12, fontFamily: "inherit" };
                return (
                  <tr key={e.id} style={{ background: isEditing ? tc.bgAlt : "transparent" }}>
                    <td style={{ ...td, fontFamily: "'DM Mono',monospace", fontSize: 11 }}>
                      {isEditing ? (
                        <input value={editValues.entityId} onChange={ev => setEditValues(v => ({ ...v, entityId: ev.target.value }))}
                          onKeyDown={ev => { if (ev.key === "Escape") cancelEdit(); }}
                          style={{ ...inputStyle, width: 140 }} />
                      ) : (
                        <span style={{ color: e.id.startsWith("MOCKNIF:") ? tc.textLight : tc.text }}>{e.id}</span>
                      )}
                    </td>
                    <td style={td}>
                      {isEditing ? (
                        <input autoFocus value={editValues.name} onChange={ev => setEditValues(v => ({ ...v, name: ev.target.value }))}
                          onKeyDown={ev => { if (ev.key === "Escape") cancelEdit(); }}
                          style={{ ...inputStyle, width: "100%", minWidth: 180 }} />
                      ) : (
                        <span style={{ fontWeight: 500 }}>{e.canonical_name}</span>
                      )}
                    </td>
                    <td style={td}>
                      {isEditing ? (
                        <input value={editValues.fiscal_name} onChange={ev => setEditValues(v => ({ ...v, fiscal_name: ev.target.value }))}
                          placeholder="Nom fiscal…"
                          onKeyDown={ev => { if (ev.key === "Escape") cancelEdit(); }}
                          style={{ ...inputStyle, width: 160 }} />
                      ) : (
                        <span style={{ color: e.fiscal_name ? tc.text : tc.textLight }}>{e.fiscal_name ?? "—"}</span>
                      )}
                    </td>
                    <td style={td}>
                      <select
                        value={isEditing ? editValues.vehicle_est : (e.vehicle_est ?? "")}
                        disabled={savingEstId === e.id}
                        onChange={(ev) => {
                          const next = ev.target.value;
                          if (isEditing) {
                            setEditValues((v) => ({ ...v, vehicle_est: next }));
                          } else {
                            void saveVehicleEstInline(e.id, next);
                          }
                        }}
                        onKeyDown={(ev) => { if (ev.key === "Escape") cancelEdit(); }}
                        style={{ ...inputStyle, width: 190, borderColor: tc.border, fontFamily: "inherit" }}
                      >
                        <option value="">(auto)</option>
                        {CAPITAL_CALL_STRATEGY_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
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
                            style={{ padding: "3px 10px", borderRadius: 4, border: "none", background: tc.green, color: "#fff", cursor: "pointer", fontSize: 11, fontFamily: "inherit", fontWeight: 600 }}>
                            {saving ? "…" : "Desa"}
                          </button>
                          <button onClick={cancelEdit}
                            style={{ padding: "3px 8px", borderRadius: 4, border: `1px solid ${tc.border}`, background: "transparent", color: tc.textMid, cursor: "pointer", fontSize: 11, fontFamily: "inherit" }}>
                            ✕
                          </button>
                        </span>
                      ) : (
                        <span style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                          <button onClick={() => startEdit(e)}
                            style={{ padding: "3px 10px", borderRadius: 4, border: `1px solid ${tc.border}`, background: "transparent", color: tc.textMid, cursor: "pointer", fontSize: 11, fontFamily: "inherit" }}>
                            Edita
                          </button>
                          <button onClick={() => setConfirmDelete(e)}
                            style={{ padding: "3px 8px", borderRadius: 4, border: `1px solid ${tc.red ?? "#d32f2f"}`, background: "transparent", color: tc.red ?? "#d32f2f", cursor: "pointer", fontSize: 11, fontFamily: "inherit" }}>
                            Elimina
                          </button>
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      </>}

      <AdminEntitiesDeleteDialog
        tc={tc}
        confirmDelete={confirmDelete}
        deleting={deleting}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={confirmAndDelete}
      />
    </div>
  );
}
