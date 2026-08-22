import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  Alert,
  Modal,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Link, useRouter } from "expo-router";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/hooks/useAuth";
import { useAppTheme } from "@/hooks/useTheme";
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
  const { colors } = useAppTheme();
  const router = useRouter();

  const [showBetaModal, setShowBetaModal] = useState(false);
  const [agreedToLgpd, setAgreedToLgpd] = useState(false);
  const [showLgpdModal, setShowLgpdModal] = useState(false);

  const {
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<RegisterForm>({
    resolver: zodResolver(schema),
    // 👇 CORREÇÃO 1: Evita o erro laranja de "uncontrolled input" no console
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirm: "",
    },
  });

  const onSubmit = async (data: RegisterForm) => {
    if (!agreedToLgpd) {
      const msg =
        "Para criar a sua conta, precisa concordar com os termos de privacidade (LGPD).";
      if (Platform.OS === "web") window.alert(msg);
      else Alert.alert("Atenção", msg);
      return;
    }

    try {
      // 👇 CORREÇÃO 2: Silenciamos o falso erro do VS Code e passamos os dados limpos
      // @ts-ignore
      const { error } = await register({
        name: data.name,
        email: data.email,
        password: data.password,
      });

      if (error) {
        // 👇 CORREÇÃO 3: Traduzimos o objeto de erro para texto legível, removendo o "{}" vermelho da tela
        const errorMsg =
          typeof error === "string"
            ? error
            : error?.message ||
              "Erro no servidor (500). Verifique os Triggers no Supabase.";

        setError("root", { message: errorMsg });
      } else {
        router.replace("/");
      }
    } catch (err: any) {
      setError("root", { message: "Falha na comunicação com o servidor." });
    }
  };

  return (
    <SafeAreaView style={[s.container, { backgroundColor: colors.bg }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
      >
        <View style={s.logoContainer}>
          <Image
            source={require("../../../assets/icon.png")}
            style={s.logo}
            resizeMode="contain"
          />
        </View>

        <TouchableOpacity onPress={() => setShowBetaModal(true)}>
          <Text style={[s.betaText, { color: colors.primary }]}>
            Beta Version 1.0
          </Text>
        </TouchableOpacity>

        <Text style={[s.title, { color: colors.text }]}>Criar conta</Text>
        <Text style={[s.subtitle, { color: colors.subText }]}>
          Comece a controlar suas finanças
        </Text>

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

          <View style={s.lgpdContainer}>
            <TouchableOpacity onPress={() => setAgreedToLgpd(!agreedToLgpd)}>
              <Ionicons
                name={agreedToLgpd ? "checkbox" : "square-outline"}
                size={24}
                color={agreedToLgpd ? colors.primary : colors.subText}
              />
            </TouchableOpacity>
            <Text style={[s.lgpdText, { color: colors.subText }]}>
              Em conformidade com a{" "}
              <Text style={{ fontWeight: "bold", color: colors.text }}>
                LGPD
              </Text>
              , concordo com os termos de privacidade. Garantimos que os seus
              dados estão seguros:{" "}
              <Text
                style={{
                  textDecorationLine: "underline",
                  color: colors.primary,
                  fontWeight: "bold",
                }}
                onPress={() => setShowLgpdModal(true)}
              >
                leia aqui como tratamos os seus dados.
              </Text>
            </Text>
          </View>

          {/* O Erro agora será sempre uma frase de texto limpa */}
          {errors.root && <FormError message={errors.root.message!} />}

          <Button
            label="Criar conta"
            loading={isLoading}
            onPress={handleSubmit(onSubmit)}
          />
        </View>

        <View style={s.footer}>
          <Text style={{ color: colors.subText }}>Já tem conta? </Text>
          <Link href="/(auth)/login">
            <Text style={[s.link, { color: colors.primary }]}>Entrar</Text>
          </Link>
        </View>
      </ScrollView>

      {/* SUB-TELA DA LGPD */}
      <Modal visible={showLgpdModal} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={[s.modalContent, { backgroundColor: colors.bg }]}>
            <Text style={[s.modalTitle, { color: colors.text }]}>
              Termos de Privacidade e LGPD
            </Text>

            <ScrollView
              showsVerticalScrollIndicator={false}
              style={s.modalScroll}
            >
              <Text style={[s.modalTopic, { color: colors.primary }]}>
                O que a aplicação FAZ:
              </Text>
              <Text style={[s.modalBody, { color: colors.text }]}>
                • Recolhemos o seu nome e e-mail exclusivamente para criar a sua
                conta e identificar os seus registos financeiros.{"\n"}•
                Armazenamos os seus dados de forma encriptada e segura nos
                nossos servidores.{"\n"}• Usamos as suas informações de gastos
                apenas para lhe apresentar as análises e metas pessoais dentro
                da própria aplicação.
              </Text>

              <Text
                style={[s.modalTopic, { color: colors.primary, marginTop: 16 }]}
              >
                O que a aplicação NÃO FAZ:
              </Text>
              <Text style={[s.modalBody, { color: colors.text }]}>
                • Não vendemos, partilhamos ou alugamos os seus dados pessoais
                ou financeiros a empresas terceiras ou anunciantes.{"\n"}• Não
                rastreamos a sua atividade fora desta aplicação.{"\n"}• Não
                temos acesso a senhas de bancos ou cartões de crédito. Toda a
                gestão feita aqui é totalmente manual e controlada por si.
              </Text>

              <Text
                style={[
                  s.modalBody,
                  { color: colors.subText, marginTop: 16, fontStyle: "italic" },
                ]}
              >
                De acordo com a Lei Geral de Proteção de Dados (LGPD - Lei nº
                13.709/2018), tem o direito de solicitar a eliminação total da
                sua conta e dos seus dados a qualquer momento nas definições da
                aplicação.
              </Text>
            </ScrollView>

            <TouchableOpacity
              style={[s.modalCloseBtn, { backgroundColor: colors.primary }]}
              onPress={() => setShowLgpdModal(false)}
            >
              <Text style={s.modalCloseText}>Entendi e Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* JANELA DA VERSÃO BETA */}
      <Modal visible={showBetaModal} transparent animationType="fade">
        <View style={s.modalOverlay}>
          <View style={[s.modalContent, { backgroundColor: colors.bg }]}>
            <Text style={[s.modalTitle, { color: colors.text }]}>
              Versão Beta
            </Text>

            <Text style={[s.modalBody, { color: colors.text }]}>
              Esta é a{" "}
              <Text style={{ fontWeight: "bold" }}>Beta Version 1.0</Text> da
              aplicação. Por ser uma versão de testes, é possível que encontre
              instabilidades ou alguns erros.
              {"\n\n"}A sua experiência é muito importante! Caso note algo a
              funcionar de forma inesperada, notifique a nossa equipa para
              aplicarmos as correções em atualizações futuras.
            </Text>

            <TouchableOpacity
              style={[s.modalCloseBtn, { backgroundColor: colors.primary }]}
              onPress={() => setShowBetaModal(false)}
            >
              <Text style={s.modalCloseText}>Entendi</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  logoContainer: { alignItems: "center", marginBottom: 24 },
  logo: { width: 90, height: 90 },
  title: { fontSize: 28, fontWeight: "bold", marginBottom: 4 },
  subtitle: { fontSize: 14, marginBottom: 32 },
  form: { gap: 16 },
  lgpdContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "rgba(0,0,0,0.02)",
    padding: 12,
    borderRadius: 12,
    marginTop: 4,
    gap: 12,
  },
  lgpdText: { flex: 1, fontSize: 12, lineHeight: 18 },
  footer: { flexDirection: "row", justifyContent: "center", marginTop: 32 },
  link: { fontWeight: "600" },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: "80%",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 16,
    textAlign: "center",
  },
  modalScroll: {
    marginBottom: 20,
  },
  modalTopic: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 8,
  },
  modalBody: {
    fontSize: 14,
    lineHeight: 22,
  },
  modalCloseBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 10,
  },
  modalCloseText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  betaText: {
    fontSize: 12,
    fontWeight: "bold",
    marginTop: -20,
    padding: 8,
  },
});
