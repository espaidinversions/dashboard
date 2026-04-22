import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase.js";
import { useAuth } from "../auth.jsx";

export default function ResetPasswordPage() {
  const { session, clearRecovery } = useAuth();
  const navigate = useNavigate();
  const [password,  setPassword]  = useState("");
  const [confirm,   setConfirm]   = useState("");
  const [error,     setError]     = useState(null);
  const [loading,   setLoading]   = useState(false);

  // If there's no session at all (direct navigation without recovery token), send to login
  if (session === null) {
    navigate("/login", { replace: true });
    return null;
  }

  const inp = {
    width: "100%", padding: "11px 14px", fontSize: 14,
    border: "1.5px solid #D0D8E4", borderRadius: 10,
    fontFamily: "'Outfit',system-ui,sans-serif", outline: "none",
    background: "#F8FAFB", color: "#1A2B3C", boxSizing: "border-box",
    transition: "border-color 0.15s",
  };

  const submit = async e => {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Les contrasenyes no coincideixen.");
      return;
    }
    if (password.length < 8) {
      setError("La contrasenya ha de tenir almenys 8 caràcters.");
      return;
    }
    setLoading(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (err) {
      setError(err.message);
    } else {
      clearRecovery();
      navigate("/", { replace: true });
    }
  };

  return (
    <div style={{
      minHeight: "100vh", background: "#F0F4F8",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "'Outfit',system-ui,sans-serif",
    }}>
      <div style={{
        background: "#fff", borderRadius: 14, padding: "40px 40px 36px",
        width: 360, boxShadow: "0 4px 32px rgba(0,0,0,.10)",
      }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <img src="/logo.jpg" alt="Turtle Capital" style={{ height: 64, objectFit: "contain" }} />
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#1A2B3C", marginBottom: 4 }}>Establir contrasenya</div>
          <div style={{ fontSize: 13, color: "#7A8A9A" }}>Introdueix una nova contrasenya per al teu compte.</div>
        </div>

        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: "#4A5A6A", letterSpacing: "0.08em", textTransform: "uppercase", display: "block", marginBottom: 6 }}>
              Nova contrasenya
            </label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              required placeholder="••••••••" style={inp}
              onFocus={e => e.target.style.borderColor = "#2B5070"}
              onBlur={e => e.target.style.borderColor = "#D0D8E4"} />
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: "#4A5A6A", letterSpacing: "0.08em", textTransform: "uppercase", display: "block", marginBottom: 6 }}>
              Confirma la contrasenya
            </label>
            <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
              required placeholder="••••••••" style={inp}
              onFocus={e => e.target.style.borderColor = "#2B5070"}
              onBlur={e => e.target.style.borderColor = "#D0D8E4"} />
          </div>

          {error && (
            <div style={{ fontSize: 12, color: "#C62828", background: "#FDECEA", borderRadius: 6, padding: "9px 12px" }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} style={{
            marginTop: 4, padding: "12px", background: "#2B5070", color: "#fff",
            border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600,
            fontFamily: "inherit", cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.7 : 1, transition: "opacity 0.15s",
          }}>
            {loading ? "Guardant…" : "Establir contrasenya"}
          </button>
        </form>
      </div>
    </div>
  );
}
