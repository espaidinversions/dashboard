import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "./supabase.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined); // undefined = loading

  useEffect(() => {
    if (!supabase) { setSession(null); return; }
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  const signIn  = (email, password) => supabase.auth.signInWithPassword({ email, password });
  const signUp  = (email, password) => supabase.auth.signUp({ email, password });
  const signOut = () => supabase.auth.signOut();
  const resendConfirmation = (email) => supabase.auth.resend({ type: "signup", email });

  const isSuperuser = session?.user?.user_metadata?.role === "superuser";

  return (
    <AuthContext.Provider value={{ session, signIn, signUp, signOut, resendConfirmation, isSuperuser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
