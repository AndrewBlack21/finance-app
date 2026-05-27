import { View, Text, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Link } from "expo-router";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/hooks/useAuth";
import { Button, Input, FormError } from "@/components/ui";

const schema = z
  .object({
    name: z.string().min(2, "Nome muito curto"),
    email: z.string().email("E-mail inválido"),
    password: z.string().min(6, "Mínimo 6 caracteres"),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: "As senhas não conferem",
    path: ["confirm"],
  });
type RegisterForm = z.infer<typeof schema>;

export default function RegisterScreen() {
  const { register, isLoading } = useAuth();
  const {
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<RegisterForm>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async ({ name, email, password }: RegisterForm) => {
    const { error } = await register({ name, email, password });
    if (error) setError("root", { message: error });
  };

  return (
    <SafeAreaView style={s.container}>
      <Text style={s.title}>Criar conta</Text>
      <Text style={s.subtitle}>Comece a controlar suas finanças</Text>

      <View style={s.form}>
        <Controller
          name="name"
          control={control}
          render={({ field: { onChange, value } }) => (
            <Input
              label="Nome"
              placeholder="Seu nome completo"
              onChangeText={onChange}
              value={value}
              error={errors.name?.message}
            />
          )}
        />
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
        <Controller
          name="confirm"
          control={control}
          render={({ field: { onChange, value } }) => (
            <Input
              label="Confirmar senha"
              placeholder="••••••••"
              secureTextEntry
              onChangeText={onChange}
              value={value}
              error={errors.confirm?.message}
            />
          )}
        />

        {errors.root && <FormError message={errors.root.message!} />}

        <Button
          label="Criar conta"
          loading={isLoading}
          onPress={handleSubmit(onSubmit)}
        />
      </View>

      <View style={s.footer}>
        <Text style={s.footerText}>Já tem conta? </Text>
        <Link href="/(auth)/login">
          <Text style={s.link}>Entrar</Text>
        </Link>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
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
  footer: { flexDirection: "row", justifyContent: "center", marginTop: 32 },
  footerText: { color: "#6b7280" },
  link: { color: "#6366f1", fontWeight: "600" },
});
