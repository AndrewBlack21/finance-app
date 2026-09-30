import { useEffect, useState } from "react";
import { Slot, SplashScreen, Stack, useRouter, useSegments } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useAuth } from "@/hooks/useAuth";

SplashScreen.preventAutoHideAsync();

function RootLayoutContent() {
  const { isHydrated, isLoggedIn } = useAuth();
  const [timeoutReached, setTimeoutReached] = useState(false);
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    const timer = setTimeout(() => setTimeoutReached(true), 3000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (isHydrated || timeoutReached) SplashScreen.hideAsync();
  }, [isHydrated, timeoutReached]);

  useEffect(() => {
    if (!isHydrated && !timeoutReached) return;

    const inAuthGroup = segments[0] === "(auth)";
    const isResetPassword = inAuthGroup && segments[1] === "reset-password";

    // A sessão criada pelo link de recuperação precisa permanecer na tela
    // de redefinição até que a nova senha seja salva.
    if (isResetPassword) return;

    if (isLoggedIn && inAuthGroup) {
      router.replace("/(tabs)");
    } else if (!isLoggedIn && !inAuthGroup) {
      router.replace("/(auth)/login");
    }
  }, [isLoggedIn, isHydrated, timeoutReached, segments]);

  if (!isHydrated && !timeoutReached) return null;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <RootLayoutContent />
    </SafeAreaProvider>
  );
}
