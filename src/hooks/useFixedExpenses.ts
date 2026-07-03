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
    // sem bloqueio — permite pagar mesmo sem conta vinculada

    // Cria a transação de despesa
    const { error: txError } = await transactionService.create({
      title: `${expense.title} (Conta Fixa)`,
      amount: expense.amount,
      currency: expense.currency,
      amount: expense.amount,
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
      expense.account_id ?? "",
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

  const undoPaid = async (id: string) => {
    setIsLoading(true);
    const { data, error } = await fixedExpenseService.update(id, {
      is_paid: false,
      paid_at: null,
    });
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

  // ============================================================
  // INTELIGÊNCIA: GERA CÓPIAS PARA O NOVO MÊS
  // ============================================================
  const generateMonthlyFixedExpenses = async () => {
    setIsLoading(true);

    const currentMonth = new Date().toISOString().slice(0, 7); // Ex: "2026-07"

    // 1. Verifica se já geramos contas para este mês (para não duplicar)
    const { data: currentExpenses } =
      await fixedExpenseService.getForMonth(currentMonth);

    if (currentExpenses && currentExpenses.length === 0) {
      // 2. Se está vazio, pega as contas recorrentes ativas
      const { data: allActive } = await fixedExpenseService.getAllRecurring();

      if (allActive && allActive.length > 0) {
        // 3. Prepara as cópias com o status "não pago" para o mês atual
        const copies = allActive.map((expense) => ({
          title: expense.title,
          amount: expense.amount,
          currency: expense.currency,
          due_day: expense.due_day,
          account_id: expense.account_id,
          category_id: expense.category_id,
          is_paid: false, // Começa devendo!
          paid_at: null,
          recurring: true,
          // Ajusta a data para o mês atual
          date: `${currentMonth}-${String(expense.due_day).padStart(2, "0")}`,
        }));

        // 4. Salva as cópias no banco
        await fixedExpenseService.createMany(copies);
        await fetch(); // Atualiza a tela
      }
    }
    setIsLoading(false);
  };

  return {
    expenses,
    isLoading,
    totalMonth,
    totalPaid,
    totalPending,
    pendingCount,
    generateMonthlyFixedExpenses,
    create,
    markAsPaid,
    undoPaid,
    remove,
    refetch: fetch,
  };
}
