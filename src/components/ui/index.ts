import {
  TouchableOpacity,
  TextInput,
  Text,
  View,
  ActivityIndicator,
} from "react-native";
import type { TouchableOpacityProps, TextInputProps } from "react-native";

// ============================================================
// BUTTON
// Variantes: primary | outline | ghost
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
  const base = "flex-row items-center justify-center rounded-xl px-4 py-3.5";
  const variants = {
    primary: "bg-indigo-600 active:bg-indigo-700",
    outline: "border border-indigo-600 active:bg-indigo-50",
    ghost: "active:bg-gray-100",
  };
  const labelVariants = {
    primary: "text-white font-semibold text-base",
    outline: "text-indigo-600 font-semibold text-base",
    ghost: "text-gray-600 font-semibold text-base",
  };

  return (
    <TouchableOpacity
      className={`${base} ${variants[variant]} ${disabled || loading ? "opacity-50" : ""}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={variant === "primary" ? "#fff" : "#6366f1"} />
      ) : (
        <Text className={labelVariants[variant]}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

// ============================================================
// INPUT
// Wrapper com label e estado de erro integrados
// ============================================================
interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
}

export function Input({ label, error, ...props }: InputProps) {
  return (
    <View className="gap-y-1.5">
      {label && (
        <Text className="text-sm font-medium text-gray-700">{label}</Text>
      )}
      <TextInput
        className={`
          border rounded-xl px-4 py-3 text-base text-gray-900 bg-white
          ${error ? "border-red-400" : "border-gray-300"}
        `}
        placeholderTextColor="#9ca3af"
        {...props}
      />
      {error && <FormError message={error} />}
    </View>
  );
}

// ============================================================
// FORM ERROR — mensagem de erro reutilizável
// ============================================================
export function FormError({ message }: { message: string }) {
  return <Text className="text-xs text-red-500 mt-0.5">{message}</Text>;
}
