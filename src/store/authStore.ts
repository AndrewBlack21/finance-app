import { create } from "zustand";
import type { Session, User } from "@supabase/supabase-js";
import type { Profile } from "../types";

// TIPO DE STORE

interface AuthState {
  // Estado
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  isLoading: boolean;
  isHydrated: boolean;

  setUser: (user: User | null) => void;
  setProfile: (profile: Profile | null) => void;
  setSession: (session: Session | null) => void;
  setLoading: (v: boolean) => void;
  setHydrated: (v: boolean) => void;
  clear: () => void; // Limpa tudo no logout
}

// Store
// Responsabilidade apenas guarda e expor o estado de auth
// Toda Logica de chamada fica no useAuth

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  profile: null,
  session: null,
  isLoading: false,
  isHydrated: false,

  setUser: (user) => set({ user }),
  setProfile: (profile) => set({ profile }),
  setSession: (session) => set({ session }),
  setLoading: (v) => set({ isLoading: v }),
  setHydrated: (v) => set({ isHydrated: v }),

  clear: () =>
    set({
      user: null,
      profile: null,
      session: null,
      isLoading: false,
      isHydrated: false,
    }),
}));
