import { createClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

const ExpoSecureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

const storage = Platform.OS === "web" ? localStorage : ExpoSecureStoreAdapter;

export const supabase = createCliente(URL, KEY, {
  auth: {
    storage,
    autoRefreshToken: true,
    persisSession: true,
    detectSessionInUrl: Platform.OS === "web",
  },
});
