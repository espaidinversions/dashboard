import React, { useState, useEffect } from "react";
import { useTheme } from "../../theme.js";
import { useToast } from "../../toast.jsx";
import { sharedStyles } from "../SharedComponents.jsx";
import { loadAllowedDomains, saveAllowedDomains } from "./adminApi.js";

export default function AdminSettings() {
  const { tc } = useTheme();
  const { toast } = useToast();
  const [domains, setDomains] = useState([]);
  const [input, setInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        setDomains(await loadAllowedDomains());
      } catch (error) {
        toast({ message: "Error carregant configuració.", type: "error" });
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const addDomain = () => {
    const d = input.trim().toLowerCase().replace(/^@/, "");
    if (!d || domains.includes(d)) { setInput(""); return; }
    setDomains(prev => [...prev, d]);
    setInput("");
  };

  const removeDomain = (d) => setDomains(prev => prev.filter(x => x !== d));

  const handleKeyDown = (e) => {
    if (e.key === "Enter") { e.preventDefault(); addDomain(); }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveAllowedDomains(domains);
      toast({ message: "Configuració desada." });
    } catch (error) {
      toast({ message: "Error desant: " + error.message, type: "error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h2 style={{ margin: "0 0 20px", fontSize: 18, fontWeight: 700, color: tc.navy }}>Configuració</h2>

      <section style={{ ...sharedStyles.cardPad(tc, "20px 24px"), maxWidth: 500 }}>
        <h3 style={{ margin: "0 0 6px", fontSize: 14, fontWeight: 700, color: tc.navy }}>Dominis permesos</h3>
        <p style={{ margin: "0 0 16px", fontSize: 13, color: tc.textMid }}>
          Només emails d'aquests dominis podran registrar-se. Si la llista és buida, qualsevol domini és permès.
        </p>

        {loading ? <div style={{ color: tc.textLight }}>Carregant…</div> : (
          <>
            {/* Tag list */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12, minHeight: 32 }}>
              {domains.map(d => (
                <span key={d} style={{ display: "flex", alignItems: "center", gap: 5, background: tc.bgAlt, border: `1px solid ${tc.border}`, borderRadius: 5, padding: "3px 10px", fontSize: 12, color: tc.text }}>
                  {d}
                  <button onClick={() => removeDomain(d)}
                    style={{ background: "none", border: "none", cursor: "pointer", color: tc.textLight, padding: 0, fontSize: 13, lineHeight: 1 }}>×</button>
                </span>
              ))}
              {domains.length === 0 && (
                <span style={{ fontSize: 12, color: tc.textLight }}>Cap domini configurat — tots permesos.</span>
              )}
            </div>

            {/* Input */}
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown}
                placeholder="espaidinversions.com"
                style={{ flex: 1, padding: "7px 12px", borderRadius: 7, border: `1.5px solid ${tc.border}`, background: tc.bg, color: tc.text, fontSize: 13, fontFamily: "inherit" }} />
              <button onClick={addDomain}
                style={{ padding: "7px 14px", borderRadius: 7, border: "none", background: tc.navy, color: "#fff", cursor: "pointer", fontSize: 13, fontFamily: "inherit", fontWeight: 600 }}>
                Afegir
              </button>
            </div>

            <button onClick={handleSave} disabled={saving}
              style={{ padding: "8px 20px", borderRadius: 7, border: "none", background: tc.green, color: "#fff", cursor: saving ? "not-allowed" : "pointer", fontSize: 13, fontFamily: "inherit", fontWeight: 600, opacity: saving ? 0.7 : 1 }}>
              {saving ? "Desant…" : "Desar"}
            </button>
          </>
        )}
      </section>
    </div>
  );
}
