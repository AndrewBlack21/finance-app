import { supabase } from "./client";
import type { Invoice, ServiceResponse } from "@/types";

// ================================================================
// SERVICE DE FATURAS
// Responsabilidade: leitura e pagamento de faturas (invoices)
// ================================================================
export const invoiceService = {
  listByAccount: async (
    accountId: string,
  ): Promise<ServiceResponse<Invoice[]>> => {
    const { data, error } = await supabase
      .from("invoices")
      .select("*")
      .eq("account_id", accountId)
      .order("reference", { ascending: true });
    return { data, error: error?.message ?? null };
  },

  // Marca a fatura como paga — guarda de onde saiu o dinheiro, pra permitir desfazer depois
  payInvoice: async (
    id: string,
    payload: {
      paid_amount: number;
      paid_from_account_id: string;
      transaction_id?: string;
    },
  ): Promise<ServiceResponse<Invoice>> => {
    const { data, error } = await supabase
      .from("invoices")
      .update({ status: "paga", ...payload } as any)
      .eq("id", id)
      .select()
      .single();
    return { data, error: error?.message ?? null };
  },

  // Desfaz o pagamento — volta a fatura para "fechada" e limpa os dados de pagamento
  unpayInvoice: async (id: string): Promise<ServiceResponse<Invoice>> => {
    const { data, error } = await supabase
      .from("invoices")
      .update({
        status: "fechada",
        paid_amount: null,
        paid_from_account_id: null,
        transaction_id: null,
      } as any)
      .eq("id", id)
      .select()
      .single();
    return { data, error: error?.message ?? null };
  },
};
