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
};
