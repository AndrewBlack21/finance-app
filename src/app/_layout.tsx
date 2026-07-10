import { useEffect, useState } from "react";
import { Slot, SplashScreen, Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useAuth } from "@/hooks/useAuth";

SplashScreen.preventAutoHideAsync();

function RootLayoutContent() {
  const { isHydrated } = useAuth();
  // Trava de segurança contra a tela branca do Safari
  const [timeoutReached, setTimeoutReached] = useState(false);

  useEffect(() => {
    // Se passar 3 segundos e o Safari não responder, destravamos a tela à força
    const timer = setTimeout(() => {
      setTimeoutReached(true);
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    // Esconde a tela de Splash se já carregou ou se o timeout for atingido
    if (isHydrated || timeoutReached) SplashScreen.hideAsync();
  }, [isHydrated, timeoutReached]);

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
