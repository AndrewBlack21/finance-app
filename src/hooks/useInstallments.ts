import { useState, useEffect } from "react";
import { installmentService } from "@/services";
import type { Installment, CreateInstallment } from "@/types";

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
    if (i.paid_installments < i.total_installments)
      return sum + i.installment_amount;
    return sum;
  }, 0);

  return {
    installments,
    isLoading,
    monthlyTotal,
    create,
    payInstallment,
    remove,
    refetch: fetch,
  };
}
