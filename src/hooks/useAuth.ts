import { useEffect, useRef } from "react";
import { supabase, authService } from "@/services";
import { useAuthStore } from "@/store/authStore";
import type { AuthCredentials, RegisterCredentials } from "@/types";
import { useRouter } from "expo-router";

export function useAuth() {
  const store = useAuthStore();
  const router = useRouter();

  // Variável para garantir que o ecrã só é libertado uma única vez
  const authInitialized = useRef(false);

  useEffect(() => {
    let mounted = true;

    // ETAPA 1: Busca ativa e imediata da sessão ao abrir a aplicação
    const fetchInitialSession = async () => {
      try {
        const { data: session } = await authService.getSession();

        if (session && mounted) {
          store.setSession(session);
          store.setUser(session.user);

          // Busca os dados do perfil (Nome, Moeda, etc.)
          const { data } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", session.user.id)
            .single();

          if (data && mounted) store.setProfile(data);
        } else if (mounted) {
          store.clear();
        }
      } catch (error) {
        console.log("Erro ao carregar sessão:", error);
      } finally {
        // ETAPA 2: Assim que os dados são lidos, remove o ecrã de carregamento
        if (mounted && !authInitialized.current) {
          authInitialized.current = true;
          store.setHydrated(true);
        }
      }
    };

    fetchInitialSession();

    // ETAPA 3: O "escutador" fica apenas para manter a segurança (ex: caso faça logout)
    const subscription = authService.onAuthChange(async (session) => {
      if (!mounted) return;

      // Só processa se a busca inicial já tiver terminado, para não atropelar a Etapa 1
      if (authInitialized.current) {
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
          router.replace("/(auth)/login");
        }
      }
    });

    // ETAPA 4: Tempo limite de segurança caso a base de dados falhe completamente
    const timeout = setTimeout(() => {
      if (mounted && !authInitialized.current) {
        authInitialized.current = true;
        store.setHydrated(true);
      }
    }, 3000);

    return () => {
      mounted = false;
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  // --- Funções de Autenticação Padrão ---

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
