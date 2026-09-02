import { sharedStyles } from "../SharedComponents.jsx";

export function AdminEntitiesDeleteDialog({ tc, confirmDelete, deleting, onCancel, onConfirm }) {
  if (!confirmDelete) return null;
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
      <div style={{ ...sharedStyles.cardPad(tc, "28px 32px"), maxWidth: 420, width: "90%" }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: tc.navy, marginBottom: 10 }}>
          Eliminar {confirmDelete.kind === "company" ? "empresa" : "vehicle"}?
        </div>
        <div style={{ fontSize: 13, color: tc.text, marginBottom: 8 }}>
          <strong>{confirmDelete.canonical_name}</strong>
        </div>
        <div style={{ fontSize: 12, color: tc.red ?? "#d32f2f", marginBottom: 20, lineHeight: 1.5 }}>
          {confirmDelete.kind === "company"
            ? "Atenció: s'eliminarà el registre de l'empresa i les seves dades. Aquesta acció no es pot desfer."
            : "Atenció: totes les crides de capital associades a aquest vehicle perdran la referència (vehicle_id → NULL). Aquesta acció no es pot desfer."
          }
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onCancel} disabled={deleting}
            style={{ padding: "6px 16px", borderRadius: 6, border: `1px solid ${tc.border}`, background: "transparent", color: tc.textMid, cursor: "pointer", fontSize: 13, fontFamily: "inherit" }}>
            Cancel·la
          </button>
          <button onClick={onConfirm} disabled={deleting}
            style={{ padding: "6px 16px", borderRadius: 6, border: "none", background: tc.red ?? "#d32f2f", color: "#fff", cursor: "pointer", fontSize: 13, fontFamily: "inherit", fontWeight: 600 }}>
            {deleting ? "Eliminant…" : "Elimina"}
          </button>
        </div>
      </div>
    </div>
  );
}
