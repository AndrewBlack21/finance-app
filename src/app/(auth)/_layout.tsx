import { Redirect, Stack } from "expo-router";
import { useAuth } from "../../hooks/useAuth";

export default function AuthLayout() {
  const { isLoggedIn, isHydrated } = useAuth();

  //Aguarda verificar a sessao antes de redirecionar
  if (!isHydrated) return null;

  // Ja logado vai direto pro app
  if (isLoggedIn) return <Redirect href="/(tabs)" />;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
      <Stack.Screen name="forgot-password" />
    </Stack>
  );
}
