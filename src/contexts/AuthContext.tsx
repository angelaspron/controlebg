import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase, resolveEmailFromIdentifier } from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  username: string;
  signIn: (identifier: string, password: string) => Promise<{ error: string | null }>;
  signUp: (identifier: string, password: string, customUsername?: string) => Promise<{ error: string | null; needsEmailConfirmation?: boolean }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Obter sessão atual
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    }).catch(err => {
      console.error('Erro ao verificar sessão Supabase:', err);
      setLoading(false);
    });

    // 2. Ouvir mudanças no estado de autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const username = React.useMemo(() => {
    if (!user) return '';
    return (
      user.user_metadata?.username ||
      user.user_metadata?.name ||
      user.email?.split('@')[0] ||
      'Usuário'
    );
  }, [user]);

  const signIn = async (identifier: string, password: string): Promise<{ error: string | null }> => {
    try {
      const email = await resolveEmailFromIdentifier(identifier);
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { error: error.message };
      }

      return { error: null };
    } catch (e: any) {
      return { error: e?.message || 'Falha ao autenticar.' };
    }
  };

  const signUp = async (
    identifier: string, 
    password: string, 
    customUsername?: string
  ): Promise<{ error: string | null; needsEmailConfirmation?: boolean }> => {
    try {
      let email = identifier.trim();
      let chosenUsername = customUsername?.trim();

      if (!email.includes('@')) {
        chosenUsername = chosenUsername || email;
        email = `${email.toLowerCase().replace(/[^a-z0-9._-]/g, '')}@controlebg.local`;
      } else if (!chosenUsername) {
        chosenUsername = email.split('@')[0];
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username: chosenUsername,
          },
        },
      });

      if (error) {
        return { error: error.message };
      }

      const needsEmailConfirmation = Boolean(data.user && !data.session);
      return { error: null, needsEmailConfirmation };
    } catch (e: any) {
      return { error: e?.message || 'Falha ao cadastrar usuário.' };
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.error('Erro ao deslogar:', e);
    }
  };

  const resetPassword = async (email: string): Promise<{ error: string | null }> => {
    try {
      const targetEmail = await resolveEmailFromIdentifier(email);
      const { error } = await supabase.auth.resetPasswordForEmail(targetEmail, {
        redirectTo: window.location.origin,
      });
      if (error) return { error: error.message };
      return { error: null };
    } catch (e: any) {
      return { error: e?.message || 'Falha ao solicitar redefinição de senha.' };
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, username, signIn, signUp, signOut, resetPassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
}
