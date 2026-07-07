import { useState, useEffect, useMemo } from "react";
import { installmentService } from "@/services";
import type { Installment, CreateInstallment } from "@/types";
import type { InstallmentGroup } from "@/types";
import { supabase } from "@/services";
export function useInstallments() {
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetch = async () => {
    setIsLoading(true);
    const { data } = await installmentService.list();
    // Calcula campos derivados
    const enriched = (data ?? []).map((i) => ({
      ...i,
      remaining_installments: i.total_installments - i.paid_installments,
      progress: Math.round((i.paid_installments / i.total_installments) * 100),
    }));
    setInstallments(enriched);
    setIsLoading(false);
  };

  useEffect(() => {
    fetch();
  }, []);

  const create = async (payload: CreateInstallment) => {
    setIsLoading(true);
    const { data, error } = await installmentService.create(payload);
    if (data) {
      const enriched = {
        ...data,
        remaining_installments:
          data.total_installments - data.paid_installments,
        progress: 0,
      };
      setInstallments((prev) => [enriched, ...prev]);
    }
    setIsLoading(false);
    return { data, error };
  };

  const payInstallment = async (id: string, currentPaid: number) => {
    const { data, error } = await installmentService.payInstallment(
      id,
      currentPaid,
    );
    if (data) {
      setInstallments((prev) =>
        prev.map((i) =>
          i.id === id
            ? {
                ...data,
                remaining_installments:
                  data.total_installments - data.paid_installments,
                progress: Math.round(
                  (data.paid_installments / data.total_installments) * 100,
                ),
              }
            : i,
        ),
      );
    }
    return { error };
  };

  const remove = async (id: string) => {
    const { error } = await installmentService.remove(id);
    if (!error) setInstallments((prev) => prev.filter((i) => i.id !== id));
    return { error };
  };

  // Total de parcelas pendentes no mês
  const monthlyTotal = installments.reduce((sum, i) => {
    return sum + i.installment_amount;
  }, 0);

  // NOVA FUNÇÃO: Atualiza uma compra parcelada no banco e no estado local
  const update = async (id: string, payload: Partial<CreateInstallment>) => {
    setIsLoading(true);
    const { data, error } = await installmentService.update(id, payload);
    if (data) {
      setInstallments((prev) =>
        prev.map((i) =>
          i.id === id
            ? {
                ...data,
                remaining_installments:
                  data.total_installments - data.paid_installments,
                progress: Math.round(
                  (data.paid_installments / data.total_installments) * 100,
                ),
              }
            : i,
        ),
      );
    }
    setIsLoading(false);
    return { data, error };
  };
  const groupedByAccount = useMemo((): InstallmentGroup[] => {
    const map: Record<string, InstallmentGroup> = {};
    const today = new Date().getDate();

    installments.forEach((i) => {
      const id = i.account_id;
      const acct = i.account;
      if (!map[id]) {
        const due = acct?.due_day ?? null;
        const diff = due !== null ? due - today : null;
        map[id] = {
          account_id: id,
          account_name: acct?.name ?? "Sem conta",
          account_color: acct?.color ?? "#6366f1",
          due_day: due,
          monthly_total: 0,
          currency: i.currency,
          installments: [],
          is_overdue: diff !== null && diff >= 0 && diff <= 2,
        };
      }
      // Só soma parcelas em aberto
      if (i.paid_installments < i.total_installments) {
        map[id].monthly_total += i.installment_amount;
      }
      map[id].installments.push(i);
    });

    return Object.values(map).sort(
      (a, b) => (a.due_day ?? 99) - (b.due_day ?? 99),
    );
  }, [installments]);

  // Paga TODAS as parcelas do mês de um cartão e persiste o mês pago
  const payFullInvoice = async (accountId: string) => {
    setIsLoading(true);
    const currentMonth = new Date().toISOString().slice(0, 7);

    const activeInstallments = installments.filter(
      (i) =>
        i.account_id === accountId &&
        i.paid_installments < i.total_installments,
    );

    const promises = activeInstallments.map((i) =>
      installmentService.update(i.id, {
        paid_installments: i.paid_installments + 1,
        invoice_paid_month: currentMonth,
      }),
    );

    await Promise.all(promises);
    await fetch(); // Recarrega os dados do banco para o estado local
    setIsLoading(false);
  };
  return {
    installments,
    isLoading,
    monthlyTotal,
    groupedByAccount,
    create,
    payInstallment,
    payFullInvoice,
    update, // <-- Exportando a nova função de edição
    remove,
    refetch: fetch,
  };
}
