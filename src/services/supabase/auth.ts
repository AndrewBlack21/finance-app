import { Platform } from "react-native";
import { isSupabaseConfigured, supabase } from "./client";
import type {
  AuthCredentials,
  RegisterCredentials,
  ServiceResponse,
} from "../../types/index";
import type { Session, User } from "@supabase/supabase-js";

const missingConfigError =
  "Configure EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_ANON_KEY no arquivo .env.";

const PRODUCTION_WEB_URL = "https://secontrolaai.vercel.app";

const getPasswordResetRedirectUrl = () => {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    const { origin, hostname } = window.location;

    // Desenvolvimento local continua usando localhost.
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return `${origin}/reset-password`;
    }

    // Produção e previews web usam a própria origem da aplicação.
    // Isso evita que uma variável de ambiente antiga aponte o reset para localhost.
    return `${origin}/reset-password`;
  }

  return `${PRODUCTION_WEB_URL}/reset-password`;
};

const getLoginErrorMessage = (message?: string | null) => {
  const normalized = (message ?? "").toLowerCase();

  if (
    normalized.includes("invalid login credentials") ||
    normalized.includes("invalid credentials")
  ) {
    return "E-mail ou senha incorretos. Verifique os dados e tente novamente.";
  }

  if (normalized.includes("email not confirmed")) {
    return "Seu e-mail ainda não foi confirmado. Verifique sua caixa de entrada.";
  }

  if (normalized.includes("too many requests")) {
    return "Muitas tentativas. Aguarde alguns minutos e tente novamente.";
  }

  return message ?? "Não foi possível entrar. Tente novamente.";
};

export const authService = {
  register: async ({
    email,
    password,
    name,
  }: RegisterCredentials): Promise<ServiceResponse<User>> => {
    if (!isSupabaseConfigured) return { data: null, error: missingConfigError };

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name, full_name: name } },
    });
    return { data: data.user, error: error?.message ?? null };
  },

  login: async ({
    email,
    password,
  }: AuthCredentials): Promise<ServiceResponse<Session>> => {
    if (!isSupabaseConfigured) return { data: null, error: missingConfigError };

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    return {
      data: data.session,
      error: error ? getLoginErrorMessage(error.message) : null,
    };
  },

  logout: async (): Promise<ServiceResponse<null>> => {
    const { error } = await supabase.auth.signOut();
    return { data: null, error: error?.message ?? null };
  },

  forgotPassword: async (email: string): Promise<ServiceResponse<null>> => {
    if (!isSupabaseConfigured) return { data: null, error: missingConfigError };

    const redirectTo = getPasswordResetRedirectUrl();

    console.log("Link de recuperação configurado para:", redirectTo);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });

    return { data: null, error: error?.message ?? null };
  },

  getSession: async (): Promise<ServiceResponse<Session>> => {
    if (!isSupabaseConfigured) return { data: null, error: null };

    const { data, error } = await supabase.auth.getSession();
    return { data: data.session, error: error?.message ?? null };
  },

  onAuthChange: (callback: (session: Session | null) => void) => {
    if (!isSupabaseConfigured) {
      callback(null);
      return { unsubscribe: () => undefined };
    }

    const { data } = supabase.auth.onAuthStateChange((_event, session) =>
      callback(session),
    );

    return data.subscription;
  },
};
