import { createClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

// 1. Configurações base
const URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const KEY = (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.EXPO_PUBLIC_SUPABASE_KEY)!;

export const isSupabaseConfigured = Boolean(URL && KEY);

const isWeb = Platform.OS === "web";
const isBrowser =
  isWeb && typeof window !== "undefined" && !!window.localStorage;
const isStaticRendering = isWeb && !isBrowser;

// 2. Gestão de memória para renderização estática
const memoryStorage = (() => {
  const store = new Map<string, string>();

  return {
    getItem: (key: string) => Promise.resolve(store.get(key) ?? null),
    setItem: (key: string, value: string) => {
      store.set(key, value);
      return Promise.resolve();
    },
    removeItem: (key: string) => {
      store.delete(key);
      return Promise.resolve();
    },
  };
})();

// 3. Escolha automática do melhor armazenamento local
const storage = isBrowser
  ? {
      getItem: (key: string) =>
        Promise.resolve(window.localStorage.getItem(key)),
      setItem: (key: string, value: string) =>
        Promise.resolve(window.localStorage.setItem(key, value)),
      removeItem: (key: string) =>
        Promise.resolve(window.localStorage.removeItem(key)),
    }
  : isStaticRendering
    ? memoryStorage
    : AsyncStorage;

const staticRealtimeOptions = isStaticRendering
  ? {
      transport: class StaticRenderingWebSocket {
        constructor() {
          throw new Error(
            "Supabase realtime is disabled during static rendering.",
          );
        }
      },
    }
  : undefined;

// 4. NOVA LÓGICA: Variável para guardar a ligação única
let supabaseInstance: ReturnType<typeof createClient> | undefined;
// 5. NOVA LÓGICA: Só cria uma ligação nova se ela ainda não existir
if (!supabaseInstance) {
  supabaseInstance = createClient(URL, KEY, {
    auth: {
      storage,
      autoRefreshToken: !isStaticRendering,
      persistSession: !isStaticRendering,
      detectSessionInUrl: isBrowser,
    },
    realtime: staticRealtimeOptions as any,
  });
}

// 6. Exporta a ligação única para o resto da aplicação usar
export const supabase = supabaseInstance;
