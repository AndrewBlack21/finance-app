import { useEffect } from "react";
import { supabase, authService } from "@/services";
import { useAuthStore } from "@/store/authStore";
import type { AuthCredentials, RegisterCredentials } from "@/types";
import { useRouter } from "expo-router";

// 👇 CORREÇÃO: Variável global. Garante que a sessão seja buscada apenas UMA VEZ
// para o aplicativo inteiro, impedindo que uma tela cancele o login da outra.[cite: 16]
let isGlobalAuthInitialized = false;

export function useAuth() {
  const store = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (isGlobalAuthInitialized) return;
    isGlobalAuthInitialized = true;

    // ETAPA 1: Busca ativa e imediata da sessão ao abrir a aplicação
    const fetchInitialSession = async () => {
      try {
        const { data: session } = await authService.getSession();

        if (session) {
          store.setSession(session);
          store.setUser(session.user);

          // Busca os dados do perfil (Nome, Moeda, etc.)
          const { data } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", session.user.id)
            .single();

          // 👇 CORREÇÃO: O store global deve ser atualizado mesmo que a tela saia de foco[cite: 16]
          if (data) store.setProfile(data);
        } else {
          store.clear();
        }
      } catch (error) {
        console.log("Erro ao carregar sessão:", error);
      } finally {
        store.setHydrated(true);
      }
    };

    fetchInitialSession();

    // ETAPA 2: Escutador global contínuo (fica ativo no fundo do app)
    authService.onAuthChange(async (session) => {
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
        store.clear();
        router.replace("/(auth)/login");
      }
    });

    // ETAPA 3: Tempo limite de segurança caso a base de dados demore
    setTimeout(() => {
      store.setHydrated(true);
    }, 3000);

    // 👇 CORREÇÃO: Removemos o return de cleanup. O escutador deve viver para sempre![cite: 16]
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