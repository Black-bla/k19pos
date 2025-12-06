import { initDatabase } from '@/lib/localDb';
import { supabase } from '@/lib/supabase';
import { initNetworkMonitoring, initialSync } from '@/lib/syncManager';
import { router } from 'expo-router';
import React, { createContext, useContext, useEffect, useState } from 'react';

interface StaffProfile {
  id: string;
  name?: string;
  role?: string;
}

interface AuthContextValue {
  session: any | null;
  user: any | null;
  staffProfile?: StaffProfile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: (userId?: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<any | null>(null);
  const [user, setUser] = useState<any | null>(null);
  const [staffProfile, setStaffProfile] = useState<StaffProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        // Initialize local database
        await initDatabase();
        console.log('Local database initialized');
        
        // Initialize network monitoring
        initNetworkMonitoring();
        console.log('Network monitoring initialized');
        
        // Initial sync
        await initialSync();
        console.log('Initial sync completed');
        
        const { data } = await supabase.auth.getSession();
        const s = data?.session ?? null;
        if (mounted) {
          setSession(s);
          setUser(s?.user ?? null);
          if (s?.user?.id) await fetchStaffProfile(s.user.id);
        }
      } catch (e) {
        console.warn('AuthProvider init error', e);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session ?? null);
      setUser(session?.user ?? null);
      if (!session) {
        setStaffProfile(null);
        router.replace('/(auth)/login');
      } else {
        await fetchStaffProfile(session.user.id);
        router.replace('/(tabs)');
      }
    });

    async function fetchStaffProfile(userId: string) {
      try {
        const { data } = await supabase.from('staff_profiles').select('*').eq('id', userId).single();
        if (data) {
          if (mounted) setStaffProfile(data ?? null);
          return;
        }
        // No profile found — create one automatically (handles email-confirm flows)
        // Use available metadata for name/phone/avatar if present
        const metaName = (session?.user?.user_metadata?.full_name) || (session?.user?.email) || null;
        const metaPhone = session?.user?.user_metadata?.phone || null;
        const metaAvatar = session?.user?.user_metadata?.avatar_url || null;
        try {
          const insertPayload: any = { id: userId, role: 'staff' };
          if (metaName) insertPayload.name = metaName;
          if (metaPhone) insertPayload.phone = metaPhone;
          if (metaAvatar) insertPayload.avatar_url = metaAvatar;
          const { error: insertErr } = await supabase.from('staff_profiles').insert(insertPayload);
          if (insertErr) {
            console.warn('Failed to create staff_profile', insertErr);
          } else {
            // refetch
            const { data: newData } = await supabase.from('staff_profiles').select('*').eq('id', userId).single();
            if (mounted) setStaffProfile(newData ?? null);
          }
        } catch (ie) {
          console.warn('Error inserting staff_profile', ie);
          if (mounted) setStaffProfile(null);
        }
      } catch (err) {
        console.warn('fetchStaffProfile error', err);
        if (mounted) setStaffProfile(null);
      }
    }

    return () => {
      mounted = false;
      try { subscription.unsubscribe(); } catch (e) { /* ignore */ }
    };
  }, []);

  async function signOut() {
    try {
      await supabase.auth.signOut();
      setSession(null);
      setUser(null);
      setStaffProfile(null);
      router.replace('/(auth)/login');
    } catch (err) {
      console.warn('Sign out failed', err);
    }
  }

  async function refreshProfile(userId?: string) {
    const id = userId || session?.user?.id;
    if (!id) return;
    try {
      const { data } = await supabase.from('staff_profiles').select('*').eq('id', id).single();
      setStaffProfile(data ?? null);
    } catch (err) {
      console.warn('refreshProfile error', err);
    }
  }

  return (
    <AuthContext.Provider value={{ session, user, staffProfile, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
