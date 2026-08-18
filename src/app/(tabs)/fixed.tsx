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
  KeyboardAvoidingView,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useFixedExpenses } from "@/hooks/useFixedExpenses";
import { useAccounts } from "@/hooks/useAccounts";
import { useCategories } from "@/hooks/useCategories";
import { fixedExpenseService, transactionService } from "@/services";
import { Input, Button } from "@/components/ui";
import { formatCurrency } from "@/utils";
import { useAuth } from "@/hooks/useAuth";
import { useAppTheme } from "@/hooks/useTheme";
import { Ionicons } from "@expo/vector-icons";
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
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();

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

  const {
    accounts,
    create: createAccount,
    refetch: refetchAccounts,
    update: updateAccount,
  } = useAccounts();
  const [refreshing, setRefreshing] = useState(false);
  const [accountModalVisible, setAccountModalVisible] = useState(false);
  const [newBankName, setNewBankName] = useState("");
  const [newBankColor, setNewBankColor] = useState("#830ad1");

  const { expense: expenseCategories } = useCategories();

  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<FixedExpense | null>(null);

  const onRefresh = async () => {
    setRefreshing(true);
    if (refetchAccounts) await refetchAccounts();
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
      if (
        editing.account_id &&
        payload.account_id &&
        editing.account_id !== payload.account_id
      ) {
        const txRes = await transactionService.list({
          account_id: editing.account_id,
        });
        const linkedTxs = (txRes.data || []).filter(
          (t: any) =>
            t.title === `${editing.title} (Conta Fixa)` ||
            t.title === `Conta Fixa: ${editing.title}`,
        );

        for (const tx of linkedTxs) {
          await transactionService.update(tx.id, {
            account_id: payload.account_id,
          });

          const oldAcc = accounts.find((a) => a.id === editing.account_id);
          if (oldAcc)
            await updateAccount(oldAcc.id, {
              balance: Number(oldAcc.balance) + Number(tx.amount),
            });

          const newAcc = accounts.find((a) => a.id === payload.account_id);
          if (newAcc)
            await updateAccount(newAcc.id, {
              balance: Number(newAcc.balance) - Number(tx.amount),
            });
        }
      }

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
    if (expense.is_paid) {
      const msgDesfazer = `"${expense.title}" já foi marcada como paga. Deseja desfazer?`;

      const undoAction = async () => {
        const { error } = await undoPaid(expense.id);
        if (error) {
          Alert.alert("Erro", error);
          return;
        }

        if (expense.account_id) {
          const txRes = await transactionService.list({
            account_id: expense.account_id,
          });
          const txsToDelete = (txRes.data || []).filter(
            (t: any) =>
              (t.title === `${expense.title} (Conta Fixa)` ||
                t.title === `Conta Fixa: ${expense.title}`) &&
              t.amount === expense.amount,
          );

          let totalRefund = 0;
          for (const tx of txsToDelete) {
            await transactionService.remove(tx.id);
            totalRefund += Number(tx.amount);
          }

          if (totalRefund > 0) {
            const acc = accounts.find((a) => a.id === expense.account_id);
            if (acc)
              await updateAccount(acc.id, {
                balance: Number(acc.balance) + totalRefund,
              });
          }
        }
        await onRefresh();
      };

      if (Platform.OS === "web") {
        if (window.confirm(msgDesfazer)) await undoAction();
      } else {
        Alert.alert("Conta paga", msgDesfazer, [
          { text: "Cancelar", style: "cancel" },
          {
            text: "Desfazer pagamento",
            style: "destructive",
            onPress: undoAction,
          },
        ]);
      }
      return;
    }

    if (!expense.account_id) {
      Alert.alert(
        "⚠️ Conta não vinculada!",
        "Edite esta conta fixa e selecione de qual banco o dinheiro irá sair.",
      );
      return;
    }

    const payAction = async () => {
      const { error } = await markAsPaid(expense);
      if (error) {
        Alert.alert("Erro", error);
        return;
      }

      const acc = accounts.find((a) => a.id === expense.account_id);
      if (acc)
        await updateAccount(acc.id, {
          balance: Number(acc.balance) - Number(expense.amount),
        });

      await onRefresh();
    };

    if (Platform.OS === "web") {
      if (window.confirm(`Confirmar pagamento?`)) await payAction();
    } else {
      Alert.alert("Pagar conta", `Confirmar pagamento?`, [
        { text: "Cancelar", style: "cancel" },
        { text: "Confirmar", onPress: payAction },
      ]);
    }
  };

  const handleDelete = (item: FixedExpense) => {
    const deleteAction = async () => {
      if (item.is_paid && item.account_id) {
        const txRes = await transactionService.list({
          account_id: item.account_id,
        });
        const txsToDelete = (txRes.data || []).filter(
          (t: any) =>
            (t.title === `${item.title} (Conta Fixa)` ||
              t.title === `Conta Fixa: ${item.title}`) &&
            t.amount === item.amount,
        );

        let totalRefund = 0;
        for (const tx of txsToDelete) {
          await transactionService.remove(tx.id);
          totalRefund += Number(tx.amount);
        }

        if (totalRefund > 0) {
          const acc = accounts.find((a) => a.id === item.account_id);
          if (acc)
            await updateAccount(acc.id, {
              balance: Number(acc.balance) + totalRefund,
            });
        }
      }

      const { error } = await remove(item.id);
      if (error) Alert.alert("Erro ao remover", error);
      else await onRefresh();
    };

    if (Platform.OS === "web") {
      if (window.confirm("Certeza que deseja remover?")) deleteAction();
    } else {
      Alert.alert("Remover", "Certeza que deseja remover?", [
        { text: "Cancelar", style: "cancel" },
        { text: "Remover", style: "destructive", onPress: deleteAction },
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
    <View
      style={[
        s.container,
        {
          backgroundColor: colors.bg,
          paddingTop: Math.max(insets.top, 20) + 10,
        },
      ]}
    >
      {/* 👇 DESIGN ATUALIZADO: Cabeçalho Limpo */}
      <View style={s.headerContainer}>
        <Text style={[s.headerTitle, { color: colors.text }]}>
          Contas Fixas
        </Text>
        <Text style={[s.headerSubtitle, { color: colors.subText }]}>
          Gerencie os seus compromissos mensais
        </Text>
      </View>

      {/* 👇 DESIGN ATUALIZADO: Resumo Financeiro (Semelhante a Transactions) */}
      <View style={s.summaryRow}>
        <View
          style={[
            s.summaryCard,
            { backgroundColor: colors.card, borderLeftColor: colors.primary },
          ]}
        >
          <Text style={[s.summaryLabel, { color: colors.subText }]}>
            Total do Mês
          </Text>
          <Text style={[s.summaryValue, { color: colors.text }]}>
            {formatCurrency(totalMonth, profile?.currency)}
          </Text>
        </View>
        <View
          style={[
            s.summaryCard,
            { backgroundColor: colors.card, borderLeftColor: "#10b981" },
          ]}
        >
          <Text style={[s.summaryLabel, { color: colors.subText }]}>
            Já Pago
          </Text>
          <Text style={[s.summaryValue, { color: "#10b981" }]}>
            {formatCurrency(totalPaid, profile?.currency)}
          </Text>
        </View>
      </View>

      {pendingCount > 0 && (
        <View style={{ paddingHorizontal: 20, marginBottom: 16 }}>
          <View
            style={[
              s.pendingAlertBox,
              { backgroundColor: "rgba(239, 68, 68, 0.1)" },
            ]}
          >
            <Ionicons name="alert-circle" size={20} color="#ef4444" />
            <Text style={s.pendingAlertText}>
              Atenção: Tem {pendingCount} conta{pendingCount > 1 ? "s" : ""}{" "}
              pendente{pendingCount > 1 ? "s" : ""} a pagar. (
              {formatCurrency(totalPending, profile?.currency)})
            </Text>
          </View>
        </View>
      )}

      {isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 32 }} />
      ) : (
        <FlatList
          data={sorted}
          keyExtractor={(e) => e.id}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
          bounces={false}
          overScrollMode="never"
          ListEmptyComponent={
            <View style={s.empty}>
              <Text style={[s.emptyText, { color: colors.text }]}>
                Nenhuma conta fixa cadastrada
              </Text>
              <Text style={[s.emptySubtext, { color: colors.subText }]}>
                Toque no botão "+" para adicionar
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <FixedExpenseCard
              item={item}
              colors={colors}
              isDark={isDark}
              onPay={() => handlePay(item)}
              onEdit={() => handleEdit(item)}
              onDelete={() => handleDelete(item)}
            />
          )}
        />
      )}

      {/* 👇 DESIGN ATUALIZADO: FAB Gigante */}
      <TouchableOpacity
        style={[s.fab, { backgroundColor: colors.primary }]}
        onPress={() => setModalVisible(true)}
      >
        <Ionicons name="add" size={32} color="#fff" />
      </TouchableOpacity>

      {/* 👇 DESIGN ATUALIZADO: Modal Limpo */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={{ flex: 1, backgroundColor: colors.bg }}>
          <View
            style={[
              s.modalHeader,
              {
                backgroundColor: colors.card,
                borderBottomColor: colors.border,
              },
            ]}
          >
            <Text style={[s.modalTitle, { color: colors.text }]}>
              {editing ? "Editar Conta Fixa" : "Nova Conta Fixa"}
            </Text>
            <TouchableOpacity onPress={handleClose}>
              <Text style={[s.modalClose, { color: colors.primary }]}>
                Fechar
              </Text>
            </TouchableOpacity>
          </View>

          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
          >
            <ScrollView
              contentContainerStyle={s.form}
              showsVerticalScrollIndicator={false}
            >
              <Text style={[s.label, { color: colors.subText }]}>
                Sugestões rápidas
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginBottom: 20, maxHeight: 40 }}
              >
                <View style={s.optionRow}>
                  {SUGGESTIONS.map((sug) => (
                    <TouchableOpacity
                      key={sug}
                      style={[
                        s.suggestionBtn,
                        { backgroundColor: isDark ? "#1e1b4b" : "#eef2ff" },
                      ]}
                      onPress={() => setValue("title", sug)}
                    >
                      <Text
                        style={[s.suggestionText, { color: colors.primary }]}
                      >
                        {sug}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              <Controller
                name="title"
                control={control}
                render={({ field: { onChange, value } }) => (
                  <Input
                    label="Nome da Conta"
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
                        label="Valor (R$)"
                        placeholder="0,00"
                        keyboardType="decimal-pad"
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
                        label="Dia de Venc."
                        placeholder="Ex: 15"
                        keyboardType="decimal-pad"
                        onChangeText={onChange}
                        value={value}
                        error={errors.due_day?.message}
                      />
                    )}
                  />
                </View>
              </View>

              {accounts.length > 0 && (
                <View style={{ marginTop: 8 }}>
                  <Text style={[s.label, { color: colors.subText }]}>
                    Conta de Origem (Automático)
                  </Text>
                  <Controller
                    name="account_id"
                    control={control}
                    render={({ field: { onChange, value } }) => (
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
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
                            onPress={() => setAccountModalVisible(true)}
                          >
                            <Text
                              style={{
                                color: colors.primary,
                                fontWeight: "bold",
                              }}
                            >
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
                </View>
              )}

              {expenseCategories.length > 0 && (
                <View style={{ marginTop: 24, marginBottom: 12 }}>
                  <Text style={[s.label, { color: colors.subText }]}>
                    Categoria (Opcional)
                  </Text>
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
                </View>
              )}

              <TouchableOpacity
                style={[s.submitBtn, { backgroundColor: colors.primary }]}
                onPress={handleSubmit(onSubmit)}
              >
                <Text style={s.submitBtnText}>
                  {editing ? "Salvar Alterações" : "Criar Conta Fixa"}
                </Text>
              </TouchableOpacity>
              <View style={{ height: 40 }} />
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Modal de Nova Conta Bancária (Mantido intacto visualmente/logicamente do anterior) */}
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
              padding: 24,
              borderRadius: 20,
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
              Nova Conta
            </Text>
            <TextInput
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.inputBg,
                color: colors.text,
                padding: 14,
                borderRadius: 12,
                marginBottom: 16,
                fontSize: 16,
              }}
              placeholder="Nome do Banco (Ex: Nubank)"
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
                marginBottom: 24,
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
                    width: 36,
                    height: 36,
                    borderRadius: 18,
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
                  padding: 14,
                  backgroundColor: colors.border,
                  borderRadius: 12,
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
                  padding: 14,
                  backgroundColor: newBankColor,
                  borderRadius: 12,
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
                <Text style={{ fontWeight: "bold", color: "#fff" }}>
                  Salvar
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// 👇 DESIGN ATUALIZADO: Cartões da Lista
function FixedExpenseCard({
  item,
  colors,
  isDark,
  onPay,
  onEdit,
  onDelete,
}: any) {
  const daysUntilDue = item.due_day - new Date().getDate();
  const isOverdue = !item.is_paid && daysUntilDue < 0;
  const isDueSoon = !item.is_paid && daysUntilDue >= 0 && daysUntilDue <= 3;

  return (
    <View
      style={[
        cs.card,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      {/* Ícone à Esquerda */}
      <View
        style={[
          cs.iconBox,
          {
            backgroundColor: item.is_paid
              ? "#dcfce7"
              : isOverdue
                ? "#fee2e2"
                : colors.inputBg,
          },
        ]}
      >
        <Ionicons
          name="document-text"
          size={22}
          color={
            item.is_paid ? "#16a34a" : isOverdue ? "#ef4444" : colors.primary
          }
        />
      </View>

      {/* Informações Centrais */}
      <View style={cs.cardInfo}>
        <Text style={[cs.cardTitle, { color: colors.text }]} numberOfLines={1}>
          {item.title}
        </Text>

        <Text
          style={[
            cs.cardSub,
            {
              color: item.is_paid
                ? "#16a34a"
                : isOverdue
                  ? "#ef4444"
                  : isDueSoon
                    ? "#f59e0b"
                    : colors.subText,
            },
          ]}
        >
          {item.is_paid
            ? `✓ Pago`
            : isOverdue
              ? `Atrasada (Dia ${item.due_day})`
              : isDueSoon
                ? `Vence em ${daysUntilDue} dia${daysUntilDue !== 1 ? "s" : ""}`
                : `Vence dia ${item.due_day}`}
        </Text>

        {item.account && (
          <Text style={[cs.cardAccount, { color: colors.subText }]}>
            {item.account.name}
          </Text>
        )}
      </View>

      {/* Valor e Ações à Direita */}
      <View style={cs.cardRight}>
        <Text
          style={[
            cs.cardAmount,
            {
              color: colors.text,
              textDecorationLine: item.is_paid ? "line-through" : "none",
            },
          ]}
        >
          {formatCurrency(item.amount, item.currency)}
        </Text>

        <View style={cs.cardActions}>
          <TouchableOpacity onPress={onEdit} style={cs.actionIcon}>
            <Ionicons name="create-outline" size={16} color={colors.subText} />
          </TouchableOpacity>
          <TouchableOpacity onPress={onDelete} style={cs.actionIcon}>
            <Ionicons name="trash-outline" size={16} color="#ef4444" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              cs.payBtn,
              {
                backgroundColor: item.is_paid ? colors.inputBg : colors.primary,
              },
            ]}
            onPress={onPay}
          >
            <Text
              style={[
                cs.payText,
                { color: item.is_paid ? colors.subText : "#fff" },
              ]}
            >
              {item.is_paid ? "Desfazer" : "Pagar"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  headerContainer: { paddingHorizontal: 24, paddingTop: 10, paddingBottom: 20 },
  headerTitle: { fontSize: 28, fontWeight: "bold" },
  headerSubtitle: { fontSize: 14, marginTop: 4 },

  summaryRow: {
    flexDirection: "row",
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 16,
  },
  summaryCard: { flex: 1, borderRadius: 16, padding: 16, borderLeftWidth: 4 },
  summaryLabel: { fontSize: 12, marginBottom: 4, fontWeight: "600" },
  summaryValue: { fontSize: 18, fontWeight: "bold" },

  pendingAlertBox: {
    padding: 12,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  pendingAlertText: {
    color: "#ef4444",
    fontSize: 13,
    fontWeight: "600",
    flex: 1,
  },

  list: { paddingHorizontal: 20, paddingBottom: 100 }, // Espaço para o FAB

  fab: {
    position: "absolute",
    bottom: 24,
    alignSelf: "center",
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },

  empty: { alignItems: "center", paddingVertical: 60 },
  emptyText: { fontSize: 16, fontWeight: "600" },
  emptySubtext: { fontSize: 13, marginTop: 6 },

  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  modalTitle: { fontSize: 18, fontWeight: "bold" },
  modalClose: { fontWeight: "600" },
  form: { padding: 20 },
  label: { fontSize: 13, fontWeight: "600", marginBottom: 6 },

  optionRow: { flexDirection: "row", gap: 8, paddingVertical: 4 },
  optionBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
  },
  optionText: { fontSize: 13, fontWeight: "600" },

  suggestionBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    marginRight: 8,
  },
  suggestionText: { fontSize: 13, fontWeight: "600" },

  submitBtn: {
    paddingVertical: 18,
    borderRadius: 100,
    alignItems: "center",
    marginTop: 16,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  submitBtnText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
});

const cs = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  iconBox: {
    width: 46,
    height: 46,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  cardInfo: { flex: 1, paddingRight: 8 },
  cardTitle: { fontSize: 15, fontWeight: "bold", marginBottom: 2 },
  cardSub: { fontSize: 12, fontWeight: "600" },
  cardAccount: { fontSize: 11, marginTop: 4 },

  cardRight: { alignItems: "flex-end" },
  cardAmount: { fontSize: 16, fontWeight: "bold", marginBottom: 8 },

  cardActions: { flexDirection: "row", alignItems: "center", gap: 10 },
  actionIcon: { padding: 4 },

  payBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 10 },
  payText: { fontSize: 12, fontWeight: "bold" },
});
