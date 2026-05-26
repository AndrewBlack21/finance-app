import { useEffect } from "react";
import { supabase, authService } from "@/services";
import { useAuthStore } from "@/store/authStore";
import type { AuthCredentials, RegisterCredentials } from "@/types";

export function useAuth() {
  const store = useAuthStore();

  useEffect(() => {
    let mounted = true;

    const hydrate = async () => {
      try {
        const { data: session } = await authService.getSession();
        if (!mounted) return;
        if (session) {
          store.setSession(session);
          store.setUser(session.user);
          const { data } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", session.user.id)
            .single();
          if (data && mounted) store.setProfile(data);
        }
      } catch (e) {
        console.log("hydrate error:", e);
      } finally {
        if (mounted) store.setHydrated(true);
      }
    };

    hydrate();

    const subscription = authService.onAuthChange(async (session) => {
      if (!mounted) return;
      store.setSession(session);
      store.setUser(session?.user ?? null);
      if (session?.user) {
        const { data } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", session.user.id)
          .single();
        if (data) store.setProfile(data);
      } else {
        store.clearAuth();
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const register = async (credentials: RegisterCredentials) => {
    store.setLoading(true);
    const { error } = await authService.register(credentials);
    store.setLoading(false);
    return { error };
  };

  const login = async (credentials: AuthCredentials) => {
    store.setLoading(true);
    const { error } = await authService.login(credentials);
    store.setLoading(false);
    return { error };
  };

  const logout = async () => {
    store.setLoading(true);
    await authService.logout();
    store.setLoading(false);
  };

  const forgotPassword = async (email: string) => {
    store.setLoading(true);
    const { error } = await authService.forgotPassword(email);
    store.setLoading(false);
    return { error };
  };

  return {
    user: store.user,
    profile: store.profile,
    session: store.session,
    isLoading: store.isLoading,
    isHydrated: store.isHydrated,
    isLoggedIn: !!store.session,
    register,
    login,
    logout,
    forgotPassword,
  };
}
