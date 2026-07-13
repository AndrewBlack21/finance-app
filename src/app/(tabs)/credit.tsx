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
import {
  transactionService,
  accountService,
  installmentService,
} from "@/services";

interface InvoiceGroup {
  account: Account;
  activeInstallments: Installment[];
  invoiceTotal: number;
  nextInvoiceTotal: number;
}

export default function CreditScreen() {
  const {
    installments,
    payFullInvoice,
    create,
    update,
    remove,
    refetch: refetchInstallments,
  } = useInstallments();
  const { accounts, refetch: refetchAccounts } = useAccounts();
  const { to } = getCurrentMonthRange();

  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<Installment | null>(null);
  const [payModalVisible, setPayModalVisible] = useState(false);
  const [payingGroup, setPayingGroup] = useState<any>(null);
  const [sourceAccountId, setSourceAccountId] = useState<string>("");

  const creditAccountsOnly = useMemo(() => {
    return accounts.filter((acc) => acc.type === "credit");
  }, [accounts]);

  const handleConfirmPayment = async () => {
    if (!sourceAccountId || !payingGroup) return;

    await transactionService.create({
      account_id: sourceAccountId,
      title: `Pagamento Fatura ${payingGroup.account.name}`,
      amount: payingGroup.invoiceTotal,
      type: "expense",
      date: new Date().toISOString().split("T")[0],
      currency: payingGroup.account.currency ?? "BRL",
      category_id: null,
    } as any);

    await payFullInvoice(payingGroup.account.id);

    setPayModalVisible(false);
    setPayingGroup(null);
    setSourceAccountId("");
    await onRefresh();
  };

  const invoiceGroups = useMemo(() => {
    const currentMonthIso = new Date().toISOString().slice(0, 7);

    return creditAccountsOnly
      .map((acc) => {
        const allRelevant = installments.filter(
          (i) =>
            i.account_id === acc.id &&
            (Number(i.paid_installments) < Number(i.total_installments) ||
              i.invoice_paid_month === currentMonthIso),
        );

        const currentInstallments = allRelevant.filter(
          (i) => !i.start_date || i.start_date <= to,
        );

        const pendingCurrent = currentInstallments.filter(
          (i) => i.invoice_paid_month !== currentMonthIso,
        );

        const isInvoicePaid =
          currentInstallments.length > 0 && pendingCurrent.length === 0;

        const invoiceTotal = currentInstallments.reduce(
          (sum, i) => sum + Number(i.installment_amount),
          0,
        );

        const nextMonthDate = new Date();
        nextMonthDate.setMonth(nextMonthDate.getMonth() + 1);
        const nextMonthEnd = new Date(
          nextMonthDate.getFullYear(),
          nextMonthDate.getMonth() + 1,
          0,
        )
          .toISOString()
          .split("T")[0];

        const activeForNext = allRelevant.filter(
          (i) => Number(i.paid_installments) < Number(i.total_installments),
        );

        const nextInstallments = activeForNext.filter((i) => {
          if (i.start_date && i.start_date > nextMonthEnd) return false;
          if (!i.start_date || i.start_date <= to) {
            if (i.invoice_paid_month === currentMonthIso) return true;
            return (
              Number(i.total_installments) - Number(i.paid_installments) > 1
            );
          }
          return true;
        });

        const nextInvoiceTotal = nextInstallments.reduce(
          (sum, i) => sum + Number(i.installment_amount),
          0,
        );

        return {
          account: acc,
          currentInstallments: isInvoicePaid
            ? currentInstallments
            : pendingCurrent,
          nextInstallments,
          invoiceTotal,
          nextInvoiceTotal,
          isInvoicePaid,
        };
      })
      .filter(
        (group) =>
          group.currentInstallments.length > 0 ||
          group.nextInstallments.length > 0 ||
          group.isInvoicePaid,
      );
  }, [creditAccountsOnly, installments, to]);

  const pendingCards = invoiceGroups.filter((g) => !g.isInvoicePaid);
  const paidCards = invoiceGroups.filter((g) => g.isInvoicePaid);

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
      {/* 👇 BLOQUEIO DE ZOOM */}

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
        <Text style={s.sectionTitle}>Faturas Pendentes</Text>
        {pendingCards.length === 0 ? (
          <Text style={s.emptyText}>Nenhuma fatura pendente.</Text>
        ) : (
          pendingCards.map((group) => (
            <InvoiceCard
              key={group.account.id}
              group={group}
              onPayInvoice={() => {
                setPayingGroup(group);
                setPayModalVisible(true);
              }}
              onEdit={handleOpenEdit}
              onDelete={remove}
              isPaidMode={group.isInvoicePaid}
            />
          ))
        )}

        {paidCards.length > 0 && (
          <>
            <View style={s.divider} />
            <Text style={s.sectionTitle}>Faturas Pagas (Este Mês)</Text>
            {paidCards.map((group) => (
              <InvoiceCard
                key={group.account.id}
                group={group}
                onPayInvoice={() => {
                  setPayingGroup(group);
                  setPayModalVisible(true);
                }}
                onEdit={handleOpenEdit}
                onDelete={remove}
                isPaidMode={group.isInvoicePaid}
              />
            ))}
          </>
        )}
      </ScrollView>

      <InstallmentFormModal
        visible={modalVisible}
        initialData={editingItem}
        accounts={creditAccountsOnly}
        onClose={() => setModalVisible(false)}
        onSave={async (payload: any) => {
          if (editingItem) {
            await update(editingItem.id, payload);
          } else {
            await create(payload as any);
          }
          setModalVisible(false);
        }}
      />

      <Modal visible={payModalVisible} transparent animationType="fade">
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <Text style={s.modalTitle}>Pagar Fatura</Text>

            <Text style={{ fontSize: 14, color: "#374151", marginBottom: 16 }}>
              Você está prestes a pagar a fatura do{" "}
              <Text style={{ fontWeight: "bold" }}>
                {payingGroup?.account?.name}
              </Text>{" "}
              no valor total de{" "}
              <Text style={{ fontWeight: "bold", color: "#dc2626" }}>
                {formatCurrency(payingGroup?.invoiceTotal || 0, "BRL")}
              </Text>
              .
            </Text>

            <Text style={s.label}>De qual conta o dinheiro vai sair?</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginBottom: 24, maxHeight: 40 }}
            >
              {accounts
                .filter((a) => a.type !== "credit")
                .map((acc) => (
                  <TouchableOpacity
                    key={acc.id}
                    style={[
                      s.accBtn,
                      sourceAccountId === acc.id && s.accBtnActive,
                      { borderColor: acc.color },
                    ]}
                    onPress={() => setSourceAccountId(acc.id)}
                  >
                    <Text
                      style={[
                        s.accBtnText,
                        sourceAccountId === acc.id && { color: "#fff" },
                      ]}
                    >
                      {acc.name}
                    </Text>
                  </TouchableOpacity>
                ))}
            </ScrollView>

            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity
                style={[s.btn, { backgroundColor: "#e5e7eb" }]}
                onPress={() => {
                  setPayModalVisible(false);
                  setSourceAccountId("");
                }}
              >
                <Text style={{ color: "#374151", fontWeight: "bold" }}>
                  Cancelar
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  s.btn,
                  {
                    backgroundColor: "#10b981",
                    opacity: !sourceAccountId ? 0.5 : 1,
                  },
                ]}
                onPress={handleConfirmPayment}
                disabled={!sourceAccountId}
              >
                <Text style={{ color: "#fff", fontWeight: "bold" }}>
                  Confirmar Pagamento
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function InvoiceCard({
  group,
  onPayInvoice,
  onEdit,
  onDelete,
  isPaidMode = false,
}: any) {
  const [expanded, setExpanded] = useState(false);
  const [showNextMonth, setShowNextMonth] = useState(false);
  const { to } = getCurrentMonthRange();

  const {
    account,
    currentInstallments = [],
    nextInstallments = [],
    invoiceTotal = 0,
    nextInvoiceTotal = 0,
  } = group ?? {};

  const dueDay = account.due_day || 10;
  const displayList = showNextMonth ? nextInstallments : currentInstallments;

  const today = new Date();
  const targetMonth = today.getMonth() + (showNextMonth ? 1 : 0);
  const invoiceDate = new Date(today.getFullYear(), targetMonth, dueDay);

  const rawMonthName = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
  }).format(invoiceDate);
  const formattedMonth =
    rawMonthName.charAt(0).toUpperCase() + rawMonthName.slice(1);

  const headerTotal = showNextMonth ? nextInvoiceTotal : invoiceTotal;

  const handlePayFull = () => {
    onPayInvoice();
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
        onPress={() => {
          setExpanded(!expanded);
          if (expanded) setShowNextMonth(false);
        }}
      >
        <View style={{ flex: 1 }}>
          <Text style={s.cardTitle}>
            {account.name} {isPaidMode && "✅"}
          </Text>
          <Text style={s.cardSubtitle}>
            Vence dia {dueDay} de {formattedMonth}
          </Text>
        </View>
        <View style={{ alignItems: "flex-end", marginRight: 12 }}>
          <Text style={s.invoiceTotal}>
            {formatCurrency(headerTotal, account.currency)}
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
          <TouchableOpacity
            style={[
              s.nextInvoiceBox,
              showNextMonth && {
                backgroundColor: "#c7d2fe",
                borderColor: "#4f46e5",
                borderWidth: 1,
              },
            ]}
            activeOpacity={0.7}
            onPress={() => setShowNextMonth(!showNextMonth)}
          >
            <Ionicons name="calendar-outline" size={16} color="#4f46e5" />
            <View style={{ flex: 1 }}>
              <Text style={s.nextInvoiceText}>
                Previsão para o próximo mês:{" "}
                <Text style={{ fontWeight: "bold" }}>
                  {formatCurrency(nextInvoiceTotal, account.currency)}
                </Text>
              </Text>
              <Text
                style={{
                  fontSize: 11,
                  color: "#4f46e5",
                  marginTop: 2,
                  fontWeight: "600",
                }}
              >
                {showNextMonth
                  ? "↑ Voltar para a fatura atual"
                  : "↓ Clique para ver as compras do próximo mês"}
              </Text>
            </View>
          </TouchableOpacity>

          <Text
            style={{
              fontSize: 14,
              fontWeight: "bold",
              color: "#374151",
              marginBottom: 12,
            }}
          >
            {showNextMonth
              ? "Compras da Próxima Fatura:"
              : "Compras Desta Fatura:"}
          </Text>

          {!isPaidMode && !showNextMonth && (
            <TouchableOpacity style={s.payInvoiceBtn} onPress={handlePayFull}>
              <Ionicons name="checkmark-done-circle" size={18} color="#fff" />
              <Text style={s.payInvoiceText}>Pagar Fatura Completa</Text>
            </TouchableOpacity>
          )}

          <View style={s.miniDivider} />

          {displayList.length === 0 && (
            <Text
              style={{
                color: "#9ca3af",
                fontStyle: "italic",
                textAlign: "center",
                marginBottom: 10,
              }}
            >
              Nenhuma compra para exibir.
            </Text>
          )}

          {displayList.map((item: any) => {
            const isOldItem = !item.start_date || item.start_date <= to;
            let displayParcel = Number(item.paid_installments) + 1;

            if (isPaidMode && !showNextMonth) {
              displayParcel = Number(item.paid_installments);
            } else if (showNextMonth && isOldItem) {
              displayParcel = isPaidMode
                ? Number(item.paid_installments) + 1
                : Number(item.paid_installments) + 2;
            }

            return (
              <View key={item.id} style={s.itemRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.itemTitle}>{item.title}</Text>
                  <Text style={s.itemSub}>
                    Parcela {displayParcel} de {item.total_installments}
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
            );
          })}
        </View>
      )}
    </View>
  );
}

