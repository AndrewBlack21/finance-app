import React, { useMemo, useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,
  Modal,
  TextInput,
  RefreshControl,
  KeyboardAvoidingView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useInstallments } from "@/hooks/useInstallments";
import { useAccounts } from "@/hooks/useAccounts";
import { formatCurrency, getCurrentMonthRange } from "@/utils";
import type { Installment, Account } from "@/types";

interface InvoiceGroup {
  account: Account;
  activeInstallments: Installment[];
  invoiceTotal: number;
  nextInvoiceTotal: number;
}

export default function CreditScreen() {
  const { installments, payFullInvoice, create, update, remove, refetch } =
    useInstallments();
  const { accounts, refetch: refetchAccounts } = useAccounts();
  const { to } = getCurrentMonthRange();
  // 1. Estado para controlar quais faturas foram pagas nesta sessão
  const [paidThisMonth, setPaidThisMonth] = useState<string[]>([]);

  // 2. Estados do Modal de Edição/Criação
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<Installment | null>(null);

  // 3. Lógica de Agrupamento e Previsão
  // Agrupa os cartões e calcula as faturas com inteligência de data e parcelas
  // Agrupa os cartões e calcula as faturas com matemática exata de parcelas e datas
  const invoiceGroups = useMemo(() => {
    return accounts
      .map((acc) => {
        // 1. Pega todas as compras ativas deste cartão que ainda não foram totalmente quitadas
        const allActive = installments.filter(
          (i) =>
            i.account_id === acc.id &&
            i.paid_installments < i.total_installments,
        );

        // 2. FATURA ATUAL (Julho): Só entram compras sem data OU com data deste mês para trás
        const currentMonthInstallments = allActive.filter(
          (i) => !i.start_date || i.start_date <= to,
        );
        const invoiceTotal = currentMonthInstallments.reduce(
          (sum, i) => sum + i.installment_amount,
          0,
        );

        // 3. PREVISÃO DO PRÓXIMO MÊS (Agosto) - Matemática à prova de falhas:
        const nextInvoiceTotal = allActive.reduce((sum, i) => {
          // CASO A: A compra foi marcada com o Checkbox (Fatura Fechada) -> Vai DIRETO para o mês que vem
          if (i.start_date && i.start_date > to) {
            return sum + i.installment_amount;
          }

          // CASO B: Compras normais/antigas (Ex: BambuLab ou compras 1 de 1)
          if (!i.start_date || i.start_date <= to) {
            // Se o utilizador pagar a parcela deste mês, quantas vão sobrar para o mês que vem?
            const parcelasRestantesAposEsteMes =
              i.total_installments - (i.paid_installments + 1);

            // SE SOBRAR 0 OU MENOS (Ex: era 1 de 1, ou 12 de 12), ela ACABA ESTE MÊS e NÃO SOMA em Agosto!
            if (parcelasRestantesAposEsteMes > 0) {
              return sum + i.installment_amount;
            }
          }

          return sum;
        }, 0);

        return {
          account: acc,
          // Exibe na lista de Julho apenas o que pertence a Julho
          activeInstallments: currentMonthInstallments,
          invoiceTotal,
          nextInvoiceTotal,
        };
      })
      .filter(
        (group) =>
          group.activeInstallments.length > 0 || group.nextInvoiceTotal > 0,
      );
  }, [accounts, installments, to]);

  // Separação das listas
  const pendingCards = invoiceGroups.filter(
    (g) => !paidThisMonth.includes(g.account.id),
  );
  const paidCards = invoiceGroups.filter((g) =>
    paidThisMonth.includes(g.account.id),
  );

  // Ações da Tela
  const handlePayInvoice = async (accountId: string) => {
    await payFullInvoice(accountId);
    setPaidThisMonth((prev) => [...prev, accountId]); // Move para a seção de pagos
  };

  const handleOpenCreate = () => {
    setEditingItem(null);
    setModalVisible(true);
  };

  const handleOpenEdit = (item: Installment) => {
    setEditingItem(item);
    setModalVisible(true);
  };
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    if (refetchAccounts) await refetchAccounts();
    if (refetchInstallments) await refetchInstallments();
    setRefreshing(false);
  };
  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Text style={s.title}>Meus Cartões</Text>
        <TouchableOpacity style={s.addBtn} onPress={handleOpenCreate}>
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={s.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#6366f1"]}
          />
        }
      >
        {/* SEÇÃO 1: FATURAS PENDENTES */}
        <Text style={s.sectionTitle}>Faturas Pendentes</Text>
        {pendingCards.length === 0 ? (
          <Text style={s.emptyText}>Nenhuma fatura pendente.</Text>
        ) : (
          pendingCards.map((group) => (
            <InvoiceCard
              key={group.account.id}
              group={group}
              onPayInvoice={handlePayInvoice}
              onEdit={handleOpenEdit}
              onDelete={remove}
            />
          ))
        )}

        {/* SEÇÃO 2: FATURAS PAGAS */}
        {paidCards.length > 0 && (
          <>
            <View style={s.divider} />
            <Text style={s.sectionTitle}>Faturas Pagas (Este Mês)</Text>
            {paidCards.map((group) => (
              <InvoiceCard
                key={group.account.id}
                group={group}
                onPayInvoice={handlePayInvoice}
                onEdit={handleOpenEdit}
                onDelete={remove}
                isPaidMode
              />
            ))}
          </>
        )}
      </ScrollView>

      {/* MODAL FLEXÍVEL DE CADASTRO / EDIÇÃO */}
      <InstallmentFormModal
        visible={modalVisible}
        initialData={editingItem}
        accounts={accounts}
        onClose={() => setModalVisible(false)}
        onSave={async (payload) => {
          if (editingItem) {
            await update(editingItem.id, payload);
          } else {
            await create(payload as any);
          }
          setModalVisible(false);
        }}
      />
    </SafeAreaView>
  );
}

