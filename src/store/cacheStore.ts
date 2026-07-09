import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Transaction, Account, FixedExpense, Installment } from "@/types";

// ============================================================
// TEMPO DE EXPIRAÇÃO DO CACHE
// ============================================================
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos — após isso, busca no banco

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

interface CacheStore {
  transactions: CacheEntry<Transaction[]> | null;
  accounts: CacheEntry<Account[]> | null;
  fixedExpenses: CacheEntry<FixedExpense[]> | null;
  installments: CacheEntry<Installment[]> | null;

  // Salva no cache em memória E no AsyncStorage
  set: <K extends keyof Omit<CacheStore, "set" | "get" | "isValid" | "clear">>(
    key: K,
    data: any,
  ) => Promise<void>;

  // Lê do cache (memória primeiro, depois AsyncStorage)
  get: <T>(key: string) => Promise<T | null>;

  // Verifica se o cache ainda é válido
  isValid: (entry: CacheEntry<any> | null) => boolean;

  // Limpa o cache de uma chave específica (force refresh)
  clear: (key?: string) => Promise<void>;
}

export const useCacheStore = create<CacheStore>((set, get) => ({
  transactions: null,
  accounts: null,
  fixedExpenses: null,
  installments: null,

  set: async (key, data) => {
    const entry: CacheEntry<any> = { data, timestamp: Date.now() };

    // Atualiza memória
    set({ [key]: entry } as any);

    // Persiste no AsyncStorage para sobreviver ao fechamento do app
    try {
      await AsyncStorage.setItem(`@cache_${key}`, JSON.stringify(entry));
    } catch (e) {
      console.warn("Cache write error:", e);
    }
  },

  get: async <T>(key: string): Promise<T | null> => {
    // 1. Tenta memória primeiro (mais rápido)
    const memEntry = (get() as any)[key] as CacheEntry<T> | null;
    if (memEntry && get().isValid(memEntry)) return memEntry.data;

    // 2. Tenta AsyncStorage (persiste entre sessões)
    try {
      const raw = await AsyncStorage.getItem(`@cache_${key}`);
      if (!raw) return null;
      const entry: CacheEntry<T> = JSON.parse(raw);
      if (get().isValid(entry)) {
        set({ [key]: entry } as any); // restaura na memória
        return entry.data;
      }
    } catch (e) {
      console.warn("Cache read error:", e);
    }
    return null;
  },

  isValid: (entry) => {
    if (!entry) return false;
    return Date.now() - entry.timestamp < CACHE_TTL_MS;
  },

  clear: async (key) => {
    if (key) {
      set({ [key]: null } as any);
      await AsyncStorage.removeItem(`@cache_${key}`);
    } else {
      // Limpa tudo
      set({
        transactions: null,
        accounts: null,
        fixedExpenses: null,
        installments: null,
      });
      await AsyncStorage.multiRemove([
        "@cache_transactions",
        "@cache_accounts",
        "@cache_fixedExpenses",
        "@cache_installments",
      ]);
    }
  },
}));
