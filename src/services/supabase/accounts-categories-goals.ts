import { supabase } from "./client";
import type {
  Accout,
  CreateAccount,
  UpdateAccount,
  Category,
  CreateCategory,
  UpdateCategory,
  Goal,
  CreateGoal,
  UpdateGoal,
  ServiceResponse,
} from "../../types/index";

// ============================================================
// ACCOUNTS SERVICE
// ============================================================
export const accountService = {
  list: async (): Promise<ServiceResponse<Accout[]>> => {
    const { data, error } = await supabase
      .from("accounts")
      .select("*")
      .order("created_at", { ascending: true });
    return { data, error: error?.message ?? null };
  },

  create: async (payload: CreateAccount): Promise<ServiceResponse<Accout>> => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("accounts")
      .insert({ ...payload, user_id: user!.id })
      .select()
      .single();
    return { data, error: error?.message ?? null };
  },

  update: async (
    id: string,
    payload: UpdateAccount,
  ): Promise<ServiceResponse<Accout>> => {
    const { data, error } = await supabase
      .from("accounts")
      .update(payload)
      .eq("id", id)
      .select()
      .single();
    return { data, error: error?.message ?? null };
  },

  remove: async (id: string): Promise<ServiceResponse<null>> => {
    const { error } = await supabase.from("accounts").delete().eq("id", id);
    return { data: null, error: error?.message ?? null };
  },
};

// ============================================================
// CATEGORIES SERVICE
// ============================================================
export const categoryService = {
  // Retorna categorias do usuário + categorias globais (user_id IS NULL)
  // O RLS já filtra isso — a policy "own + global" cuida disso no banco
  list: async (): Promise<ServiceResponse<Category[]>> => {
    const { data, error } = await supabase
      .from("categories")
      .select("*")
      .order("name", { ascending: true });
    return { data, error: error?.message ?? null };
  },

  create: async (
    payload: CreateCategory,
  ): Promise<ServiceResponse<Category>> => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("categories")
      .insert({ ...payload, user_id: user!.id })
      .select()
      .single();
    return { data, error: error?.message ?? null };
  },

  update: async (
    id: string,
    payload: UpdateCategory,
  ): Promise<ServiceResponse<Category>> => {
    const { data, error } = await supabase
      .from("categories")
      .update(payload)
      .eq("id", id)
      .select()
      .single();
    return { data, error: error?.message ?? null };
  },

  remove: async (id: string): Promise<ServiceResponse<null>> => {
    const { error } = await supabase.from("categories").delete().eq("id", id);
    return { data: null, error: error?.message ?? null };
  },
};

// ============================================================
// GOALS SERVICE
// ============================================================
export const goalService = {
  list: async (): Promise<ServiceResponse<Goal[]>> => {
    const { data, error } = await supabase
      .from("goals")
      .select("*")
      .order("deadline", { ascending: true });
    return { data, error: error?.message ?? null };
  },

  create: async (payload: CreateGoal): Promise<ServiceResponse<Goal>> => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("goals")
      .insert({ ...payload, user_id: user!.id })
      .select()
      .single();
    return { data, error: error?.message ?? null };
  },

  update: async (
    id: string,
    payload: UpdateGoal,
  ): Promise<ServiceResponse<Goal>> => {
    const { data, error } = await supabase
      .from("goals")
      .update(payload)
      .eq("id", id)
      .select()
      .single();
    return { data, error: error?.message ?? null };
  },

  // Atualiza apenas o valor atual da meta (ação frequente)
  updateProgress: async (
    id: string,
    current: number,
  ): Promise<ServiceResponse<Goal>> => {
    return goalService.update(id, { current });
  },

  remove: async (id: string): Promise<ServiceResponse<null>> => {
    const { error } = await supabase.from("goals").delete().eq("id", id);
    return { data: null, error: error?.message ?? null };
  },
};