function InstallmentFormModal({
  visible,
  onClose,
  initialData,
  accounts,
  onSave,
}: any) {
  const [mode, setMode] = useState<"A" | "B">("A");
  const [title, setTitle] = useState("");
  const [val1, setVal1] = useState("");
  const [val2, setVal2] = useState("");
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
  }, [visible, initialData, accounts]);

  const handleSave = () => {
    const v1 = parseFloat(val1.replace(",", "."));
    const v2 = parseInt(val2, 10);
    if (!title || isNaN(v1) || isNaN(v2))
      return Alert.alert("Erro", "Preencha os campos corretamente.");

    if (!accountId)
      return Alert.alert("Erro", "Selecione um cartão de crédito válido.");

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
      start_date: finalStartDate,
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

            <View style={s.alertContainer}>
              <Ionicons name="information-circle" size={18} color="#1e40af" />
              <Text style={s.alertText}>
                Apenas cartões de crédito são exibidos aqui para o controle de
                faturas.
              </Text>
            </View>

            <Text style={s.label}>Cartão de Crédito</Text>
            {accounts.length === 0 ? (
              <Text
                style={{
                  color: "#dc2626",
                  fontStyle: "italic",
                  marginBottom: 16,
                }}
              >
                Nenhum cartão de crédito cadastrado na plataforma.
              </Text>
            ) : (
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
            )}

            <Text style={s.label}>Nome da Compra</Text>
            <TextInput
              style={s.input}
              value={title}
              onChangeText={setTitle}
              placeholder="Ex: Geladeira"
            />

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
                  keyboardType="decimal-pad"
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
                  keyboardType="decimal-pad"
                />
              </View>
            </View>

            <TouchableOpacity
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginTop: 16,
                marginBottom: 8,
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
                    style={{ color: "#fff", fontSize: 14, fontWeight: "bold" }}
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
                disabled={accounts.length === 0}
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

const s = StyleSheet.create({
  // 👇 ESTILO BLINDADO PARA EVITAR SCROLL NO NAVEGADOR
  safe: {
    flex: 1,
    backgroundColor: "#f8fafc",
    ...(Platform.OS === "web" ? { overflow: "hidden", maxWidth: "100%" } : {}),
  },
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
  modalTitle: { fontSize: 20, fontWeight: "bold", marginBottom: 16 },
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
    fontSize: 16, // 👇 PREVINE ZOOM NO INPUT NO iOS
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
    padding: 4,
    marginBottom: 16,
  },
  modeBtn: { flex: 1, padding: 10, alignItems: "center", borderRadius: 6 },
  modeBtnActive: { backgroundColor: "#4f46e5" },
  modeText: { fontWeight: "bold", color: "#6b7280" },

  alertContainer: {
    flexDirection: "row",
    backgroundColor: "#dbeafe",
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    alignItems: "center",
    gap: 8,
  },
  alertText: {
    color: "#1e40af",
    fontSize: 12,
    fontWeight: "600",
    flex: 1,
  },
});
