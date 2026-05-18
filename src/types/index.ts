export type AccountType = "checking" | "savings" | "credit" | "investment";
import { type } from "./index";
export type TransactionType = "income" | "expense" | "transfer";
export type CategoryType = "income" | "expense";

export interface Profile {
  id: string;
  name: string | null;
  avatar_url: string | null;
  currency: string;
  created_at: string;
}

export interface Accout {
  id: string;
  user_id: string;
  name: string;
  type: AccountType;
  balance: number;
  currency: string;
  color: string;
  created_at: string;
}

export interface Category {
  id: string;
  user_id: string | null; // null categoria gobal
  name: string;
  icon: string;
  color: string;
  type: CategoryType;
  created_at: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  account_id: string;
  category_id: string | null; // null categoria gobal
  title: string;
  amount: number;
  type: TransactionType;
  date: string;
  description: string | null;
  notes: string | null;
  recurring: boolean;
  created_at: string; // Joins opcionais (quando fizer select com related)
  category?: Category;
  account?: Accout;
}

export interface Goal {
  id: string;
  user_id: string;
  title: string;
  target: number;
  current: number;
  currency: string;
  deadline: string | null;
  color: string;
  created_at: string;
}

// ============================================================
// DTOs — dados de entrada para criação/edição (sem id/user_id/created_at)
// ============================================================
export type CreateAccount = Omit<Account, "id" | "user_id" | "created_at">;
export type UpdateAccount = Partial<CreateAccount>;

export type CreateCategory = Omit<Category, "id" | "user_id" | "created_at">;
export type UpdateCategory = Partial<CreateCategory>;

export type CreateTransaction = Omit<
  Transaction,
  "id" | "user_id" | "created_at" | "category" | "account"
>;
export type UpdateTransaction = Partial<CreateTransaction>;

export type CreateGoal = Omit<Goal, "id" | "user_id" | "created_at">;
export type UpdateGoal = Partial<CreateGoal>;

// ============================================================
// FILTROS — usados nos hooks de listagem
// ============================================================
export interface TransactionFilters {
  type?: TransactionType;
  category_id?: string;
  account_id?: string;
  currency?: string;
  date_from?: string;
  date_to?: string;
}

// ============================================================
// DASHBOARD — tipos dos dados agregados
// ============================================================
export interface DashboardSummary {
  totalIncome: number;
  totalExpense: number;
  balance: number;
  currency: string;
}

export interface CategorySummary {
  category: Category;
  total: number;
  percentage: number;
}

// ============================================================
// AUTH
// ============================================================
export interface AuthCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials extends AuthCredentials {
  name: string;
}

// ============================================================
// RESPOSTA PADRÃO DOS SERVICES
// Padrão reutilizável: sempre retorna { data, error }
// ============================================================
export interface ServiceResponse<T> {
  data: T | null;
  error: string | null;
}
