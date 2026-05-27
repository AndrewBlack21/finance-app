import { Redirect, Tabs } from "expo-router";
import { useAuthStore } from "@/store/authStore";

export default function TabsLayout() {
  const session = useAuthStore((state) => state.session);

  if (!session) {
    return <Redirect href="/(auth)/login" />;
  }

  return <Tabs screenOptions={{ headerShown: false }} />;
}
