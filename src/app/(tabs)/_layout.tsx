import { Tabs } from "expo-router";
import { StyleSheet, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { useAppTheme } from "@/hooks/useTheme";

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
  const { colors } = useAppTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          height: Platform.OS === "ios" ? 90 : 70, // 👈 Altura extra para caber o texto com folga
          paddingBottom: Platform.OS === "ios" ? 30 : 10, // 👇 Dá espaço em baixo
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "bold",
          paddingBottom: 5, // 👇 Garante que a letra não toca no fundo
          marginTop: 2,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.subText,
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
          title: "Crédito",
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

      <Tabs.Screen name="charts" options={{ href: null, headerShown: false }} />

      <Tabs.Screen
        name="budget"
        options={{
          href: null,
          title: "Metas de Gastos",
        }}
      />

      <Tabs.Screen
        name="investments"
        options={{
          href: null,
          headerShown: false,
        }}
      />

      <Tabs.Screen
        name="settings"
        options={{
          href: null,
          headerShown: false,
        }}
      />
    </Tabs>
  );
}
