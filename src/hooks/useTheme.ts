import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useColorScheme } from "react-native";

interface ThemeState {
  theme: "light" | "dark" | "auto";
  setTheme: (theme: "light" | "dark" | "auto") => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: "auto",
  setTheme: async (newTheme) => {
    set({ theme: newTheme });
    await AsyncStorage.setItem("@app_theme", newTheme);
  },
}));

// Carrega o tema salvo imediatamente ao iniciar a aplicação
AsyncStorage.getItem("@app_theme").then((saved) => {
  if (saved === "light" || saved === "dark" || saved === "auto") {
    useThemeStore.setState({ theme: saved });
  }
});

export function useAppTheme() {
  const { theme, setTheme } = useThemeStore();
  const systemTheme = useColorScheme();

  const isDark = theme === "auto" ? systemTheme === "dark" : theme === "dark";

  const colors = {
    bg: isDark ? "#111827" : "#f8fafc",
    card: isDark ? "#1f2937" : "#fff",
    text: isDark ? "#f9fafb" : "#111827",
    subText: isDark ? "#9ca3af" : "#4b5563",
    border: isDark ? "#374151" : "#e5e7eb",
    inputBg: isDark ? "#374151" : "#f9fafb",
    primary: "#6366f1",
  };

  return { theme, setTheme, isDark, colors };
}
