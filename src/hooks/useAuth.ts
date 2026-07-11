import { useEffect, useRef } from "react";
import { supabase, authService } from "@/services";
import { useAuthStore } from "@/store/authStore";
import type { AuthCredentials, RegisterCredentials } from "@/types";
import { useRouter } from "expo-router";

export function useAuth() {
  const store = useAuthStore();
  const router = useRouter();

  // Garante que o onAuthChange disparou ao menos 1x antes de libertar a tela
  const authListenerFired = useRef(false);

  useEffect(() => {
    let mounted = true;

    // 1. Escuta mudanças — dispara imediatamente com a sessão atual do telemóvel
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
        if (data && mounted) store.setProfile(data);
      } else {
        store.clear();
      }

      // 2. Só marca "hydrated" (e liberta a tela preta/branca) APÓS o listener disparar pela primeira vez!
      if (!authListenerFired.current) {
        authListenerFired.current = true;
        if (mounted) store.setHydrated(true);
      }
    });

    // 3. Timeout de segurança — se a leitura demorar > 3s, liberta a tela para não travar o utilizador
    const timeout = setTimeout(() => {
      if (mounted && !authListenerFired.current) {
        console.log("Auth timeout — forçando hydration");
        authListenerFired.current = true;
        store.setHydrated(true);
      }
    }, 3000);

    return () => {
      mounted = false;
      clearTimeout(timeout);
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
    store.clear();
    store.setHydrated(true);
    store.setLoading(false);

    // O router que você tinha antes para redirecionar
    router.replace("/(auth)/login");
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
