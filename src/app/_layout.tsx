import { useEffect } from "react";
import {
  SplashScreen,
  Stack,
  useRouter,
  useSegments,
} from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useAuth } from "@/hooks/useAuth";
import { useAppTheme } from "@/hooks/useTheme";

SplashScreen.preventAutoHideAsync();

function RootLayoutContent() {
  const { isHydrated, isLoggedIn } = useAuth();
  const { colors } = useAppTheme();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (isHydrated) {
      SplashScreen.hideAsync();
    }
  }, [isHydrated]);

  useEffect(() => {
    if (!isHydrated) return;

    const inAuthGroup = segments[0] === "(auth)";
    const isResetPassword =
      inAuthGroup && segments[1] === "reset-password";

    if (isResetPassword) return;

    if (isLoggedIn && inAuthGroup) {
      router.replace("/(tabs)");
    } else if (!isLoggedIn && !inAuthGroup) {
      router.replace("/(auth)/login");
    }
  }, [isLoggedIn, isHydrated, segments]);

  if (!isHydrated) {
    return (
      <View style={[s.loading, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[s.loadingText, { color: colors.subText }]}>
          Carregando sua conta...
        </Text>
      </View>
    );
  }

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

const s = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: "600",
  },
});
