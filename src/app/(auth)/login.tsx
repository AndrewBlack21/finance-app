import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Link, useRouter } from "expo-router";
import { Input, Button, FormError } from "@/components/ui";
import { useAppTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";

export default function LoginScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { login, isLoading } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = async () => {
    setError("");

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !password) {
      setError("Preencha o e-mail e a senha.");
      return;
    }

    const { error: loginError } = await login({
      email: normalizedEmail,
      password,
    });

    if (loginError) {
      setError(loginError);
      return;
    }

    router.replace("/(tabs)");
  };

  return (
    <SafeAreaView style={[s.safeArea, { backgroundColor: colors.bg }]}>
      <ScrollView
        contentContainerStyle={s.scrollContainer}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={s.logoContainer}>
          <Image
            source={require("../../../assets/icon.png")}
            style={s.logo}
            resizeMode="contain"
          />
        </View>

        <View style={s.header}>
          <Text style={[s.title, { color: colors.text }]}>Entrar</Text>
          <Text style={[s.subtitle, { color: colors.subText }]}>Acesse sua conta para continuar</Text>
        </View>

        <View style={s.form}>
          <Input
            label="E-mail"
            placeholder="voce@email.com"
            value={email}
            onChangeText={(value) => {
              setEmail(value);
              if (error) setError("");
            }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
          />

          <Input
            label="Senha"
            placeholder="••••••••"
            value={password}
            onChangeText={(value) => {
              setPassword(value);
              if (error) setError("");
            }}
            secureTextEntry
            autoComplete="password"
            textContentType="password"
            error={error}
          />

          <TouchableOpacity
            style={s.forgotPassword}
            onPress={() => router.push("/(auth)/forgot-password")}
            disabled={isLoading}
          >
            <Text style={{ color: colors.primary, fontSize: 13 }}>
              Esqueci minha senha
            </Text>
          </TouchableOpacity>

          <Button label="Entrar" loading={isLoading} onPress={handleLogin} />

          <View style={s.footer}>
            <Text style={{ color: colors.subText, fontSize: 14 }}>Não tem conta? </Text>
            <Link href="/(auth)/register">
              <Text style={{ color: colors.primary, fontSize: 14, fontWeight: "600" }}>
                Criar conta
              </Text>
            </Link>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safeArea: { flex: 1 },
  scrollContainer: { padding: 24, flexGrow: 1, justifyContent: "center" },
  logoContainer: { alignItems: "center", marginBottom: 32 },
  logo: { width: 280, height: 180 },
  header: { marginBottom: 32 },
  title: { fontSize: 32, fontWeight: "800", marginBottom: 8 },
  subtitle: { fontSize: 16 },
  form: { gap: 16 },
  forgotPassword: { alignSelf: "flex-end", marginTop: -8, marginBottom: 8 },
  footer: { flexDirection: "row", justifyContent: "center", marginTop: 24 },
});
