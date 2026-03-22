/**
 * AuthContext.jsx
 * Single source of truth for auth and profile state.
 * Fixes the loading race condition: setLoading(false) only fires after
 * BOTH the session check AND the athlete query have resolved.
 */
import { useState, useEffect, useRef, createContext, useContext } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext(null);

function isProfileComplete(athlete) {
  if (!athlete) return false;
  return !!(athlete.name && athlete.discipline && athlete.skating_level && athlete.partner_role);
}

async function queryAthlete(userId) {
  const { data } = await supabase
    .from('athletes')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  return data ?? null;
}

export function AuthProvider({ children }) {
  const [session,  setSession]  = useState(null);
  const [user,     setUser]     = useState(null);
  const [athlete,  setAthlete]  = useState(null);
  const [loading,  setLoading]  = useState(true);

  // Prevent double-fetch on the INITIAL_SESSION event that fires immediately
  // after onAuthStateChange is subscribed (same tick as getSession would return).
  const initialized = useRef(false);

  useEffect(() => {
    let mounted = true;

    // onAuthStateChange fires synchronously with INITIAL_SESSION on mount,
    // so we can skip a separate getSession() call entirely.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        if (!mounted) return;

        const newUser = newSession?.user ?? null;
        setSession(newSession ?? null);
        setUser(newUser);

        if (newUser) {
          const row = await queryAthlete(newUser.id);
          if (mounted) setAthlete(row);
        } else {
          setAthlete(null);
        }

        // Only set loading=false once (on the first resolution).
        // Subsequent auth events (SIGNED_IN, TOKEN_REFRESHED, etc.) should
        // update state silently without re-triggering a loading flash.
        if (!initialized.current) {
          initialized.current = true;
          if (mounted) setLoading(false);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function refreshAthlete() {
    if (!user) return;
    const row = await queryAthlete(user.id);
    setAthlete(row);
  }

  async function signUp(email, password) {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    return data;
  }

  async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }

  const profileComplete = isProfileComplete(athlete);

  return (
    <AuthContext.Provider value={{
      session,
      user,
      athlete,
      loading,
      profileComplete,
      refreshAthlete,
      refetchAthlete: refreshAthlete,   // backward-compat alias
      signUp,
      signIn,
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
