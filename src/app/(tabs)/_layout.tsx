import { Tabs } from "expo-router";
import { View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
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
        tabBarStyle: s.tabBar,
        tabBarLabelStyle: s.tabLabel,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
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
          title: "Transações",
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

      <Tabs.Screen
        name="fixed"
        options={{
          title: "Fixas",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              active="receipt"
              inactive="receipt-outline"
              color={color}
              focused={focused}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="categories"
        options={{ href: null, headerShown: false }}
      />

      <Tabs.Screen
        name="account-detail"
        options={{ href: null, headerShown: false }}
      />
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
