import { sharedStyles } from "../SharedComponents.jsx";
import { MATCH_COLORS } from "./entityDedupe.js";

export function AdminEntitiesDuplicates({ tc, duplicateGroups, merging, mergeGroup, mergeAllDuplicates }) {
  return (
    <div>
      {duplicateGroups.length === 0 ? (
        <div style={{ color: tc.textLight, padding: 32, textAlign: "center" }}>Cap duplicat detectat.</div>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <span style={{ fontSize: 13, color: tc.text }}>{duplicateGroups.length} grup{duplicateGroups.length !== 1 ? "s" : ""} de duplicats detectats</span>
            <button onClick={mergeAllDuplicates} disabled={merging}
              style={{ padding: "6px 16px", borderRadius: 6, border: "none", background: tc.navy, color: "#fff", cursor: "pointer", fontSize: 12, fontFamily: "inherit", fontWeight: 600 }}>
              {merging ? "Fusionant…" : "Fusiona tots"}
            </button>
          </div>
          {duplicateGroups.map(({ keeper, dups }, gi) => (
            <div key={gi} style={{ ...sharedStyles.cardPad(tc, "16px 20px"), marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, color: tc.textLight, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Grup</div>
                  {/* Keeper */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 10, borderRadius: 4, padding: "1px 6px", fontWeight: 600, background: "#E8F5E9", color: "#1B5E20" }}>✓ manté</span>
                    <span style={{ fontWeight: 600, fontSize: 13, color: tc.navy }}>{keeper.canonical_name}</span>
                    <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: tc.textLight }}>{keeper.id}</span>
                    {keeper.match_type && <span style={{ fontSize: 10, borderRadius: 4, padding: "1px 6px", fontWeight: 600, ...(MATCH_COLORS[keeper.match_type] ?? {}) }}>{keeper.match_type}</span>}
                  </div>
                  {/* Duplicates */}
                  {dups.map(dup => (
                    <div key={dup.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, opacity: 0.7 }}>
                      <span style={{ fontSize: 10, borderRadius: 4, padding: "1px 6px", fontWeight: 600, background: "#FFEBEE", color: "#B71C1C" }}>✕ elimina</span>
                      <span style={{ fontSize: 13, color: tc.text }}>{dup.canonical_name}</span>
                      <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: tc.textLight }}>{dup.id}</span>
                      {dup.match_type && <span style={{ fontSize: 10, borderRadius: 4, padding: "1px 6px", fontWeight: 600, ...(MATCH_COLORS[dup.match_type] ?? {}) }}>{dup.match_type}</span>}
                    </div>
                  ))}
                </div>
                <button onClick={() => mergeGroup(keeper, dups)} disabled={merging}
                  style={{ padding: "5px 14px", borderRadius: 6, border: "none", background: tc.navy, color: "#fff", cursor: "pointer", fontSize: 12, fontFamily: "inherit", fontWeight: 600, whiteSpace: "nowrap" }}>
                  {merging ? "…" : "Fusiona"}
                </button>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
