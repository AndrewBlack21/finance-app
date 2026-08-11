import { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Modal,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTransactions } from "@/hooks/useTransactions";
import { useAccounts } from "@/hooks/useAccounts";
import { TransactionForm } from "@/components/forms/TransactionForm";
import { formatCurrency, formatDate } from "@/utils";
import { useAuth } from "@/hooks/useAuth";
import { useAppTheme } from "@/hooks/useTheme"; // 👈 Importação do motor de temas
import type {
  Transaction,
  CreateTransaction,
  UpdateTransaction,
} from "@/types";

export default function TransactionsScreen() {
  const { profile } = useAuth();
  const { accounts, update: updateAccount } = useAccounts();
  const { colors, isDark } = useAppTheme(); // 👈 Cores dinâmicas

  const {
    transactions,
    isLoading,
    create,
    update,
    remove,
    summary,
    setFilters,
    refetch,
    fetchMore,
    isLoadingMore,
    hasMore,
  } = useTransactions();

  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [dateFilter, setDateFilter] = useState("");
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [currentMonthView, setCurrentMonthView] = useState(new Date());

  useEffect(() => {
    if (dateFilter) {
      setFilters({ date_from: dateFilter, date_to: dateFilter });
    } else {
      setFilters({});
    }
  }, [dateFilter, setFilters]);

  const onRefresh = async () => {
    setRefreshing(true);
    if (refetch) await refetch();
    setRefreshing(false);
  };

  const handleCreate = async (data: CreateTransaction) => {
    const { error } = await create(data);
    if (error) Alert.alert("Erro", error);
    else {
      const acc = accounts.find((a) => a.id === data.account_id);
      if (acc) {
        const amount = Number(data.amount) || 0;
        const modifier = data.type === "expense" ? -amount : amount;
        await updateAccount(acc.id, {
          balance: Number(acc.balance) + modifier,
        });
      }
      setModalVisible(false);
      setEditing(null);
      onRefresh();
    }
  };

  const handleUpdate = async (data: CreateTransaction) => {
    if (!editing) return;

    const oldAcc = accounts.find((a) => a.id === editing.account_id);
    const newAcc = accounts.find((a) => a.id === data.account_id);

    const { error } = await update(editing.id, data as UpdateTransaction);
    if (error) Alert.alert("Erro", error);
    else {
      if (oldAcc && newAcc) {
        const oldAmount = Number(editing.amount) || 0;
        const revertModifier =
          editing.type === "expense" ? oldAmount : -oldAmount;
        const oldBalance = Number(oldAcc.balance) + revertModifier;

        const newAmount = Number(data.amount) || 0;
        const applyModifier = data.type === "expense" ? -newAmount : newAmount;

        if (oldAcc.id === newAcc.id) {
          await updateAccount(oldAcc.id, {
            balance: oldBalance + applyModifier,
          });
        } else {
          await updateAccount(oldAcc.id, { balance: oldBalance });
          await updateAccount(newAcc.id, {
            balance: Number(newAcc.balance) + applyModifier,
          });
        }
      }
      setModalVisible(false);
      setEditing(null);
      onRefresh();
    }
  };

  const handleDelete = async (id: string) => {
    const confirmAction = async () => {
      const tx = transactions.find((t) => t.id === id);
      if (tx && tx.account_id) {
        const acc = accounts.find((a) => a.id === tx.account_id);
        if (acc) {
          const amount = Number(tx.amount) || 0;
          const modifier = tx.type === "expense" ? amount : -amount;
          await updateAccount(acc.id, {
            balance: Number(acc.balance) + modifier,
          });
        }
      }

      const { error } = await remove(id);
      if (error) Alert.alert("Erro", error);
      else onRefresh();
    };

    if (Platform.OS === "web") {
      if (window.confirm("Deseja remover esta transação?"))
        await confirmAction();
    } else {
      Alert.alert("Remover", "Tem certeza?", [
        { text: "Cancelar", style: "cancel" },
        { text: "Remover", style: "destructive", onPress: confirmAction },
      ]);
    }
  };

  const getDaysInMonth = (year: number, month: number) =>
    new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) =>
    new Date(year, month, 1).getDay();

  const renderCalendarDays = () => {
    const year = currentMonthView.getFullYear();
    const month = currentMonthView.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);

    const days = [];
    for (let i = 0; i < firstDay; i++) {
      days.push(<View key={`empty-${i}`} style={s.calendarDay} />);
    }
    for (let i = 1; i <= daysInMonth; i++) {
      const dateString = `${year}-${String(month + 1).padStart(2, "0")}-${String(i).padStart(2, "0")}`;
      const isSelected = dateFilter === dateString;

      days.push(
        <TouchableOpacity
          key={i}
          style={[
            s.calendarDay,
            isSelected && { backgroundColor: colors.primary },
          ]}
          onPress={() => {
            setDateFilter(dateString);
            setCalendarVisible(false);
          }}
        >
          <Text
            style={[
              s.calendarDayText,
              { color: colors.text },
              isSelected && { color: "#fff" },
            ]}
          >
            {i}
          </Text>
        </TouchableOpacity>,
      );
    }
    return days;
  };

  const changeMonth = (offset: number) => {
    const newDate = new Date(currentMonthView);
    newDate.setMonth(newDate.getMonth() + offset);
    setCurrentMonthView(newDate);
  };

  const sortedTransactions = [...transactions].sort((a: any, b: any) => {
    const dateA = new Date(a.date).getTime();
    const dateB = new Date(b.date).getTime();
    if (dateA !== dateB) return dateB - dateA;
    if (a.created_at && b.created_at) {
      return (
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    }
    return 0;
  });

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: colors.bg }]}>
      <View style={s.header}>
        <Text style={[s.title, { color: colors.text }]}>Transações</Text>
        <TouchableOpacity
          style={s.addBtn}
          onPress={() => {
            setEditing(null);
            setModalVisible(true);
          }}
        >
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={s.addBtnText}>Nova</Text>
        </TouchableOpacity>
      </View>

      <View style={s.summaryRow}>
        <View
          style={[
            s.summaryCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderLeftColor: "#16a34a",
              borderWidth: 1,
            },
          ]}
        >
          <Text style={[s.summaryLabel, { color: colors.subText }]}>
            Receitas
          </Text>
          <Text style={[s.summaryValue, { color: "#16a34a" }]}>
            {formatCurrency(summary.income, profile?.currency)}
          </Text>
        </View>
        <View
          style={[
            s.summaryCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderLeftColor: "#dc2626",
              borderWidth: 1,
            },
          ]}
        >
          <Text style={[s.summaryLabel, { color: colors.subText }]}>
            Despesas
          </Text>
          <Text style={[s.summaryValue, { color: "#dc2626" }]}>
            {formatCurrency(summary.expense, profile?.currency)}
          </Text>
        </View>
      </View>

      <View
        style={{
          paddingHorizontal: 20,
          marginBottom: 12,
          flexDirection: "row",
          gap: 10,
        }}
      >
        <TouchableOpacity
          style={[
            s.filterBtn,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
          onPress={() => setCalendarVisible(true)}
        >
          <Ionicons name="calendar-outline" size={18} color={colors.primary} />
          <Text style={[s.filterBtnText, { color: colors.text }]}>
            {dateFilter ? formatDate(dateFilter) : "Filtrar por data..."}
          </Text>
        </TouchableOpacity>
        {dateFilter !== "" && (
          <TouchableOpacity
            style={s.clearBtn}
            onPress={() => setDateFilter("")}
          >
            <Ionicons name="close-circle" size={20} color={colors.subText} />
          </TouchableOpacity>
        )}
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 32 }} />
      ) : (
        <FlatList
          data={sortedTransactions}
          keyExtractor={(t) => t.id}
          contentContainerStyle={s.list}
          onEndReached={fetchMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={
            isLoadingMore ? (
              <ActivityIndicator
                color={colors.primary}
                style={{ marginVertical: 16 }}
              />
            ) : !hasMore ? (
              <Text style={[s.endText, { color: colors.subText }]}>
                — Fim do histórico —
              </Text>
            ) : null
          }
          bounces={false}
          overScrollMode="never"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={s.empty}>
              <Text style={[s.emptyText, { color: colors.text }]}>
                Nenhuma transação encontrada
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <TransactionItem
              transaction={item}
              currency={profile?.currency ?? "BRL"}
              colors={colors}
              onEdit={() => {
                setEditing(item);
                setModalVisible(true);
              }}
              onDelete={() => handleDelete(item.id)}
            />
          )}
        />
      )}

      <Modal visible={calendarVisible} transparent={true} animationType="fade">
        <View style={s.modalOverlay}>
          <View style={[s.calendarContainer, { backgroundColor: colors.card }]}>
            <View style={s.calendarHeader}>
              <TouchableOpacity
                onPress={() => changeMonth(-1)}
                style={{ padding: 10 }}
              >
                <Ionicons name="chevron-back" size={20} color={colors.text} />
              </TouchableOpacity>
              <Text style={[s.calendarMonthName, { color: colors.text }]}>
                {new Intl.DateTimeFormat("pt-BR", {
                  month: "long",
                  year: "numeric",
                }).format(currentMonthView)}
              </Text>
              <TouchableOpacity
                onPress={() => changeMonth(1)}
                style={{ padding: 10 }}
              >
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={colors.text}
                />
              </TouchableOpacity>
            </View>
            <View style={s.calendarWeekRow}>
              {["D", "S", "T", "Q", "Q", "S", "S"].map((d, i) => (
                <Text
                  key={i}
                  style={[s.calendarWeekDay, { color: colors.subText }]}
                >
                  {d}
                </Text>
              ))}
            </View>
            <View style={s.calendarGrid}>{renderCalendarDays()}</View>
            <TouchableOpacity
              style={[s.closeCalendarBtn, { backgroundColor: colors.primary }]}
              onPress={() => setCalendarVisible(false)}
            >
              <Text style={{ color: "#fff", fontWeight: "bold" }}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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
              {editing ? "Editar Transação" : "Nova Transação"}
            </Text>
            <TouchableOpacity
              onPress={() => {
                setModalVisible(false);
                setEditing(null);
              }}
            >
              <Text style={[s.modalClose, { color: colors.primary }]}>
                Fechar
              </Text>
            </TouchableOpacity>
          </View>
          <TransactionForm
            isLoading={!!isLoading}
            initialValues={editing ? editing : undefined}
            onSubmit={async (data: CreateTransaction) => {
              if (editing) {
                await handleUpdate(data);
              } else {
                await handleCreate(data);
              }
            }}
            onCancel={() => {
              setModalVisible(false);
              setEditing(null);
            }}
          />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

