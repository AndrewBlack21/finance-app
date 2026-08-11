import { useState, useEffect } from "react";
import { fixedExpenseService, transactionService } from "@/services";
import type { FixedExpense, CreateFixedExpense } from "@/types";

export function useFixedExpenses() {
  const [expenses, setExpenses] = useState<FixedExpense[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetch = async () => {
    setIsLoading(true);
    const { data } = await fixedExpenseService.list();

    let validExpenses = data ?? [];

    // 👇 INTELIGÊNCIA DE VIRADA DE MÊS (Auto-Reset) 👇
    const currentMonth = new Date().toISOString().slice(0, 7); // Ex: "2026-08"

    // 1. Verifica se há alguma conta que foi paga num mês anterior
    const hasOutdated = validExpenses.some(
      (e) => e.is_paid && e.paid_at && e.paid_at.slice(0, 7) < currentMonth,
    );

    if (hasOutdated) {
      // 2. Atualiza automaticamente no banco as contas do passado para "pendente"
      const updated = await Promise.all(
        validExpenses.map(async (expense) => {
          if (
            expense.is_paid &&
            expense.paid_at &&
            expense.paid_at.slice(0, 7) < currentMonth
          ) {
            // Volta a conta para o estado original (Não paga)
            const { data: refreshed } = await fixedExpenseService.update(
              expense.id,
              {
                is_paid: false,
                paid_at: null,
              } as any,
            );

            return refreshed || { ...expense, is_paid: false, paid_at: null };
          }
          return expense;
        }),
      );
      validExpenses = updated; // Atualiza a lista visual com os dados corrigidos
    }

    setExpenses(validExpenses);
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

  const markAsPaid = async (expense: FixedExpense) => {
    if (!expense.account_id) {
      return {
        error:
          "É necessário vincular uma conta bancária para realizar o pagamento.",
      };
    }

    // Usamos a data de hoje para registar a transação
    const todayStr = new Date().toISOString().split("T")[0];

    // Cria a transação de despesa
    const { error: txError } = await transactionService.create({
      title: `${expense.title} (Conta Fixa)`,
      amount: expense.amount,
      currency: expense.currency,
      type: "expense",
      account_id: expense.account_id,
      category_id: expense.category_id,
      date: todayStr,
      notes: "Gerado automaticamente por conta fixa",
      recurring: true,
    } as any);

    if (txError) return { error: txError };

    // Marca a conta como paga. O teu backend já deve tratar do 'paid_at'
    const { data, error } = await fixedExpenseService.markAsPaid(
      expense.id,
      expense.account_id,
    );

    if (data) {
      setExpenses((prev) => prev.map((e) => (e.id === expense.id ? data : e)));
    }

    return { error };
  };

  const remove = async (id: string) => {
    const { error } = await fixedExpenseService.remove(id);
    if (!error) setExpenses((prev) => prev.filter((e) => e.id !== id));
    return { error };
  };

  const undoPaid = async (id: string) => {
    setIsLoading(true);
    const { data, error } = await fixedExpenseService.update(id, {
      is_paid: false,
      paid_at: null,
    } as any);
    if (data) setExpenses((prev) => prev.map((e) => (e.id === id ? data : e)));
    setIsLoading(false);
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
    undoPaid,
    remove,
    refetch: fetch,
  };
}
