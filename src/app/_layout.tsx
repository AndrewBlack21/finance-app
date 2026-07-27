import { useEffect, useState } from "react";
import { Slot, SplashScreen, Stack, useRouter, useSegments } from "expo-router"; // 👇 Adicionados useRouter e useSegments
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useAuth } from "@/hooks/useAuth";

SplashScreen.preventAutoHideAsync();

function RootLayoutContent() {
  const { isHydrated, isLoggedIn } = useAuth(); // 👇 Lemos se está conectado
  const [timeoutReached, setTimeoutReached] = useState(false);

  const router = useRouter(); // Ferramenta para mudar de tela
  const segments = useSegments(); // Ferramenta para saber a tela atual

  useEffect(() => {
    const timer = setTimeout(() => {
      setTimeoutReached(true);
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (isHydrated || timeoutReached) SplashScreen.hideAsync();
  }, [isHydrated, timeoutReached]);

  // 👇 NOVA LÓGICA: O Guarda de Trânsito Inteligente 👇
  useEffect(() => {
    // 1. Se a memória ainda está a carregar, a aplicação aguarda em silêncio
    if (!isHydrated && !timeoutReached) return;

    // 2. Descobre se estamos a tentar aceder a um ecrã de login/registo
    const inAuthGroup = segments[0] === "(auth)";

    // 3. Executa as regras de segurança
    if (isLoggedIn && inAuthGroup) {
      // Se a pessoa JÁ está conectada, mas tentou abrir a página de login, manda para o Dashboard
      router.replace("/(tabs)");
    } else if (!isLoggedIn && !inAuthGroup) {
      // Se a pessoa NÃO está conectada, mas tentou abrir as abas seguras, atira para o login
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
