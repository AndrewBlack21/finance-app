import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from "react-native";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input, Button, FormError } from "@/components/ui";
import { useAccounts } from "@/hooks/useAccounts";
import { useCategories } from "@/hooks/useCategories";
import type { CreateTransaction, TransactionType } from "@/types";

// ============================================================
// SCHEMA DE VALIDAÇÃO
// ============================================================
const schema = z.object({
  title: z.string().min(1, "Título obrigatório"),
  amount: z
    .string()
    .min(1, "Valor obrigatório")
    .refine((v) => !isNaN(Number(v)) && Number(v) > 0, "Valor inválido"),
  type: z.enum(["income", "expense", "transfer"]),
  account_id: z.string().min(1, "Selecione uma conta"),
  category_id: z.string().optional(),
  date: z.string().min(1, "Data obrigatória"),
  notes: z.string().optional(),
  currency: z.string().min(1, "Moeda obrigatória"),
});
type FormData = z.infer<typeof schema>;

// ============================================================
// PROPS
// ============================================================
interface TransactionFormProps {
  onSubmit: (data: CreateTransaction) => Promise<void>;
  onCancel: () => void;
  isLoading: boolean;
}

// ============================================================
// TIPOS DE TRANSAÇÃO — label + cor
// ============================================================
const TYPES: { value: TransactionType; label: string; color: string }[] = [
  { value: "income", label: "Receita", color: "#16a34a" },
  { value: "expense", label: "Despesa", color: "#dc2626" },
  { value: "transfer", label: "Transferência", color: "#2563eb" },
];

// Moedas disponíveis
const CURRENCIES = ["BRL", "USD", "EUR", "GBP", "JPY", "ARS"];

