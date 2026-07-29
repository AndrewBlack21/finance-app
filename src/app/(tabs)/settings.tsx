import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "@/hooks/useAuth";
import { useAppTheme } from "@/hooks/useTheme"; // 👈 Importação correta do cofre global de temas

export default function SettingsScreen() {
  const router = useRouter();
  const { profile, updateName, updatePassword } = useAuth();

  const [name, setName] = useState(profile?.name || "");
  const [isSavingName, setIsSavingName] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  // 👇 Usamos o hook global de temas em vez do estado local isolado
  const { theme, setTheme, colors } = useAppTheme();

  const handleUpdateName = async () => {
    if (!name.trim())
      return Alert.alert("Atenção", "O nome não pode ficar vazio.");
    setIsSavingName(true);
    try {
      const { error } = await updateName(name.trim());
      if (error) throw error;
      Alert.alert("Sucesso", "O teu nome foi atualizado.");
    } catch (error) {
      Alert.alert("Erro", "Não foi possível atualizar o nome.");
    } finally {
      setIsSavingName(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!currentPassword || !newPassword) {
      return Alert.alert("Atenção", "Preenche a senha atual e a nova senha.");
    }
    if (newPassword.length < 6) {
      return Alert.alert(
        "Atenção",
        "A nova senha deve ter pelo menos 6 caracteres.",
      );
    }
    setIsSavingPassword(true);
    try {
      const { error } = await updatePassword(newPassword);
      if (error) throw error;
      Alert.alert("Sucesso", "A tua senha foi alterada com sucesso.");
      setCurrentPassword("");
      setNewPassword("");
    } catch (error) {
      Alert.alert("Erro", "Não foi possível alterar a senha.");
    } finally {
      setIsSavingPassword(false);
    }
  };

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: colors.bg }]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View
          style={[
            s.header,
            { backgroundColor: colors.card, borderBottomColor: colors.border },
          ]}
        >
          <TouchableOpacity
            onPress={() => router.back()}
            style={[s.backBtn, { backgroundColor: colors.inputBg }]}
          >
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={[s.headerTitle, { color: colors.text }]}>
            Configurações
          </Text>
          <View style={{ width: 38 }} />
        </View>

        <ScrollView
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
        >
          <Text style={[s.sectionTitle, { color: colors.text }]}>
            Meu Perfil
          </Text>
          <View
            style={[
              s.card,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Text style={[s.label, { color: colors.subText }]}>
              Nome de exibição
            </Text>
            <View
              style={[
                s.inputWrapper,
                { backgroundColor: colors.inputBg, borderColor: colors.border },
              ]}
            >
              <Ionicons
                name="person-outline"
                size={20}
                color="#9ca3af"
                style={s.inputIcon}
              />
              <TextInput
                style={[s.input, { color: colors.text }]}
                value={name}
                onChangeText={setName}
                placeholder="Digita o teu nome"
                placeholderTextColor="#9ca3af"
              />
            </View>

            <TouchableOpacity
              style={[s.saveBtn, isSavingName && { opacity: 0.6 }]}
              onPress={handleUpdateName}
              disabled={isSavingName}
            >
              <Text style={s.saveBtnText}>
                {isSavingName ? "A guardar..." : "Salvar Nome"}
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={[s.sectionTitle, { color: colors.text }]}>
            Segurança
          </Text>
          <View
            style={[
              s.card,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Text style={[s.label, { color: colors.subText }]}>
              Senha Atual
            </Text>
            <View
              style={[
                s.inputWrapper,
                { backgroundColor: colors.inputBg, borderColor: colors.border },
              ]}
            >
              <Ionicons
                name="lock-closed-outline"
                size={20}
                color="#9ca3af"
                style={s.inputIcon}
              />
              <TextInput
                style={[s.input, { color: colors.text }]}
                value={currentPassword}
                onChangeText={setCurrentPassword}
                placeholder="Digita a senha atual"
                placeholderTextColor="#9ca3af"
                secureTextEntry
              />
            </View>

            <Text style={[s.label, { color: colors.subText, marginTop: 12 }]}>
              Nova Senha
            </Text>
            <View
              style={[
                s.inputWrapper,
                { backgroundColor: colors.inputBg, borderColor: colors.border },
              ]}
            >
              <Ionicons
                name="key-outline"
                size={20}
                color="#9ca3af"
                style={s.inputIcon}
              />
              <TextInput
                style={[s.input, { color: colors.text }]}
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="Digita a nova senha"
                placeholderTextColor="#9ca3af"
                secureTextEntry
              />
            </View>

            <TouchableOpacity
              style={[s.saveBtn, isSavingPassword && { opacity: 0.6 }]}
              onPress={handleUpdatePassword}
              disabled={isSavingPassword}
            >
              <Text style={s.saveBtnText}>
                {isSavingPassword ? "A alterar..." : "Alterar Senha"}
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={[s.sectionTitle, { color: colors.text }]}>
            Aparência
          </Text>
          <View
            style={[
              s.card,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Text style={[s.helpText, { color: colors.subText }]}>
              Escolhe o tema da aplicação. O modo automático acompanha as
              definições do teu telemóvel.
            </Text>

            <View style={s.themeRow}>
              <TouchableOpacity
                style={[
                  s.themeBtn,
                  {
                    backgroundColor: colors.inputBg,
                    borderColor: colors.border,
                  },
                  theme === "light" && s.themeBtnActive,
                ]}
                onPress={() => setTheme("light")}
              >
                <Ionicons
                  name="sunny-outline"
                  size={24}
                  color={theme === "light" ? colors.primary : colors.subText}
                />
                <Text
                  style={[
                    s.themeText,
                    { color: colors.subText },
                    theme === "light" && s.themeTextActive,
                  ]}
                >
                  Claro
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  s.themeBtn,
                  {
                    backgroundColor: colors.inputBg,
                    borderColor: colors.border,
                  },
                  theme === "dark" && s.themeBtnActive,
                ]}
                onPress={() => setTheme("dark")}
              >
                <Ionicons
                  name="moon-outline"
                  size={24}
                  color={theme === "dark" ? colors.primary : colors.subText}
                />
                <Text
                  style={[
                    s.themeText,
                    { color: colors.subText },
                    theme === "dark" && s.themeTextActive,
                  ]}
                >
                  Escuro
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  s.themeBtn,
                  {
                    backgroundColor: colors.inputBg,
                    borderColor: colors.border,
                  },
                  theme === "auto" && s.themeBtnActive,
                ]}
                onPress={() => setTheme("auto")}
              >
                <Ionicons
                  name="phone-portrait-outline"
                  size={24}
                  color={theme === "auto" ? colors.primary : colors.subText}
                />
                <Text
                  style={[
                    s.themeText,
                    { color: colors.subText },
                    theme === "auto" && s.themeTextActive,
                  ]}
                >
                  Auto
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: { fontSize: 18, fontWeight: "800" },
  scroll: { padding: 20, paddingBottom: 60 },

  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 12,
    marginTop: 10,
  },
  card: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
  },

  label: { fontSize: 13, fontWeight: "600", marginBottom: 6 },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 50,
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: 15, height: "100%" },

  saveBtn: {
    backgroundColor: "#6366f1",
    borderRadius: 12,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
  },
  saveBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },

  helpText: {
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 16,
  },

  themeRow: { flexDirection: "row", justifyContent: "space-between", gap: 10 },
  themeBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  themeBtnActive: {
    backgroundColor: "#eef2ff",
    borderColor: "#6366f1",
  },
  themeText: { fontSize: 13, fontWeight: "600", marginTop: 8 },
  themeTextActive: { color: "#6366f1" },
});
