import {
  TouchableOpacity,
  TextInput,
  Text,
  View,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import type { TouchableOpacityProps, TextInputProps } from "react-native";

// 👇 Importação das cores automáticas
import { useAppTheme } from "@/hooks/useTheme";

// ============================================================
// BUTTON
// ============================================================
interface ButtonProps extends TouchableOpacityProps {
  label: string;
  loading?: boolean;
  variant?: "primary" | "outline" | "ghost";
}

export function Button({
  label,
  loading,
  variant = "primary",
  disabled,
  ...props
}: ButtonProps) {
  const { colors } = useAppTheme(); // 👈 Trazemos as cores para o botão

  return (
    <TouchableOpacity
      style={[s.btnBase, s[variant], (disabled || loading) && s.disabled]}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === "primary" ? "#fff" : colors.primary}
        />
      ) : (
        <Text
          style={[
            s.btnLabel,
            variant === "primary" && s.primaryLabel,
            variant === "outline" && { color: colors.primary },
            variant === "ghost" && { color: colors.text }, // Ajusta o texto fantasma ao tema
          ]}
        >
          {label}
        </Text>
      )}
    </TouchableOpacity>
  );
}

// ============================================================
// INPUT
// ============================================================
interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
}

export function Input({ label, error, style, ...props }: InputProps) {
  const { colors } = useAppTheme(); // 👈 Trazemos as cores para a caixa de texto

  return (
    <View style={s.inputWrapper}>
      {label && (
        <Text style={[s.label, { color: colors.subText }]}>{label}</Text>
      )}
      <TextInput
        style={[
          s.input,
          {
            backgroundColor: colors.inputBg, // Muda o fundo sozinho
            color: colors.text, // Muda a letra sozinha
            borderColor: colors.border, // Muda a linha à volta sozinha
          },
          style,
          error && s.inputError,
        ]}
        placeholderTextColor={colors.subText} // Cor do texto de exemplo
        {...props}
      />
      {error && <FormError message={error} />}
    </View>
  );
}

// ============================================================
// FORM ERROR
// ============================================================
export function FormError({ message }: { message: string }) {
  return <Text style={s.errorText}>{message}</Text>;
}

// ============================================================
// STYLES
// ============================================================
const s = StyleSheet.create({
  // Button base
  btnBase: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  disabled: { opacity: 0.5 },

  // Button variants
  primary: { backgroundColor: "#6366f1" },
  outline: { borderWidth: 1, borderColor: "#6366f1" },
  ghost: { backgroundColor: "transparent" },

  // Button labels
  btnLabel: { fontSize: 16, fontWeight: "600" },
  primaryLabel: { color: "#fff" },

  // Input
  inputWrapper: { gap: 6 },
  label: { fontSize: 14, fontWeight: "500" },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
  inputError: { borderColor: "#f87171" },

  // Error
  errorText: { fontSize: 12, color: "#ef4444", marginTop: 2 },
});
