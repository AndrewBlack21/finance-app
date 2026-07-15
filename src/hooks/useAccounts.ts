import { useState, useEffect, useMemo } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { accountService, supabase } from "@/services";
import type { Account, CreateAccount } from "@/types";

// ── Cache local simples — sem dependência de store externa ──
const CACHE_KEY = "@cache_accounts";
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

async function readCache(): Promise<Account[] | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { data, timestamp } = JSON.parse(raw);
    if (Date.now() - timestamp > CACHE_TTL) return null;
    return data;
  } catch {
    return null;
  }
}

async function writeCache(data: Account[]) {
  try {
    await AsyncStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ data, timestamp: Date.now() }),
    );
  } catch {}
}

async function clearCache() {
  try {
    await AsyncStorage.removeItem(CACHE_KEY);
  } catch {}
}

// ============================================================
// HOOK DE CONTAS — mantém todas as funcionalidades originais
// + cache local com AsyncStorage (evita leituras desnecessárias)
// ============================================================
export function useAccounts() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // forceRefresh=true → ignora cache e vai ao Supabase
  const fetch = async (forceRefresh = false) => {
    setIsLoading(true);

    // 1. Tenta cache — economiza 1 leitura no Supabase
    if (!forceRefresh) {
      const cached = await readCache();
      if (cached) {
        setAccounts(cached);
        setIsLoading(false);
        return;
      }
    }

    // 2. Busca no banco e salva cache
    const { data } = await accountService.list();
    const result = data ?? [];
    setAccounts(result);
    await writeCache(result);
    setIsLoading(false);
  };

  useEffect(() => {
    // Aguarda o cliente Supabase ter o token antes de buscar
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) fetch();
    });
    // Tenta buscar imediatamente também (caso já tenha sessão)
    fetch();
    return () => subscription.unsubscribe();
  }, []);

  const create = async (payload: CreateAccount) => {
    const { data, error } = await accountService.create(payload);
    if (data) {
      setAccounts((prev) => [...prev, data]);
      await clearCache(); // invalida cache após mutação
    }
    return { data, error };
  };

  const update = async (id: string, payload: any) => {
    const { data, error } = await accountService.update(id, payload);
    if (data) {
      setAccounts((prev) => prev.map((a) => (a.id === id ? data : a)));
      await clearCache(); // invalida cache após mutação
    }
    return { data, error };
  };

  const remove = async (id: string) => {
    const { error } = await accountService.remove(id);
    if (!error) {
      setAccounts((prev) => prev.filter((a) => a.id !== id));
      await clearCache();
    }
    return { error };
  };

  // Saldo total apenas das contas correntes
  const totalBalance = useMemo(
    () =>
      accounts
        .filter((acc) => acc.type === "checking")
        .reduce((sum, acc) => sum + acc.balance, 0),
    [accounts],
  );

  return {
    accounts,
    isLoading,
    totalBalance,
    create,
    update,
    remove,
    refetch: () => fetch(true), // força refresh ignorando cache
  };
}
