import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useState } from "react";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "@/components/ui";
import { useAccounts } from "@/hooks/useAccounts";
import { useCategories } from "@/hooks/useCategories";
import { useFixedExpenses } from "@/hooks/useFixedExpenses";
import { useAppTheme } from "@/hooks/useTheme";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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

const INVESTMENT_OPTIONS = [
  "CDB",
  "CDI",
  "SELIC",
  "Tesouro",
  "Poupança",
  "Outros",
];
const CURRENCIES = ["BRL", "USD", "EUR"];

// Função auxiliar para tentar adivinhar um ícone baseado no nome da categoria
const getCategoryIcon = (name: string): keyof typeof Ionicons.glyphMap => {
  const n = name.toLowerCase();
  if (n.includes("aliment") || n.includes("mercado") || n.includes("comida"))
    return "cart";
  if (n.includes("morad") || n.includes("casa") || n.includes("aluguel"))
    return "home";
  if (n.includes("transport") || n.includes("carro") || n.includes("gasolina"))
    return "car";
  if (n.includes("educa") || n.includes("faculdade") || n.includes("curso"))
    return "school";
  if (n.includes("saúde") || n.includes("farmácia") || n.includes("médico"))
    return "medkit";
  if (n.includes("assinatura") || n.includes("netflix") || n.includes("tv"))
    return "tv";
  if (n.includes("lazer") || n.includes("festa")) return "party-horn" as any; // fallback
  if (n.includes("roupa") || n.includes("vestuário")) return "shirt";
  if (n.includes("serviço")) return "build";
  return "pricetag"; // Ícone padrão
};

