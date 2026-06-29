import { useState, useEffect } from "react";
import { fixedExpenseService, transactionService } from "@/services";
import type { FixedExpense, CreateFixedExpense } from "@/types";

export function useFixedExpenses() {
  const [expenses, setExpenses] = useState<FixedExpense[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetch = async () => {
    setIsLoading(true);
    const { data } = await fixedExpenseService.list();
    setExpenses(data ?? []);
    setIsLoading(false);
  };

  useEffect(() => {
    fetch();
  }, []);

  const create = async (payload: CreateFixedExpense) => {
    setIsLoading(true);
    const { data, error } = await fixedExpenseService.create(payload);
    if (data) setExpenses((prev) => [...prev, data]);
    setIsLoading(false);
    return { error };
  };

  // Paga a conta e cria transação de despesa automaticamente
  const markAsPaid = async (expense: FixedExpense) => {
    if (!expense.account_id) return { error: "Selecione uma conta para pagar" };

    // Cria a transação de despesa
    const { error: txError } = await transactionService.create({
      title: `${expense.title} (Conta Fixa)`,
      amount: expense.amount,
      currency: expense.currency,
      type: "expense",
      account_id: expense.account_id,
      category_id: expense.category_id,
      date: new Date().toISOString().split("T")[0],
      notes: "Gerado automaticamente por conta fixa",
      recurring: true,
    });
    if (txError) return { error: txError };

    // Marca como paga
    const { data, error } = await fixedExpenseService.markAsPaid(
      expense.id,
      expense.account_id,
    );
    if (data)
      setExpenses((prev) => prev.map((e) => (e.id === expense.id ? data : e)));
    return { error };
  };

  const remove = async (id: string) => {
    const { error } = await fixedExpenseService.remove(id);
    if (!error) setExpenses((prev) => prev.filter((e) => e.id !== id));
    return { error };
  };

  // Totais
  const totalMonth = expenses.reduce((s, e) => s + e.amount, 0);
  const totalPaid = expenses
    .filter((e) => e.is_paid)
    .reduce((s, e) => s + e.amount, 0);
  const totalPending = totalMonth - totalPaid;
  const pendingCount = expenses.filter((e) => !e.is_paid).length;

  return {
    expenses,
    isLoading,
    totalMonth,
    totalPaid,
    totalPending,
    pendingCount,
    create,
    markAsPaid,
    remove,
    refetch: fetch,
  };
}
