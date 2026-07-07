import { useState, useEffect, useMemo } from "react";
import { accountService } from "@/services";
import type { Account, CreateAccount } from "@/types";

export function useAccounts() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetch = async () => {
    setIsLoading(true);
    const { data } = await accountService.list();
    setAccounts(data ?? []);
    setIsLoading(false);
  };

  useEffect(() => {
    fetch();
  }, []);

  const create = async (payload: CreateAccount) => {
    const { data, error } = await accountService.create(payload);
    if (data) setAccounts((prev) => [...prev, data]);
    return { data, error };
  };
  const update = async (id: string, payload: any) => {
    const { data, error } = await accountService.update(id, payload);
    if (data) {
      setAccounts((prev) => prev.map((a) => (a.id === id ? data : a)));
      fetch(); // Atualiza a lista para refletir as mudanças imediatamente
    }
    return { data, error };
  };
  const remove = async (id: string) => {
    const { error } = await accountService.remove(id);
    if (!error) setAccounts((prev) => prev.filter((a) => a.id !== id));
    return { error };
  };

  const totalBalance = useMemo(() => {
    return accounts
      .filter((acc) => acc.type === "checking") // <--- ADICIONE ESTE FILTRO
      .reduce((sum, acc) => sum + acc.balance, 0);
  }, [accounts]);
  return {
    accounts,
    isLoading,
    totalBalance,
    create,
    update,
    remove,
    refetch: fetch,
  };
}