export function TransactionForm({
  onSubmit,
  onCancel,
  isLoading,
  initialValues,
}: TransactionFormProps) {
  const { accounts } = useAccounts();
  const router = useRouter();
  const { income, expense } = useCategories();
  const { create: createFixed } = useFixedExpenses();
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();

  const today = new Date().toISOString().split("T")[0];
  const investmentAccounts = accounts.filter((a) => a.type === "investment");

  const {
    control,
    handleSubmit,
    watch,
    setValue,
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

  const categoriesList = selectedType === "income" ? income : expense;

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

  // 👇 LÓGICA DE CORES DO CABEÇALHO BASEADA NO DESIGN
  let headerColor = colors.primary; // Roxo padrão
  if (selectedType === "expense") headerColor = "#ef4444"; // Vermelho
  if (selectedType === "income") headerColor = "#10b981"; // Verde

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
      if (!values.investment_account_id)
        return Alert.alert("Atenção", "Selecione uma conta de destino.");
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
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: headerColor }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* 👇 SUPER CABEÇALHO COLORIDO (Design da Imagem 3) */}
      <View
        style={{
          paddingTop: Math.max(insets.top, 20),
          paddingHorizontal: 20,
          paddingBottom: 40,
        }}
      >
        <View style={s.headerTop}>
          <TouchableOpacity onPress={onCancel} style={s.backBtn}>
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={s.headerTitle}>
            {initialValues ? "Editar Transação" : "Nova Transação"}
          </Text>
          <View style={{ width: 24 }} />
        </View>

        {/* Toggle Despesa/Receita/Investimento */}
        <View style={s.typeToggleContainer}>
          <TouchableOpacity
            style={[
              s.typeToggleBtn,
              selectedType === "expense" && s.typeToggleBtnActive,
            ]}
            onPress={() => setValue("type", "expense")}
          >
            <Text
              style={[
                s.typeToggleText,
                selectedType === "expense" && s.typeToggleTextActive,
              ]}
            >
              💸 Despesa
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              s.typeToggleBtn,
              selectedType === "income" && s.typeToggleBtnActive,
            ]}
            onPress={() => setValue("type", "income")}
          >
            <Text
              style={[
                s.typeToggleText,
                selectedType === "income" && s.typeToggleTextActive,
              ]}
            >
              💵 Receita
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              s.typeToggleBtn,
              selectedType === "investment" && s.typeToggleBtnActive,
            ]}
            onPress={() => setValue("type", "investment")}
          >
            <Text
              style={[
                s.typeToggleText,
                selectedType === "investment" && s.typeToggleTextActive,
              ]}
            >
              📈 Invest
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={s.amountLabel}>Valor</Text>
        <Controller
          name="amount"
          control={control}
          render={({ field: { onChange, value } }) => (
            <View style={s.amountInputContainer}>
              <Text style={s.currencyPrefix}>R$</Text>
              <TextInput
                style={s.hugeInput}
                placeholder="0,00"
                placeholderTextColor="rgba(255,255,255,0.5)"
                keyboardType="decimal-pad"
                value={value}
                onChangeText={onChange}
              />
            </View>
          )}
        />
        {errors.amount && (
          <Text style={s.errorTopText}>{errors.amount.message}</Text>
        )}
      </View>

      {/* 👇 CORPO DO FORMULÁRIO (Cartão Branco/Escuro Sobreposto) */}
      <ScrollView
        contentContainerStyle={[
          s.bodyContainer,
          { backgroundColor: colors.bg },
        ]}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <Controller
          name="title"
          control={control}
          render={({ field: { onChange, value } }) => (
            <View style={s.inputGroup}>
              <Text style={[s.label, { color: colors.text }]}>Descrição</Text>
              <TextInput
                style={[
                  s.modernInput,
                  {
                    backgroundColor: colors.card,
                    color: colors.text,
                    borderColor: colors.border,
                  },
                ]}
                placeholder="Ex: Supermercado do mês..."
                placeholderTextColor={colors.subText}
                value={value}
                onChangeText={onChange}
              />
              {errors.title && (
                <Text style={s.errorText}>{errors.title.message}</Text>
              )}
            </View>
          )}
        />

        {/* 👇 GRID DE CATEGORIAS (Design da Imagem 3) */}
        {selectedType !== "investment" && selectedType !== "transfer" && (
          <View style={s.inputGroup}>
            <Text style={[s.label, { color: colors.text }]}>Categoria</Text>
            <Controller
              name="category_id"
              control={control}
              render={({ field: { onChange, value } }) => (
                <View style={s.categoryGrid}>
                  {categoriesList.map((c) => {
                    const isSelected = value === c.id;
                    return (
                      <TouchableOpacity
                        key={c.id}
                        style={s.categoryItem}
                        onPress={() => onChange(c.id)}
                      >
                        <View
                          style={[
                            s.categoryIconBox,
                            {
                              backgroundColor: isSelected
                                ? headerColor
                                : colors.card,
                              borderColor: colors.border,
                            },
                          ]}
                        >
                          <Ionicons
                            name={getCategoryIcon(c.name)}
                            size={24}
                            color={isSelected ? "#fff" : colors.subText}
                          />
                        </View>
                        <Text
                          style={[
                            s.categoryItemText,
                            { color: colors.subText },
                            isSelected && {
                              color: colors.text,
                              fontWeight: "bold",
                            },
                          ]}
                          numberOfLines={1}
                        >
                          {c.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            />
          </View>
        )}

        {/* FORMA DE PAGAMENTO / CONTA */}
        <View style={s.inputGroup}>
          <Text style={[s.label, { color: colors.text }]}>
            De onde saiu o dinheiro?
          </Text>
          <Controller
            name="account_id"
            control={control}
            render={({ field: { onChange, value } }) => (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={s.pillRow}>
                  {accounts
                    .filter((a) => a.type !== "credit")
                    .map((a) => {
                      const isSelected = value === a.id;
                      return (
                        <TouchableOpacity
                          key={a.id}
                          style={[
                            s.pillBtn,
                            {
                              backgroundColor: colors.card,
                              borderColor: colors.border,
                            },
                            isSelected && {
                              backgroundColor: headerColor,
                              borderColor: headerColor,
                            },
                          ]}
                          onPress={() => onChange(a.id)}
                        >
                          <Text
                            style={[
                              s.pillText,
                              { color: colors.subText },
                              isSelected && {
                                color: "#fff",
                                fontWeight: "bold",
                              },
                            ]}
                          >
                            {a.name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                </View>
              </ScrollView>
            )}
          />
        </View>

        {isExceeded && (
          <Text style={s.errorText}>
            ⚠️ Saldo insuficiente na conta origem.
          </Text>
        )}

        {selectedType === "investment" && (
          <>
            <View style={s.inputGroup}>
              <Text style={[s.label, { color: colors.text }]}>
                Tipo de Investimento
              </Text>
              <Controller
                name="investment_type"
                control={control}
                render={({ field: { onChange, value } }) => (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={s.pillRow}>
                      {INVESTMENT_OPTIONS.map((inv) => (
                        <TouchableOpacity
                          key={inv}
                          style={[
                            s.pillBtn,
                            {
                              backgroundColor: colors.card,
                              borderColor: colors.border,
                            },
                            value === inv && {
                              backgroundColor: headerColor,
                              borderColor: headerColor,
                            },
                          ]}
                          onPress={() => onChange(inv)}
                        >
                          <Text
                            style={[
                              s.pillText,
                              { color: colors.subText },
                              value === inv && {
                                color: "#fff",
                                fontWeight: "bold",
                              },
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

            <View style={s.inputGroup}>
              <Text style={[s.label, { color: colors.text }]}>
                Para qual corretora?
              </Text>
              <Controller
                name="investment_account_id"
                control={control}
                render={({ field: { onChange, value } }) => (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={s.pillRow}>
                      {investmentAccounts.map((inv) => (
                        <TouchableOpacity
                          key={inv.id}
                          style={[
                            s.pillBtn,
                            {
                              backgroundColor: colors.card,
                              borderColor: colors.border,
                            },
                            value === inv.id && {
                              backgroundColor: headerColor,
                              borderColor: headerColor,
                            },
                          ]}
                          onPress={() => onChange(inv.id)}
                        >
                          <Text
                            style={[
                              s.pillText,
                              { color: colors.subText },
                              value === inv.id && {
                                color: "#fff",
                                fontWeight: "bold",
                              },
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
        )}

        {/* TOGGLE FIXA */}
        {selectedType === "expense" && (
          <Controller
            name="is_fixed"
            control={control}
            render={({ field: { onChange, value } }) => (
              <View
                style={[
                  s.inputGroup,
                  s.toggleRow,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <View>
                  <Text
                    style={[s.label, { color: colors.text, marginBottom: 0 }]}
                  >
                    Conta Fixa Recorrente?
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.subText }}>
                    Ex: Aluguel, Luz, Internet
                  </Text>
                </View>
                <Switch
                  value={value}
                  onValueChange={onChange}
                  trackColor={{ false: colors.border, true: headerColor }}
                  thumbColor="#fff"
                />
              </View>
            )}
          />
        )}

        <View style={s.inputGroup}>
          <Text style={[s.label, { color: colors.text }]}>Data</Text>
          <Controller
            name="date"
            control={control}
            render={({ field: { onChange, value } }) => (
              <TextInput
                style={[
                  s.modernInput,
                  {
                    backgroundColor: colors.card,
                    color: colors.text,
                    borderColor: colors.border,
                  },
                ]}
                placeholder="AAAA-MM-DD"
                placeholderTextColor={colors.subText}
                onChangeText={onChange}
                value={value}
              />
            )}
          />
        </View>

        <TouchableOpacity
          style={[
            s.submitBtn,
            { backgroundColor: headerColor },
            (isLoading || isExceeded) && { opacity: 0.6 },
          ]}
          onPress={handleSubmit(handleFormSubmit)}
          disabled={isLoading || isExceeded}
        >
          <Text style={s.submitBtnText}>
            {isLoading ? "Registrando..." : "Registrar Transação"}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  // Cabeçalho Colorido
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  backBtn: { padding: 4 },
  headerTitle: { color: "#fff", fontSize: 18, fontWeight: "bold" },
  typeToggleContainer: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 12,
    padding: 4,
    marginBottom: 30,
  },
  typeToggleBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 10,
  },
  typeToggleBtnActive: { backgroundColor: "#fff" },
  typeToggleText: {
    color: "rgba(255,255,255,0.8)",
    fontWeight: "bold",
    fontSize: 13,
  },
  typeToggleTextActive: { color: "#000" },
  amountLabel: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 8,
  },
  amountInputContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  currencyPrefix: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "bold",
    marginRight: 8,
    marginTop: 4,
  },
  hugeInput: {
    color: "#fff",
    fontSize: 48,
    fontWeight: "900",
    textAlign: "center",
    minWidth: 150,
  },
  errorTopText: {
    color: "#fff",
    textAlign: "center",
    marginTop: 8,
    backgroundColor: "rgba(0,0,0,0.3)",
    padding: 4,
    borderRadius: 8,
    alignSelf: "center",
  },

  // Corpo do Formulário
  bodyContainer: {
    flexGrow: 1,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    paddingBottom: 60,
  },
  inputGroup: { marginBottom: 24 },
  label: { fontSize: 15, fontWeight: "bold", marginBottom: 12 },
  modernInput: { padding: 16, borderRadius: 16, borderWidth: 1, fontSize: 16 },

  // Grid de Categorias
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-start",
    marginHorizontal: -6,
  },
  categoryItem: {
    width: "25%",
    padding: 6,
    alignItems: "center",
    marginBottom: 10,
  },
  categoryIconBox: {
    width: 56,
    height: 56,
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 6,
  },
  categoryItemText: { fontSize: 11, textAlign: "center" },

  // Pills (Formas de pagamento)
  pillRow: { flexDirection: "row", gap: 8 },
  pillBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
  },
  pillText: { fontSize: 13, fontWeight: "600" },

  toggleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  errorText: {
    color: "#ef4444",
    fontSize: 13,
    fontWeight: "bold",
    marginTop: -16,
    marginBottom: 16,
  },

  submitBtn: {
    paddingVertical: 18,
    borderRadius: 100,
    alignItems: "center",
    marginTop: 10,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  submitBtnText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
});
