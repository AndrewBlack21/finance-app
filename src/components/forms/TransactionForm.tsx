import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Switch,
  Modal,
  TextInput,
  Alert,
} from "react-native";
import { useState } from "react";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input, Button, FormError } from "@/components/ui";
import { useAccounts } from "@/hooks/useAccounts";
import { useCategories } from "@/hooks/useCategories";
import { useFixedExpenses } from "@/hooks/useFixedExpenses";
import { useAppTheme } from "@/hooks/useTheme"; // 👈 Importação do motor de temas global
import type { CreateTransaction, TransactionType, Transaction } from "@/types";

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    v,
  );

const schema = z.object({
  title: z.string().min(1, "Título obrigatório"),
  amount: z
    .string()
    .min(1, "Valor obrigatório")
    .refine((v) => {
      const clean = v.replace(/[R$\s.]/g, "").replace(",", ".");
      return !isNaN(Number(clean)) && Number(clean) > 0;
    }, "Valor inválido"),
  type: z.enum(["income", "expense", "transfer", "investment"]),
  account_id: z.string().min(1, "Selecione uma conta"),
  category_id: z.string().optional(),
  investment_type: z.string().optional(),
  investment_account_id: z.string().optional(),
  date: z.string().min(1, "Data obrigatória"),
  due_day: z.string().optional(),
  notes: z.string().optional(),
  currency: z.string().min(1, "Moeda obrigatória"),
  is_fixed: z.boolean().default(false),
});
type FormData = z.infer<typeof schema>;

interface TransactionFormProps {
  onSubmit: (data: CreateTransaction) => Promise<void>;
  onCancel: () => void;
  isLoading: boolean;
  initialValues?: Partial<Transaction>;
}

const TYPES = [
  { value: "income", label: "Receita", color: "#16a34a" },
  { value: "expense", label: "Despesa", color: "#dc2626" },
  { value: "investment", label: "Investimento", color: "#8b5cf6" },
  { value: "transfer", label: "Transferência", color: "#2563eb" },
];

const INVESTMENT_OPTIONS = [
  "CDB",
  "CDI",
  "SELIC",
  "Tesouro",
  "Poupança",
  "Outros",
];
const CURRENCIES = ["BRL", "USD", "EUR", "GBP", "JPY", "ARS"];

