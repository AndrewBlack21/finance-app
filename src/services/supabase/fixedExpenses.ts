import { supabase } from "./client";
import type {
  FixedExpense,
  CreateFixedExpense,
  UpdateFixedExpense,
  ServiceResponse,
} from "@/types";

export const fixedExpenseService = {
  list: async (): Promise<ServiceResponse<FixedExpense[]>> => {
    const { data, error } = await supabase
      .from("fixed_expenses")
      .select("*, account:accounts(*), category:categories(*)")
      .order("due_day", { ascending: true });
    return { data, error: error?.message ?? null };
  },

  create: async (
    payload: CreateFixedExpense,
  ): Promise<ServiceResponse<FixedExpense>> => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("fixed_expenses")
      .insert({ ...payload, user_id: user!.id })
      .select("*, account:accounts(*), category:categories(*)")
      .single();
    return { data, error: error?.message ?? null };
  },

  // Marca como paga e cria despesa na conta automaticamente
  markAsPaid: async (
    id: string,
    accountId: string,
  ): Promise<ServiceResponse<FixedExpense>> => {
    const today = new Date().toISOString().split("T")[0];
    const { data, error } = await supabase
      .from("fixed_expenses")
      .update({ is_paid: true, paid_at: today })
      .eq("id", id)
      .select("*, account:accounts(*), category:categories(*)")
      .single();
    return { data, error: error?.message ?? null };
  },

  undoPaid: async (id: string): Promise<ServiceResponse<FixedExpense>> => {
    const { data, error } = await supabase
      .from("fixed_expenses")
      .update({ is_paid: false, paid_at: null })
      .eq("id", id)
      .select("*, account:accounts(*), category:categories(*)")
      .single();
    return { data, error: error?.message ?? null };
  },

  // Reseta pagamentos (virada do mês)
  resetPaid: async (): Promise<ServiceResponse<null>> => {
    const { error } = await supabase
      .from("fixed_expenses")
      .update({ is_paid: false, paid_at: null })
      .eq("recurring", true);
    return { data: null, error: error?.message ?? null };
  },

  update: async (
    id: string,
    payload: UpdateFixedExpense,
  ): Promise<ServiceResponse<FixedExpense>> => {
    const { data, error } = await supabase
      .from("fixed_expenses")
      .update(payload)
      .eq("id", id)
      .select("*, account:accounts(*), category:categories(*)")
      .single();
    return { data, error: error?.message ?? null };
  },

  remove: async (id: string): Promise<ServiceResponse<null>> => {
    const { error } = await supabase
      .from("fixed_expenses")
      .delete()
      .eq("id", id);
    return { data: null, error: error?.message ?? null };
  },

  // 1. Busca as despesas de um mês específico (Ex: "2026-07")
  getForMonth: async (
    monthYear: string,
  ): Promise<ServiceResponse<FixedExpense[]>> => {
    const { data, error } = await supabase
      .from("fixed_expenses")
      .select("*, account:accounts(*), category:categories(*)")
      .like("date", `${monthYear}%`); // Busca tudo que começa com o ano-mês
    return { data, error: error?.message ?? null };
  },

  // 2. Busca todas as contas que se repetem (filtrando duplicadas para não gerar cópias a mais)
  getAllRecurring: async (): Promise<ServiceResponse<FixedExpense[]>> => {
    const { data, error } = await supabase
      .from("fixed_expenses")
      .select("*")
      .eq("recurring", true);

    // Removemos duplicados pelo nome para garantir que o "Aluguel" não será copiado 5x
    const unique = data
      ? Array.from(new Map(data.map((item) => [item.title, item])).values())
      : [];

    return { data: unique as FixedExpense[], error: error?.message ?? null };
  },

  // 3. Cria várias cópias de uma só vez no banco de dados
  createMany: async (
    payloads: CreateFixedExpense[],
  ): Promise<ServiceResponse<FixedExpense[]>> => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Adiciona o ID do usuário em todas as cópias antes de enviar
    const withUser = payloads.map((p) => ({ ...p, user_id: user!.id }));

    const { data, error } = await supabase
      .from("fixed_expenses")
      .insert(withUser)
      .select();
    return { data, error: error?.message ?? null };
  },
};
