import { useState, useEffect } from "react";
import { supabase } from "@/services";
import { useAuth } from "@/hooks/useAuth";

export interface BudgetGoal {
  id: string;
  user_id: string;
  category_id: string | null;
  label: string | null;
  monthly_limit: number;
  currency: string;
}

export function useBudgetGoals() {
  const [goals, setGoals] = useState<BudgetGoal[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { session } = useAuth();

  const fetch = async () => {
    if (!session?.user?.id) return;
    setIsLoading(true);
    const { data, error } = await supabase
      .from("budget_goals")
      .select("*")
      .eq("user_id", session.user.id);

    if (!error && data) {
      setGoals(data);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    if (session?.user?.id) fetch();
  }, [session?.user?.id]);

  // Cria ou atualiza uma meta (Geral ou por Categoria)
  const upsert = async (
    categoryId: string | null,
    label: string | null,
    monthly_limit: number,
    currency: string,
  ) => {
    if (!session?.user?.id) return { error: "Usuário não autenticado." };

    const payload = {
      user_id: session.user.id,
      category_id: categoryId,
      label,
      monthly_limit,
      currency,
    };

    // Procura se já existe uma meta para esta categoria específica (ou meta geral se for null)
    let query = supabase
      .from("budget_goals")
      .select("id")
      .eq("user_id", session.user.id);
    if (categoryId) {
      query = query.eq("category_id", categoryId);
    } else {
      query = query.is("category_id", null);
    }

    const { data: existing } = await query.single();

    let response;
    if (existing) {
      response = await supabase
        .from("budget_goals")
        .update({ monthly_limit, label })
        .eq("id", existing.id)
        .select()
        .single();
    } else {
      response = await supabase
        .from("budget_goals")
        .insert(payload)
        .select()
        .single();
    }

    if (response.error) return { error: response.error.message };

    if (response.data) {
      setGoals((prev) => {
        const idx = prev.findIndex((g) => g.category_id === categoryId);
        if (idx >= 0) {
          const copy = [...prev];
          copy[idx] = response.data;
          return copy;
        }
        return [...prev, response.data];
      });
    }
    return { data: response.data };
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("budget_goals").delete().eq("id", id);
    if (error) return { error: error.message };
    setGoals((prev) => prev.filter((g) => g.id !== id));
    return { success: true };
  };

  // 👇 O SEGREDO ESTÁ AQUI 👇
  // A Meta Global é aquela que não pertence a nenhuma categoria (null)
  const globalGoal = goals.find((g) => g.category_id === null);

  // O Orçamento Total passa a ser exatamente o valor que o utilizador definiu na Meta Global
  const totalBudget = globalGoal ? globalGoal.monthly_limit : 0;

  return {
    goals,
    globalGoal,
    isLoading,
    totalBudget,
    upsert,
    remove,
    refetch: fetch,
  };
}
