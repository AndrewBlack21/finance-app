import { useState, useEffect } from "react";
import { categoryService } from "@/services";
import type { Category, CreateCategory } from "@/types";

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetch = async () => {
    setIsLoading(true);
    const { data } = await categoryService.list();
    setCategories(data ?? []);
    setIsLoading(false);
  };

  useEffect(() => {
    fetch();
  }, []);

  const create = async (payload: CreateCategory) => {
    const { data, error } = await categoryService.create(payload);
    if (data) setCategories((prev) => [...prev, data]);
    return { data, error };
  };

  const remove = async (id: string) => {
    setIsLoading(true);
    const { error } = await categoryService.remove(id);
    if (!error) {
      setCategories((prev) => prev.filter((c) => c.id !== id));
    }
    setIsLoading(false);
    return { error };
  };

  const income = categories.filter((c) => c.type === "income");
  const expense = categories.filter((c) => c.type === "expense");

  return {
    categories,
    income,
    expense,
    isLoading,
    remove,
    create,
    refetch: fetch,
  };
}