export function TransactionForm({
  onSubmit,
  onCancel,
  isLoading,
  initialValues,
}: TransactionFormProps) {
  const { accounts, create: createAccount } = useAccounts();
  const router = useRouter();
  const { income, expense } = useCategories();
  const { create: createFixed } = useFixedExpenses();
  const { colors, isDark } = useAppTheme(); // 👈 Cores dinâmicas ativas

  const [accountModalVisible, setAccountModalVisible] = useState(false);
  const [newBankName, setNewBankName] = useState("");
  const [newBankColor, setNewBankColor] = useState("#830ad1");

  const [newAccountType, setNewAccountType] = useState<
    "checking" | "investment"
  >("checking");

  const today = new Date().toISOString().split("T")[0];

  const investmentAccounts = accounts.filter((a) => a.type === "investment");

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      type: (initialValues?.type ?? "expense") as any,
      date: initialValues?.date ?? today,
      currency: initialValues?.currency ?? "BRL",
      title: initialValues?.title ?? "",
      amount: initialValues?.amount?.toString() ?? "",
      account_id: initialValues?.account_id ?? "",
      category_id: initialValues?.category_id ?? "",
      investment_type: "",
      investment_account_id: "",
      notes: initialValues?.notes ?? "",
      is_fixed: false,
      due_day: "",
    },
  });

  const selectedType = watch("type");
  const isFixed = watch("is_fixed");
  const currentAmountStr = watch("amount");
  const currentAccountId = watch("account_id");

  const categories = selectedType === "income" ? income : expense;

  const originAccount = accounts.find((a) => a.id === currentAccountId);
  const originBalance = Number(originAccount?.balance || 0);

  const cleanAmountStr = currentAmountStr
    ? currentAmountStr.replace(/[R$\s.]/g, "").replace(",", ".")
    : "0";
  const numericAmount = Number(cleanAmountStr);

  const isTakingMoneyOut =
    selectedType === "expense" ||
    selectedType === "transfer" ||
    selectedType === "investment";
  const isExceeded =
    isTakingMoneyOut &&
    currentAccountId !== "" &&
    numericAmount > originBalance + 0.01;

  const handleFormSubmit = async (values: FormData) => {
    const cleanAmount = values.amount.replace(/[R$\s.]/g, "").replace(",", ".");
    const amount = Number(cleanAmount);

    if (values.is_fixed && values.type === "expense") {
      await createFixed({
        title: values.title,
        amount,
        currency: values.currency,
        due_day: Number(values.due_day) || new Date().getDate(),
        account_id: values.account_id ?? null,
        category_id: values.category_id ?? null,
        is_paid: false,
        paid_at: null,
        recurring: true,
      });
      onCancel();
      return;
    }

    if (values.type === "investment") {
      if (!values.investment_account_id) {
        Alert.alert(
          "Atenção",
          "Por favor, selecione uma conta de investimento de destino.",
        );
        return;
      }

      const invTag = values.investment_type
        ? `[${values.investment_type}] `
        : "";

      await onSubmit({
        title: values.title,
        amount,
        type: "expense",
        account_id: values.account_id,
        category_id: null,
        date: values.date,
        notes: `[SAÍDA] ${invTag}${values.notes ?? ""}`.trim(),
        currency: values.currency,
        recurring: false,
      });

      await onSubmit({
        title: values.title,
        amount,
        type: "income",
        account_id: values.investment_account_id,
        category_id: null,
        date: values.date,
        notes: `[ENTRADA] ${invTag}${values.notes ?? ""}`.trim(),
        currency: values.currency,
        recurring: false,
      });
      return;
    }

    await onSubmit({
      title: values.title,
      amount,
      type: values.type as TransactionType,
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
      <Text style={[s.label, { color: colors.subText, marginBottom: 8 }]}>
        Tipo
      </Text>
      <Controller
        name="type"
        control={control}
        render={({ field: { onChange, value } }) => (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginBottom: 4 }}
          >
            <View style={s.typeRow}>
              {TYPES.map((t) => (
                <TouchableOpacity
                  key={t.value}
                  style={[
                    s.typeBtn,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                    },
                    value === t.value && {
                      backgroundColor: t.color,
                      borderColor: t.color,
                    },
                  ]}
                  onPress={() => onChange(t.value)}
                >
                  <Text
                    style={[
                      s.typeBtnText,
                      { color: colors.subText },
                      value === t.value && s.typeBtnActive,
                    ]}
                  >
                    {t.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        )}
      />

      {/* TOGGLE FIXA */}
      {selectedType === "expense" && (
        <Controller
          name="is_fixed"
          control={control}
          render={({ field: { onChange, value } }) => (
            <View
              style={[
                s.toggleRow,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  borderWidth: 1,
                },
              ]}
            >
              <View>
                <Text style={[s.toggleLabel, { color: colors.text }]}>
                  Conta fixa recorrente?
                </Text>
                <Text style={[s.toggleSub, { color: colors.subText }]}>
                  Ex: aluguel, luz, internet
                </Text>
              </View>
              <Switch
                value={value}
                onValueChange={onChange}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor="#fff"
              />
            </View>
          )}
        />
      )}

      {/* DIA DE VENCIMENTO */}
      {isFixed && selectedType === "expense" && (
        <Controller
          name="due_day"
          control={control}
          render={({ field: { onChange, value } }) => (
            <Input
              label="Dia de vencimento"
              placeholder="Ex: 10"
              placeholderTextColor={colors.subText}
              keyboardType="decimal-pad"
              onChangeText={onChange}
              value={value ?? ""}
            />
          )}
        />
      )}

      {/* TÍTULO */}
      <Controller
        name="title"
        control={control}
        render={({ field: { onChange, value } }) => (
          <Input
            label="Título"
            placeholder={
              selectedType === "investment"
                ? "Ex: Aporte Mensal"
                : "Ex: Almoço, Salário..."
            }
            placeholderTextColor={colors.subText}
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
                placeholderTextColor={colors.subText}
                keyboardType="decimal-pad"
                onChangeText={onChange}
                value={value}
                error={errors.amount?.message}
              />
            )}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[s.label, { color: colors.subText }]}>Moeda</Text>
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
                        {
                          backgroundColor: colors.card,
                          borderColor: colors.border,
                        },
                        value === c && [
                          s.currencyBtnActive,
                          {
                            backgroundColor: colors.primary,
                            borderColor: colors.primary,
                          },
                        ],
                      ]}
                      onPress={() => onChange(c)}
                    >
                      <Text
                        style={[
                          s.currencyText,
                          { color: colors.subText },
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

      {/* CONTA (ORIGEM) */}
      <Text style={[s.label, { color: colors.subText }]}>
        {selectedType === "investment"
          ? "De qual conta saiu o dinheiro?"
          : "Conta"}
      </Text>
      <Controller
        name="account_id"
        control={control}
        render={({ field: { onChange, value } }) => (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginBottom: 12 }}
          >
            <View style={s.optionRow}>
              <TouchableOpacity
                style={[
                  s.optionBtn,
                  {
                    backgroundColor: isDark ? "#1e1b4b" : "#eef2ff",
                    borderColor: colors.border,
                  },
                ]}
                onPress={() => {
                  setNewAccountType("checking");
                  setAccountModalVisible(true);
                }}
              >
                <Text style={{ color: colors.primary, fontWeight: "bold" }}>
                  + Nova
                </Text>
              </TouchableOpacity>

              {accounts
                .filter((a) => a.type !== "credit")
                .map((a) => (
                  <TouchableOpacity
                    key={a.id}
                    style={[
                      s.optionBtn,
                      {
                        backgroundColor: colors.card,
                        borderColor: colors.border,
                      },
                      value === a.id && {
                        backgroundColor: a.color,
                        borderColor: a.color,
                      },
                    ]}
                    onPress={() => onChange(a.id)}
                  >
                    <Text
                      style={[
                        s.optionText,
                        { color: colors.subText },
                        value === a.id && { color: "#fff" },
                      ]}
                    >
                      {a.name}
                    </Text>
                  </TouchableOpacity>
                ))}
            </View>
          </ScrollView>
        )}
      />

      {/* AVISO DE LIMITE EXCEDIDO */}
      {isExceeded && (
        <Text style={s.errorText}>
          ⚠️ Saldo insuficiente. Tens apenas {fmt(originBalance)} nesta conta.
        </Text>
      )}

      {/* INVESTIMENTOS */}
      {selectedType === "investment" ? (
        <>
          {/* TIPO DE INVESTIMENTO */}
          <View style={{ marginBottom: 16 }}>
            <Text style={[s.label, { color: colors.subText }]}>
              Onde está investindo?
            </Text>
            <Controller
              name="investment_type"
              control={control}
              render={({ field: { onChange, value } }) => (
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={s.optionRow}>
                    {INVESTMENT_OPTIONS.map((inv) => (
                      <TouchableOpacity
                        key={inv}
                        style={[
                          s.optionBtn,
                          {
                            backgroundColor: colors.card,
                            borderColor: colors.border,
                          },
                          value === inv && {
                            backgroundColor: "#8b5cf6",
                            borderColor: "#8b5cf6",
                          },
                        ]}
                        onPress={() => onChange(inv)}
                      >
                        <Text
                          style={[
                            s.optionText,
                            { color: colors.subText },
                            value === inv && s.optionTextActive,
                          ]}
                        >
                          {inv}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              )}
            />
          </View>

          {/* CONTA DE DESTINO */}
          <View style={{ marginBottom: 16 }}>
            <Text style={[s.label, { color: colors.subText }]}>
              Para qual conta de investimento?
            </Text>
            <Controller
              name="investment_account_id"
              control={control}
              render={({ field: { onChange, value } }) => (
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={s.optionRow}>
                    <TouchableOpacity
                      style={[
                        s.optionBtn,
                        {
                          backgroundColor: isDark ? "#2e1065" : "#f5f3ff",
                          borderColor: colors.border,
                        },
                      ]}
                      onPress={() => {
                        setNewAccountType("investment");
                        setAccountModalVisible(true);
                      }}
                    >
                      <Text style={{ color: "#8b5cf6", fontWeight: "bold" }}>
                        + Nova Conta
                      </Text>
                    </TouchableOpacity>

                    {investmentAccounts.map((inv) => (
                      <TouchableOpacity
                        key={inv.id}
                        style={[
                          s.optionBtn,
                          {
                            backgroundColor: colors.card,
                            borderColor: colors.border,
                          },
                          value === inv.id && {
                            backgroundColor: inv.color || "#8b5cf6",
                            borderColor: inv.color || "#8b5cf6",
                          },
                        ]}
                        onPress={() => onChange(inv.id)}
                      >
                        <Text
                          style={[
                            s.optionText,
                            { color: colors.subText },
                            value === inv.id && s.optionTextActive,
                          ]}
                        >
                          {inv.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              )}
            />
          </View>
        </>
      ) : selectedType !== "transfer" ? (
        <>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Text style={[s.label, { color: colors.subText }]}>Categoria</Text>
            <TouchableOpacity
              onPress={() => {
                onCancel();
                router.push("/(tabs)/categories");
              }}
            >
              <Ionicons name="add-circle" size={22} color={colors.primary} />
            </TouchableOpacity>
          </View>
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
                        {
                          backgroundColor: colors.card,
                          borderColor: colors.border,
                        },
                        value === c.id && {
                          backgroundColor: c.color,
                          borderColor: c.color,
                        },
                      ]}
                      onPress={() => onChange(c.id)}
                    >
                      <Text
                        style={[
                          s.optionText,
                          { color: colors.subText },
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
      ) : null}

      {/* DATA */}
      <Controller
        name="date"
        control={control}
        render={({ field: { onChange, value } }) => (
          <Input
            label="Data"
            placeholder="AAAA-MM-DD"
            placeholderTextColor={colors.subText}
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
            placeholderTextColor={colors.subText}
            onChangeText={onChange}
            value={value ?? ""}
            multiline
            numberOfLines={3}
          />
        )}
      />

      {/* AÇÕES */}
      <View style={s.actions}>
        <TouchableOpacity
          style={[s.cancelBtn, { borderColor: colors.primary }]}
          onPress={onCancel}
        >
          <Text style={[s.cancelText, { color: colors.primary }]}>
            Cancelar
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            s.saveBtn,
            { backgroundColor: colors.primary },
            (isLoading || isExceeded) && { opacity: 0.6 },
          ]}
          onPress={handleSubmit(handleFormSubmit)}
          disabled={isLoading || isExceeded}
        >
          <Text style={s.saveText}>{isLoading ? "Salvando..." : "Salvar"}</Text>
        </TouchableOpacity>
      </View>

      {/* MODAL DE NOVA CONTA */}
      <Modal
        visible={accountModalVisible}
        animationType="fade"
        transparent={true}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.5)",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <View
            style={{
              backgroundColor: colors.card,
              padding: 20,
              borderRadius: 16,
            }}
          >
            <Text
              style={{
                fontSize: 18,
                fontWeight: "bold",
                marginBottom: 16,
                color: colors.text,
              }}
            >
              {newAccountType === "investment"
                ? "Nova Conta de Investimento"
                : "Nova Conta"}
            </Text>
            <TextInput
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.inputBg,
                color: colors.text,
                padding: 12,
                borderRadius: 8,
                marginBottom: 16,
              }}
              placeholder={
                newAccountType === "investment"
                  ? "Nome (Ex: Corretora Rico)"
                  : "Nome (Ex: Nubank)"
              }
              placeholderTextColor={colors.subText}
              value={newBankName}
              onChangeText={setNewBankName}
            />
            <Text
              style={{
                marginBottom: 8,
                fontWeight: "600",
                color: colors.subText,
              }}
            >
              Cor:
            </Text>
            <View
              style={{
                flexDirection: "row",
                gap: 10,
                marginBottom: 20,
                flexWrap: "wrap",
              }}
            >
              {[
                "#830ad1",
                "#ec7000",
                "#ff7a00",
                "#1d823b",
                "#e11d48",
                "#2563eb",
                "#16a34a",
                "#475569",
              ].map((color) => (
                <TouchableOpacity
                  key={color}
                  onPress={() => setNewBankColor(color)}
                  style={{
                    width: 35,
                    height: 35,
                    borderRadius: 20,
                    backgroundColor: color,
                    borderWidth: newBankColor === color ? 3 : 0,
                    borderColor: colors.text,
                  }}
                />
              ))}
            </View>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity
                style={{
                  flex: 1,
                  padding: 12,
                  backgroundColor: colors.border,
                  borderRadius: 8,
                  alignItems: "center",
                }}
                onPress={() => setAccountModalVisible(false)}
              >
                <Text style={{ fontWeight: "bold", color: colors.text }}>
                  Cancelar
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  flex: 1,
                  padding: 12,
                  backgroundColor: newBankColor,
                  borderRadius: 8,
                  alignItems: "center",
                }}
                onPress={async () => {
                  if (!newBankName) return;
                  await createAccount({
                    name: newBankName,
                    color: newBankColor,
                    type: newAccountType,
                    balance: 0,
                    currency: "BRL",
                    due_day: null,
                  });
                  setNewBankName("");
                  setAccountModalVisible(false);
                }}
              >
                <Text style={{ fontWeight: "bold", color: "#fff" }}>
                  Salvar
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { padding: 20, gap: 16 },
  label: { fontSize: 13, fontWeight: "600", marginBottom: 6 },
  row: { flexDirection: "row", alignItems: "flex-start" },

  toggleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderRadius: 12,
    padding: 14,
  },
  toggleLabel: { fontSize: 14, fontWeight: "600" },
  toggleSub: { fontSize: 12, marginTop: 2 },

  typeRow: { flexDirection: "row", paddingVertical: 2 },
  typeBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    marginRight: 8,
  },
  typeBtnText: { fontSize: 13, fontWeight: "600" },
  typeBtnActive: { color: "#fff" },

  currencyRow: { flexDirection: "row" },
  currencyBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    marginRight: 6,
  },
  currencyBtnActive: {},
  currencyText: { fontSize: 12, fontWeight: "600" },
  currencyTextActive: { color: "#fff" },

  optionRow: { flexDirection: "row", paddingVertical: 2 },
  optionBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
  },
  optionText: { fontSize: 13, fontWeight: "600" },
  optionTextActive: { color: "#fff" },

  errorText: {
    color: "#ef4444",
    fontSize: 13,
    fontWeight: "600",
    marginTop: -8,
    marginBottom: 8,
  },

  actions: { flexDirection: "row", marginTop: 24, marginBottom: 40 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    marginRight: 8,
  },
  cancelText: { fontWeight: "600", fontSize: 15 },
  saveBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  saveText: { color: "#fff", fontWeight: "600", fontSize: 15 },
});
