import { supabase } from "./client";
import type {
  Installment,
  CreateInstallment,
  UpdateInstallment,
  ServiceResponse,
} from "@/types";

export const installmentService = {
  list: async (): Promise<ServiceResponse<Installment[]>> => {
    const { data, error } = await supabase
      .from("installments")
      .select(
        "*, account:accounts(*), invoice:invoices!installments_invoice_id_fkey(*)",
      ) // <-- Apenas um select com tudo incluído
      .order("created_at", { ascending: false });
    return { data, error: error?.message ?? null };
  },

  create: async (
    payload: CreateInstallment,
  ): Promise<ServiceResponse<Installment>> => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("installments")
      .insert({ ...payload, user_id: user!.id })
      .select(
        "*, account:accounts(*), invoice:invoices!installments_invoice_id_fkey(*)",
      ) // <-- Corrigido
      .single();
    return { data, error: error?.message ?? null };
  },

  payInstallment: async (
    id: string,
    currentPaid: number,
  ): Promise<ServiceResponse<Installment>> => {
    const { data: current, error: fetchError } = await supabase
      .from("installments")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError) {
      return { data: null, error: fetchError.message };
    }

    const newPaid = (current?.paid_installments ?? currentPaid) + 1;

    const { data, error } = await supabase
      .from("installments")
      .update({ paid_installments: newPaid })
      .eq("id", id)
      .select("*, account:accounts(*), invoice:invoices(*)") // <-- Mantido padrão
      .single();
    return { data, error: error?.message ?? null };
  },

  update: async (
    id: string,
    payload: UpdateInstallment,
  ): Promise<ServiceResponse<Installment>> => {
    const { data, error } = await supabase
      .from("installments")
      .update(payload)
      .eq("id", id)
      .select(
        "*, account:accounts(*), invoice:invoices!installments_invoice_id_fkey(*)",
      ) // <-- Corrigido
      .single();
    return { data, error: error?.message ?? null };
  },

  remove: async (id: string): Promise<ServiceResponse<null>> => {
    const { error } = await supabase.from("installments").delete().eq("id", id);
    return { data: null, error: error?.message ?? null };
  },
};
