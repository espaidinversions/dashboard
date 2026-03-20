import React, { useState } from "react";
import { useAuth } from "../auth.jsx";

const ALLOWED_DOMAINS = ["solvicocean.com", "espaidinversions.com"];

export default function LoginPage() {
  const { signIn, signUp } = useAuth();
  const [mode,     setMode]     = useState("login"); // "login" | "register"
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [confirm,  setConfirm]  = useState("");
  const [error,    setError]    = useState(null);
  const [info,     setInfo]     = useState(null);
  const [loading,  setLoading]  = useState(false);

  const switchMode = m => { setMode(m); setError(null); setInfo(null); setConfirm(""); };

  const submit = async e => {
    e.preventDefault();
    const domain = email.split("@")[1]?.toLowerCase();
    if (!ALLOWED_DOMAINS.includes(domain)) {
      setError("Aquest domini no té accés al dashboard.");
      return;
    }
    if (mode === "register" && password !== confirm) {
      setError("Les contrasenyes no coincideixen.");
      return;
    }
    setLoading(true);
    setError(null);
    if (mode === "login") {
      const { error: err } = await signIn(email, password);
      if (err) { setError(err.message); setLoading(false); }
    } else {
      const { error: err } = await signUp(email, password);
      setLoading(false);
      if (err) { setError(err.message); }
      else { setInfo("Comprova el teu correu per confirmar el compte."); }
    }
  };

  const inp = {
    width: "100%", padding: "11px 14px", fontSize: 14,
    border: "1.5px solid #D0D8E4", borderRadius: 8,
    fontFamily: "'Outfit',system-ui,sans-serif", outline: "none",
    background: "#F8FAFB", color: "#1A2B3C", boxSizing: "border-box",
    transition: "border-color 0.15s",
  };

  return (
    <div style={{
      minHeight: "100vh", background: "#F0F4F8",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "'Outfit',system-ui,sans-serif",
    }}>
      <div style={{
        background: "#fff", borderRadius: 16, padding: "40px 40px 36px",
        width: 360, boxShadow: "0 4px 32px rgba(0,0,0,.10)",
      }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <img src="/logo.jpg" alt="Turtle Capital" style={{ height: 64, objectFit: "contain" }} />
        </div>

        {/* Mode tabs */}
        <div style={{ display: "flex", gap: 0, marginBottom: 24, border: "1.5px solid #D0D8E4", borderRadius: 8, overflow: "hidden" }}>
          {["login", "register"].map(m => (
            <button key={m} type="button" onClick={() => switchMode(m)} style={{
              flex: 1, padding: "9px 0", fontSize: 13, fontWeight: 600, border: "none",
              fontFamily: "inherit", cursor: "pointer", transition: "background 0.15s, color 0.15s",
              background: mode === m ? "#2B5070" : "#F8FAFB",
              color: mode === m ? "#fff" : "#4A5A6A",
            }}>
              {m === "login" ? "Entrar" : "Registrar-se"}
            </button>
          ))}
        </div>

        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: "#4A5A6A", letterSpacing: "0.08em", textTransform: "uppercase", display: "block", marginBottom: 6 }}>
              Correu electrònic
            </label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              required placeholder="nom@empresa.com" style={inp}
              onFocus={e => e.target.style.borderColor = "#2B5070"}
              onBlur={e => e.target.style.borderColor = "#D0D8E4"} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: "#4A5A6A", letterSpacing: "0.08em", textTransform: "uppercase", display: "block", marginBottom: 6 }}>
              Contrasenya
            </label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              required placeholder="••••••••" style={inp}
              onFocus={e => e.target.style.borderColor = "#2B5070"}
              onBlur={e => e.target.style.borderColor = "#D0D8E4"} />
          </div>
          {mode === "register" && (
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: "#4A5A6A", letterSpacing: "0.08em", textTransform: "uppercase", display: "block", marginBottom: 6 }}>
                Confirma la contrasenya
              </label>
              <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
                required placeholder="••••••••" style={inp}
                onFocus={e => e.target.style.borderColor = "#2B5070"}
                onBlur={e => e.target.style.borderColor = "#D0D8E4"} />
            </div>
          )}

          {error && (
            <div style={{ fontSize: 12, color: "#C62828", background: "#FDECEA", borderRadius: 7, padding: "9px 12px" }}>
              {error}
            </div>
          )}
          {info && (
            <div style={{ fontSize: 12, color: "#1B5E20", background: "#E8F5E9", borderRadius: 7, padding: "9px 12px" }}>
              {info}
            </div>
          )}

          <button type="submit" disabled={loading} style={{
            marginTop: 4, padding: "12px", background: "#2B5070", color: "#fff",
            border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600,
            fontFamily: "inherit", cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.7 : 1, transition: "opacity 0.15s",
          }}>
            {loading ? (mode === "login" ? "Entrant…" : "Registrant…") : (mode === "login" ? "Entrar" : "Crear compte")}
          </button>
        </form>
      </div>
    </div>
  );
}
