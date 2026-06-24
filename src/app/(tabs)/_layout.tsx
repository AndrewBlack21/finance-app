import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet } from "react-native";
import type { ComponentProps } from "react";

// Ícone simples em texto — substituir por expo-vector-icons depois
type IconName = ComponentProps<typeof Ionicons>["name"];

function TabIcon({
  active,
  inactive,
  color,
  focused,
}: {
  active: IconName;
  inactive: IconName;
  color: string;
  focused: boolean;
}) {
  return (
    <Ionicons name={focused ? active : inactive} size={22} color={color} />
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#6366f1",
        tabBarInactiveTintColor: "#9ca3af",
        tabBarStyle: s.tabBar,
        tabBarLabelStyle: s.tabLabel,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Inicio",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              active="home"
              inactive="home-outline"
              color={color}
              focused={focused}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="transactions"
        options={{
          title: "Transacoes",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              active="swap-horizontal"
              inactive="swap-horizontal-outline"
              color={color}
              focused={focused}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="accounts"
        options={{
          title: "Contas",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              active="wallet"
              inactive="wallet-outline"
              color={color}
              focused={focused}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="credit"
        options={{
          title: "Credito",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              active="card"
              inactive="card-outline"
              color={color}
              focused={focused}
            />
          ),
        }}
      />
    </Tabs>
  );
}

const s = StyleSheet.create({
  tabBar: { backgroundColor: "#fff", borderTopColor: "#e5e7eb", height: 62 },
  tabLabel: { fontSize: 11, fontWeight: "600", marginBottom: 4 },
});
