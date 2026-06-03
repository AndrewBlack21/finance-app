import { useState, useEffect } from "react";
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

  const remove = async (id: string) => {
    const { error } = await accountService.remove(id);
    if (!error) setAccounts((prev) => prev.filter((a) => a.id !== id));
    return { error };
  };

  const totalBalance = accounts.reduce((sum, a) => sum + a.balance, 0);

  return { accounts, isLoading, totalBalance, create, remove, refetch: fetch };
}