function TransactionItem({
  transaction: t,
  currency,
  colors,
  onEdit,
  onDelete,
}: any) {
  const isIncome = t.type === "income";

  // 👇 1. Nova lógica para detetar qualquer movimentação de fatura (Pagamento, Cancelado, Estorno)
  const isInvoicePayment =
    t.title && (t.title.includes("Fatura") || t.title.includes("Estorno"));
  const isCanceled = t.title && t.title.includes("(Cancelado)");

  const baseColor = isIncome ? "#16a34a" : "#dc2626";
  // 👇 2. Se a transação foi cancelada, fica cinzenta para não confundir o utilizador
  const displayColor = isCanceled ? colors.subText : baseColor;

  return (
    <View style={[s.item, { backgroundColor: colors.card }]}>
      <View
        style={[
          s.itemIcon,
          {
            backgroundColor: isInvoicePayment
              ? "#6366f118" // Fundo azul claro para cartões
              : (t.category?.color ?? colors.primary) + "20",
          },
        ]}
      >
        <Ionicons
          name={
            isInvoicePayment ? "card" : isIncome ? "arrow-up" : "arrow-down"
          }
          size={20}
          color={isInvoicePayment ? colors.primary : displayColor}
        />
      </View>
      <View style={s.itemInfo}>
        {/* Título riscado se estiver cancelado */}
        <Text
          style={[
            s.itemTitle,
            {
              color: isCanceled ? colors.subText : colors.text,
              textDecorationLine: isCanceled ? "line-through" : "none",
            },
          ]}
        >
          {t.title}
        </Text>

        {/* 👇 3. Subtítulo Limpo: Mostra apenas a data se for fatura */}
        <Text style={[s.itemCategory, { color: colors.subText }]}>
          {isInvoicePayment
            ? `Data: ${formatDate(t.date)}`
            : `${t.category?.name ?? "Sem categoria"} · ${formatDate(t.date)}`}
        </Text>
      </View>
      <View style={s.itemRight}>
        <Text
          style={[
            s.itemAmount,
            {
              color: displayColor,
              textDecorationLine: isCanceled ? "line-through" : "none",
            },
          ]}
        >
          {isIncome ? "+" : "-"}
          {formatCurrency(t.amount, currency)}
        </Text>

        <View style={s.itemActions}>
          {/* 👇 4. Esconde Editar e Apagar para Faturas (Protege o banco de dados) */}
          {!isInvoicePayment && (
            <>
              <TouchableOpacity onPress={onEdit} style={s.editBtn}>
                <Ionicons
                  name="create-outline"
                  size={14}
                  color={colors.primary}
                />
              </TouchableOpacity>
              <TouchableOpacity onPress={onDelete} style={s.deleteBtn}>
                <Ionicons name="trash-outline" size={14} color="#ef4444" />
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  title: { fontSize: 22, fontWeight: "bold" },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#6366f1",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  addBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  summaryRow: {
    flexDirection: "row",
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 16,
  },
  summaryCard: {
    flex: 1,
    borderRadius: 12,
    padding: 14,
    borderLeftWidth: 4,
  },
  summaryLabel: { fontSize: 12, marginBottom: 4 },
  summaryValue: { fontSize: 16, fontWeight: "700" },
  list: { paddingHorizontal: 20, paddingBottom: 32 },
  item: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  itemIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  itemInfo: { flex: 1 },
  itemTitle: { fontSize: 14, fontWeight: "600" },
  itemCategory: { fontSize: 12, marginTop: 2 },
  itemRight: { alignItems: "flex-end" },
  itemAmount: { fontSize: 14, fontWeight: "700" },
  itemActions: { flexDirection: "row", gap: 8, marginTop: 4 },
  editBtn: { padding: 4 },
  deleteBtn: { padding: 4 },
  empty: { alignItems: "center", paddingVertical: 60 },
  emptyText: { fontSize: 16, fontWeight: "600" },
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
  filterBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  filterBtnText: { fontSize: 14 },
  clearBtn: { justifyContent: "center", padding: 8 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  calendarContainer: {
    width: 320,
    borderRadius: 16,
    padding: 20,
    elevation: 5,
  },
  calendarHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  calendarMonthName: {
    fontSize: 16,
    fontWeight: "bold",
    textTransform: "capitalize",
  },
  calendarWeekRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  calendarWeekDay: {
    width: 35,
    textAlign: "center",
    fontWeight: "bold",
    fontSize: 12,
  },
  calendarGrid: { flexDirection: "row", flexWrap: "wrap", gap: 2 },
  calendarDay: {
    width: 38,
    height: 38,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 19,
  },
  calendarDayText: { fontSize: 14 },
  closeCalendarBtn: {
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 16,
  },
  endText: {
    textAlign: "center",
    fontSize: 12,
    paddingVertical: 16,
  },
});
