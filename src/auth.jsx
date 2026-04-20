import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { supabase } from "./supabase.js";
import { clearTurtleCapitalLS } from "./utils.js";

const AuthContext = createContext(null);

const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const ACTIVITY_EVENTS = ["mousemove", "keydown", "mousedown", "touchstart", "scroll"];

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined); // undefined = loading
  const [role, setRole] = useState("user");
  const [deniedSections, setDeniedSections] = useState([]);
  const idleTimerRef = useRef(null);

  useEffect(() => {
    if (!supabase) {
      setSession(null);
      setRole("user");
      return;
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s ?? null);
      setRole(s?.user?.app_metadata?.role ?? "user");
      if (!s) setDeniedSections([]);
    });

    return () => subscription.unsubscribe();
  }, []);

  // After session is established, fetch the server-side user to get the current
  // app_metadata.role — the cached JWT may predate when the role was assigned.
  // getUser() makes a real network call and never triggers auth events (no loop).
  useEffect(() => {
    if (!session || !supabase) return;
    supabase.auth.getUser()
      .then(({ data: { user } }) => {
        if (user?.app_metadata?.role) setRole(user.app_metadata.role);
      })
      .catch(() => {});
  }, [session]);

  // Load per-user section permissions after session is ready.
  const fetchPermissions = useCallback((token) => {
    fetch("/api/admin/user-permissions", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.deniedSections) setDeniedSections(data.deniedSections); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!session || !supabase) return;
    fetchPermissions(session.access_token);
    const handleVisibility = () => {
      if (document.visibilityState === "visible") fetchPermissions(session.access_token);
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [session, fetchPermissions]);

  // Session inactivity timeout — sign out after 30 min of no activity
  useEffect(() => {
    if (!session) return;

    const resetTimer = () => {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(() => {
        clearTurtleCapitalLS();
        supabase.auth.signOut({ scope: "global" });
      }, IDLE_TIMEOUT_MS);
    };

    resetTimer();
    ACTIVITY_EVENTS.forEach(e => window.addEventListener(e, resetTimer, { passive: true }));
    return () => {
      clearTimeout(idleTimerRef.current);
      ACTIVITY_EVENTS.forEach(e => window.removeEventListener(e, resetTimer));
    };
  }, [session]);

  const signIn  = (email, password) => supabase.auth.signInWithPassword({ email, password });
  const signUp  = (email, password) => supabase.auth.signUp({ email, password });
  const signOut = () => {
    clearTurtleCapitalLS();
    return supabase.auth.signOut({ scope: "global" });
  };
  const resendConfirmation = (email) => supabase.auth.resend({ type: "signup", email });
  const resetPassword = (email) => supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + "/reset-password",
  });

  const isAdmin = role === "admin";
  const isSuperuser = role === "superuser";
  const canEdit = role === "admin" || role === "superuser";
  const isElevated = canEdit;

  return (
    <AuthContext.Provider value={{ session, signIn, signUp, signOut, resendConfirmation, resetPassword, role, isSuperuser, isAdmin, isElevated, canEdit, deniedSections }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
