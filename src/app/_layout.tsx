import { useEffect, useState } from "react";
import { Slot, SplashScreen, Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useAuth } from "@/hooks/useAuth";

SplashScreen.preventAutoHideAsync();

function RootLayoutContent() {
  const { isHydrated } = useAuth();
  // NOVA VARIÁVEL: Controla se o tempo limite de segurança foi atingido
  const [timeoutReached, setTimeoutReached] = useState(false);

  useEffect(() => {
    // Se demorar mais de 3 segundos para confirmar o login, força a paragem da espera
    const timer = setTimeout(() => {
      setTimeoutReached(true);
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    // Esconde o ecrã de carregamento se a hidratação estiver pronta OU se passou do tempo limite
    if (isHydrated || timeoutReached) {
      SplashScreen.hideAsync();
    }
  }, [isHydrated, timeoutReached]);

  // Se não carregou e ainda não passou o tempo, aguarda invisível (evita o ecrã piscar)
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
