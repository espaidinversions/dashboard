import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "./supabase.js";
import { clearTurtleCapitalLS } from "./utils.js";
import {
  ACCESS_SUPERUSER,
  buildSectionAccessMap,
  canAccessAnySection,
  getSectionAccessLevel,
  hasSectionAccess,
  isAdminRole,
  isLegacySuperuserRole,
  sectionAccessMapToDeniedSections,
} from "./permissions.js";

const AuthContext = createContext(null);

const IDLE_TIMEOUT_MS = 60 * 60 * 1000; // 60 minutes
const ACTIVITY_EVENTS = ["mousemove", "keydown", "mousedown", "touchstart", "scroll"];

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined); // undefined = loading
  const [role, setRole] = useState("user");
  const [rawPermissions, setRawPermissions] = useState({ sectionRoles: {}, deniedSections: [] });
  const [isRecovery, setIsRecovery] = useState(false);
  const idleTimerRef = useRef(null);

  useEffect(() => {
    if (!supabase) {
      setSession(null);
      setRole("user");
      return;
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      if (_event === "PASSWORD_RECOVERY") {
        setIsRecovery(true);
      }
      setSession(s ?? null);
      setRole(s?.user?.app_metadata?.role ?? "user");
      if (!s) { setRawPermissions({ sectionRoles: {}, deniedSections: [] }); setIsRecovery(false); }
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
      .catch((err) => console.error("[auth] getUser refresh failed:", err));
  }, [session]);

  // Load per-user section permissions after session is ready.
  // Store the raw API response; the access map is derived from it + current role in useMemo below.
  const fetchPermissions = useCallback((token) => {
    fetch("/api/admin/user-permissions", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        setRawPermissions({
          sectionRoles: data?.sectionRoles ?? {},
          deniedSections: data?.deniedSections ?? [],
        });
      })
      .catch((err) => console.error("[auth] fetchPermissions failed:", err));
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

  // Session inactivity timeout — sign out after 60 min of no activity
  const debounceTimerRef = useRef(null);
  useEffect(() => {
    if (!session) return;

    const resetTimer = () => {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(() => {
        clearTurtleCapitalLS();
        supabase.auth.signOut({ scope: "global" });
      }, IDLE_TIMEOUT_MS);
    };

    const debouncedReset = () => {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(resetTimer, 250);
    };

    resetTimer();
    ACTIVITY_EVENTS.forEach(e => window.addEventListener(e, debouncedReset, { passive: true }));
    return () => {
      clearTimeout(idleTimerRef.current);
      clearTimeout(debounceTimerRef.current);
      ACTIVITY_EVENTS.forEach(e => window.removeEventListener(e, debouncedReset));
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

  const clearRecovery = () => setIsRecovery(false);

  const isAdmin = isAdminRole(role);
  const isSuperuser = isLegacySuperuserRole(role);
  const sectionAccess = useMemo(
    () => buildSectionAccessMap({ role, sectionRoles: rawPermissions.sectionRoles, deniedSections: rawPermissions.deniedSections }),
    [role, rawPermissions],
  );
  const deniedSections = sectionAccessMapToDeniedSections(sectionAccess);
  const canEdit = isAdmin || canAccessAnySection(sectionAccess, Object.keys(sectionAccess), ACCESS_SUPERUSER);
  const isElevated = isAdmin || isSuperuser;
  const canAccessSection = useCallback((sectionId) => hasSectionAccess(sectionAccess, sectionId), [sectionAccess]);
  const canEditSection = useCallback((sectionId) => hasSectionAccess(sectionAccess, sectionId, ACCESS_SUPERUSER), [sectionAccess]);
  const getSectionAccess = useCallback((sectionId) => getSectionAccessLevel(sectionAccess, sectionId), [sectionAccess]);
  const canAccessAny = useCallback((sectionIds) => canAccessAnySection(sectionAccess, sectionIds), [sectionAccess]);

  return (
    <AuthContext.Provider value={{
      session,
      signIn,
      signUp,
      signOut,
      resendConfirmation,
      resetPassword,
      role,
      isSuperuser,
      isAdmin,
      isElevated,
      canEdit,
      deniedSections,
      sectionAccess,
      canAccessSection,
      canEditSection,
      getSectionAccess,
      canAccessAny,
      isRecovery,
      clearRecovery,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
