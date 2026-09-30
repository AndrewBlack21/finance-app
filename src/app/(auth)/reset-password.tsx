import { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Input, FormError } from "@/components/ui";
import { useAuth } from "@/hooks/useAuth";
import { useAppTheme } from "@/hooks/useTheme";

const schema = z
  .object({
    password: z.string().min(6, "A senha deve ter pelo menos 6 caracteres"),
    confirm: z.string().min(6, "Confirme sua senha"),
  })
  .refine((data) => data.password === data.confirm, {
    message: "As senhas não conferem",
    path: ["confirm"],
  });

type ResetForm = z.infer<typeof schema>;

export default function ResetPasswordScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { updatePassword, isLoading, session } = useAuth();
  const [serverError, setServerError] = useState("");
  const [success, setSuccess] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetForm>({
    resolver: zodResolver(schema),
    defaultValues: { password: "", confirm: "" },
  });

  const onSubmit = async ({ password }: ResetForm) => {
    setServerError("");
    setSuccess(false);

    if (!session) {
      setServerError("O link de recuperação é inválido ou expirou. Solicite um novo link.");
      return;
    }

    const { error } = await updatePassword(password);

    if (error) {
      setServerError(error.message ?? "Não foi possível atualizar a senha.");
      return;
    }

    setSuccess(true);
    setTimeout(() => router.replace("/(tabs)"), 1200);
  };

  return (
    <SafeAreaView style={[s.container, { backgroundColor: colors.bg }]}>
      <Text style={[s.title, { color: colors.text }]}>Criar nova senha</Text>
      <Text style={[s.subtitle, { color: colors.subText }]}>Escolha uma nova senha para acessar sua conta.</Text>

      <View style={s.form}>
        <Controller
          name="password"
          control={control}
          render={({ field: { onChange, value } }) => (
            <Input
              label="Nova senha"
              placeholder="••••••••"
              secureTextEntry
              value={value}
              onChangeText={onChange}
              error={errors.password?.message}
            />
          )}
        />

        <Controller
          name="confirm"
          control={control}
          render={({ field: { onChange, value } }) => (
            <Input
              label="Confirmar nova senha"
              placeholder="••••••••"
              secureTextEntry
              value={value}
              onChangeText={onChange}
              error={errors.confirm?.message}
            />
          )}
        />

        {serverError ? <FormError message={serverError} /> : null}
        {success ? (
          <Text style={[s.success, { color: colors.primary }]}>Senha atualizada. Redirecionando...</Text>
        ) : null}

        <Button
          label="Atualizar senha"
          loading={isLoading}
          onPress={handleSubmit(onSubmit)}
        />
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", paddingHorizontal: 24 },
  title: { fontSize: 28, fontWeight: "800", marginBottom: 8 },
  subtitle: { fontSize: 14, lineHeight: 21, marginBottom: 32 },
  form: { gap: 16 },
  success: { fontSize: 13 },
});
