import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Link, useRouter } from "expo-router";
import { Input, Button } from "@/components/ui";
import { useAppTheme } from "@/hooks/useTheme";
import { supabase } from "@/lib/supabase"; // 👈 Importa o seu cliente do Supabase (ajuste o caminho se necessário)

export default function LoginScreen() {
  const router = useRouter();
  const { colors, isDark } = useAppTheme();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false); // 👈 Estado para controlar o carregamento

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Atenção", "Preencha o e-mail e a senha.");
      return;
    }

    try {
      setLoading(true);

      // Autenticação real com o Supabase
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password,
      });

      if (error) {
        Alert.alert("Erro ao entrar", "E-mail ou senha incorretos.");
        setLoading(false);
        return;
      }

      // Se der certo, redireciona para a tela principal das abas
      router.replace("/(tabs)");
    } catch (err) {
      Alert.alert("Erro", "Ocorreu um erro inesperado.");
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[s.safeArea, { backgroundColor: colors.bg }]}>
      <ScrollView
        contentContainerStyle={s.scrollContainer}
        showsVerticalScrollIndicator={false}
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
          <Text style={[s.subtitle, { color: colors.subText }]}>
            Acesse sua conta para continuar
          </Text>
        </View>

        <View style={s.form}>
          <Input
            label="E-mail"
            placeholder="voce@email.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <Input
            label="Senha"
            placeholder="••••••••"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <TouchableOpacity style={s.forgotPassword}>
            <Text style={{ color: colors.primary, fontSize: 13 }}>
              Esqueci minha senha
            </Text>
          </TouchableOpacity>

          {/* O botão agora respeita o estado de carregamento */}
          <Button label="Entrar" loading={loading} onPress={handleLogin} />

          <View style={s.footer}>
            <Text style={{ color: colors.subText, fontSize: 14 }}>
              Não tem conta?{" "}
            </Text>
            <Link href="/(auth)/register">
              <Text
                style={{
                  color: colors.primary,
                  fontSize: 14,
                  fontWeight: "600",
                }}
              >
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
