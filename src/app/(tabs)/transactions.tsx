import { useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ActivityIndicator,
  Alert,
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
  const { transactions, isLoading, create, update, remove, summary } =
    useTransactions();
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);

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

  const handleDelete = (id: string) => {
    Alert.alert("Remover", "Tem certeza?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Remover", style: "destructive", onPress: () => remove(id) },
    ]);
  };

  const openEdit = (t: Transaction) => {
    setEditing(t);
    setModalVisible(true);
  };

  const openNew = () => {
    setEditing(null);
    setModalVisible(true);
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Text style={s.title}>Transações</Text>
        <TouchableOpacity style={s.addBtn} onPress={openNew}>
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

      {isLoading ? (
        <ActivityIndicator color="#6366f1" style={{ marginTop: 32 }} />
      ) : (
        <FlatList
          data={transactions}
          keyExtractor={(t) => t.id}
          contentContainerStyle={s.list}
          ListEmptyComponent={
            <View style={s.empty}>
              <Text style={s.emptyText}>Nenhuma transação encontrada</Text>
              <Text style={s.emptySubtext}>
                Toque em "+ Nova" para adicionar
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <TransactionItem
              transaction={item}
              currency={profile?.currency ?? "BRL"}
              onEdit={() => openEdit(item)}
              onDelete={() => handleDelete(item.id)}
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
              {editing ? "Editar TransaÃ§Ã£o" : "Nova TransaÃ§Ã£o"}
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

function TransactionItem({
  transaction: t,
  currency,
  onEdit,
  onDelete,
}: {
  transaction: Transaction;
  currency: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const isIncome = t.type === "income";
  return (
    <View style={s.item}>
      <View
        style={[
          s.itemIcon,
          { backgroundColor: (t.category?.color ?? "#6366f1") + "20" },
        ]}
      >
        <Ionicons
          name={isIncome ? "arrow-up" : "arrow-down"}
          size={20}
          color={isIncome ? "#16a34a" : "#dc2626"}
        />
      </View>
      <View style={s.itemInfo}>
        <Text style={s.itemTitle}>{t.title}</Text>
        <Text style={s.itemCategory}>
          {t.category?.name ?? "Sem categoria"} Â· {formatDate(t.date)}
        </Text>
      </View>
      <View style={s.itemRight}>
        <Text
          style={[s.itemAmount, { color: isIncome ? "#16a34a" : "#dc2626" }]}
        >
          {isIncome ? "+" : "-"}
          {formatCurrency(t.amount, currency)}
        </Text>
        <View style={s.itemActions}>
          <TouchableOpacity onPress={onEdit} style={s.editBtn}>
            <Ionicons name="create-outline" size={14} color="#6366f1" />
          </TouchableOpacity>
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
  editText: { fontSize: 11, color: "#6366f1" },
  deleteBtn: { padding: 4 },
  deleteText: { fontSize: 11, color: "#ef4444" },
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
});
