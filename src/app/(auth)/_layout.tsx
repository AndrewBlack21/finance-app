import { Redirect, Stack, useSegments } from "expo-router";
import { useAuthStore } from "@/store/authStore";

export default function AuthLayout() {
  const session = useAuthStore((state) => state.session);
  const segments = useSegments();
  const isResetPassword = segments[1] === "reset-password";

  if (session && !isResetPassword) {
    return <Redirect href="/(tabs)" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
