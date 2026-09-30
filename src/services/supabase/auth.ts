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

const getPasswordResetRedirectUrl = () => {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    return `${window.location.origin}/reset-password`;
  }

  return "financeapp://reset-password";
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
    return { data: data.session, error: error?.message ?? null };
  },

  logout: async (): Promise<ServiceResponse<null>> => {
    const { error } = await supabase.auth.signOut();
    return { data: null, error: error?.message ?? null };
  },

  forgotPassword: async (email: string): Promise<ServiceResponse<null>> => {
    if (!isSupabaseConfigured) return { data: null, error: missingConfigError };

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: getPasswordResetRedirectUrl(),
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
