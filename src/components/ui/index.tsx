import {
  TouchableOpacity,
  TextInput,
  Text,
  View,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import type { TouchableOpacityProps, TextInputProps } from "react-native";

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
  return (
    <TouchableOpacity
      style={[s.btnBase, s[variant], (disabled || loading) && s.disabled]}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={variant === "primary" ? "#fff" : "#6366f1"} />
      ) : (
        <Text style={[s.btnLabel, s[`${variant}Label`]]}>{label}</Text>
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

export function Input({ label, error, ...props }: InputProps) {
  return (
    <View style={s.inputWrapper}>
      {label && <Text style={s.label}>{label}</Text>}
      <TextInput
        style={[s.input, error && s.inputError]}
        placeholderTextColor="#9ca3af"
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
  outlineLabel: { color: "#6366f1" },
  ghostLabel: { color: "#4b5563" },

  // Input
  inputWrapper: { gap: 6 },
  label: { fontSize: 14, fontWeight: "500", color: "#374151" },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: "#111827",
    backgroundColor: "#fff",
  },
  inputError: { borderColor: "#f87171" },

  // Error
  errorText: { fontSize: 12, color: "#ef4444", marginTop: 2 },
});
