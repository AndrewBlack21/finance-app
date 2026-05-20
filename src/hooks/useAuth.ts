import { useEffect } from "react";
import { useRouter } from "expo-router";
import { supabase, authService } from "@/services";
import { useAuthStore } from "@/store/authStore";
import type { AuthCredentials, RegisterCredentials } from "@/types";

// hook de autenticacao
// Responsabilidade logica + side effects de auth

export function useAuth() {
  const router = useRouter();
}
