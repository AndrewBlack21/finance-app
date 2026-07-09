import { useState, useEffect, useCallback, useRef } from "react";
import { transactionService } from "@/services";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type {
  Transaction,
  CreateTransaction,
  UpdateTransaction,
  TransactionFilters,
} from "@/types";

// ===============================================================
// HOOK DE TRANSAÇÕES
// Responsabilidade: estado + CRUD + filtros + cache + paginação
// ================================================================

const PAGE_SIZE = 15; // itens por página
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos em ms
const CACHE_KEY = "@cache_transactions";

// ── Helpers de cache ────────────────────────────────────────
async function readCache(): Promise<Transaction[] | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { data, timestamp } = JSON.parse(raw);
    if (Date.now() - timestamp > CACHE_TTL) return null; // expirado
    return data;
  } catch {
    return null;
  }
}

async function writeCache(data: Transaction[]) {
  try {
    await AsyncStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ data, timestamp: Date.now() }),
    );
  } catch {}
}

async function clearCache() {
  try {
    await AsyncStorage.removeItem(CACHE_KEY);
  } catch {}
}

export function useTransactions(initialFilters: TransactionFilters = {}) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false); // ← novo: infinite scroll
  const [hasMore, setHasMore] = useState(true); // ← novo: controla se há mais páginas
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<TransactionFilters>(initialFilters);

  const pageRef = useRef(0); // página atual — não causa re-render

  // ── Busca inicial com cache ──────────────────────────────
  const fetch = useCallback(
    async (forceRefresh = false) => {
      setIsLoading(true);
      setError(null);
      pageRef.current = 0;

      // 1. Tenta cache (só usa se não houver filtros ativos e não for force refresh)
      const hasFilters = Object.values(filters).some((v) => v !== undefined);
      if (!forceRefresh && !hasFilters) {
        const cached = await readCache();
        if (cached) {
          setTransactions(cached);
          setHasMore(cached.length === PAGE_SIZE);
          setIsLoading(false);
          return;
        }
      }

      // 2. Busca no Supabase com paginação
      const { data, error } = await transactionService.list({
        ...filters,
        limit: PAGE_SIZE,
        offset: 0,
      } as any);

      if (error) {
        setError(error);
      } else {
        const result = data ?? [];
        setTransactions(result);
        setHasMore(result.length === PAGE_SIZE);
        if (!hasFilters) await writeCache(result); // só cacheia sem filtros
      }
      setIsLoading(false);
    },
    [filters],
  );

  // ── Carrega próxima página (infinite scroll) ─────────────
  const fetchMore = async () => {
    if (isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    pageRef.current += 1;

    const { data } = await transactionService.list({
      ...filters,
      limit: PAGE_SIZE,
      offset: pageRef.current * PAGE_SIZE,
    } as any);

    if (data && data.length > 0) {
      setTransactions((prev) => [...prev, ...data]);
      setHasMore(data.length === PAGE_SIZE);
    } else {
      setHasMore(false);
    }
    setIsLoadingMore(false);
  };

  // Re-busca sempre que filtros mudam — igual ao original
  useEffect(() => {
    fetch();
  }, [fetch]);

  // ── CRUD — mantém comportamento original ─────────────────
  const create = async (payload: CreateTransaction) => {
    setIsLoading(true);
    const { data, error } = await transactionService.create(payload);
    if (data) {
      setTransactions((prev) => [data, ...prev]);
      await clearCache(); // invalida cache após mutação
    }
    setIsLoading(false);
    return { data, error };
  };

  const update = async (id: string, payload: UpdateTransaction) => {
    setIsLoading(true);
    const { data, error } = await transactionService.update(id, payload);
    if (data) {
      setTransactions((prev) => prev.map((t) => (t.id === id ? data : t)));
      await clearCache();
    }
    setIsLoading(false);
    return { data, error };
  };

  const remove = async (id: string) => {
    const { error } = await transactionService.remove(id);
    if (!error) {
      setTransactions((prev) => prev.filter((t) => t.id !== id));
      await clearCache();
    }
    return { error };
  };

  // Calcular totais localmente — sem chamada extra ao banco
  const summary = transactions.reduce(
    (acc, t) => {
      if (t.type === "income") acc.income += t.amount;
      if (t.type === "expense") acc.expense += t.amount;
      return acc;
    },
    { income: 0, expense: 0 },
  );

  return {
    // ── Mantém tudo que existia ──
    transactions,
    isLoading,
    error,
    filters,
    setFilters,
    refetch: () => fetch(true), // força refresh ignorando cache
    create,
    update,
    remove,
    summary: { ...summary, balance: summary.income - summary.expense },
    // ── Novidades de paginação ──
    isLoadingMore,
    hasMore,
    fetchMore,
  };
}
