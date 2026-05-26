import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Link } from "expo-router";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/hooks/useAuth";
import { Button, Input, FormError } from "@/components/ui";

const schema = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(6, "Mínimo 6 caracteres"),
});
type LoginForm = z.infer<typeof schema>;

export default function LoginScreen() {
  const { login, isLoading } = useAuth();
  const {
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (values: LoginForm) => {
    const { error } = await login(values);
    if (error) setError("root", { message: error });
  };

  return (
    <SafeAreaView style={s.container}>
      <Text style={s.title}>Entrar</Text>
      <Text style={s.subtitle}>Acesse sua conta para continuar</Text>

      <View style={s.form}>
        <Controller
          name="email"
          control={control}
          render={({ field: { onChange, value } }) => (
            <Input
              label="E-mail"
              placeholder="voce@email.com"
              keyboardType="email-address"
              autoCapitalize="none"
              onChangeText={onChange}
              value={value}
              error={errors.email?.message}
            />
          )}
        />
        <Controller
          name="password"
          control={control}
          render={({ field: { onChange, value } }) => (
            <Input
              label="Senha"
              placeholder="••••••••"
              secureTextEntry
              onChangeText={onChange}
              value={value}
              error={errors.password?.message}
            />
          )}
        />

        {errors.root && <FormError message={errors.root.message!} />}

        <Link href="/(auth)/forgot-password" asChild>
          <TouchableOpacity>
            <Text style={s.forgotLink}>Esqueci minha senha</Text>
          </TouchableOpacity>
        </Link>

        <Button
          label="Entrar"
          loading={isLoading}
          onPress={handleSubmit(onSubmit)}
        />
      </View>

      <View style={s.footer}>
        <Text style={s.footerText}>Não tem conta? </Text>
        <Link href="/(auth)/register">
          <Text style={s.link}>Criar conta</Text>
        </Link>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#111827",
    marginBottom: 4,
  },
  subtitle: { fontSize: 14, color: "#6b7280", marginBottom: 32 },
  form: { gap: 16 },
  forgotLink: { color: "#6366f1", fontSize: 13, textAlign: "right" },
  footer: { flexDirection: "row", justifyContent: "center", marginTop: 32 },
  footerText: { color: "#6b7280" },
  link: { color: "#6366f1", fontWeight: "600" },
});
