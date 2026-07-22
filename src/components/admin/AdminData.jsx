import { useState } from "react";
import { Link } from "react-router-dom";
import { useTheme } from "../../theme.js";
import { useToast } from "../../toast.jsx";
import { clearTable } from "../../db.js";

const TABLES = [
  { key: "capital_calls",       label: "Capital Calls" },
  { key: "portfolio_companies", label: "Participades" },
  { key: "searchers",           label: "Searchers" },
  { key: "pipeline",            label: "Pipeline" },
];

export default function AdminData() {
  const { tc } = useTheme();
  const { toast } = useToast();
  const [clearing, setClearing] = useState(null);
  const [confirmText, setConfirmText] = useState("");
  const [confirmTable, setConfirmTable] = useState(null);

  const startClear = (tableKey) => {
    setConfirmTable(tableKey);
    setConfirmText("");
  };

  const handleClear = async () => {
    if (confirmText !== confirmTable) return;
    setClearing(confirmTable);
    setConfirmTable(null);
    setConfirmText("");
    const { error } = await clearTable(clearing ?? confirmTable);
    setClearing(null);
    if (error) toast({ message: "Error: " + error.message, type: "error" });
    else toast({ message: `Taula esborrada.` });
  };

  const sectionStyle = { background: tc.card, border: `1px solid ${tc.border}`, borderRadius: 10, padding: "20px 24px", marginBottom: 20 };
  const linkBtn = { display: "inline-block", padding: "8px 16px", borderRadius: 6, background: tc.navy, color: "#fff", textDecoration: "none", fontSize: 13, fontWeight: 600 };

  return (
    <div>
      <h2 style={{ margin: "0 0 20px", fontSize: 18, fontWeight: 700, color: tc.navy }}>Dades</h2>

      {/* Bulk Import */}
      <section style={sectionStyle}>
        <h3 style={{ margin: "0 0 8px", fontSize: 14, fontWeight: 700, color: tc.navy }}>Importació massiva</h3>
        <p style={{ margin: "0 0 14px", fontSize: 13, color: tc.textMid }}>
          Carrega un fitxer CSV o Excel per substituir les dades. Utilitza el carregador del Dashboard principal.
        </p>
        <Link to="/" style={linkBtn}>↑ Carregar dades (Dashboard)</Link>
      </section>

      {/* Export */}
      <section style={sectionStyle}>
        <h3 style={{ margin: "0 0 8px", fontSize: 14, fontWeight: 700, color: tc.navy }}>Exportar snapshot</h3>
        <p style={{ margin: "0 0 14px", fontSize: 13, color: tc.textMid }}>Descarrega totes les dades actuals en format Excel.</p>
        <Link to="/" style={linkBtn}>↓ Excel (Dashboard)</Link>
      </section>

      {/* Table Reset */}
      <section style={sectionStyle}>
        <h3 style={{ margin: "0 0 8px", fontSize: 14, fontWeight: 700, color: tc.navy }}>Esborrar taula</h3>
        <p style={{ margin: "0 0 14px", fontSize: 13, color: tc.textMid }}>Elimina tots els registres d'una taula. Irreversible.</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {TABLES.map(t => (
            <div key={t.key} style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 13, color: tc.text, minWidth: 180 }}>{t.label}</span>
              <button onClick={() => startClear(t.key)} disabled={clearing === t.key}
                style={{ padding: "5px 12px", borderRadius: 6, border: `1.5px solid ${tc.border}`, background: "transparent", color: "#C62828", cursor: "pointer", fontSize: 12, fontFamily: "inherit", fontWeight: 600 }}>
                {clearing === t.key ? "Esborrant…" : "Esborrar tot"}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Confirm dialog */}
      {confirmTable && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: tc.card, borderRadius: 10, padding: 28, maxWidth: 380, width: "100%", boxShadow: "0 8px 32px rgba(0,0,0,0.2)" }}>
            <h3 style={{ margin: "0 0 12px", color: tc.navy }}>Confirmar esborrament</h3>
            <p style={{ margin: "0 0 16px", fontSize: 13, color: tc.textMid }}>
              Escriu <strong>{confirmTable}</strong> per confirmar:
            </p>
            <input value={confirmText} onChange={e => setConfirmText(e.target.value)}
              placeholder={confirmTable}
              style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: `1.5px solid ${tc.border}`, background: tc.bg, color: tc.text, fontSize: 13, fontFamily: "inherit", boxSizing: "border-box", marginBottom: 16 }} />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setConfirmTable(null)}
                style={{ padding: "7px 16px", borderRadius: 6, border: `1.5px solid ${tc.border}`, background: "transparent", color: tc.textMid, cursor: "pointer", fontSize: 13, fontFamily: "inherit" }}>
                Cancel·lar
              </button>
              <button onClick={handleClear} disabled={confirmText !== confirmTable}
                style={{ padding: "7px 16px", borderRadius: 6, border: "none", background: "#C62828", color: "#fff", cursor: confirmText !== confirmTable ? "not-allowed" : "pointer", fontSize: 13, fontFamily: "inherit", fontWeight: 600, opacity: confirmText !== confirmTable ? 0.5 : 1 }}>
                Esborrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
