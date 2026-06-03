import { Redirect, Tabs } from "expo-router";
import { useAuthStore } from "@/store/authStore";
import { View, StyleSheet } from "react-native";

// icone simples em texto - substituir por expo-vector
function TabIcon({ label, active }: { label: string; active: boolean }) {
  const icons: Record<string, string> = {
    home: "🏠",
    transactions: "💳",
    goals: "🎯",
    profile: "👤",
  };
  return <View style={[s.icon, active && s.iconActive]}></View>;
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#6366f1",
        tabBarStyle: s.tabBar,
        tabBarLabelStyle: s.tabLabel,
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Início" }} />
      <Tabs.Screen name="transactions" options={{ title: "Transações" }} />
    </Tabs>
  );
}

const s = StyleSheet.create({
  tabBar: { backgroundColor: "#fff", borderTopColor: "#e5e7eb", height: 60 },
  tabLabel: { fontSize: 11, fontWeight: "600", marginBottom: 4 },
  icon: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "transparent",
    marginTop: 2,
  },
  iconActive: { backgroundColor: "#6366f1" },
});
