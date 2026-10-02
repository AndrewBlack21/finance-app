import { supabase } from "./client";
import type {
  ShoppingListItem,
  CreateShoppingListItem,
  ServiceResponse,
} from "@/types";

export const shoppingListService = {
  list: async (): Promise<ServiceResponse<ShoppingListItem[]>> => {
    const { data, error } = await supabase
      .from("shopping_list_items")
      .select("*")
      .order("is_purchased", { ascending: true })
      .order("created_at", { ascending: false });

    return {
      data: (data ?? []) as ShoppingListItem[],
      error: error?.message ?? null,
    };
  },

  create: async (
    payload: CreateShoppingListItem,
  ): Promise<ServiceResponse<ShoppingListItem>> => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { data: null, error: "Usuário não autenticado." };
    }

    const { data, error } = await supabase
      .from("shopping_list_items")
      .insert({
        product_name: payload.product_name,
        is_purchased: false,
        purchased_value: null,
        purchased_at: null,
        user_id: user.id,
      })
      .select("*")
      .single();

    return {
      data: data as ShoppingListItem | null,
      error: error?.message ?? null,
    };
  },

  markPurchased: async (
    id: string,
    purchasedValue: number,
  ): Promise<ServiceResponse<ShoppingListItem>> => {
    const { data, error } = await supabase
      .from("shopping_list_items")
      .update({
        is_purchased: true,
        purchased_value: purchasedValue,
        purchased_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("*")
      .single();

    return {
      data: data as ShoppingListItem | null,
      error: error?.message ?? null,
    };
  },

  markPending: async (
    id: string,
  ): Promise<ServiceResponse<ShoppingListItem>> => {
    const { data, error } = await supabase
      .from("shopping_list_items")
      .update({
        is_purchased: false,
        purchased_value: null,
        purchased_at: null,
      })
      .eq("id", id)
      .select("*")
      .single();

    return {
      data: data as ShoppingListItem | null,
      error: error?.message ?? null,
    };
  },

  remove: async (id: string): Promise<ServiceResponse<null>> => {
    const { error } = await supabase
      .from("shopping_list_items")
      .delete()
      .eq("id", id);

    return { data: null, error: error?.message ?? null };
  },
};
