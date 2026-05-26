import { View, Text, StyleSheet } from "react-native";

export default function HomeScreen() {
  return (
    <View style={s.container}>
      <Text style={s.text}>✅ App funcionando!</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  text: { fontSize: 20, fontWeight: "bold", color: "#6366f1" },
});
