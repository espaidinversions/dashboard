import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { supabase } from "./supabase.js";

const AuthContext = createContext(null);

const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const ACTIVITY_EVENTS = ["mousemove", "keydown", "mousedown", "touchstart", "scroll"];

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined); // undefined = loading
  const idleTimerRef = useRef(null);

  useEffect(() => {
    if (!supabase) { setSession(null); return; }
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  // Session inactivity timeout — sign out after 30 min of no activity
  useEffect(() => {
    if (!session) return;

    const resetTimer = () => {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(() => {
        ["tc_rawCC","tc_fundMeta","tc_portfolioCompanies","tc_allSearchers"].forEach(k => localStorage.removeItem(k));
        supabase.auth.signOut();
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
    ["tc_rawCC","tc_fundMeta","tc_portfolioCompanies","tc_allSearchers"].forEach(k => localStorage.removeItem(k));
    return supabase.auth.signOut();
  };
  const resendConfirmation = (email) => supabase.auth.resend({ type: "signup", email });
  const resetPassword = (email) => supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + "/reset-password",
  });

  const isAdmin = session?.user?.user_metadata?.role === "admin";
  const isSuperuser = isAdmin || session?.user?.user_metadata?.role === "superuser";

  return (
    <AuthContext.Provider value={{ session, signIn, signUp, signOut, resendConfirmation, resetPassword, isSuperuser, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