export function TransactionForm({
  onSubmit,
  onCancel,
  isLoading,
}: TransactionFormProps) {
  const { accounts } = useAccounts();
  const { income, expense } = useCategories();

  const today = new Date().toISOString().split("T")[0];

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      type: "expense",
      date: today,
      currency: "BRL",
    },
  });

  const selectedType = watch("type");
  // Categorias filtradas pelo tipo selecionado
  const categories = selectedType === "income" ? income : expense;

  const handleFormSubmit = async (values: FormData) => {
    await onSubmit({
      title: values.title,
      amount: Number(values.amount),
      type: values.type,
      account_id: values.account_id,
      category_id: values.category_id ?? null,
      date: values.date,
      notes: values.notes ?? null,
      currency: values.currency,
      recurring: false,
    });
  };

  return (
    <ScrollView
      contentContainerStyle={s.container}
      showsVerticalScrollIndicator={false}
    >
      {/* TIPO */}
      <Text style={s.label}>Tipo</Text>
      <Controller
        name="type"
        control={control}
        render={({ field: { onChange, value } }) => (
          <View style={s.typeRow}>
            {TYPES.map((t) => (
              <TouchableOpacity
                key={t.value}
                style={[
                  s.typeBtn,
                  value === t.value && { backgroundColor: t.color },
                ]}
                onPress={() => onChange(t.value)}
              >
                <Text
                  style={[s.typeBtnText, value === t.value && s.typeBtnActive]}
                >
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      />

      {/* TÍTULO */}
      <Controller
        name="title"
        control={control}
        render={({ field: { onChange, value } }) => (
          <Input
            label="Título"
            placeholder="Ex: Almoço, Salário..."
            onChangeText={onChange}
            value={value}
            error={errors.title?.message}
          />
        )}
      />

      {/* VALOR + MOEDA */}
      <View style={s.row}>
        <View style={{ flex: 2, marginRight: 8 }}>
          <Controller
            name="amount"
            control={control}
            render={({ field: { onChange, value } }) => (
              <Input
                label="Valor"
                placeholder="0,00"
                keyboardType="numeric"
                onChangeText={onChange}
                value={value}
                error={errors.amount?.message}
              />
            )}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.label}>Moeda</Text>
          <Controller
            name="currency"
            control={control}
            render={({ field: { onChange, value } }) => (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={s.currencyRow}>
                  {CURRENCIES.map((c) => (
                    <TouchableOpacity
                      key={c}
                      style={[
                        s.currencyBtn,
                        value === c && s.currencyBtnActive,
                      ]}
                      onPress={() => onChange(c)}
                    >
                      <Text
                        style={[
                          s.currencyText,
                          value === c && s.currencyTextActive,
                        ]}
                      >
                        {c}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            )}
          />
        </View>
      </View>

      {/* CONTA */}
      <Text style={s.label}>Conta</Text>
      <Controller
        name="account_id"
        control={control}
        render={({ field: { onChange, value } }) => (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={s.optionRow}>
                {accounts.map((a) => (
                  <TouchableOpacity
                    key={a.id}
                    style={[
                      s.optionBtn,
                      value === a.id && { backgroundColor: a.color },
                    ]}
                    onPress={() => onChange(a.id)}
                  >
                    <Text
                      style={[
                        s.optionText,
                        value === a.id && s.optionTextActive,
                      ]}
                    >
                      {a.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
            {errors.account_id && (
              <FormError message={errors.account_id.message!} />
            )}
          </>
        )}
      />

      {/* CATEGORIA */}
      {selectedType !== "transfer" && (
        <>
          <Text style={s.label}>Categoria</Text>
          <Controller
            name="category_id"
            control={control}
            render={({ field: { onChange, value } }) => (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={s.optionRow}>
                  {categories.map((c) => (
                    <TouchableOpacity
                      key={c.id}
                      style={[
                        s.optionBtn,
                        value === c.id && { backgroundColor: c.color },
                      ]}
                      onPress={() => onChange(c.id)}
                    >
                      <Text
                        style={[
                          s.optionText,
                          value === c.id && s.optionTextActive,
                        ]}
                      >
                        {c.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            )}
          />
        </>
      )}

      {/* DATA */}
      <Controller
        name="date"
        control={control}
        render={({ field: { onChange, value } }) => (
          <Input
            label="Data"
            placeholder="AAAA-MM-DD"
            onChangeText={onChange}
            value={value}
            error={errors.date?.message}
          />
        )}
      />

      {/* NOTAS */}
      <Controller
        name="notes"
        control={control}
        render={({ field: { onChange, value } }) => (
          <Input
            label="Observações (opcional)"
            placeholder="Adicione uma nota..."
            onChangeText={onChange}
            value={value ?? ""}
            multiline
            numberOfLines={3}
          />
        )}
      />

      {/* AÇÕES */}
      <View style={s.actions}>
        <Button
          label="Cancelar"
          variant="outline"
          onPress={onCancel}
          style={{ flex: 1, marginRight: 8 }}
        />
        <Button
          label="Salvar"
          loading={isLoading}
          onPress={handleSubmit(handleFormSubmit)}
          style={{ flex: 1 }}
        />
      </View>
    </ScrollView>
  );
}

// ============================================================
// STYLES
// ============================================================
const s = StyleSheet.create({
  container: { padding: 20, gap: 16 },
  label: { fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 6 },
  row: { flexDirection: "row", alignItems: "flex-start" },

  // Tipo
  typeRow: { flexDirection: "row", gap: 8, marginBottom: 4 },
  typeBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    alignItems: "center",
  },
  typeBtnText: { fontSize: 13, fontWeight: "600", color: "#6b7280" },
  typeBtnActive: { color: "#fff" },

  // Moeda
  currencyRow: { flexDirection: "row", gap: 6 },
  currencyBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  currencyBtnActive: { backgroundColor: "#6366f1", borderColor: "#6366f1" },
  currencyText: { fontSize: 12, fontWeight: "600", color: "#6b7280" },
  currencyTextActive: { color: "#fff" },

  // Opções (conta/categoria)
  optionRow: { flexDirection: "row", gap: 8, marginBottom: 4 },
  optionBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  optionText: { fontSize: 13, color: "#6b7280", fontWeight: "500" },
  optionTextActive: { color: "#fff" },

  // Ações
  actions: { flexDirection: "row", marginTop: 8 },
});
