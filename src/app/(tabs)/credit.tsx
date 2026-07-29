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
import { useAppTheme } from "@/hooks/useTheme"; // 👈 Motor de temas global

interface InvoiceGroup {
  account: Account;
  activeInstallments: Installment[];
  invoiceTotal: number;
  nextInvoiceTotal: number;
}

export default function CreditScreen() {
  const { colors, isDark } = useAppTheme(); // 👈 Cores dinâmicas ativas

  const {
    installments,
    payFullInvoice,
    create,
    update,
    remove,
    refetch: refetchInstallments,
  } = useInstallments();
  const {
    accounts,
    refetch: refetchAccounts,
    update: updateAccount,
  } = useAccounts();
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

    const acc = accounts.find((a) => a.id === sourceAccountId);
    if (acc) {
      await updateAccount(acc.id, {
        balance: Number(acc.balance) - Number(payingGroup.invoiceTotal),
      });
    }

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
    <SafeAreaView style={[s.safe, { backgroundColor: colors.bg }]}>
      <View
        style={[
          s.header,
          {
            backgroundColor: colors.card,
            borderBottomColor: colors.border,
            borderBottomWidth: 1,
          },
        ]}
      >
        <Text style={[s.title, { color: colors.text }]}>Meus Cartões</Text>
        <TouchableOpacity
          style={[s.addBtn, { backgroundColor: colors.primary }]}
          onPress={handleOpenCreate}
        >
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={s.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        <Text style={[s.sectionTitle, { color: colors.subText }]}>
          Faturas Pendentes
        </Text>
        {pendingCards.length === 0 ? (
          <Text style={[s.emptyText, { color: colors.subText }]}>
            Nenhuma fatura pendente.
          </Text>
        ) : (
          pendingCards.map((group) => (
            <InvoiceCard
              key={group.account.id}
              group={group}
              colors={colors}
              isDark={isDark}
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
            <View style={[s.divider, { backgroundColor: colors.border }]} />
            <Text style={[s.sectionTitle, { color: colors.subText }]}>
              Faturas Pagas (Este Mês)
            </Text>
            {paidCards.map((group) => (
              <InvoiceCard
                key={group.account.id}
                group={group}
                colors={colors}
                isDark={isDark}
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
        colors={colors}
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
          <View style={[s.modalContent, { backgroundColor: colors.card }]}>
            <Text style={[s.modalTitle, { color: colors.text }]}>
              Pagar Fatura
            </Text>

            <Text
              style={{ fontSize: 14, color: colors.subText, marginBottom: 16 }}
            >
              Você está prestes a pagar a fatura do{" "}
              <Text style={{ fontWeight: "bold", color: colors.text }}>
                {payingGroup?.account?.name}
              </Text>{" "}
              no valor total de{" "}
              <Text style={{ fontWeight: "bold", color: "#dc2626" }}>
                {formatCurrency(payingGroup?.invoiceTotal || 0, "BRL")}
              </Text>
              .
            </Text>

            <Text style={[s.label, { color: colors.subText }]}>
              De qual conta o dinheiro vai sair?
            </Text>
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
                      {
                        backgroundColor: colors.inputBg,
                        borderColor: colors.border,
                      },
                      sourceAccountId === acc.id && [
                        s.accBtnActive,
                        {
                          backgroundColor: colors.primary,
                          borderColor: colors.primary,
                        },
                      ],
                    ]}
                    onPress={() => setSourceAccountId(acc.id)}
                  >
                    <Text
                      style={[
                        s.accBtnText,
                        { color: colors.text },
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
                style={[s.btn, { backgroundColor: colors.border }]}
                onPress={() => {
                  setPayModalVisible(false);
                  setSourceAccountId("");
                }}
              >
                <Text style={{ color: colors.text, fontWeight: "bold" }}>
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
  colors,
  isDark,
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
          backgroundColor: colors.card,
          borderLeftColor: account.color || colors.primary,
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
          <Text style={[s.cardTitle, { color: colors.text }]}>
            {account.name} {isPaidMode && "✅"}
          </Text>
          <Text style={[s.cardSubtitle, { color: colors.subText }]}>
            Vence dia {dueDay} de {formattedMonth}
          </Text>
        </View>
        <View style={{ alignItems: "flex-end", marginRight: 12 }}>
          <Text style={[s.invoiceTotal, { color: colors.primary }]}>
            {formatCurrency(headerTotal, account.currency)}
          </Text>
        </View>
        <Ionicons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={20}
          color={colors.subText}
        />
      </TouchableOpacity>

      {expanded && (
        <View
          style={[
            s.expandedArea,
            { backgroundColor: colors.inputBg, borderTopColor: colors.border },
          ]}
        >
          <TouchableOpacity
            style={[
              s.nextInvoiceBox,
              { backgroundColor: isDark ? "#312e81" : "#e0e7ff" },
              showNextMonth && {
                backgroundColor: isDark ? "#3730a3" : "#c7d2fe",
                borderColor: colors.primary,
                borderWidth: 1,
              },
            ]}
            activeOpacity={0.7}
            onPress={() => setShowNextMonth(!showNextMonth)}
          >
            <Ionicons
              name="calendar-outline"
              size={16}
              color={colors.primary}
            />
            <View style={{ flex: 1 }}>
              <Text
                style={[
                  s.nextInvoiceText,
                  { color: isDark ? "#e0e7ff" : "#3730a3" },
                ]}
              >
                Previsão para o próximo mês:{" "}
                <Text style={{ fontWeight: "bold" }}>
                  {formatCurrency(nextInvoiceTotal, account.currency)}
                </Text>
              </Text>
              <Text
                style={{
                  fontSize: 11,
                  color: colors.primary,
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
              color: colors.text,
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

          <View style={[s.miniDivider, { backgroundColor: colors.border }]} />

          {displayList.length === 0 && (
            <Text
              style={{
                color: colors.subText,
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
                  <Text style={[s.itemTitle, { color: colors.text }]}>
                    {item.title}
                  </Text>
                  <Text style={[s.itemSub, { color: colors.subText }]}>
                    Parcela {displayParcel} de {item.total_installments}
                  </Text>
                </View>
                <Text style={[s.itemValue, { color: colors.text }]}>
                  {formatCurrency(item.installment_amount, account.currency)}
                </Text>

                <View style={s.itemActions}>
                  <TouchableOpacity onPress={() => onEdit(item)}>
                    <Ionicons name="pencil" size={18} color={colors.subText} />
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
  colors,
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
          <View style={[s.modalContent, { backgroundColor: colors.card }]}>
            <Text style={[s.modalTitle, { color: colors.text }]}>
              {initialData ? "Editar Compra" : "Nova Compra Parcelada"}
            </Text>

            <View style={s.alertContainer}>
              <Ionicons name="information-circle" size={18} color="#1e40af" />
              <Text style={s.alertText}>
                Apenas cartões de crédito são exibidos aqui para o controle de
                faturas.
              </Text>
            </View>

            <Text style={[s.label, { color: colors.subText }]}>
              Cartão de Crédito
            </Text>
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
                      {
                        backgroundColor: colors.inputBg,
                        borderColor: colors.border,
                      },
                      accountId === acc.id && [
                        s.accBtnActive,
                        {
                          backgroundColor: colors.primary,
                          borderColor: colors.primary,
                        },
                      ],
                    ]}
                    onPress={() => setAccountId(acc.id)}
                  >
                    <Text
                      style={[
                        s.accBtnText,
                        { color: colors.text },
                        accountId === acc.id && { color: "#fff" },
                      ]}
                    >
                      {acc.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            <Text style={[s.label, { color: colors.subText }]}>
              Nome da Compra
            </Text>
            <TextInput
              style={[
                s.input,
                {
                  backgroundColor: colors.inputBg,
                  color: colors.text,
                  borderColor: colors.border,
                },
              ]}
              value={title}
              onChangeText={setTitle}
              placeholder="Ex: Geladeira"
              placeholderTextColor={colors.subText}
            />

            <View style={[s.modeToggle, { backgroundColor: colors.inputBg }]}>
              <TouchableOpacity
                style={[
                  s.modeBtn,
                  mode === "A" && [
                    s.modeBtnActive,
                    { backgroundColor: colors.primary },
                  ],
                ]}
                onPress={() => setMode("A")}
              >
                <Text
                  style={[
                    s.modeText,
                    { color: colors.subText },
                    mode === "A" && { color: "#fff" },
                  ]}
                >
                  Valor Total
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  s.modeBtn,
                  mode === "B" && [
                    s.modeBtnActive,
                    { backgroundColor: colors.primary },
                  ],
                ]}
                onPress={() => setMode("B")}
              >
                <Text
                  style={[
                    s.modeText,
                    { color: colors.subText },
                    mode === "B" && { color: "#fff" },
                  ]}
                >
                  Por Parcela
                </Text>
              </TouchableOpacity>
            </View>

            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={[s.label, { color: colors.subText }]}>
                  {mode === "A" ? "Valor Total (R$)" : "Valor da Parcela (R$)"}
                </Text>
                <TextInput
                  style={[
                    s.input,
                    {
                      backgroundColor: colors.inputBg,
                      color: colors.text,
                      borderColor: colors.border,
                    },
                  ]}
                  value={val1}
                  onChangeText={setVal1}
                  keyboardType="decimal-pad"
                  placeholderTextColor={colors.subText}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.label, { color: colors.subText }]}>
                  {mode === "A" ? "Qtd de Parcelas" : "Parcelas Restantes"}
                </Text>
                <TextInput
                  style={[
                    s.input,
                    {
                      backgroundColor: colors.inputBg,
                      color: colors.text,
                      borderColor: colors.border,
                    },
                  ]}
                  value={val2}
                  onChangeText={setVal2}
                  keyboardType="decimal-pad"
                  placeholderTextColor={colors.subText}
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
                  borderColor: colors.primary,
                  marginRight: 10,
                  backgroundColor: isNextMonth ? colors.primary : "transparent",
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
              <Text style={{ color: colors.text, fontSize: 13, flex: 1 }}>
                Fatura já fechou? (Lançar apenas no próximo mês)
              </Text>
            </TouchableOpacity>

            <View style={{ flexDirection: "row", gap: 10, marginTop: 24 }}>
              <TouchableOpacity
                style={[s.btn, { backgroundColor: colors.border }]}
                onPress={onClose}
              >
                <Text style={{ color: colors.text, fontWeight: "bold" }}>
                  Cancelar
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.btn, { backgroundColor: colors.primary }]}
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
  safe: {
    flex: 1,
    ...(Platform.OS === "web" ? { overflow: "hidden", maxWidth: "100%" } : {}),
  },
  header: {
    padding: 20,
    paddingTop: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: { fontSize: 24, fontWeight: "bold" },
  addBtn: { padding: 8, borderRadius: 12 },
  list: { paddingHorizontal: 16, paddingBottom: 40 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 12,
    marginTop: 10,
  },
  emptyText: { fontStyle: "italic", marginBottom: 20 },
  divider: { height: 2, marginVertical: 16 },

  cardWrapper: {
    borderRadius: 12,
    marginBottom: 16,
    borderLeftWidth: 6,
    elevation: 2,
    overflow: "hidden",
  },
  cardHeader: { flexDirection: "row", alignItems: "center", padding: 16 },
  cardTitle: { fontSize: 16, fontWeight: "700" },
  cardSubtitle: { fontSize: 13, marginTop: 2 },
  invoiceTotal: { fontSize: 16, fontWeight: "800" },

  expandedArea: {
    padding: 16,
    borderTopWidth: 1,
  },
  nextInvoiceBox: {
    padding: 10,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 6,
  },
  nextInvoiceText: { fontSize: 13 },
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
  miniDivider: { height: 1, marginVertical: 16 },

  itemRow: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  itemTitle: { fontSize: 14, fontWeight: "600" },
  itemSub: { fontSize: 12 },
  itemValue: {
    fontSize: 14,
    fontWeight: "700",
    marginRight: 16,
  },
  itemActions: { flexDirection: "row", alignItems: "center" },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
  },
  modalTitle: { fontSize: 20, fontWeight: "bold", marginBottom: 16 },
  label: {
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 6,
  },
  input: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    fontSize: 16,
    borderWidth: 1,
  },
  btn: { flex: 1, padding: 14, alignItems: "center", borderRadius: 8 },
  accBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
  },
  accBtnActive: {},
  accBtnText: { fontWeight: "600" },
  modeToggle: {
    flexDirection: "row",
    borderRadius: 8,
    padding: 4,
    marginBottom: 16,
  },
  modeBtn: { flex: 1, padding: 10, alignItems: "center", borderRadius: 6 },
  modeBtnActive: {},
  modeText: { fontWeight: "bold" },

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
