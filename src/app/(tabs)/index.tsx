import { View, Text, StyleSheet } from "react-native";
import { Button } from "@/components/ui";
import { useAuth } from "@/hooks/useAuth";

export default function HomeScreen() {
  const { logout, isLoading } = useAuth();

  return (
    <View style={s.container}>
      <Text style={s.title}>Inicio</Text>
      <Text style={s.subtitle}>Voce esta logado.</Text>
      <Button label="Sair" loading={isLoading} onPress={logout} />
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
    gap: 16,
    paddingHorizontal: 24,
  },
  title: { fontSize: 24, fontWeight: "bold", color: "#111827" },
  subtitle: { fontSize: 14, color: "#6b7280" },
});
