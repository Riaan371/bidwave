import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import type { AppUser } from './types';

type AuthState = {
  session: Session | null;
  profile: AppUser | null;
  initialized: boolean;
  setSession: (session: Session | null) => void;
  loadProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  profile: null,
  initialized: false,
  setSession: (session) => set({ session }),
  loadProfile: async () => {
    const session = get().session;
    if (!session) {
      set({ profile: null, initialized: true });
      return;
    }
    const { data } = await supabase
      .from('users')
      .select('id, email, role, full_name, screen_name, kyc_status, created_at')
      .eq('id', session.user.id)
      .maybeSingle();
    set({ profile: data as AppUser | null, initialized: true });
  },
  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null, profile: null });
  },
}));
