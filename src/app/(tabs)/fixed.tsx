import { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Modal,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Platform,
  TextInput,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useFixedExpenses } from "@/hooks/useFixedExpenses";
import { useAccounts } from "@/hooks/useAccounts";
import { useCategories } from "@/hooks/useCategories";
import { fixedExpenseService } from "@/services";
import { Input, Button } from "@/components/ui";
import { formatCurrency } from "@/utils";
import { useAuth } from "@/hooks/useAuth";
import type { FixedExpense } from "@/types";

const schema = z.object({
  title: z.string().min(1, "Nome obrigatório"),
  amount: z.string().min(1, "Valor obrigatório"),
  due_day: z.string().min(1, "Dia obrigatório"),
  currency: z.string().min(1),
  account_id: z.string().optional(),
  category_id: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

const CURRENCIES = ["BRL", "USD", "EUR", "GBP"];
const SUGGESTIONS = [
  "Aluguel",
  "Luz",
  "Água",
  "Internet",
  "Netflix",
  "Academia",
  "Plano de Saúde",
  "Condomínio",
  "Seguro",
  "Telefone",
];

export default function FixedExpensesScreen() {
  const { profile } = useAuth();
  const {
    expenses,
    isLoading,
    totalMonth,
    totalPaid,
    totalPending,
    pendingCount,
    create,
    markAsPaid,
    undoPaid,
    remove,
    refetch,
  } = useFixedExpenses();
  const { accounts, create: createAccount } = useAccounts();
  const [refreshing, setRefreshing] = useState(false);
  // criação de conta:
  const [accountModalVisible, setAccountModalVisible] = useState(false);
  const [newBankName, setNewBankName] = useState("");
  const [newBankColor, setNewBankColor] = useState("#830ad1");

  const { expense: expenseCategories } = useCategories();

  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<FixedExpense | null>(null);
  const onRefresh = async () => {
    setRefreshing(true);
    if (refetch) await refetch();
    setRefreshing(false);
  };
  const {
    control,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { currency: "BRL" },
  });

  // Preenche form ao editar
  useEffect(() => {
    if (editing) {
      setValue("title", editing.title);
      setValue("amount", editing.amount.toString());
      setValue("due_day", editing.due_day.toString());
      setValue("currency", editing.currency);
      if (editing.account_id) setValue("account_id", editing.account_id);
      if (editing.category_id) setValue("category_id", editing.category_id);
    } else {
      reset({ currency: "BRL" });
    }
  }, [editing]);

  const onSubmit = async (values: FormData) => {
    const payload = {
      title: values.title,
      amount: Number(values.amount.replace(",", ".")),
      currency: values.currency,
      due_day: Number(values.due_day),
      account_id: values.account_id ?? null,
      category_id: values.category_id ?? null,
    };

    if (editing) {
      const { error } = await fixedExpenseService.update(editing.id, payload);
      if (error) return Alert.alert("Erro", error);
      await refetch();
    } else {
      const { error } = await create({
        ...payload,
        is_paid: false,
        paid_at: null,
        recurring: true,
      });
      if (error) return Alert.alert("Erro", error);
    }
    reset({ currency: "BRL" });
    setEditing(null);
    setModalVisible(false);
  };

  const handlePay = async (expense: FixedExpense) => {
    // ----------------------------------------------------
    // LÓGICA 1: SE A CONTA JÁ ESTIVER PAGA (DESFAZER)
    // ----------------------------------------------------
    if (expense.is_paid) {
      const msgDesfazer = `"${expense.title}" já foi marcada como paga. Deseja desfazer?`;

      if (Platform.OS === "web") {
        const confirmou = window.confirm(msgDesfazer);
        if (confirmou) {
          const { error } = await undoPaid(expense.id);
          if (error) window.alert("Erro: " + error);
        }
      } else {
        Alert.alert("Conta paga", msgDesfazer, [
          { text: "Cancelar", style: "cancel" },
          {
            text: "Desfazer pagamento",
            style: "destructive",
            onPress: async () => {
              const { error } = await undoPaid(expense.id);
              if (error) Alert.alert("Erro", error);
            },
          },
        ]);
      }
      return;
    }

    // ----------------------------------------------------
    // LÓGICA 2: SE A CONTA AINDA NÃO FOI PAGA (PAGAR)
    // ----------------------------------------------------
    const msgPagar = `Confirmar pagamento de "${expense.title}"?\n${formatCurrency(expense.amount, expense.currency)}${!expense.account_id ? "\n\n⚠️ Sem conta vinculada — apenas marcará como paga." : ""}`;

    if (Platform.OS === "web") {
      const confirmou = window.confirm(msgPagar);
      if (confirmou) {
        const { error } = await markAsPaid(expense);
        if (error) window.alert("Erro: " + error);
      }
    } else {
      Alert.alert("Pagar conta", msgPagar, [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Confirmar",
          onPress: async () => {
            const { error } = await markAsPaid(expense);
            if (error) Alert.alert("Erro", error);
          },
        },
      ]);
    }
  };

  // Função atualizada para apagar contas fixas de forma segura
  const handleDelete = (item: FixedExpense) => {
    const mensagem = `Tem certeza que deseja remover "${item.title}"?\n\nEssa ação não pode ser desfeita.`;

    // Verificação para ambiente Web
    if (Platform.OS === "web") {
      const confirmou = window.confirm(mensagem);
      if (confirmou) {
        remove(item.id).then(({ error }) => {
          if (error) window.alert("Erro ao remover: " + error);
        });
      }
    }
    // Verificação para ambiente Mobile (iOS/Android)
    else {
      Alert.alert("Remover conta fixa", mensagem, [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Remover",
          style: "destructive",
          onPress: async () => {
            const { error } = await remove(item.id);
            if (error) Alert.alert("Erro ao remover", error);
          },
        },
      ]);
    }
  };

  const handleEdit = (item: FixedExpense) => {
    setEditing(item);
    setModalVisible(true);
  };

  const handleClose = () => {
    setModalVisible(false);
    setEditing(null);
    reset({ currency: "BRL" });
  };

  const sorted = [...expenses].sort(
    (a, b) => Number(a.is_paid) - Number(b.is_paid),
  );

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Text style={s.title}>Contas Fixas</Text>
        <TouchableOpacity
          style={s.addBtn}
          onPress={() => setModalVisible(true)}
        >
          <Text style={s.addBtnText}>+ Nova</Text>
        </TouchableOpacity>
      </View>

      <View style={s.summaryCard}>
        <View style={s.summaryRow}>
          <View style={s.summaryItem}>
            <Text style={s.summaryLabel}>Total mês</Text>
            <Text style={s.summaryValue}>
              {formatCurrency(totalMonth, profile?.currency)}
            </Text>
          </View>
          <View style={s.summaryDivider} />
          <View style={s.summaryItem}>
            <Text style={s.summaryLabel}>Pago</Text>
            <Text style={[s.summaryValue, { color: "#16a34a" }]}>
              {formatCurrency(totalPaid, profile?.currency)}
            </Text>
          </View>
          <View style={s.summaryDivider} />
          <View style={s.summaryItem}>
            <Text style={s.summaryLabel}>Pendente</Text>
            <Text style={[s.summaryValue, { color: "#dc2626" }]}>
              {formatCurrency(totalPending, profile?.currency)}
            </Text>
          </View>
        </View>
        {pendingCount > 0 && (
          <Text style={s.pendingAlert}>
            ⚠️ {pendingCount} conta{pendingCount > 1 ? "s" : ""} pendente
            {pendingCount > 1 ? "s" : ""}
          </Text>
        )}
      </View>

      {isLoading ? (
        <ActivityIndicator color="#6366f1" style={{ marginTop: 32 }} />
      ) : (
        <FlatList
          data={sorted}
          keyExtractor={(e) => e.id}
          contentContainerStyle={s.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={["#6366f1"]}
            />
          }
          bounces={false} // <--- ADICIONE ISTO
          overScrollMode="never" // <--- ADICIONE ISTO
          ListEmptyComponent={
            <View style={s.empty}>
              <Text style={s.emptyText}>Nenhuma conta fixa cadastrada</Text>
              <Text style={s.emptySubtext}>
                Toque em "+ Nova" para adicionar
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <FixedExpenseCard
              item={item}
              onPay={() => handlePay(item)}
              onEdit={() => handleEdit(item)}
              onDelete={() => handleDelete(item)}
            />
          )}
        />
      )}

      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={s.modal}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>
              {editing ? "Editar Conta Fixa" : "Nova Conta Fixa"}
            </Text>
            <TouchableOpacity onPress={handleClose}>
              <Text style={s.modalClose}>Fechar</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={s.form}>
            <Text style={s.label}>Sugestões</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginBottom: 8 }}
            >
              <View style={s.optionRow}>
                {SUGGESTIONS.map((sug) => (
                  <TouchableOpacity
                    key={sug}
                    style={s.suggestionBtn}
                    onPress={() => setValue("title", sug)}
                  >
                    <Text style={s.suggestionText}>{sug}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <Controller
              name="title"
              control={control}
              render={({ field: { onChange, value } }) => (
                <Input
                  label="Nome da conta"
                  placeholder="Ex: Conta de Luz"
                  onChangeText={onChange}
                  value={value}
                  error={errors.title?.message}
                />
              )}
            />

            <View style={{ flexDirection: "row", gap: 12 }}>
              <View style={{ flex: 2 }}>
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
                <Controller
                  name="due_day"
                  control={control}
                  render={({ field: { onChange, value } }) => (
                    <Input
                      label="Dia venc."
                      placeholder="15"
                      keyboardType="numeric"
                      onChangeText={onChange}
                      value={value}
                      error={errors.due_day?.message}
                    />
                  )}
                />
              </View>
            </View>

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
                        style={[s.optionText, value === c && { color: "#fff" }]}
                      >
                        {c}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            />

            {accounts.length >= 0 && ( // Mudamos de > 0 para >= 0 para o botão sempre aparecer
              <>
                <Text style={s.label}>Debitar da conta (opcional)</Text>
                <Controller
                  name="account_id"
                  control={control}
                  render={({ field: { onChange, value } }) => (
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                    >
                      <View style={s.optionRow}>
                        {/* NOVO BOTÃO: + Nova Conta */}
                        <TouchableOpacity
                          style={[
                            s.optionBtn,
                            {
                              backgroundColor: "#eef2ff",
                              borderColor: "#c7d2fe",
                            },
                          ]}
                          onPress={() => setAccountModalVisible(true)}
                        >
                          <Text
                            style={{ color: "#4f46e5", fontWeight: "bold" }}
                          >
                            + Nova
                          </Text>
                        </TouchableOpacity>

                        {/* Lista de contas existentes */}
                        {accounts.map((a) => (
                          <TouchableOpacity
                            key={a.id}
                            style={[
                              s.optionBtn,
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
                                value === a.id && { color: "#fff" },
                              ]}
                            >
                              {a.name}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>

                      {/* MODAL RÁPIDO DE NOVA CONTA */}
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
                              backgroundColor: "#fff",
                              padding: 20,
                              borderRadius: 16,
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 18,
                                fontWeight: "bold",
                                marginBottom: 16,
                              }}
                            >
                              Nova Conta
                            </Text>

                            <TextInput
                              style={{
                                borderWidth: 1,
                                borderColor: "#d1d5db",
                                padding: 12,
                                borderRadius: 8,
                                marginBottom: 16,
                              }}
                              placeholder="Nome do Banco (Ex: Nubank)"
                              value={newBankName}
                              onChangeText={setNewBankName}
                            />

                            <Text
                              style={{ marginBottom: 8, fontWeight: "600" }}
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
                                  }}
                                />
                              ))}
                            </View>

                            <View style={{ flexDirection: "row", gap: 10 }}>
                              <TouchableOpacity
                                style={{
                                  flex: 1,
                                  padding: 12,
                                  backgroundColor: "#f3f4f6",
                                  borderRadius: 8,
                                  alignItems: "center",
                                }}
                                onPress={() => setAccountModalVisible(false)}
                              >
                                <Text
                                  style={{
                                    fontWeight: "bold",
                                    color: "#4b5563",
                                  }}
                                >
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
                                    type: "checking",
                                    balance: 0,
                                    currency: "BRL",
                                    due_day: null,
                                  });
                                  setNewBankName("");
                                  setAccountModalVisible(false);
                                }}
                              >
                                <Text
                                  style={{ fontWeight: "bold", color: "#fff" }}
                                >
                                  Salvar
                                </Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        </View>
                      </Modal>
                    </ScrollView>
                  )}
                />
              </>
            )}

            {expenseCategories.length > 0 && (
              <>
                <Text style={s.label}>Categoria (opcional)</Text>
                <Controller
                  name="category_id"
                  control={control}
                  render={({ field: { onChange, value } }) => (
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                    >
                      <View style={s.optionRow}>
                        {expenseCategories.map((c) => (
                          <TouchableOpacity
                            key={c.id}
                            style={[
                              s.optionBtn,
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
                                value === c.id && { color: "#fff" },
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

            <Button
              label={editing ? "Salvar alterações" : "Salvar conta fixa"}
              loading={isLoading}
              onPress={handleSubmit(onSubmit)}
            />
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

function FixedExpenseCard({
  item,
  onPay,
  onEdit,
  onDelete,
}: {
  item: FixedExpense;
  onPay: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const daysUntilDue = item.due_day - new Date().getDate();
  const isOverdue = !item.is_paid && daysUntilDue < 0;
  const isDueSoon = !item.is_paid && daysUntilDue >= 0 && daysUntilDue <= 3;

  return (
    <View style={[cs.card, item.is_paid && cs.cardPaid]}>
      <View style={cs.cardLeft}>
        <View
          style={[
            cs.dot,
            item.is_paid
              ? { backgroundColor: "#16a34a" }
              : isOverdue
                ? { backgroundColor: "#dc2626" }
                : isDueSoon
                  ? { backgroundColor: "#f59e0b" }
                  : { backgroundColor: "#6366f1" },
          ]}
        />
      </View>
      <View style={cs.cardInfo}>
        <Text style={cs.cardTitle}>{item.title}</Text>
        <Text style={cs.cardSub}>
          {item.is_paid
            ? `✓ Pago em ${item.paid_at}`
            : isOverdue
              ? `⚠️ Venceu dia ${item.due_day}`
              : isDueSoon
                ? `⏰ Vence em ${daysUntilDue} dia${daysUntilDue !== 1 ? "s" : ""}`
                : `Vence dia ${item.due_day}`}
        </Text>
        {item.account && (
          <Text style={cs.cardAccount}>{item.account.name}</Text>
        )}
      </View>
      <View style={cs.cardRight}>
        <Text style={cs.cardAmount}>
          {formatCurrency(item.amount, item.currency)}
        </Text>
        <View style={cs.cardActions}>
          <TouchableOpacity onPress={onPay}>
            <Text style={[cs.payText, item.is_paid && { color: "#9ca3af" }]}>
              {item.is_paid ? "Desfazer" : "Pagar"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onEdit}>
            <Text style={cs.editText}>Editar</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onDelete}>
            <Text style={cs.deleteText}>Remover</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

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
  summaryCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
  },
  summaryRow: { flexDirection: "row", alignItems: "center" },
  summaryItem: { flex: 1, alignItems: "center" },
  summaryLabel: { fontSize: 12, color: "#6b7280", marginBottom: 4 },
  summaryValue: { fontSize: 15, fontWeight: "700", color: "#111827" },
  summaryDivider: {
    width: 1,
    height: 32,
    backgroundColor: "#e5e7eb",
    marginHorizontal: 8,
  },
  pendingAlert: {
    marginTop: 12,
    fontSize: 13,
    color: "#dc2626",
    fontWeight: "600",
    textAlign: "center",
  },
  list: { paddingHorizontal: 20, paddingBottom: 32 },
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
  optionRow: { flexDirection: "row", gap: 8 },
  optionBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  optionBtnActive: { backgroundColor: "#6366f1", borderColor: "#6366f1" },
  optionText: { fontSize: 13, color: "#6b7280", fontWeight: "500" },
  suggestionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: "#ede9fe",
    marginRight: 8,
  },
  suggestionText: { fontSize: 12, color: "#6366f1", fontWeight: "600" },
});

const cs = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
  },
  cardPaid: { opacity: 0.6 },
  cardLeft: { marginRight: 12 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  cardInfo: { flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: "700", color: "#111827" },
  cardSub: { fontSize: 12, color: "#6b7280", marginTop: 3 },
  cardAccount: { fontSize: 11, color: "#9ca3af", marginTop: 2 },
  cardRight: { alignItems: "flex-end" },
  cardAmount: { fontSize: 15, fontWeight: "700", color: "#111827" },
  cardActions: { flexDirection: "row", gap: 10, marginTop: 6 },
  payText: { fontSize: 12, color: "#6366f1", fontWeight: "700" },
  editText: { fontSize: 12, color: "#f59e0b", fontWeight: "700" },
  deleteText: { fontSize: 12, color: "#ef4444" },
});
