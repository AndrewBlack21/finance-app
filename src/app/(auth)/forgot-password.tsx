import { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/hooks/useAuth";
import { Button, Input, FormError } from "@/components/ui";
import { useAppTheme } from "@/hooks/useTheme";

const schema = z.object({
  email: z.string().trim().email("Digite um e-mail válido"),
});

type ForgotForm = z.infer<typeof schema>;

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { forgotPassword, isLoading } = useAuth();
  const [success, setSuccess] = useState(false);
  const [serverError, setServerError] = useState("");

  const { control, handleSubmit, formState: { errors } } = useForm<ForgotForm>({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
  });

  const onSubmit = async ({ email }: ForgotForm) => {
    setServerError("");
    setSuccess(false);

    const { error } = await forgotPassword(email.trim().toLowerCase());

    if (error) {
      setServerError(error);
      return;
    }

    setSuccess(true);
  };

  return (
    <SafeAreaView style={[s.container, { backgroundColor: colors.bg }]}>
      <Text style={[s.title, { color: colors.text }]}>Recuperar senha</Text>
      <Text style={[s.subtitle, { color: colors.subText }]}>Digite seu e-mail e enviaremos um link para criar uma nova senha.</Text>

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
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              value={value}
              onChangeText={onChange}
              error={errors.email?.message}
            />
          )}
        />

        {serverError ? <FormError message={serverError} /> : null}
        {success ? (
          <Text style={[s.success, { color: colors.primary }]}>E-mail enviado. Verifique sua caixa de entrada e clique no link para redefinir sua senha.</Text>
        ) : null}

        <Button
          label="Enviar link de recuperação"
          loading={isLoading}
          onPress={handleSubmit(onSubmit)}
        />
      </View>

      <TouchableOpacity
        style={s.footer}
        onPress={() => router.replace("/(auth)/login")}
        disabled={isLoading}
      >
        <Text style={[s.link, { color: colors.primary }]}>Voltar para entrar</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", paddingHorizontal: 24, paddingVertical: 40 },
  title: { fontSize: 28, fontWeight: "800", marginBottom: 8 },
  subtitle: { fontSize: 14, lineHeight: 21, marginBottom: 32 },
  form: { gap: 16 },
  success: { fontSize: 13, lineHeight: 19 },
  footer: { alignItems: "center", marginTop: 28, padding: 8 },
  link: { fontWeight: "600" },
});
