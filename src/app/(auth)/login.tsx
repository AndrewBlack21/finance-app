import { View, Text, TouchableOpacity } from "react-native";
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
    <View className="flex-1 bg-white justify-center px-6">
      {/* Cabeçalho */}
      <Text className="text-3xl font-bold text-gray-900 mb-1">Entrar</Text>
      <Text className="text-gray-500 mb-8">
        Acesse sua conta para continuar
      </Text>

      {/* Formulário */}
      <View className="gap-y-4">
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

        {/* Erro global do servidor */}
        {errors.root && <FormError message={errors.root.message!} />}

        <Link href="/(auth)/forgot-password" asChild>
          <TouchableOpacity>
            <Text className="text-indigo-600 text-sm text-right">
              Esqueci minha senha
            </Text>
          </TouchableOpacity>
        </Link>

        <Button
          label="Entrar"
          loading={isLoading}
          onPress={handleSubmit(onSubmit)}
        />
      </View>

      {/* Rodapé */}
      <View className="flex-row justify-center mt-8">
        <Text className="text-gray-500">Não tem conta? </Text>
        <Link href="/(auth)/register">
          <Text className="text-indigo-600 font-semibold">Criar conta</Text>
        </Link>
      </View>
    </View>
  );
}
