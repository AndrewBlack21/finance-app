// ============================================================
// ENUMS — espelham os tipos criados no Supabase
// ============================================================
export type AccountType = "checking" | "savings" | "credit" | "investment";
export type TransactionType = "income" | "expense" | "transfer";
export type CategoryType = "income" | "expense";

// ============================================================
// ENTIDADES — espelham as tabelas do banco
// ============================================================
export interface Profile {
  id: string;
  name: string | null;
  avatar_url: string | null;
  currency: string;
  created_at: string;
}

export interface Account {
  id: string;
  user_id: string;
  name: string;
  type: AccountType;
  balance: number;
  currency: string;
  color: string;
  created_at: string;
  due_day: number | null;
}
export interface InstallmentGroup {
  account_id: string;
  account_name: string;
  account_color: string;
  due_day: number | null;
  monthly_total: number; // soma das parcelas do mês
  currency: string;
  installments: Installment[];
  is_overdue: boolean; // vence em <= 2 dias
}

export interface Category {
  id: string;
  user_id: string | null; // null = categoria global
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
  category_id: string | null;
  title: string;
  amount: number;
  currency: string;
  type: TransactionType;
  date: string;
  notes: string | null;
  recurring: boolean;
  created_at: string;
  // Joins opcionais (quando fizer select com related)
  category?: Category;
  account?: Account;
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

export interface FixedExpense {
  id: string;
  user_id: string;
  title: string;
  amount: number;
  currency: string;
  due_day: number;
  account_id: string | null;
  category_id: string | null;
  is_paid: boolean;
  paid_at: string | null;
  recurring: boolean;
  created_at: string;
  account?: Account;
  category?: Category;
}

export type CreateFixedExpense = Omit<
  FixedExpense,
  "id" | "user_id" | "created_at" | "account" | "category"
>;
export type UpdateFixedExpense = Partial<
  Omit<CreateFixedExpense, "is_paid" | "paid_at" | "recurring">
>;

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
// PARCELAS
// ============================================================
export interface Installment {
  id: string;
  user_id: string;
  account_id: string;
  title: string;
  total_amount: number;
  installment_amount: number;
  total_installments: number;
  paid_installments: number;
  currency: string;
  start_date: string;
  created_at: string;
  account?: Account;
  // Calculados no frontend
  remaining_installments?: number;
  progress?: number;
  invoice_paid_month: string | null; // ex: "2026-07"
}

export type CreateInstallment = Omit<
  Installment,
  | "id"
  | "user_id"
  | "created_at"
  | "account"
  | "remaining_installments"
  | "progress"
>;
export type UpdateInstallment = Partial<CreateInstallment>;
export interface ServiceResponse<T> {
  data: T | null;
  error: string | null;
}
