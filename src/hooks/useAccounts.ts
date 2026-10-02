import { useState, useEffect, useMemo, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { accountService } from "@/services";
import type { Account, CreateAccount } from "@/types";
import { useAuth } from "@/hooks/useAuth";

const CACHE_TTL = 5 * 60 * 1000;

async function readCache(userId: string): Promise<Account[] | null> {
  try {
    const raw = await AsyncStorage.getItem(`@cache_accounts_${userId}`);
    if (!raw) return null;

    const { data, timestamp } = JSON.parse(raw);
    if (Date.now() - timestamp > CACHE_TTL) return null;

    return data;
  } catch {
    return null;
  }
}

async function writeCache(userId: string, data: Account[]) {
  try {
    await AsyncStorage.setItem(
      `@cache_accounts_${userId}`,
      JSON.stringify({ data, timestamp: Date.now() }),
    );
  } catch {}
}

async function clearCache(userId?: string) {
  if (!userId) return;

  try {
    await AsyncStorage.removeItem(`@cache_accounts_${userId}`);
  } catch {}
}

export function useAccounts() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { session, isHydrated } = useAuth();
  const userId = session?.user?.id ?? null;

  const fetch = useCallback(
    async (forceRefresh = false) => {
      if (!userId) {
        setAccounts([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);

      if (!forceRefresh) {
        const cached = await readCache(userId);

        if (cached) {
          setAccounts(cached);
          setIsLoading(false);

          // Atualiza em segundo plano para não ficar preso em cache antigo.
          void (async () => {
            const { data } = await accountService.list();
            if (data) {
              setAccounts(data);
              await writeCache(userId, data);
            }
          })();

          return;
        }
      }

      const { data } = await accountService.list();
      const result = data ?? [];

      setAccounts(result);
      await writeCache(userId, result);
      setIsLoading(false);
    },
    [userId],
  );

  useEffect(() => {
    if (!isHydrated) return;

    if (userId) {
      void fetch(true);
    } else {
      setAccounts([]);
      setIsLoading(false);
    }
  }, [isHydrated, userId, fetch]);

  const create = async (payload: CreateAccount) => {
    const { data, error } = await accountService.create(payload);

    if (data) {
      setAccounts((prev) => [...prev, data]);
      await clearCache(userId ?? undefined);
    }

    return { data, error };
  };

  const update = async (id: string, payload: any) => {
    const { data, error } = await accountService.update(id, payload);

    if (data) {
      setAccounts((prev) => prev.map((a) => (a.id === id ? data : a)));
      await clearCache(userId ?? undefined);
    }

    return { data, error };
  };

  const remove = async (id: string) => {
    const { error } = await accountService.remove(id);

    if (!error) {
      setAccounts((prev) => prev.filter((a) => a.id !== id));
      await clearCache(userId ?? undefined);
    }

    return { error };
  };

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
    refetch: () => fetch(true),
  };
}
