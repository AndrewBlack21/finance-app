// ============================================================
// Barrel export — importa tudo de um lugar só
// Uso: import { authService, transactionService } from '@/services'
// ============================================================
export { supabase } from "./supabase/client";
export { authService } from "./supabase/auth";
export { transactionService } from "./supabase/transactions";
export { accountService } from "./supabase/accounts-categories-goals";
export { categoryService } from "./supabase/accounts-categories-goals";
export { goalService } from "./supabase/accounts-categories-goals";
export { installmentService } from "./supabase/installments";
