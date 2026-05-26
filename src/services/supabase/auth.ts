import { isSupabaseConfigured, supabase } from "./client";
import type {
  AuthCredentials,
  RegisterCredentials,
  ServiceResponse,
} from "../../types/index";
import type { Session, User } from "@supabase/supabase-js";

// ============================================================
// Padrão: toda função retorna ServiceResponse<T>
// O caller decide o que fazer com error — sem try/catch espalhado
// ============================================================

const missingConfigError =
  "Configure EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_ANON_KEY no arquivo .env.";

export const authService = {
  // Registro com email/senha — profile criado automaticamente via trigger
  register: async ({
    email,
    password,
    name,
  }: RegisterCredentials): Promise<ServiceResponse<User>> => {
    if (!isSupabaseConfigured) return { data: null, error: missingConfigError };

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } }, // capturado pelo trigger handle_new_user
    });
    return { data: data.user, error: error?.message ?? null };
  },

  // Login com email/senha
  login: async ({
    email,
    password,
  }: AuthCredentials): Promise<ServiceResponse<Session>> => {
    if (!isSupabaseConfigured) return { data: null, error: missingConfigError };

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { data: data.session, error: error?.message ?? null };
  },

  // Logout
  logout: async (): Promise<ServiceResponse<null>> => {
    const { error } = await supabase.auth.signOut();
    return { data: null, error: error?.message ?? null };
  },

  // Recuperação de senha — envia email
  forgotPassword: async (email: string): Promise<ServiceResponse<null>> => {
    if (!isSupabaseConfigured) return { data: null, error: missingConfigError };

    const { error } = await supabase.auth.resetPasswordForEmail(email);
    return { data: null, error: error?.message ?? null };
  },

  // Sessão atual
  getSession: async (): Promise<ServiceResponse<Session>> => {
    if (!isSupabaseConfigured) return { data: null, error: null };

    const { data, error } = await supabase.auth.getSession();
    return { data: data.session, error: error?.message ?? null };
  },

  // Escuta mudanças de sessão (login, logout, refresh)
  // Padrão: chame no Provider global da aplicação
  onAuthChange: (callback: (session: Session | null) => void) => {
    if (!isSupabaseConfigured) {
      callback(null);
      return { unsubscribe: () => undefined };
    }

    const { data } = supabase.auth.onAuthStateChange((_event, session) =>
      callback(session),
    );
    return data.subscription; // retorna para poder chamar .unsubscribe()
  },
};
