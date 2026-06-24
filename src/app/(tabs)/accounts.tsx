import { useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAccounts } from "@/hooks/useAccounts";
import { Input, Button, FormError } from "@/components/ui";
import { formatCurrency } from "@/utils";
import type { AccountType } from "@/types";

//SCHEMA
const schema = z.object({
  name: z.string().min(1, "Nome Obrigatorio"),
  type: z.enum(["checking", "saving", "credit", "investment"]),
  balance: z.string().refine((v) => !isNaN(Number(v)), "Valor invalido"),
  currency: z.string().min(1),
  color: z.string().min(1),
});

type FormData = z.infer<typeof schema>;

const ACCOUNT_TYPES: { value: AccountType; label: string }[] = [
  { value: "checking", label: "Corrente" },
  { value: "savings", label: "Poupança" },
  { value: "credit", label: "Crédito" },
  { value: "investment", label: "Investimento" },
];

const COLORS = [
  "#6366f1",
  "#ec4899",
  "#f97316",
  "#22c55e",
  "#3b82f6",
  "#eab308",
  "#ef4444",
  "#8b5cf6",
];
const CURRENCIES = ["BRL", "USD", "EUR", "GBP"];

// ============================================================
// SCREEN
// ============================================================
export default function AccountsScreen() {
  const { accounts, isLoading, totalBalance, create, remove } = useAccounts();
  const [modalVisible, setModalVisible] = useState(false);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      type: "checking",
      currency: "BRL",
      color: "#6366f1",
      balance: "0",
    },
  });

  const onSubmit = async (values: FormData) => {
    const { error } = await create({
      name: values.name,
      type: values.type,
      balance: Number(values.balance),
      currency: values.currency,
      color: values.color,
    });
    if (!error) {
      reset();
      setModalVisible(false);
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      {/* HEADER */}
      <View style={s.header}>
        <Text style={s.title}>Contas</Text>
        <TouchableOpacity
          style={s.addBtn}
          onPress={() => setModalVisible(true)}
        >
          <Text style={s.addBtnText}>+ Nova</Text>
        </TouchableOpacity>
      </View>

      {/* SALDO TOTAL */}
      <View style={s.totalCard}>
        <Text style={s.totalLabel}>Patrimônio total</Text>
        <Text style={s.totalValue}>{formatCurrency(totalBalance)}</Text>
      </View>

      {/* LISTA */}
      <FlatList
        data={accounts}
        keyExtractor={(a) => a.id}
        contentContainerStyle={s.list}
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={s.emptyText}>Nenhuma conta cadastrada</Text>
            <Text style={s.emptySubtext}>Toque em "+ Nova" para adicionar</Text>
          </View>
        }
        renderItem={({ item: a }) => (
          <View style={[s.accountCard, { borderLeftColor: a.color }]}>
            <View style={s.accountInfo}>
              <Text style={s.accountName}>{a.name}</Text>
              <Text style={s.accountType}>
                {ACCOUNT_TYPES.find((t) => t.value === a.type)?.label ?? a.type}
              </Text>
            </View>
            <View style={s.accountRight}>
              <Text style={s.accountBalance}>
                {formatCurrency(a.balance, a.currency)}
              </Text>
              <TouchableOpacity onPress={() => remove(a.id)}>
                <Text style={s.deleteText}>Remover</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />

      {/* MODAL */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={s.modal}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Nova Conta</Text>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Text style={s.modalClose}>Fechar</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={s.form}>
            <Controller
              name="name"
              control={control}
              render={({ field: { onChange, value } }) => (
                <Input
                  label="Nome da conta"
                  placeholder="Ex: Nubank, Itaú..."
                  onChangeText={onChange}
                  value={value}
                  error={errors.name?.message}
                />
              )}
            />

            {/* TIPO */}
            <Text style={s.label}>Tipo</Text>
            <Controller
              name="type"
              control={control}
              render={({ field: { onChange, value } }) => (
                <View style={s.optionRow}>
                  {ACCOUNT_TYPES.map((t) => (
                    <TouchableOpacity
                      key={t.value}
                      style={[
                        s.optionBtn,
                        value === t.value && s.optionBtnActive,
                      ]}
                      onPress={() => onChange(t.value)}
                    >
                      <Text
                        style={[
                          s.optionText,
                          value === t.value && s.optionTextActive,
                        ]}
                      >
                        {t.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            />

            {/* SALDO INICIAL */}
            <Controller
              name="balance"
              control={control}
              render={({ field: { onChange, value } }) => (
                <Input
                  label="Saldo inicial"
                  placeholder="0,00"
                  keyboardType="numeric"
                  onChangeText={onChange}
                  value={value}
                  error={errors.balance?.message}
                />
              )}
            />

            {/* MOEDA */}
            <Text style={s.label}>Moeda</Text>
            <Controller
              name="currency"
              control={control}
              render={({ field: { onChange, value } }) => (
                <View style={s.optionRow}>
                  {CURRENCIES.map((c) => (
                    <TouchableOpacity
                      key={c}
                      style={[s.optionBtn, value === c && s.optionBtnActive]}
                      onPress={() => onChange(c)}
                    >
                      <Text
                        style={[
                          s.optionText,
                          value === c && s.optionTextActive,
                        ]}
                      >
                        {c}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            />

            {/* COR */}
            <Text style={s.label}>Cor</Text>
            <Controller
              name="color"
              control={control}
              render={({ field: { onChange, value } }) => (
                <View style={s.colorRow}>
                  {COLORS.map((c) => (
                    <TouchableOpacity
                      key={c}
                      style={[
                        s.colorBtn,
                        { backgroundColor: c },
                        value === c && s.colorBtnActive,
                      ]}
                      onPress={() => onChange(c)}
                    />
                  ))}
                </View>
              )}
            />

            <Button
              label="Criar conta"
              loading={isLoading}
              onPress={handleSubmit(onSubmit)}
            />
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

// ============================================================
// STYLES
// ============================================================
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f8fafc" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  title: { fontSize: 22, fontWeight: "bold", color: "#111827" },
  addBtn: {
    backgroundColor: "#6366f1",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  addBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },

  totalCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: "#6366f1",
    borderRadius: 16,
    padding: 20,
  },
  totalLabel: { color: "#c7d2fe", fontSize: 13, marginBottom: 6 },
  totalValue: { color: "#fff", fontSize: 28, fontWeight: "bold" },

  list: { paddingHorizontal: 20, paddingBottom: 32 },
  accountCard: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderLeftWidth: 4,
  },
  accountInfo: { flex: 1 },
  accountName: { fontSize: 15, fontWeight: "600", color: "#111827" },
  accountType: { fontSize: 12, color: "#9ca3af", marginTop: 4 },
  accountRight: { alignItems: "flex-end" },
  accountBalance: { fontSize: 16, fontWeight: "700", color: "#111827" },
  deleteText: { fontSize: 12, color: "#ef4444", marginTop: 6 },

  empty: { alignItems: "center", paddingVertical: 60 },
  emptyText: { fontSize: 16, fontWeight: "600", color: "#374151" },
  emptySubtext: { fontSize: 13, color: "#9ca3af", marginTop: 6 },

  modal: { flex: 1, backgroundColor: "#f8fafc" },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  modalTitle: { fontSize: 18, fontWeight: "bold", color: "#111827" },
  modalClose: { color: "#6366f1", fontWeight: "600" },

  form: { padding: 20, gap: 16 },
  label: { fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 2 },

  optionRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  optionBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  optionBtnActive: { backgroundColor: "#6366f1", borderColor: "#6366f1" },
  optionText: { fontSize: 13, color: "#6b7280", fontWeight: "500" },
  optionTextActive: { color: "#fff" },

  colorRow: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  colorBtn: { width: 36, height: 36, borderRadius: 18 },
  colorBtnActive: { borderWidth: 3, borderColor: "#111827" },
});
