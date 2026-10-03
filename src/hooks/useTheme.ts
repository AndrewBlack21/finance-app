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
    bg: isDark ? "#0B1220" : "#F7F8FC",
    card: isDark ? "#121C2D" : "#FFFFFF",
    text: isDark ? "#F8FAFC" : "#0F172A",
    subText: isDark ? "#94A3B8" : "#64748B",
    border: isDark ? "#22304A" : "#E2E8F0",
    inputBg: isDark ? "#17243A" : "#F1F5F9",
    primary: "#6366F1",
    success: "#10B981",
    warning: "#F59E0B",
    danger: "#EF4444",
    info: "#38BDF8",
  };

  return { theme, setTheme, isDark, colors };
}
