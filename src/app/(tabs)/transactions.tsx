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
import { TransactionForm } from "@/components/forms/TransactionForm";
import { formatCurrency, formatDate } from "@/utils";
import { useAuth } from "@/hooks/useAuth";
import type {
  Transaction,
  CreateTransaction,
  UpdateTransaction,
} from "@/types";

export default function TransactionsScreen() {
  const { profile } = useAuth();

  // Pegamos o setFilters para poder enviar a data do calendário para o banco
  const {
    transactions,
    isLoading,
    create,
    update,
    remove,
    summary,
    setFilters,
    refetch,
  } = useTransactions();

  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  // Atualizar tela com refresh
  const [refreshing, setRefreshing] = useState(false);
  // Estados para o Filtro e Calendário
  const [dateFilter, setDateFilter] = useState("");
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [currentMonthView, setCurrentMonthView] = useState(new Date());

  // Efeito que dispara a busca no banco sempre que a data do filtro muda
  useEffect(() => {
    if (dateFilter) {
      setFilters({ date_from: dateFilter, date_to: dateFilter });
    } else {
      setFilters({}); // Se limpar a data, remove os filtros
    }
  }, [dateFilter, setFilters]);
  // Atualizar tela com refresh
  const onRefresh = async () => {
    setRefreshing(true);
    if (refetch) await refetch();
    setRefreshing(false);
  };
  const handleCreate = async (data: CreateTransaction) => {
    const { error } = await create(data);
    if (error) Alert.alert("Erro", error);
    else {
      setModalVisible(false);
      setEditing(null);
    }
  };

  const handleUpdate = async (data: CreateTransaction) => {
    if (!editing) return;
    const { error } = await update(editing.id, data as UpdateTransaction);
    if (error) Alert.alert("Erro", error);
    else {
      setModalVisible(false);
      setEditing(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (Platform.OS === "web") {
      const confirmou = window.confirm(
        "Tem certeza que deseja remover esta transação?",
      );
      if (confirmou) {
        const { error } = await remove(id);
        if (error) window.alert("Erro ao remover: " + error);
      }
    } else {
      Alert.alert("Remover", "Tem certeza?", [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Remover",
          style: "destructive",
          onPress: async () => {
            const { error } = await remove(id);
            if (error) Alert.alert("Erro", error);
          },
        },
      ]);
    }
  };

  // --- LÓGICA DO CALENDÁRIO ---
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
    // Espaços vazios antes do dia 1
    for (let i = 0; i < firstDay; i++) {
      days.push(<View key={`empty-${i}`} style={s.calendarDay} />);
    }
    // Dias do mês
    for (let i = 1; i <= daysInMonth; i++) {
      const dateString = `${year}-${String(month + 1).padStart(2, "0")}-${String(i).padStart(2, "0")}`;
      const isSelected = dateFilter === dateString;

      days.push(
        <TouchableOpacity
          key={i}
          style={[s.calendarDay, isSelected && s.calendarDaySelected]}
          onPress={() => {
            setDateFilter(dateString);
            setCalendarVisible(false);
          }}
        >
          <Text style={[s.calendarDayText, isSelected && { color: "#fff" }]}>
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

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Text style={s.title}>Transações</Text>
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
        <View style={[s.summaryCard, { borderLeftColor: "#16a34a" }]}>
          <Text style={s.summaryLabel}>Receitas</Text>
          <Text style={[s.summaryValue, { color: "#16a34a" }]}>
            {formatCurrency(summary.income, profile?.currency)}
          </Text>
        </View>
        <View style={[s.summaryCard, { borderLeftColor: "#dc2626" }]}>
          <Text style={s.summaryLabel}>Despesas</Text>
          <Text style={[s.summaryValue, { color: "#dc2626" }]}>
            {formatCurrency(summary.expense, profile?.currency)}
          </Text>
        </View>
      </View>

      {/* BOTÃO DO FILTRO DE DATA (Abre o Calendário) */}
      <View
        style={{
          paddingHorizontal: 20,
          marginBottom: 12,
          flexDirection: "row",
          gap: 10,
        }}
      >
        <TouchableOpacity
          style={s.filterBtn}
          onPress={() => setCalendarVisible(true)}
        >
          <Ionicons name="calendar-outline" size={18} color="#6366f1" />
          <Text style={s.filterBtnText}>
            {dateFilter ? formatDate(dateFilter) : "Filtrar por data..."}
          </Text>
        </TouchableOpacity>
        {dateFilter !== "" && (
          <TouchableOpacity
            style={s.clearBtn}
            onPress={() => setDateFilter("")}
          >
            <Ionicons name="close-circle" size={20} color="#9ca3af" />
          </TouchableOpacity>
        )}
      </View>

      {isLoading ? (
        <ActivityIndicator color="#6366f1" style={{ marginTop: 32 }} />
      ) : (
        <FlatList
          data={transactions}
          keyExtractor={(t) => t.id}
          contentContainerStyle={s.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={["#6366f1"]}
            />
          }
          ListEmptyComponent={
            <View style={s.empty}>
              <Text style={s.emptyText}>Nenhuma transação encontrada</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TransactionItem
              transaction={item}
              currency={profile?.currency ?? "BRL"}
              onEdit={() => {
                setEditing(item);
                setModalVisible(true);
              }}
              onDelete={() => handleDelete(item.id)}
            />
          )}
        />
      )}

      {/* MODAL DO CALENDÁRIO */}
      <Modal visible={calendarVisible} transparent={true} animationType="fade">
        <View style={s.modalOverlay}>
          <View style={s.calendarContainer}>
            <View style={s.calendarHeader}>
              <TouchableOpacity
                onPress={() => changeMonth(-1)}
                style={{ padding: 10 }}
              >
                <Ionicons name="chevron-back" size={20} color="#111827" />
              </TouchableOpacity>
              <Text style={s.calendarMonthName}>
                {new Intl.DateTimeFormat("pt-BR", {
                  month: "long",
                  year: "numeric",
                }).format(currentMonthView)}
              </Text>
              <TouchableOpacity
                onPress={() => changeMonth(1)}
                style={{ padding: 10 }}
              >
                <Ionicons name="chevron-forward" size={20} color="#111827" />
              </TouchableOpacity>
            </View>
            <View style={s.calendarWeekRow}>
              {["D", "S", "T", "Q", "Q", "S", "S"].map((d, i) => (
                <Text key={i} style={s.calendarWeekDay}>
                  {d}
                </Text>
              ))}
            </View>
            <View style={s.calendarGrid}>{renderCalendarDays()}</View>
            <TouchableOpacity
              style={s.closeCalendarBtn}
              onPress={() => setCalendarVisible(false)}
            >
              <Text style={{ color: "#fff", fontWeight: "bold" }}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL DE TRANSAÇÃO */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={s.modal}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>
              {editing ? "Editar Transação" : "Nova Transação"}
            </Text>
            <TouchableOpacity
              onPress={() => {
                setModalVisible(false);
                setEditing(null);
              }}
            >
              <Text style={s.modalClose}>Fechar</Text>
            </TouchableOpacity>
          </View>
          <TransactionForm
            isLoading={isLoading}
            initialValues={editing ?? undefined}
            onSubmit={editing ? handleUpdate : handleCreate}
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

function TransactionItem({ transaction: t, currency, onEdit, onDelete }: any) {
  const isIncome = t.type === "income";
  // Inteligência: Deteta se é o pagamento de uma fatura
  const isInvoicePayment = t.title && t.title.startsWith("Fatura");
  const color = isIncome ? "#16a34a" : "#dc2626";

  return (
    <View style={s.item}>
      <View
        style={[
          s.itemIcon,
          {
            backgroundColor: isInvoicePayment
              ? "#6366f118"
              : (t.category?.color ?? "#6366f1") + "20",
          },
        ]}
      >
        <Ionicons
          name={
            isInvoicePayment ? "card" : isIncome ? "arrow-up" : "arrow-down"
          }
          size={20}
          color={isInvoicePayment ? "#6366f1" : color}
        />
      </View>
      <View style={s.itemInfo}>
        <Text style={s.itemTitle}>{t.title}</Text>
        <Text style={s.itemCategory}>
          {isInvoicePayment
            ? `Pagamento de Fatura · ${formatDate(t.date)}`
            : `${t.category?.name ?? "Sem categoria"} · ${formatDate(t.date)}`}
        </Text>
      </View>
      <View style={s.itemRight}>
        <Text
          style={[
            s.itemAmount,
            { color: isInvoicePayment ? "#111827" : color },
          ]}
        >
          {isIncome ? "+" : "-"}
          {formatCurrency(t.amount, currency)}
        </Text>
        <View style={s.itemActions}>
          {/* Escondemos o lápis de editar para faturas, pois o valor vem automático do cartão */}
          {!isInvoicePayment && (
            <TouchableOpacity onPress={onEdit} style={s.editBtn}>
              <Ionicons name="create-outline" size={14} color="#6366f1" />
            </TouchableOpacity>
          )}
          {/* O botão de excluir mantém-se para poder limpar os testes! */}
          <TouchableOpacity onPress={onDelete} style={s.deleteBtn}>
            <Ionicons name="trash-outline" size={14} color="#ef4444" />
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
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    borderLeftWidth: 4,
  },
  summaryLabel: { fontSize: 12, color: "#6b7280", marginBottom: 4 },
  summaryValue: { fontSize: 16, fontWeight: "700" },
  list: { paddingHorizontal: 20, paddingBottom: 32 },
  item: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
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
  itemTitle: { fontSize: 14, fontWeight: "600", color: "#111827" },
  itemCategory: { fontSize: 12, color: "#9ca3af", marginTop: 2 },
  itemRight: { alignItems: "flex-end" },
  itemAmount: { fontSize: 14, fontWeight: "700" },
  itemActions: { flexDirection: "row", gap: 8, marginTop: 4 },
  editBtn: { padding: 4 },
  deleteBtn: { padding: 4 },
  empty: { alignItems: "center", paddingVertical: 60 },
  emptyText: { fontSize: 16, fontWeight: "600", color: "#374151" },
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

  // Estilos do Botão de Filtro
  filterBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  filterBtnText: { color: "#374151", fontSize: 14 },
  clearBtn: { justifyContent: "center", padding: 8 },

  // Estilos do Modal do Calendário
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  calendarContainer: {
    width: 320,
    backgroundColor: "#fff",
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
    color: "#111827",
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
    color: "#6b7280",
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
  calendarDaySelected: { backgroundColor: "#6366f1" },
  calendarDayText: { color: "#374151", fontSize: 14 },
  closeCalendarBtn: {
    backgroundColor: "#6366f1",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 16,
  },
});
