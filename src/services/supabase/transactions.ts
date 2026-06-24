import { supabase } from "./client";
import type {
  Transaction,
  CreateTransaction,
  UpdateTransaction,
  TransactionFilters,
  ServiceResponse,
} from "@/types";

export const transactionService = {
  // Lista com filtros opcionais + join de category e account
  list: async (
    filters: TransactionFilters = {},
  ): Promise<ServiceResponse<Transaction[]>> => {
    let query = supabase
      .from("transactions")
      .select("*, category:categories(*), account:accounts(*)")
      .order("date", { ascending: false });

    // Aplica filtros dinamicamente — só adiciona se o valor existir
    if (filters.type) query = query.eq("type", filters.type);
    if (filters.category_id)
      query = query.eq("category_id", filters.category_id);
    if (filters.account_id) query = query.eq("account_id", filters.account_id);
    if (filters.currency) query = query.eq("currency", filters.currency);
    if (filters.date_from) query = query.gte("date", filters.date_from);
    if (filters.date_to) query = query.lte("date", filters.date_to);

    const { data, error } = await query;
    return { data, error: error?.message ?? null };
  },

  // Busca uma transação por id
  getById: async (id: string): Promise<ServiceResponse<Transaction>> => {
    const { data, error } = await supabase
      .from("transactions")
      .select("*, category:categories(*), account:accounts(*)")
      .eq("id", id)
      .single();
    return { data, error: error?.message ?? null };
  },

  // Cria — RLS garante que user_id = auth.uid() automaticamente
  create: async (
    payload: CreateTransaction,
  ): Promise<ServiceResponse<Transaction>> => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("transactions")
      .insert({ ...payload, user_id: user!.id })
      .select("*, category:categories(*), account:accounts(*)")
      .single();
    return { data, error: error?.message ?? null };
  },

  // Atualiza campos específicos
  update: async (
    id: string,
    payload: UpdateTransaction,
  ): Promise<ServiceResponse<Transaction>> => {
    const { data, error } = await supabase
      .from("transactions")
      .update(payload)
      .eq("id", id)
      .select()
      .single();
    return { data, error: error?.message ?? null };
  },

  // Remove
  remove: async (id: string): Promise<ServiceResponse<null>> => {
    const { error } = await supabase.from("transactions").delete().eq("id", id);
    return { data: null, error: error?.message ?? null };
  },

  // Resumo mensal para o dashboard
  // Retorna total de income e expense de um mês/ano
  getMonthlySummary: async (year: number, month: number) => {
    const from = `${year}-${String(month).padStart(2, "0")}-01`;
    const to = `${year}-${String(month).padStart(2, "0")}-31`;

    const { data, error } = await supabase
      .from("transactions")
      .select("type, amount, currency")
      .gte("date", from)
      .lte("date", to);

    return { data, error: error?.message ?? null };
  },
};
