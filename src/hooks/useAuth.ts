import { useEffect } from "react";
import { supabase, authService } from "@/services";
import { useAuthStore } from "@/store/authStore";
import type { AuthCredentials, Profile, RegisterCredentials } from "@/types";
import type { Session, User } from "@supabase/supabase-js";
import { useRouter } from "expo-router";

let authInitializationPromise: Promise<void> | null = null;

async function loadProfile(user: User): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    console.log("Erro ao carregar perfil:", error.message);
  }

  if (data) {
    return data as Profile;
  }

  // Fallback para evitar que a interface mostre "Usuário" enquanto
  // o perfil ainda não existe ou a leitura do perfil falha.
  return {
    id: user.id,
    name:
      user.user_metadata?.name ??
      user.user_metadata?.full_name ??
      user.email?.split("@")[0] ??
      "Usuário",
    avatar_url: user.user_metadata?.avatar_url ?? null,
    currency: "BRL",
    created_at: user.created_at,
  };
}

async function syncSession(
  store: ReturnType<typeof useAuthStore.getState>,
  session: Session | null,
) {
  if (!session?.user) {
    store.clearAuth();
    return;
  }

  store.setSession(session);
  store.setUser(session.user);
  store.setProfile(null);

  const profile = await loadProfile(session.user);
  store.setProfile(profile);
}

async function initializeAuth() {
  const store = useAuthStore.getState();

  if (authInitializationPromise) {
    return authInitializationPromise;
  }

  authInitializationPromise = (async () => {
    // Primeiro instala o listener para não perder mudanças de sessão
    // enquanto o getSession() ainda está sendo executado.
    authService.onAuthChange((session) => {
      void syncSession(useAuthStore.getState(), session);
    });

    try {
      const { data: session, error } = await authService.getSession();

      if (error) {
        console.log("Erro ao recuperar sessão:", error);
        store.clearAuth();
      } else {
        await syncSession(store, session);
      }
    } catch (error) {
      console.log("Erro ao inicializar autenticação:", error);
      store.clearAuth();
    } finally {
      store.setHydrated(true);
    }
  })();

  return authInitializationPromise;
}

export function useAuth() {
  const store = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    void initializeAuth();
  }, []);

  const register = async (credentials: RegisterCredentials) => {
    store.setLoading(true);
    const { error } = await authService.register(credentials);
    store.setLoading(false);
    return { error };
  };

  const login = async (credentials: AuthCredentials) => {
    store.setLoading(true);

    const { data: session, error } = await authService.login(credentials);

    if (!error && session) {
      await syncSession(useAuthStore.getState(), session);
      store.setHydrated(true);
    }

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

  const updateName = async (newName: string) => {
    if (!store.user) return { error: { message: "Utilizador não logado" } };

    store.setLoading(true);

    const { error } = await supabase
      .from("profiles")
      .update({ name: newName })
      .eq("id", store.user.id);

    if (!error) {
      const currentProfile = useAuthStore.getState().profile;
      if (currentProfile) {
        store.setProfile({ ...currentProfile, name: newName });
      }
    }

    store.setLoading(false);
    return { error };
  };

  const updatePassword = async (newPassword: string) => {
    store.setLoading(true);

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

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
    updateName,
    updatePassword,
  };
}
