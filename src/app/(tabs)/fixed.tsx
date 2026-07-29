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
import { fixedExpenseService, transactionService } from "@/services";
import { Input, Button } from "@/components/ui";
import { formatCurrency } from "@/utils";
import { useAuth } from "@/hooks/useAuth";
import { useAppTheme } from "@/hooks/useTheme"; // 👈 Motor de temas global
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
  const { colors, isDark } = useAppTheme(); // 👈 Cores dinâmicas ativas

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
    <SafeAreaView style={[s.safe, { backgroundColor: colors.bg }]}>
      <View style={s.header}>
        <Text style={[s.title, { color: colors.text }]}>Contas Fixas</Text>
        <TouchableOpacity
          style={[s.addBtn, { backgroundColor: colors.primary }]}
          onPress={() => setModalVisible(true)}
        >
          <Text style={s.addBtnText}>+ Nova</Text>
        </TouchableOpacity>
      </View>

      <View
        style={[
          s.summaryCard,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            borderWidth: 1,
          },
        ]}
      >
        <View style={s.summaryRow}>
          <View style={s.summaryItem}>
            <Text style={[s.summaryLabel, { color: colors.subText }]}>
              Total mês
            </Text>
            <Text style={[s.summaryValue, { color: colors.text }]}>
              {formatCurrency(totalMonth, profile?.currency)}
            </Text>
          </View>
          <View
            style={[s.summaryDivider, { backgroundColor: colors.border }]}
          />
          <View style={s.summaryItem}>
            <Text style={[s.summaryLabel, { color: colors.subText }]}>
              Pago
            </Text>
            <Text style={[s.summaryValue, { color: "#16a34a" }]}>
              {formatCurrency(totalPaid, profile?.currency)}
            </Text>
          </View>
          <View
            style={[s.summaryDivider, { backgroundColor: colors.border }]}
          />
          <View style={s.summaryItem}>
            <Text style={[s.summaryLabel, { color: colors.subText }]}>
              Pendente
            </Text>
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
        <ActivityIndicator color={colors.primary} style={{ marginTop: 32 }} />
      ) : (
        <FlatList
          data={sorted}
          keyExtractor={(e) => e.id}
          contentContainerStyle={s.list}
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
                Toque em "+ Nova" para adicionar
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

      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={[s.modal, { backgroundColor: colors.bg }]}>
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

          <ScrollView contentContainerStyle={s.form}>
            <Text style={[s.label, { color: colors.subText }]}>Sugestões</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginBottom: 8 }}
            >
              <View style={s.optionRow}>
                {SUGGESTIONS.map((sug) => (
                  <TouchableOpacity
                    key={sug}
                    style={[
                      s.suggestionBtn,
                      { backgroundColor: isDark ? "#312e81" : "#ede9fe" },
                    ]}
                    onPress={() => setValue("title", sug)}
                  >
                    <Text style={[s.suggestionText, { color: colors.primary }]}>
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
                      label="Dia venc."
                      placeholder="15"
                      keyboardType="decimal-pad"
                      onChangeText={onChange}
                      value={value}
                      error={errors.due_day?.message}
                    />
                  )}
                />
              </View>
            </View>

            <Text style={[s.label, { color: colors.subText }]}>Moeda</Text>
            <Controller
              name="currency"
              control={control}
              render={({ field: { onChange, value } }) => (
                <View style={s.optionRow}>
                  {CURRENCIES.map((c) => (
                    <TouchableOpacity
                      key={c}
                      style={[
                        s.optionBtn,
                        {
                          backgroundColor: colors.card,
                          borderColor: colors.border,
                        },
                        value === c && [
                          s.optionBtnActive,
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
                          s.optionText,
                          { color: colors.subText },
                          value === c && { color: "#fff" },
                        ]}
                      >
                        {c}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            />

            {accounts.length >= 0 && (
              <>
                <Text style={[s.label, { color: colors.subText }]}>
                  Debitar da conta (opcional)
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
                              Nova Conta
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
                                <Text
                                  style={{
                                    fontWeight: "bold",
                                    color: colors.text,
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
                <Text style={[s.label, { color: colors.subText }]}>
                  Categoria (opcional)
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
  colors,
  isDark,
  onPay,
  onEdit,
  onDelete,
}: {
  item: FixedExpense;
  colors: any;
  isDark: boolean;
  onPay: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const daysUntilDue = item.due_day - new Date().getDate();
  const isOverdue = !item.is_paid && daysUntilDue < 0;
  const isDueSoon = !item.is_paid && daysUntilDue >= 0 && daysUntilDue <= 3;

  return (
    <View
      style={[
        cs.card,
        { backgroundColor: colors.card },
        item.is_paid && cs.cardPaid,
      ]}
    >
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
                  : { backgroundColor: colors.primary },
          ]}
        />
      </View>
      <View style={cs.cardInfo}>
        <Text style={[cs.cardTitle, { color: colors.text }]}>{item.title}</Text>
        <Text style={[cs.cardSub, { color: colors.subText }]}>
          {item.is_paid
            ? `✓ Pago em ${item.paid_at}`
            : isOverdue
              ? `⚠️ Venceu dia ${item.due_day}`
              : isDueSoon
                ? `⏰ Vence em ${daysUntilDue} dia${daysUntilDue !== 1 ? "s" : ""}`
                : `Vence dia ${item.due_day}`}
        </Text>
        {item.account && (
          <Text style={[cs.cardAccount, { color: colors.subText }]}>
            {item.account.name}
          </Text>
        )}
      </View>
      <View style={cs.cardRight}>
        <Text style={[cs.cardAmount, { color: colors.text }]}>
          {formatCurrency(item.amount, item.currency)}
        </Text>
        <View style={cs.cardActions}>
          <TouchableOpacity onPress={onPay}>
            <Text
              style={[
                cs.payText,
                { color: colors.primary },
                item.is_paid && { color: colors.subText },
              ]}
            >
              {item.is_paid ? "Desfazer" : "Pagar"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onEdit}>
            <Text style={[cs.editText, { color: "#f59e0b" }]}>Editar</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onDelete}>
            <Text style={[cs.deleteText, { color: "#ef4444" }]}>Remover</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  safe: {
    flex: 1,
    ...(Platform.OS === "web" ? { overflow: "hidden", maxWidth: "100%" } : {}),
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  title: { fontSize: 22, fontWeight: "bold" },
  addBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  addBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  summaryCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 16,
    padding: 20,
  },
  summaryRow: { flexDirection: "row", alignItems: "center" },
  summaryItem: { flex: 1, alignItems: "center" },
  summaryLabel: { fontSize: 12, marginBottom: 4 },
  summaryValue: { fontSize: 15, fontWeight: "700" },
  summaryDivider: {
    width: 1,
    height: 32,
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
  emptyText: { fontSize: 16, fontWeight: "600" },
  emptySubtext: { fontSize: 13, marginTop: 6 },
  modal: { flex: 1 },
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
  form: { padding: 20, gap: 16 },
  label: { fontSize: 13, fontWeight: "600", marginBottom: 2 },
  optionRow: { flexDirection: "row", gap: 8 },
  optionBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  optionBtnActive: {},
  optionText: { fontSize: 13, fontWeight: "500" },
  suggestionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    marginRight: 8,
  },
  suggestionText: { fontSize: 12, fontWeight: "600" },
});

const cs = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
  },
  cardPaid: { opacity: 0.6 },
  cardLeft: { marginRight: 12 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  cardInfo: { flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: "700" },
  cardSub: { fontSize: 12, marginTop: 3 },
  cardAccount: { fontSize: 11, marginTop: 2 },
  cardRight: { alignItems: "flex-end" },
  cardAmount: { fontSize: 15, fontWeight: "700" },
  cardActions: { flexDirection: "row", gap: 10, marginTop: 6 },
  payText: { fontSize: 12, fontWeight: "700" },
  editText: { fontSize: 12, fontWeight: "700" },
  deleteText: { fontSize: 12 },
});
