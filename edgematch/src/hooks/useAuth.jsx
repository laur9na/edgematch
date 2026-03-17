import { useState, useEffect, createContext, useContext } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext(null);

/**
 * Provides { user, athlete, loading, signUp, signIn, signOut } to children.
 * `athlete` is the athletes row linked to the current user (null if not yet created).
 */
export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [athlete, setAthlete] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fetch the athlete row for the logged-in user
  async function fetchAthlete(userId) {
    const { data } = await supabase
      .from('athletes')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    setAthlete(data ?? null);
  }

  useEffect(() => {
    // Initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) fetchAthlete(u.id);
      setLoading(false);
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) fetchAthlete(u.id);
      else setAthlete(null);
    });

    return () => subscription.unsubscribe();
  }, []);

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

  return (
    <AuthContext.Provider value={{ user, athlete, loading, signUp, signIn, signOut, refetchAthlete: () => user && fetchAthlete(user.id) }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
