import React, { useRef, useState } from "react";
import { useTheme } from "../../theme.js";

export function DeleteRowButton({ onDelete }) {
  const { tc } = useTheme();
  const [confirming, setConfirming] = useState(false);
  const containerRef = useRef(null);

  const handleBlur = (e) => {
    if (!containerRef.current?.contains(e.relatedTarget)) {
      setConfirming(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Escape") setConfirming(false);
  };

  if (confirming) {
    return (
      <div ref={containerRef} tabIndex={-1} onBlur={handleBlur} onKeyDown={handleKeyDown}
        style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 11, color: tc.textMid }}>Eliminar?</span>
        <button onClick={onDelete}
          style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, border: "none",
            background: tc.red ?? "#C62828", color: "#fff", cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>
          Confirmar
        </button>
      </div>
    );
  }

  return (
    <button onClick={() => setConfirming(true)}
      className="btn-delete"
      style={{ minWidth: 58, padding: "4px 0", borderRadius: "var(--radius-sm)", border: "none", background: "#C62828", color: "#fff", cursor: "pointer", fontSize: "var(--text-xs)", fontFamily: "inherit", fontWeight: 600, textAlign: "center" }}
      title="Eliminar fila">
      Elimina
    </button>
  );
}

