/ ============================================================
// REGISTER — src/app/(auth)/register.tsx
// ============================================================
import { View, Text } from 'react-native'
import { Link } from 'expo-router'
import { useForm, Controller } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAuth } from '@/hooks/useAuth'
import { Button, Input, FormError } from '@/components/ui'

const schema = z.object({
  name:     z.string().min(2, 'Nome muito curto'),
  email:    z.string().email('E-mail inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
  confirm:  z.string(),
}).refine(d => d.password === d.confirm, {
  message: 'As senhas não conferem',
  path: ['confirm'],
})
type RegisterForm = z.infer<typeof schema>

export default function RegisterScreen() {
  const { register, isLoading } = useAuth()
  const { control, handleSubmit, setError, formState: { errors } } = useForm<RegisterForm>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async ({ name, email, password }: RegisterForm) => {
    const { error } = await register({ name, email, password })
    if (error) setError('root', { message: error })
  }

  return (
    <View className="flex-1 bg-white justify-center px-6">
      <Text className="text-3xl font-bold text-gray-900 mb-1">Criar conta</Text>
      <Text className="text-gray-500 mb-8">Comece a controlar suas finanças</Text>

      <View className="gap-y-4">
        <Controller name="name" control={control}
          render={({ field: { onChange, value } }) => (
            <Input label="Nome" placeholder="Seu nome completo"
              onChangeText={onChange} value={value} error={errors.name?.message} />
          )}
        />
        <Controller name="email" control={control}
          render={({ field: { onChange, value } }) => (
            <Input label="E-mail" placeholder="voce@email.com"
              keyboardType="email-address" autoCapitalize="none"
              onChangeText={onChange} value={value} error={errors.email?.message} />
          )}
        />
        <Controller name="password" control={control}
          render={({ field: { onChange, value } }) => (
            <Input label="Senha" placeholder="••••••••"
              secureTextEntry onChangeText={onChange} value={value} error={errors.password?.message} />
          )}
        />
        <Controller name="confirm" control={control}
          render={({ field: { onChange, value } }) => (
            <Input label="Confirmar senha" placeholder="••••••••"
              secureTextEntry onChangeText={onChange} value={value} error={errors.confirm?.message} />
          )}
        />

        {errors.root && <FormError message={errors.root.message!} />}

        <Button label="Criar conta" loading={isLoading} onPress={handleSubmit(onSubmit)} />
      </View>

      <View className="flex-row justify-center mt-8">
        <Text className="text-gray-500">Já tem conta? </Text>
        <Link href="/(auth)/login">
          <Text className="text-indigo-600 font-semibold">Entrar</Text>
        </Link>
      </View>
    </View>
  )
}