// ============================================================
// COMPONENTE DO CARD DO CARTÃO
// ============================================================
function InvoiceCard({
  group,
  onPayInvoice,
  onEdit,
  onDelete,
  isPaidMode = false,
}: any) {
  const [expanded, setExpanded] = useState(false);
  const { account, activeInstallments, invoiceTotal, nextInvoiceTotal } = group;

  const dueDay = account.due_day || 10;

  const handlePayFull = () => {
    if (Platform.OS === "web") {
      const ok = window.confirm(
        `Deseja marcar a fatura de ${account.name} como paga?`,
      );
      if (ok) onPayInvoice(account.id);
    } else {
      Alert.alert("Pagar Fatura", `Pagar a fatura de ${account.name}?`, [
        { text: "Cancelar", style: "cancel" },
        { text: "Sim, Pagar", onPress: () => onPayInvoice(account.id) },
      ]);
    }
  };

  return (
    <View
      style={[
        s.cardWrapper,
        {
          borderLeftColor: account.color || "#6366f1",
          opacity: isPaidMode ? 0.6 : 1,
        },
      ]}
    >
      <TouchableOpacity
        style={s.cardHeader}
        activeOpacity={0.7}
        onPress={() => setExpanded(!expanded)}
      >
        <View style={{ flex: 1 }}>
          <Text style={s.cardTitle}>
            {account.name} {isPaidMode && "✅"}
          </Text>
          <Text style={s.cardSubtitle}>Vence dia {dueDay}</Text>
        </View>
        <View style={{ alignItems: "flex-end", marginRight: 12 }}>
          <Text style={s.invoiceTotal}>
            {formatCurrency(invoiceTotal, account.currency)}
          </Text>
        </View>
        <Ionicons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={20}
          color="#6b7280"
        />
      </TouchableOpacity>

      {expanded && (
        <View style={s.expandedArea}>
          {/* AVISO DA PRÓXIMA FATURA */}
          <View style={s.nextInvoiceBox}>
            <Ionicons name="calendar-outline" size={16} color="#4f46e5" />
            <Text style={s.nextInvoiceText}>
              Previsão para o próximo mês:{" "}
              <Text style={{ fontWeight: "bold" }}>
                {formatCurrency(nextInvoiceTotal, account.currency)}
              </Text>
            </Text>
          </View>

          {!isPaidMode && (
            <TouchableOpacity style={s.payInvoiceBtn} onPress={handlePayFull}>
              <Ionicons name="checkmark-done-circle" size={18} color="#fff" />
              <Text style={s.payInvoiceText}>Pagar Fatura Completa</Text>
            </TouchableOpacity>
          )}

          <View style={s.miniDivider} />

          {activeInstallments.map((item: Installment) => (
            <View key={item.id} style={s.itemRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.itemTitle}>{item.title}</Text>
                <Text style={s.itemSub}>
                  Parcela {item.paid_installments + 1} de{" "}
                  {item.total_installments}
                </Text>
              </View>
              <Text style={s.itemValue}>
                {formatCurrency(item.installment_amount, account.currency)}
              </Text>

              <View style={s.itemActions}>
                <TouchableOpacity onPress={() => onEdit(item)}>
                  <Ionicons name="pencil" size={18} color="#6b7280" />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => onDelete(item.id)}
                  style={{ marginLeft: 12 }}
                >
                  <Ionicons name="trash" size={18} color="#dc2626" />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// ============================================================
// MODAL DE CADASTRO FLEXÍVEL (OPÇÃO A e OPÇÃO B)
// ============================================================
function InstallmentFormModal({
  visible,
  onClose,
  initialData,
  accounts,
  onSave,
}: any) {
  const [mode, setMode] = useState<"A" | "B">("A"); // A: Total+Parcelas, B: Parcela+Restantes
  const [title, setTitle] = useState("");
  const [val1, setVal1] = useState(""); // Total (A) ou Parcela (B)
  const [val2, setVal2] = useState(""); // Qtd Parcelas (A) ou Restantes (B)
  const [accountId, setAccountId] = useState("");
  const [isNextMonth, setIsNextMonth] = useState(false);
  useEffect(() => {
    if (visible) {
      if (initialData) {
        setTitle(initialData.title);
        setAccountId(initialData.account_id);
        setMode("A");
        setVal1(initialData.total_amount.toString());
        setVal2(initialData.total_installments.toString());
      } else {
        setTitle("");
        setVal1("");
        setVal2("");
        setAccountId(accounts[0]?.id || "");
      }
    }
  }, [visible, initialData]);

  const handleSave = () => {
    const v1 = parseFloat(val1.replace(",", "."));
    const v2 = parseInt(val2, 10);
    if (!title || isNaN(v1) || isNaN(v2))
      return Alert.alert("Erro", "Preencha os campos corretamente.");

    const dateObj = new Date();
    if (isNextMonth) dateObj.setMonth(dateObj.getMonth() + 1);
    const finalStartDate = dateObj.toISOString().split("T")[0];

    let total_amount = 0,
      total_installments = 0,
      installment_amount = 0;
    const paid_installments = initialData?.paid_installments ?? 0;

    if (mode === "A") {
      total_amount = v1;
      total_installments = v2;
      installment_amount = total_amount / total_installments;
    } else {
      installment_amount = v1;
      total_installments = paid_installments + v2;
      total_amount = installment_amount * total_installments;
    }

    onSave({
      title,
      total_amount,
      total_installments,
      installment_amount,
      account_id: accountId,
      currency: "BRL",
      start_date: finalStartDate, // ← data correta com lógica do checkbox
    });
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <Text style={s.modalTitle}>
              {initialData ? "Editar Compra" : "Nova Compra Parcelada"}
            </Text>

            <Text style={s.label}>Cartão de Crédito</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginBottom: 16, maxHeight: 40 }}
            >
              {accounts.map((acc: Account) => (
                <TouchableOpacity
                  key={acc.id}
                  style={[
                    s.accBtn,
                    accountId === acc.id && s.accBtnActive,
                    { borderColor: acc.color },
                  ]}
                  onPress={() => setAccountId(acc.id)}
                >
                  <Text
                    style={[
                      s.accBtnText,
                      accountId === acc.id && { color: "#fff" },
                    ]}
                  >
                    {acc.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={s.label}>Nome da Compra</Text>
            <TextInput
              style={s.input}
              value={title}
              onChangeText={setTitle}
              placeholder="Ex: Geladeira"
            />

            {/* CHAVEADOR DE MODO (OPÇÃO A / OPÇÃO B) */}
            <View style={s.modeToggle}>
              <TouchableOpacity
                style={[s.modeBtn, mode === "A" && s.modeBtnActive]}
                onPress={() => setMode("A")}
              >
                <Text style={[s.modeText, mode === "A" && { color: "#fff" }]}>
                  Valor Total
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.modeBtn, mode === "B" && s.modeBtnActive]}
                onPress={() => setMode("B")}
              >
                <Text style={[s.modeText, mode === "B" && { color: "#fff" }]}>
                  Por Parcela
                </Text>
              </TouchableOpacity>
            </View>

            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>
                  {mode === "A" ? "Valor Total (R$)" : "Valor da Parcela (R$)"}
                </Text>
                <TextInput
                  style={s.input}
                  value={val1}
                  onChangeText={setVal1}
                  keyboardType="numeric"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>
                  {mode === "A" ? "Qtd de Parcelas" : "Parcelas Restantes"}
                </Text>
                <TextInput
                  style={s.input}
                  value={val2}
                  onChangeText={setVal2}
                  keyboardType="numeric"
                />
              </View>
            </View>
            {/* NOVA CAIXINHA DE "FATURA FECHADA" */}
            <TouchableOpacity
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginTop: 16,
                marginBottom: 8, // Dei um espacinho extra aqui embaixo
              }}
              onPress={() => setIsNextMonth(!isNextMonth)}
            >
              <View
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 6,
                  borderWidth: 2,
                  borderColor: "#6366f1",
                  marginRight: 10,
                  backgroundColor: isNextMonth ? "#6366f1" : "transparent",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {isNextMonth && (
                  <Text
                    style={{
                      color: "#fff",
                      fontSize: 14,
                      fontWeight: "bold",
                    }}
                  >
                    ✓
                  </Text>
                )}
              </View>
              <Text style={{ color: "#374151", fontSize: 13, flex: 1 }}>
                Fatura já fechou? (Lançar apenas no próximo mês)
              </Text>
            </TouchableOpacity>

            <View style={{ flexDirection: "row", gap: 10, marginTop: 24 }}>
              <TouchableOpacity
                style={[s.btn, { backgroundColor: "#e5e7eb" }]}
                onPress={onClose}
              >
                <Text style={{ color: "#374151", fontWeight: "bold" }}>
                  Cancelar
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.btn, { backgroundColor: "#4f46e5" }]}
                onPress={handleSave}
              >
                <Text style={{ color: "#fff", fontWeight: "bold" }}>
                  Salvar
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ============================================================
// ESTILOS GERAIS
// ============================================================
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f8fafc" },
  header: {
    padding: 20,
    paddingTop: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: { fontSize: 24, fontWeight: "bold", color: "#111827" },
  addBtn: { backgroundColor: "#6366f1", padding: 8, borderRadius: 12 },
  list: { paddingHorizontal: 16, paddingBottom: 40 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#4b5563",
    marginBottom: 12,
    marginTop: 10,
  },
  emptyText: { color: "#9ca3af", fontStyle: "italic", marginBottom: 20 },
  divider: { height: 2, backgroundColor: "#e5e7eb", marginVertical: 16 },

  cardWrapper: {
    backgroundColor: "#fff",
    borderRadius: 12,
    marginBottom: 16,
    borderLeftWidth: 6,
    elevation: 2,
    overflow: "hidden",
  },
  cardHeader: { flexDirection: "row", alignItems: "center", padding: 16 },
  cardTitle: { fontSize: 16, fontWeight: "700", color: "#1f2937" },
  cardSubtitle: { fontSize: 13, color: "#6b7280", marginTop: 2 },
  invoiceTotal: { fontSize: 16, fontWeight: "800", color: "#6366f1" },

  expandedArea: {
    backgroundColor: "#f9fafb",
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
  },
  nextInvoiceBox: {
    backgroundColor: "#e0e7ff",
    padding: 10,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 6,
  },
  nextInvoiceText: { color: "#3730a3", fontSize: 13 },
  payInvoiceBtn: {
    backgroundColor: "#10b981",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  payInvoiceText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  miniDivider: { height: 1, backgroundColor: "#e5e7eb", marginVertical: 16 },

  itemRow: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  itemTitle: { fontSize: 14, fontWeight: "600", color: "#374151" },
  itemSub: { fontSize: 12, color: "#9ca3af" },
  itemValue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
    marginRight: 16,
  },
  itemActions: { flexDirection: "row", alignItems: "center" },

  // Estilos do Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
  },
  modalTitle: { fontSize: 20, fontWeight: "bold", marginBottom: 20 },
  label: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#374151",
    marginBottom: 6,
  },
  input: {
    backgroundColor: "#f3f4f6",
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  btn: { flex: 1, padding: 14, alignItems: "center", borderRadius: 8 },
  accBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
  },
  accBtnActive: { backgroundColor: "#6366f1" },
  accBtnText: { color: "#4b5563", fontWeight: "600" },
  modeToggle: {
    flexDirection: "row",
    backgroundColor: "#f3f4f6",
    borderRadius: 8,
    pading: 4,
    marginBottom: 16,
  },
  modeBtn: { flex: 1, padding: 10, alignItems: "center", borderRadius: 6 },
  modeBtnActive: { backgroundColor: "#4f46e5" },
  modeText: { fontWeight: "bold", color: "#6b7280" },
});
