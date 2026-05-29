import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth.jsx";
import { apiFetchJson } from "../apiClient.js";

const DEFAULT_ALLOWED_DOMAINS = ["solvicocean.com", "espaidinversions.com"];

export default function LoginPage() {
  const { signIn, signUp, resendConfirmation, resetPassword } = useAuth();
  const navigate = useNavigate();
  const [mode,       setMode]       = useState("login"); // "login" | "register" | "forgot"
  const [email,      setEmail]      = useState("");
  const [password,   setPassword]   = useState("");
  const [confirm,    setConfirm]    = useState("");
  const [error,      setError]      = useState(null);
  const [info,       setInfo]       = useState(null);
  const [loading,    setLoading]    = useState(false);
  const [canResend,  setCanResend]  = useState(false);
  const [resendDone, setResendDone] = useState(false);
  const [allowedDomains, setAllowedDomains] = useState(DEFAULT_ALLOWED_DOMAINS);

  useEffect(() => {
    let cancelled = false;
    apiFetchJson("/api/auth-settings", {}, { auth: "none" })
      .then(data => {
        if (cancelled) return;
        if (Array.isArray(data?.allowed_domains)) setAllowedDomains(data.allowed_domains);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const switchMode = m => { setMode(m); setError(null); setInfo(null); setConfirm(""); setCanResend(false); setResendDone(false); };

  const handleResend = async () => {
    const { error: err } = await resendConfirmation(email);
    if (err) setError(err.message);
    else { setResendDone(true); setInfo("Correu de confirmació reenviat. Comprova la teva safata d'entrada."); }
  };

  const submit = async e => {
    e.preventDefault();
    setError(null);

    if (mode === "forgot") {
      setLoading(true);
      const { error: err } = await resetPassword(email);
      setLoading(false);
      if (err) setError(err.message);
      else setInfo("Si existeix un compte amb aquest correu, rebràs un enllaç per restablir la contrasenya.");
      return;
    }

    const domain = email.split("@")[1]?.toLowerCase();
    if (allowedDomains.length > 0 && !allowedDomains.includes(domain)) {
      setError("Aquest domini no té accés al dashboard.");
      return;
    }
    if (mode === "register" && password !== confirm) {
      setError("Les contrasenyes no coincideixen.");
      return;
    }
    setLoading(true);
    if (mode === "login") {
      const { error: err } = await signIn(email, password);
      if (err) {
        setLoading(false);
        if (err.message?.toLowerCase().includes("email not confirmed")) {
          setError("Encara no has confirmat el correu electrònic.");
          setCanResend(true);
        } else {
          setError(err.message);
        }
      } else {
        navigate("/");
      }
    } else {
      const { error: err } = await signUp(email, password);
      setLoading(false);
      if (err) setError(err.message);
      else { setInfo("Comprova el teu correu per confirmar el compte."); setCanResend(true); }
    }
  };

  const inp = {
    width: "100%", padding: "10px 12px", fontSize: 14,
    border: "1px solid #CFD9E4", borderRadius: 4,
    fontFamily: "'IBM Plex Sans',system-ui,sans-serif", outline: "none",
    background: "#FFFFFF", color: "#1B2A36", boxSizing: "border-box",
    transition: "border-color 0.15s, box-shadow 0.15s",
  };

  const labelStyle = {
    fontSize: 11, fontWeight: 600, color: "#5A7A90",
    letterSpacing: "0.08em", textTransform: "uppercase",
    display: "block", marginBottom: 5,
  };

  return (
    <div style={{
      minHeight: "100vh", display: "flex",
      fontFamily: "'IBM Plex Sans',system-ui,sans-serif",
    }}>
      {/* Left brand panel — hidden on narrow screens via media query in index.css */}
      <div style={{
        flex: "0 0 420px", background: "#1C3650",
        display: "flex", flexDirection: "column",
        justifyContent: "space-between",
        padding: "48px 52px",
      }}>
        <div>
          <img src="/logo.jpg" alt="Turtle Capital" style={{ height: 44, objectFit: "contain", filter: "brightness(0) invert(1)", opacity: 0.92 }} />
        </div>
        <div>
          <div style={{ fontSize: 28, fontWeight: 300, color: "rgba(255,255,255,0.92)", lineHeight: 1.3, fontFamily: "'Newsreader',Georgia,serif", letterSpacing: "-0.01em", marginBottom: 16 }}>
            Gestió d'inversions<br />privades
          </div>
          <div style={{ width: 32, height: 2, background: "#3DC83E", marginBottom: 16 }} />
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.42)", lineHeight: 1.6, fontWeight: 400 }}>
            Turtle Capital · Dashboard
          </div>
        </div>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.28)", letterSpacing: "0.04em" }}>
          © {new Date().getFullYear()} Turtle Capital
        </div>
      </div>

      {/* Right form panel */}
      <div style={{
        flex: 1, background: "#EEF2F6",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "32px 24px",
      }}>
        <div style={{
          background: "#fff", borderRadius: 6, padding: "40px 40px 36px",
          width: "100%", maxWidth: 360,
          boxShadow: "0 1px 2px rgba(15,23,42,0.05), 0 2px 8px rgba(15,23,42,0.04)",
          border: "1px solid #CFD9E4",
        }}>
          {/* Mode tabs — hidden in forgot mode */}
          {mode !== "forgot" && (
            <div style={{ display: "flex", gap: 0, marginBottom: 28, borderBottom: "1px solid #CFD9E4" }}>
              {["login", "register"].map(m => (
                <button key={m} type="button" onClick={() => switchMode(m)} style={{
                  flex: 1, padding: "10px 0", fontSize: 12, fontWeight: 600, border: "none",
                  borderBottom: mode === m ? "2px solid #3DC83E" : "2px solid transparent",
                  fontFamily: "inherit", cursor: "pointer", transition: "color 0.15s, border-color 0.15s",
                  background: "transparent", letterSpacing: "0.06em", textTransform: "uppercase",
                  color: mode === m ? "#1B2A36" : "#5A7A90",
                  marginBottom: -1,
                }}>
                  {m === "login" ? "Entrar" : "Registrar-se"}
                </button>
              ))}
            </div>
          )}

          {/* Forgot password header */}
          {mode === "forgot" && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: "#1B2A36", marginBottom: 6 }}>Restablir contrasenya</div>
              <div style={{ fontSize: 13, color: "#5A7A90", lineHeight: 1.5 }}>Introdueix el teu correu i t'enviarem un enllaç.</div>
            </div>
          )}

          <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={labelStyle}>Correu electrònic</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                required placeholder="nom@empresa.com" style={inp}
                onFocus={e => { e.target.style.borderColor = "#2B4F70"; e.target.style.boxShadow = "0 0 0 2px rgba(61,200,62,0.18)"; }}
                onBlur={e => { e.target.style.borderColor = "#CFD9E4"; e.target.style.boxShadow = "none"; }} />
            </div>

            {mode !== "forgot" && (
              <div>
                <label style={labelStyle}>Contrasenya</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                  required placeholder="••••••••" style={inp}
                  onFocus={e => { e.target.style.borderColor = "#2B4F70"; e.target.style.boxShadow = "0 0 0 2px rgba(61,200,62,0.18)"; }}
                  onBlur={e => { e.target.style.borderColor = "#CFD9E4"; e.target.style.boxShadow = "none"; }} />
              </div>
            )}

            {mode === "register" && (
              <div>
                <label style={labelStyle}>Confirma la contrasenya</label>
                <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
                  required placeholder="••••••••" style={inp}
                  onFocus={e => { e.target.style.borderColor = "#2B4F70"; e.target.style.boxShadow = "0 0 0 2px rgba(61,200,62,0.18)"; }}
                  onBlur={e => { e.target.style.borderColor = "#CFD9E4"; e.target.style.boxShadow = "none"; }} />
              </div>
            )}

            {error && (
              <div style={{ fontSize: 12, color: "#B52020", background: "#FAEAEA", borderRadius: 4, padding: "9px 12px", borderLeft: "3px solid #B52020" }}>
                {error}
              </div>
            )}
            {info && (
              <div style={{ fontSize: 12, color: "#1B5E20", background: "#E8F5E9", borderRadius: 4, padding: "9px 12px", borderLeft: "3px solid #3DC83E" }}>
                {info}
              </div>
            )}

            {canResend && !resendDone && (
              <button type="button" onClick={handleResend} style={{
                background: "none", border: "none", padding: 0, fontSize: 12,
                color: "#2B4F70", textDecoration: "underline", cursor: "pointer",
                fontFamily: "inherit", textAlign: "left",
              }}>
                Reenviar correu de confirmació
              </button>
            )}

            <button type="submit" disabled={loading} style={{
              marginTop: 4, padding: "11px 16px", background: "#2B4F70", color: "#fff",
              border: "none", borderRadius: 4, fontSize: 13, fontWeight: 600,
              fontFamily: "inherit", cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1, transition: "opacity 0.15s, filter 0.15s",
              letterSpacing: "0.03em",
            }}>
              {loading
                ? (mode === "login" ? "Entrant…" : mode === "register" ? "Registrant…" : "Enviant…")
                : (mode === "login" ? "Entrar" : mode === "register" ? "Crear compte" : "Enviar enllaç")}
            </button>

            {mode === "login" && (
              <button type="button" onClick={() => switchMode("forgot")} style={{
                background: "none", border: "none", padding: 0, fontSize: 12,
                color: "#5A7A90", textDecoration: "underline", cursor: "pointer",
                fontFamily: "inherit", textAlign: "center",
              }}>
                Heu oblidat la contrasenya?
              </button>
            )}

            {mode === "forgot" && (
              <button type="button" onClick={() => switchMode("login")} style={{
                background: "none", border: "none", padding: 0, fontSize: 12,
                color: "#5A7A90", textDecoration: "underline", cursor: "pointer",
                fontFamily: "inherit", textAlign: "center",
              }}>
                Tornar a l'inici de sessió
              </button>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
