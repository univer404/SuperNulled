import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

interface AuthState {
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthState>({
  session: null,
  loading: true,
  isAdmin: false,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    let authEventReceived = false;

    // Subscribe before checking the stored session so a sign-in event cannot be
    // overwritten by a slower, stale getSession() response.
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      authEventReceived = true;
      if (!active) return;
      setSession(nextSession);
      setLoading(false);
    });

    supabase.auth.getSession()
      .then(({ data: sessionData, error }) => {
        if (!active || authEventReceived) return;
        if (error) console.error('Unable to restore Supabase session:', error.message);
        setSession(sessionData.session);
        setLoading(false);
      })
      .catch((error: unknown) => {
        if (!active || authEventReceived) return;
        console.error('Unable to restore Supabase session:', error);
        setSession(null);
        setLoading(false);
      });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  // Display hint only. Real admin enforcement happens in the database (RLS).
  const isAdmin = session?.user.app_metadata?.role === 'admin';

  return (
    <AuthContext.Provider value={{ session, loading, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}
