import { useState, useEffect, useMemo } from "react";
import { installmentService } from "@/services";
import type { Installment, CreateInstallment } from "@/types";
import type { InstallmentGroup } from "@/types";
import { supabase } from "@/services";

// ================================================================
// HOOK DE PARCELAS (compras no cartão de crédito)
// Responsabilidade: CRUD de installments + pagar/desfazer pagamento
// por lista de ids (a fatura "atual" de cada parcela é calculada
// dinamicamente em credit.tsx a partir de paid_installments, então
// esse hook não precisa saber nada sobre qual fatura é qual — só
// incrementa/decrementa o contador de parcelas pagas).
// ================================================================
export function useInstallments() {
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetch = async () => {
    setIsLoading(true);
    const { data } = await installmentService.list();
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

  const remove = async (id: string) => {
    const { error } = await installmentService.remove(id);
    if (!error) setInstallments((prev) => prev.filter((i) => i.id !== id));
    return { error };
  };

  // Total de parcelas pendentes no mês (uso geral, fora do módulo de cartões)
  const monthlyTotal = installments.reduce(
    (sum, i) => sum + i.installment_amount,
    0,
  );

  // Paga uma lista específica de parcelas — incrementa paid_installments de cada uma.
  // Quem decide QUAIS ids pagar é o credit.tsx, que já calculou quais pertencem à fatura atual.
  const payInstallments = async (installmentIds: string[]) => {
    setIsLoading(true);
    const promises = installmentIds.map((id) => {
      const inst = installments.find((i) => i.id === id);
      if (!inst) return Promise.resolve({ data: null, error: null });
      return installmentService.update(id, {
        paid_installments: inst.paid_installments + 1,
      });
    });
    const results = await Promise.all(promises);
    await fetch();
    setIsLoading(false);
    const error = results.find((result) => result?.error)?.error ?? null;
    return { error };
  };

  // Desfaz o pagamento de uma lista específica de parcelas — volta paid_installments -1
  const unpayInstallments = async (installmentIds: string[]) => {
    setIsLoading(true);
    const promises = installmentIds.map((id) => {
      const inst = installments.find((i) => i.id === id);
      if (!inst || inst.paid_installments <= 0)
        return Promise.resolve({ data: null, error: null });
      return installmentService.update(id, {
        paid_installments: inst.paid_installments - 1,
      });
    });
    const results = await Promise.all(promises);
    await fetch();
    setIsLoading(false);
    const error = results.find((result) => result?.error)?.error ?? null;
    return { error };
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
      if (i.paid_installments < i.total_installments) {
        map[id].monthly_total += i.installment_amount;
      }
      map[id].installments.push(i);
    });

    return Object.values(map).sort(
      (a, b) => (a.due_day ?? 99) - (b.due_day ?? 99),
    );
  }, [installments]);

  return {
    installments,
    isLoading,
    monthlyTotal,
    groupedByAccount,
    create,
    payInstallments,
    unpayInstallments,
    update,
    remove,
    refetch: fetch,
  };
}
