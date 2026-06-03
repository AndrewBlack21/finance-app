import { useState, useEffect, useCallback } from "react";
import { transactionService } from "@/services";
import type {
  Transaction,
  CreateTransaction,
  UpdateTransaction,
  TransactionFilters,
} from "@/types";

// ===============================================================
// HOOK DE TRANSAÇÔES
// Responsabilidade: estado + Crud + filtros
// ================================================================

export function useTransactions(initialFilters: TransactionFilters = {}) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<TransactionFilters>(initialFilters);

  // Busca lista com filtros aplicados
  const fetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const { data, error } = await transactionService.list(filters);
    if (error) setError(error);
    else setTransactions(data ?? []);
    setIsLoading(false);
  }, [filters]);

  // Re-busca sempre que filtros mudam
  useEffect(() => {
    fetch();
  }, [fetch]);

  const create = async (payload: CreateTransaction) => {
    setIsLoading(true);
    const { data, error } = await transactionService.create(payload);
    if (data) setTransactions((prev) => [data, ...prev]);
    setIsLoading(false);
    return { data, error };
  };

  const update = async (id: string, payload: UpdateTransaction) => {
    setIsLoading(true);
    const { data, error } = await transactionService.update(id, payload);
    if (data)
      setTransactions((prev) => prev.map((t) => (t.id === id ? data : t)));
    setIsLoading(false);
    return { data, error };
  };

  const remove = async (id: string) => {
    const { error } = await transactionService.remove(id);
    if (!error) setTransactions((prev) => prev.filter((t) => t.id !== id));
    return { error };
  };

  //Calcular totais localmente - sem chamada extra ao banco
  const summary = transactions.reduce(
    (acc, t) => {
      if (t.type === "income") acc.income += t.amount;
      if (t.type === "expense") acc.expense += t.amount;
      return acc;
    },
    { income: 0, expense: 0 },
  );

  return {
    transactions,
    isLoading,
    error,
    filters,
    setFilters,
    refetch: fetch,
    create,
    update,
    remove,
    summary: {
      ...summary,
      balance: summary.income - summary.expense,
    },
  };
}
