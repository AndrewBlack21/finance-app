import { createClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
// Aceita tanto ANON_KEY quanto KEY para compatibilidade
const KEY = (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.EXPO_PUBLIC_SUPABASE_KEY);

export const isSupabaseConfigured = Boolean(URL && KEY);

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

const memoryStorage = new Map<string, string>();
const WebStorageAdapter = {
  getItem: (key: string) => {
    if (typeof localStorage !== "undefined") return localStorage.getItem(key);
    return memoryStorage.get(key) ?? null;
  },
  setItem: (key: string, value: string) => {
    if (typeof localStorage !== "undefined") localStorage.setItem(key, value);
    else memoryStorage.set(key, value);
  },
  removeItem: (key: string) => {
    if (typeof localStorage !== "undefined") localStorage.removeItem(key);
    else memoryStorage.delete(key);
  },
};

const storage =
  Platform.OS === "web"
    ? WebStorageAdapter // Web: localStorage no browser, memoria no render estatico
    : ExpoSecureStoreAdapter; // Mobile: SecureStore criptografado

const NoopWebSocket = class {
  close() {}
  send() {}
  addEventListener() {}
  removeEventListener() {}
} as never;

export const supabase = createClient(
  URL ?? "https://example.supabase.co",
  KEY ?? "missing-supabase-key",
  {
    auth: {
      storage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: Platform.OS === "web",
    },
    realtime:
      typeof WebSocket === "undefined"
        ? { transport: NoopWebSocket }
        : undefined,
  },
);
