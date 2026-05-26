import { createClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
// Aceita tanto ANON_KEY quanto KEY para compatibilidade
const KEY = (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.EXPO_PUBLIC_SUPABASE_KEY)!;

// ============================================================
// STORAGE ADAPTER
// Web  → localStorage  |  Mobile → SecureStore (criptografado)
// Padrão reutilizável para qualquer app Expo com Supabase
// ============================================================
const ExpoSecureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

const storage =
  Platform.OS === "web"
    ? localStorage // Web: localStorage nativo
    : ExpoSecureStoreAdapter; // Mobile: SecureStore criptografado

export const supabase = createClient(URL, KEY, {
  auth: {
    storage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === "web",
  },
});
