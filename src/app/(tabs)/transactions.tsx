import { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Modal,
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
import { useAppTheme } from "@/hooks/useTheme";
import type {
  Transaction,
  CreateTransaction,
  UpdateTransaction,
} from "@/types";

export default function TransactionsScreen() {
  const { profile } = useAuth();
  const { accounts, update: updateAccount } = useAccounts();
  const { colors, isDark } = useAppTheme();

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
    if (a.created_at && b.created_at)
      return (
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    return 0;
  });

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: colors.bg }]}>
      <View style={s.header}>
        <Text style={[s.title, { color: colors.text }]}>Transações</Text>
      </View>

      <View style={s.summaryRow}>
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
          <Text style={[s.summaryLabel, { color: colors.subText }]}>
            Receitas
          </Text>
          <Text style={[s.summaryValue, { color: "#10b981" }]}>
            {formatCurrency(summary.income, profile?.currency)}
          </Text>
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
          <Text style={[s.summaryLabel, { color: colors.subText }]}>
            Despesas
          </Text>
          <Text style={[s.summaryValue, { color: "#ef4444" }]}>
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

      {/* 👇 O GRANDE BOTÃO FLUTUANTE ROXO NO CENTRO (FAB) */}
      <TouchableOpacity
        style={[s.fab, { backgroundColor: colors.primary }]}
        onPress={() => {
          setEditing(null);
          setModalVisible(true);
        }}
      >
        <Ionicons name="add" size={32} color="#fff" />
      </TouchableOpacity>

      <Modal visible={calendarVisible} transparent={true} animationType="fade">
        {/* ... Modal do calendário permanece igual ... */}
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

      {/* 👇 O MODAL DE CRIAÇÃO AGORA É APENAS UMA VIEW PARA A COR PREENCHER O TOPO */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={{ flex: 1, backgroundColor: colors.bg }}>
          <TransactionForm
            isLoading={!!isLoading}
            initialValues={editing ? editing : undefined}
            onSubmit={async (data: CreateTransaction) => {
              if (editing) await handleUpdate(data);
              else await handleCreate(data);
            }}
            onCancel={() => {
              setModalVisible(false);
              setEditing(null);
            }}
          />
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// 👇 ESTILO LIMPO E MODERNO PARA A LISTA (Imagem 6)
function TransactionItem({
  transaction: t,
  currency,
  colors,
  onEdit,
  onDelete,
}: any) {
  const isIncome = t.type === "income";
  const isInvoicePayment =
    t.title && (t.title.includes("Fatura") || t.title.includes("Estorno"));
  const isCanceled = t.title && t.title.includes("(Cancelado)");

  const baseColor = isIncome ? "#10b981" : "#ef4444"; // Verde e Vermelho do Design
  const displayColor = isCanceled ? colors.subText : baseColor;

  return (
    <View
      style={[
        s.item,
        { backgroundColor: colors.card, borderBottomColor: colors.border },
      ]}
    >
      <View style={[s.itemIcon, { backgroundColor: colors.inputBg }]}>
        <Ionicons
          name={isInvoicePayment ? "card" : isIncome ? "arrow-down" : "cart"}
          size={18}
          color={
            isCanceled
              ? colors.subText
              : isInvoicePayment
                ? colors.primary
                : baseColor
          }
        />
      </View>
      <View style={s.itemInfo}>
        <Text
          style={[
            s.itemTitle,
            {
              color: isCanceled ? colors.subText : colors.text,
              textDecorationLine: isCanceled ? "line-through" : "none",
            },
          ]}
          numberOfLines={1}
        >
          {t.title}
        </Text>
        <Text style={[s.itemCategory, { color: colors.subText }]}>
          {isInvoicePayment ? `Fatura` : (t.category?.name ?? "Sem categoria")}
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
        <Text
          style={[
            s.itemCategory,
            { color: colors.subText, textAlign: "right" },
          ]}
        >
          {formatDate(t.date).substring(0, 6)}
        </Text>

        {!isInvoicePayment && (
          <View style={s.itemActions}>
            <TouchableOpacity onPress={onEdit} style={s.actionIcon}>
              <Ionicons
                name="create-outline"
                size={14}
                color={colors.subText}
              />
            </TouchableOpacity>
            <TouchableOpacity onPress={onDelete} style={s.actionIcon}>
              <Ionicons name="trash-outline" size={14} color="#ef4444" />
            </TouchableOpacity>
          </View>
        )}
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
    paddingTop: 16,
    paddingBottom: 8,
  },
  title: { fontSize: 24, fontWeight: "bold" },

  // Resumo
  summaryRow: {
    flexDirection: "row",
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 16,
  },
  summaryCard: { flex: 1, borderRadius: 16, padding: 16 },
  summaryLabel: { fontSize: 13, marginBottom: 4, fontWeight: "600" },
  summaryValue: { fontSize: 18, fontWeight: "bold" },

  // Lista Limpa
  list: { paddingHorizontal: 20, paddingBottom: 100 }, // Espaço para o FAB
  item: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  itemIcon: {
    width: 44,
    height: 44,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  itemInfo: { flex: 1, paddingRight: 10 },
  itemTitle: { fontSize: 15, fontWeight: "bold", marginBottom: 2 },
  itemCategory: { fontSize: 13 },
  itemRight: { alignItems: "flex-end" },
  itemAmount: { fontSize: 15, fontWeight: "bold", marginBottom: 2 },
  itemActions: { flexDirection: "row", gap: 12, marginTop: 6 },
  actionIcon: { padding: 4 },

  // Botão Flutuante (FAB)
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
  filterBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    padding: 12,
    borderRadius: 12,
    gap: 8,
  },
  filterBtnText: { fontSize: 14, fontWeight: "600" },
  clearBtn: { justifyContent: "center", padding: 8 },

  // Calendário
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  calendarContainer: {
    width: 320,
    borderRadius: 20,
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
  calendarDayText: { fontSize: 14, fontWeight: "500" },
  closeCalendarBtn: {
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 20,
  },
  endText: { textAlign: "center", fontSize: 12, paddingVertical: 16 },
});
