import { useCallback, useEffect, useMemo, useState } from "react";
import { shoppingListService } from "@/services";
import type { ShoppingListItem } from "@/types";

export function useShoppingList() {
  const [items, setItems] = useState<ShoppingListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const sortItems = (list: ShoppingListItem[]) =>
    [...list].sort((a, b) => {
      if (a.is_purchased !== b.is_purchased) {
        return a.is_purchased ? 1 : -1;
      }
      return b.created_at.localeCompare(a.created_at);
    });

  const fetchItems = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const { data, error: fetchError } = await shoppingListService.list();

    if (fetchError) setError(fetchError);
    setItems(sortItems(data ?? []));
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const addItem = async (productName: string) => {
    const cleanName = productName.trim();
    if (!cleanName) return { error: "Digite o produto." };

    const { data, error: createError } = await shoppingListService.create({
      product_name: cleanName,
    });

    if (data) setItems((current) => sortItems([data, ...current]));
    if (createError) setError(createError);

    return { error: createError };
  };

  const markPurchased = async (id: string, value: number) => {
    const { data, error: updateError } =
      await shoppingListService.markPurchased(id, value);

    if (data) {
      setItems((current) =>
        sortItems(current.map((item) => (item.id === id ? data : item))),
      );
    }

    if (updateError) setError(updateError);
    return { error: updateError };
  };

  const markPending = async (id: string) => {
    const { data, error: updateError } =
      await shoppingListService.markPending(id);

    if (data) {
      setItems((current) =>
        sortItems(current.map((item) => (item.id === id ? data : item))),
      );
    }

    if (updateError) setError(updateError);
    return { error: updateError };
  };

  const removeItem = async (id: string) => {
    const { error: removeError } = await shoppingListService.remove(id);

    if (!removeError) {
      setItems((current) => current.filter((item) => item.id !== id));
    } else {
      setError(removeError);
    }

    return { error: removeError };
  };

  const pendingItems = useMemo(
    () => items.filter((item) => !item.is_purchased),
    [items],
  );

  const purchasedItems = useMemo(
    () => items.filter((item) => item.is_purchased),
    [items],
  );

  const purchasedTotal = useMemo(
    () =>
      purchasedItems.reduce(
        (total, item) => total + Number(item.purchased_value ?? 0),
        0,
      ),
    [purchasedItems],
  );

  return {
    items,
    pendingItems,
    purchasedItems,
    purchasedTotal,
    isLoading,
    error,
    addItem,
    markPurchased,
    markPending,
    removeItem,
    refetch: fetchItems,
  };
}
