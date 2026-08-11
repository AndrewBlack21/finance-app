import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Alert,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useInstallments } from "@/hooks/useInstallments";
import { useAccounts } from "@/hooks/useAccounts";
import { formatCurrency } from "@/utils";
import { useAppTheme } from "@/hooks/useTheme";
import type { Installment } from "@/types";
import { transactionService, invoiceService } from "@/services";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const showWebSafeAlert = (title: string, message: string) => {
  if (Platform.OS === "web") {
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
};

function addMonthsToReference(reference: string, months: number): string {
  if (!reference) return "";
  const [year, month] = reference.split("-").map(Number);
  const total = year * 12 + (month - 1) + Number(months);
  const newYear = Math.floor(total / 12);
  const newMonth = (total % 12) + 1;
  return `${newYear}-${String(newMonth).padStart(2, "0")}`;
}

const monthNamesPtBR = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];
function getMonthName(ref: string) {
  if (!ref) return "";
  const [, m] = ref.split("-");
  return monthNamesPtBR[parseInt(m, 10) - 1];
}

export default function CreditCardsScreen() {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();

  const {
    accounts,
    update: updateAccount,
    refetch: refetchAccounts,
  } = useAccounts();
  const {
    installments,
    payInstallments,
    unpayInstallments,
    create,
    update,
    remove,
    refetch: refetchInstallments,
  } = useInstallments();
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<Installment | null>(null);

  const [payModalVisible, setPayModalVisible] = useState(false);
  const [payingGroup, setPayingGroup] = useState<any>(null);
  const [sourceAccountId, setSourceAccountId] = useState("");

  const creditAccountsOnly = useMemo(
    () => accounts.filter((a) => a.type === "credit"),
    [accounts],
  );

  const [invoicesByAccount, setInvoicesByAccount] = useState<
    Record<string, Record<string, any>>
  >({});

  const fetchInvoices = async () => {
    if (creditAccountsOnly.length === 0) return;
    const map: Record<string, Record<string, any>> = {};
    for (const acc of creditAccountsOnly) {
      const { data } = await invoiceService.listByAccount(acc.id);
      map[acc.id] = {};
      (data ?? []).forEach((inv: any) => {
        map[acc.id][inv.reference] = inv;
      });
    }
    setInvoicesByAccount(map);
  };

  useEffect(() => {
    fetchInvoices();
  }, [creditAccountsOnly.map((a) => a.id).join(",")]);

  const invoiceGroups = useMemo(() => {
    const currentMonthRef = new Date().toISOString().slice(0, 7);

    return creditAccountsOnly.map((acc) => {
      const accInstallments = installments.filter(
        (i) => i.account_id === acc.id,
      );

      const allActive = accInstallments.filter(
        (i) => Number(i.paid_installments) < Number(i.total_installments),
      );

      const accInvoices = invoicesByAccount[acc.id] ?? {};
      const allInvoices = Object.values(accInvoices).sort((a: any, b: any) =>
        a.reference.localeCompare(b.reference),
      );
      const unpaidInvoices = allInvoices.filter(
        (inv: any) => inv.status !== "paga",
      );

      let currentRef = currentMonthRef;
      let currentInvoice = null;

      if (unpaidInvoices.length > 0) {
        if (
          unpaidInvoices[0].reference > currentMonthRef &&
          accInvoices[currentMonthRef]
        ) {
          currentRef = currentMonthRef;
          currentInvoice = accInvoices[currentMonthRef];
        } else {
          currentRef = unpaidInvoices[0].reference;
          currentInvoice = unpaidInvoices[0];
        }
      } else {
        const currentMonthInv = allInvoices.find(
          (g: any) => g.reference === currentMonthRef,
        );
        currentRef = currentMonthInv
          ? currentMonthRef
          : allInvoices.length > 0
            ? allInvoices[allInvoices.length - 1].reference
            : currentMonthRef;
        currentInvoice = accInvoices[currentRef] || null;
      }

      const nextRef = addMonthsToReference(currentRef, 1);
      const nextInvoice = accInvoices[nextRef] || null;

      const currentInstallments: Installment[] = [];
      const nextInstallments: Installment[] = [];

      allActive.forEach((item) => {
        const paidInst = Number(item.paid_installments) || 0;
        const totalInst = Number(item.total_installments) || 1;

        let isCurrent = false;
        let isNext = false;

        // 👇 LÓGICA BLINDADA: Exatamente a mesma usada no ecrã accounts.tsx
        if (
          item.invoice?.status === "aberta" ||
          item.invoice?.status === "fechada"
        ) {
          isCurrent = true;
        } else if (item.invoice?.status === "paga") {
          isCurrent = false;
        } else {
          // Plano B Matemático: Calcula o mês baseado na data original de compra
          const dateStr = item.start_date
            ? item.start_date.split("T")[0]
            : item.created_at
              ? item.created_at.split("T")[0]
              : new Date().toISOString().split("T")[0];
          const [y, m] = dateStr.split("-").map(Number);
          const totalMonths = y * 12 + (m - 1) + paidInst;
          const refY = Math.floor(totalMonths / 12);
          const refM = (totalMonths % 12) + 1;
          const itemRef = `${refY}-${String(refM).padStart(2, "0")}`;

          isCurrent = itemRef <= currentRef;
          isNext = itemRef === nextRef;
        }

        if (isCurrent) {
          currentInstallments.push(item);

          // Se esta parcela for cobrada agora, a próxima será no próximo mês!
          if (paidInst + 1 < totalInst) {
            nextInstallments.push({
              ...item,
              paid_installments: paidInst + 1,
            });
          }
        } else if (isNext) {
          nextInstallments.push(item);
        }
      });

      const invoiceTotal = currentInstallments.reduce(
        (sum, i) => sum + Number(i.installment_amount),
        0,
      );
      const nextInvoiceTotal = nextInstallments.reduce(
        (sum, i) => sum + Number(i.installment_amount),
        0,
      );

      return {
        account: acc,
        invoice: currentInvoice,
        currentRef,
        nextRef,
        currentInstallments,
        nextInstallments,
        invoiceTotal,
        nextInvoiceTotal,
        isInvoicePaid: currentInvoice?.status === "paga",
      };
    });
  }, [creditAccountsOnly, installments, invoicesByAccount]);

  const handleOpenPayModal = (group: any) => {
    if (!group.invoice) return;
    setPayingGroup(group);
    setPayModalVisible(true);
  };

  const handleConfirmPayment = async () => {
    if (!sourceAccountId || !payingGroup) return;

    const sourceAcc = accounts.find((a) => a.id === sourceAccountId);
    if (!sourceAcc) {
      showWebSafeAlert("Erro ao pagar", "Conta de origem não encontrada.");
      return;
    }

    if (Number(sourceAcc.balance) < payingGroup.invoiceTotal) {
      showWebSafeAlert(
        "Saldo Insuficiente",
        `A conta "${sourceAcc.name}" tem apenas ${formatCurrency(sourceAcc.balance, sourceAcc.currency)}, mas a fatura custa ${formatCurrency(payingGroup.invoiceTotal, payingGroup.account.currency)}. Adicione fundos à conta antes de pagar.`,
      );
      return;
    }

    const { data: transaction, error: transactionError } =
      await transactionService.create({
        account_id: sourceAccountId,
        title: `Pagamento Fatura ${payingGroup.account.name}`,
        amount: payingGroup.invoiceTotal,
        type: "expense",
        date: new Date().toISOString().split("T")[0],
        currency: payingGroup.account.currency ?? "BRL",
        category_id: null,
      } as any);

    if (transactionError || !transaction) {
      showWebSafeAlert(
        "Erro ao pagar",
        `Falha ao criar a transação: ${transactionError}`,
      );
      return;
    }

    const { error: balanceError } = await updateAccount(sourceAcc.id, {
      balance: Number(sourceAcc.balance) - Number(payingGroup.invoiceTotal),
    });
    if (balanceError)
      return showWebSafeAlert(
        "Erro ao pagar",
        `Falha ao debitar a conta: ${balanceError}`,
      );

    const idsToPay = payingGroup.currentInstallments.map(
      (i: Installment) => i.id,
    );
    const { error: installmentsError } = await payInstallments(idsToPay);
    if (installmentsError)
      return showWebSafeAlert(
        "Erro",
        `Falha nas parcelas: ${installmentsError}`,
      );

    const { error: invoiceError } = await invoiceService.payInvoice(
      payingGroup.invoice.id,
      {
        paid_amount: payingGroup.invoiceTotal,
        paid_from_account_id: sourceAccountId,
        transaction_id: transaction.id,
      },
    );

    if (invoiceError)
      return showWebSafeAlert(
        "Erro",
        `Fatura não marcada como paga: ${invoiceError}`,
      );

    setPayModalVisible(false);
    setPayingGroup(null);
    setSourceAccountId("");

    await refetchAccounts();
    await refetchInstallments();
    await fetchInvoices();
  };

  const handleCancelPayment = (group: any) => {
    const invoice = group.invoice;

    const executeCancel = async () => {
      const { error: invoiceError } = await invoiceService.unpayInvoice(
        invoice.id,
      );
      if (invoiceError)
        return showWebSafeAlert(
          "Erro",
          `Fatura não foi reaberta: ${invoiceError}`,
        );

      if (invoice.transaction_id) {
        await transactionService.update(invoice.transaction_id, {
          title: `(Cancelado) Pagamento Fatura ${group.account.name}`,
        });

        const { error: transactionError } = await transactionService.create({
          account_id: invoice.paid_from_account_id,
          title: `Devolvido (Estorno) Fatura ${group.account.name}`,
          amount: invoice.paid_amount,
          type: "income",
          date: new Date().toISOString().split("T")[0],
          currency: group.account.currency || "BRL",
          category_id: null,
        } as any);

        if (transactionError)
          return showWebSafeAlert(
            "Erro",
            `Falha ao registar estorno: ${transactionError}`,
          );
      }

      if (invoice.paid_from_account_id && invoice.paid_amount) {
        const acc = accounts.find((a) => a.id === invoice.paid_from_account_id);
        if (acc) {
          const { error: balanceError } = await updateAccount(acc.id, {
            balance: Number(acc.balance) + Number(invoice.paid_amount),
          });
          if (balanceError)
            return showWebSafeAlert(
              "Erro",
              `Falha ao devolver saldo: ${balanceError}`,
            );
        }
      }

      const idsToRevert = installments
        .filter(
          (i) =>
            i.account_id === group.account.id &&
            i.paid_installments > 0 &&
            i.invoice,
        )
        .filter((i) => {
          const refIfReverted = addMonthsToReference(i.invoice!.reference, -1);
          return refIfReverted === invoice.reference;
        })
        .map((i) => i.id);

      if (idsToRevert.length > 0) {
        const { error: installmentsError } =
          await unpayInstallments(idsToRevert);
        if (installmentsError)
          return showWebSafeAlert(
            "Erro",
            `Falha ao reverter parcelas: ${installmentsError}`,
          );
      }

      await refetchAccounts();
      await refetchInstallments();
      await fetchInvoices();
    };

    if (Platform.OS === "web") {
      if (
        window.confirm(
          "O valor será devolvido à conta de origem (Estorno) e a fatura voltará a ficar em aberto. Confirma?",
        )
      ) {
        executeCancel();
      }
    } else {
      Alert.alert(
        "Cancelar Pagamento",
        "O valor será devolvido à conta de origem (Estorno) e a fatura voltará a ficar em aberto. Confirma?",
        [
          { text: "Voltar", style: "cancel" },
          {
            text: "Cancelar Pagamento",
            style: "destructive",
            onPress: executeCancel,
          },
        ],
      );
    }
  };

  const handleDelete = (id: string) => {
    const executeDelete = async () => {
      const { error } = await remove(id);
      if (error) showWebSafeAlert("Erro ao remover", error);
    };

    if (Platform.OS === "web") {
      if (window.confirm("Tem certeza que deseja remover esta compra?")) {
        executeDelete();
      }
    } else {
      Alert.alert("Remover Compra", "Tem certeza que deseja remover?", [
        { text: "Cancelar", style: "cancel" },
        { text: "Remover", style: "destructive", onPress: executeDelete },
      ]);
    }
  };

  const handleOpenEdit = (item: Installment) => {
    setEditingItem(item);
    setModalVisible(true);
  };

  const handleOpenCreate = () => {
    setEditingItem(null);
    setModalVisible(true);
  };

  const checkingAccounts = accounts.filter((a) => a.type === "checking");

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
      <FlatList
        data={invoiceGroups}
        keyExtractor={(item) => item.account.id}
        contentContainerStyle={{ paddingBottom: 100 }}
        renderItem={({ item: group }) => (
          <InvoiceCard
            group={group}
            colors={colors}
            onPayInvoice={() => handleOpenPayModal(group)}
            onCancelPayment={() => handleCancelPayment(group)}
            onEdit={handleOpenEdit}
            onDelete={handleDelete}
          />
        )}
      />

      <TouchableOpacity
        style={[s.fab, { backgroundColor: colors.primary }]}
        onPress={handleOpenCreate}
      >
        <Ionicons name="add" size={24} color="#fff" />
      </TouchableOpacity>

      <Modal visible={payModalVisible} transparent animationType="fade">
        <View style={s.modalOverlay}>
          <View
            style={[
              s.modalCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Text style={[s.modalTitle, { color: colors.text }]}>
              Pagar Fatura
            </Text>
            <Text style={{ color: colors.subText, marginBottom: 16 }}>
              Pagar a fatura de{" "}
              <Text style={{ fontWeight: "bold", color: colors.text }}>
                {payingGroup?.account?.name}
              </Text>{" "}
              no valor de{" "}
              <Text style={{ fontWeight: "bold", color: "#dc2626" }}>
                {formatCurrency(payingGroup?.invoiceTotal || 0, "BRL")}
              </Text>
            </Text>

            <Text style={[s.label, { color: colors.subText }]}>
              De qual Conta Corrente sai o dinheiro?
            </Text>

            {checkingAccounts.length === 0 ? (
              <Text
                style={{
                  color: "#dc2626",
                  fontStyle: "italic",
                  marginBottom: 24,
                  marginTop: 8,
                }}
              >
                Você não possui Contas Correntes cadastradas para realizar este
                pagamento.
              </Text>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginBottom: 24, maxHeight: 40 }}
              >
                {checkingAccounts.map((acc) => (
                  <TouchableOpacity
                    key={acc.id}
                    style={{
                      paddingHorizontal: 16,
                      paddingVertical: 8,
                      borderRadius: 20,
                      borderWidth: 1,
                      marginRight: 8,
                      borderColor:
                        sourceAccountId === acc.id
                          ? colors.primary
                          : colors.border,
                      backgroundColor:
                        sourceAccountId === acc.id
                          ? colors.primary
                          : colors.inputBg,
                    }}
                    onPress={() => setSourceAccountId(acc.id)}
                  >
                    <Text
                      style={{
                        fontWeight: "600",
                        color:
                          sourceAccountId === acc.id ? "#fff" : colors.text,
                      }}
                    >
                      {acc.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

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
                    opacity:
                      !sourceAccountId || checkingAccounts.length === 0
                        ? 0.5
                        : 1,
                  },
                ]}
                onPress={handleConfirmPayment}
                disabled={!sourceAccountId || checkingAccounts.length === 0}
              >
                <Text style={{ color: "#fff", fontWeight: "bold" }}>
                  Confirmar
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {modalVisible && (
        <InstallmentFormModal
          visible={modalVisible}
          initialData={editingItem}
          onClose={() => setModalVisible(false)}
          accounts={creditAccountsOnly}
          colors={colors}
          onSave={async (payload: any) => {
            if (editingItem) {
              await update(editingItem.id, payload);
            } else {
              await create(payload);
            }
            setModalVisible(false);
          }}
        />
      )}
    </View>
  );
}

function InvoiceCard({
  group,
  onPayInvoice,
  onCancelPayment,
  onEdit,
  onDelete,
  colors,
}: any) {
  const [expanded, setExpanded] = useState(false);
  const [showNext, setShowNext] = useState(false);

  const {
    account,
    invoice,
    currentInstallments,
    nextInstallments,
    invoiceTotal,
    nextInvoiceTotal,
    isInvoicePaid,
    currentRef,
    nextRef,
  } = group;

  const displayList = showNext ? nextInstallments : currentInstallments;
  const displayTotal = showNext ? nextInvoiceTotal : invoiceTotal;

  const currentMonthName = getMonthName(currentRef);
  const nextMonthName = getMonthName(nextRef);

  return (
    <View
      style={[
        s.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderLeftWidth: 4,
          borderLeftColor: account.color || colors.primary,
        },
      ]}
    >
      <TouchableOpacity onPress={() => setExpanded(!expanded)}>
        <Text style={[s.cardTitle, { color: colors.text }]}>
          {account.name}
        </Text>
        <Text style={[s.cardSub, { color: colors.subText }]}>
          {invoice
            ? `Vence dia ${account.due_day ?? "10"} de ${currentMonthName}`
            : "Nenhuma fatura pendente"}
        </Text>
        <Text style={[s.amount, { color: colors.text }]}>
          {formatCurrency(displayTotal, account.currency)}
        </Text>
      </TouchableOpacity>

      {!showNext && invoice && !isInvoicePaid && (
        <TouchableOpacity
          style={[s.payBtn, { backgroundColor: "#10b981" }]}
          onPress={onPayInvoice}
        >
          <Ionicons name="checkmark-done-circle" size={18} color="#fff" />
          <Text style={s.payBtnText}> Pagar Fatura Completa</Text>
        </TouchableOpacity>
      )}
      {!showNext && isInvoicePaid && (
        <View>
          <Text style={{ color: "#22c55e", fontWeight: "bold", marginTop: 10 }}>
            Fatura Paga! 🎉
          </Text>
          <TouchableOpacity
            style={[s.payBtn, { backgroundColor: "#dc2626", marginTop: 8 }]}
            onPress={onCancelPayment}
          >
            <Ionicons name="arrow-undo" size={18} color="#fff" />
            <Text style={s.payBtnText}> Cancelar Pagamento</Text>
          </TouchableOpacity>
        </View>
      )}

      {expanded && (
        <View style={s.expandedArea}>
          <TouchableOpacity
            style={[
              s.nextInvoiceBox,
              { backgroundColor: colors.inputBg },
              showNext && { borderColor: colors.primary, borderWidth: 1 },
            ]}
            onPress={() => setShowNext(!showNext)}
          >
            <Ionicons
              name="calendar-outline"
              size={18}
              color={colors.primary}
              style={{ marginTop: 2 }}
            />
            <View style={{ marginLeft: 8, flex: 1 }}>
              {showNext ? (
                <>
                  <Text style={{ color: colors.text }}>
                    Previsão para o mês atual:{" "}
                    <Text style={{ fontWeight: "bold" }}>
                      {formatCurrency(invoiceTotal, account.currency)}
                    </Text>
                  </Text>
                  <Text
                    style={{
                      color: colors.primary,
                      fontSize: 12,
                      marginTop: 2,
                    }}
                  >
                    ↑ Voltar para a fatura atual
                  </Text>
                </>
              ) : (
                <>
                  <Text style={{ color: colors.text }}>
                    Previsão para o próximo mês:{" "}
                    <Text style={{ fontWeight: "bold" }}>
                      {formatCurrency(nextInvoiceTotal, account.currency)}
                    </Text>
                  </Text>
                  <Text
                    style={{
                      color: colors.primary,
                      fontSize: 12,
                      marginTop: 2,
                    }}
                  >
                    ↓ Clique para ver as compras do próximo mês
                  </Text>
                </>
              )}
            </View>
          </TouchableOpacity>

          <Text
            style={{
              color: colors.text,
              fontWeight: "bold",
              marginTop: 16,
              marginBottom: 8,
              fontSize: 13,
            }}
          >
            {showNext
              ? `Compras da Próxima Fatura (${nextMonthName}):`
              : `Compras Desta Fatura (${currentMonthName}):`}
          </Text>

          {displayList.length === 0 && (
            <Text style={{ color: colors.subText, fontStyle: "italic" }}>
              Nenhuma compra para exibir.
            </Text>
          )}

          {displayList.map((item: Installment) => {
            const currentParcela = item.paid_installments + 1;
            const remainingCount =
              item.total_installments - item.paid_installments;
            const remainingAmount = remainingCount * item.installment_amount;

            return (
              <View key={item.id} style={s.itemRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[s.itemTitle, { color: colors.text }]}>
                    {item.title}
                  </Text>
                  <Text style={[s.itemSub, { color: colors.subText }]}>
                    Parcela {currentParcela} de {item.total_installments}
                  </Text>
                  {remainingCount > 0 && (
                    <Text
                      style={[
                        s.itemSub,
                        {
                          color: colors.primary,
                          fontWeight: "600",
                          marginTop: 2,
                        },
                      ]}
                    >
                      Restam {remainingCount}x (Falta pagar:{" "}
                      {formatCurrency(remainingAmount, account.currency)})
                    </Text>
                  )}
                </View>
                <Text style={[s.itemValue, { color: colors.text }]}>
                  {formatCurrency(item.installment_amount, account.currency)}
                </Text>
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
  const [title, setTitle] = useState(initialData?.title ?? "");
  const [totalAmount, setTotalAmount] = useState(
    initialData?.total_amount?.toString() ?? "",
  );
  const [installmentsCount, setInstallmentsCount] = useState(
    initialData?.total_installments?.toString() ?? "",
  );
  const [accountId, setAccountId] = useState(
    initialData?.account_id ?? accounts[0]?.id ?? "",
  );
  const [purchaseDate, setPurchaseDate] = useState(
    initialData?.start_date ?? new Date().toISOString().split("T")[0],
  );
  const [dateObj, setDateObj] = useState(
    initialData?.start_date ? new Date(initialData.start_date) : new Date(),
  );
  const [showDatePicker, setShowDatePicker] = useState(false);

  const onChangeDate = (event: any, selectedDate?: Date) => {
    if (Platform.OS === "android") setShowDatePicker(false);
    if (selectedDate) {
      setDateObj(selectedDate);
      setPurchaseDate(selectedDate.toISOString().split("T")[0]);
    }
  };

  const handleSave = async () => {
    const amount = parseFloat(totalAmount.replace(",", "."));
    const count = parseInt(installmentsCount, 10);
    if (!title || isNaN(amount) || isNaN(count))
      return showWebSafeAlert("Erro", "Preencha os campos corretamente.");

    const selectedAccount = accounts.find((a: any) => a.id === accountId);
    const closingDay = selectedAccount?.closing_day || 31;

    const [year, month, day] = purchaseDate.split("-").map(Number);
    let finalStartDate = new Date(year, month - 1, day);

    if (day >= closingDay) {
      finalStartDate.setMonth(finalStartDate.getMonth() + 1);
    }

    const finalStartDateString = finalStartDate.toISOString().split("T")[0];

    await onSave({
      title,
      total_amount: amount,
      total_installments: count,
      installment_amount: amount / count,
      account_id: accountId,
      currency: "BRL",
      start_date: finalStartDateString,
    });
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={s.modalOverlay}>
          <View
            style={[
              s.modalCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Text style={[s.modalTitle, { color: colors.text }]}>
              {initialData ? "Editar Compra" : "Nova Compra no Cartão"}
            </Text>

            <Text style={[s.label, { color: colors.subText }]}>
              Cartão de Crédito
            </Text>
            <View style={{ flexDirection: "row", marginBottom: 16 }}>
              {accounts.map((acc: any) => (
                <TouchableOpacity
                  key={acc.id}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    borderRadius: 20,
                    borderWidth: 1,
                    marginRight: 8,
                    borderColor:
                      accountId === acc.id ? colors.primary : colors.border,
                    backgroundColor:
                      accountId === acc.id ? colors.primary : colors.inputBg,
                  }}
                  onPress={() => setAccountId(acc.id)}
                >
                  <Text
                    style={{
                      fontWeight: "600",
                      color: accountId === acc.id ? "#fff" : colors.text,
                    }}
                  >
                    {acc.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[s.label, { color: colors.subText }]}>
              Data da Compra
            </Text>
            {Platform.OS === "web" ? (
              <TextInput
                style={[
                  s.input,
                  {
                    backgroundColor: colors.inputBg,
                    color: colors.text,
                    borderColor: colors.border,
                  },
                ]}
                value={purchaseDate}
                onChangeText={setPurchaseDate}
                {...({ type: "date" } as any)}
              />
            ) : (
              <>
                <TouchableOpacity
                  style={[
                    s.input,
                    {
                      backgroundColor: colors.inputBg,
                      borderColor: colors.border,
                      justifyContent: "center",
                    },
                  ]}
                  onPress={() => setShowDatePicker(true)}
                >
                  <Text style={{ color: colors.text, fontSize: 16 }}>
                    {purchaseDate}
                  </Text>
                </TouchableOpacity>
                {showDatePicker && (
                  <DateTimePicker
                    value={dateObj}
                    mode="date"
                    display={Platform.OS === "ios" ? "inline" : "default"}
                    onChange={onChangeDate}
                  />
                )}
                {showDatePicker && Platform.OS === "ios" && (
                  <TouchableOpacity
                    style={{
                      alignItems: "center",
                      padding: 12,
                      backgroundColor: colors.primary,
                      borderRadius: 8,
                      marginTop: 10,
                    }}
                    onPress={() => setShowDatePicker(false)}
                  >
                    <Text style={{ color: "#fff", fontWeight: "bold" }}>
                      Confirmar Data
                    </Text>
                  </TouchableOpacity>
                )}
              </>
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

            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={[s.label, { color: colors.subText }]}>
                  Valor Total (R$)
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
                  value={totalAmount}
                  onChangeText={setTotalAmount}
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.label, { color: colors.subText }]}>
                  Parcelas
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
                  value={installmentsCount}
                  onChangeText={setInstallmentsCount}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>

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
              >
                <Text style={{ color: "#fff", fontWeight: "bold" }}>
                  Salvar Compra
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
  container: { flex: 1, paddingHorizontal: 16 },
  card: { padding: 16, borderRadius: 12, borderWidth: 1, marginBottom: 12 },
  cardTitle: { fontSize: 18, fontWeight: "bold" },
  cardSub: { fontSize: 12, marginTop: 4, marginBottom: 12 },
  amount: { fontSize: 24, fontWeight: "800" },
  expandedArea: { marginTop: 12 },
  nextInvoiceBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  payBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  payBtnText: { color: "#fff", fontWeight: "bold" },
  itemRow: { flexDirection: "row", alignItems: "center", marginTop: 12 },
  itemTitle: { fontSize: 14, fontWeight: "600" },
  itemSub: { fontSize: 12 },
  itemValue: { fontSize: 14, fontWeight: "700", marginRight: 16 },
  fab: {
    position: "absolute",
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    elevation: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalCard: {
    padding: 24,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
  },
  modalTitle: { fontSize: 18, fontWeight: "bold", marginBottom: 16 },
  label: { fontSize: 12, fontWeight: "bold", marginBottom: 6, marginTop: 12 },
  input: { padding: 12, borderRadius: 8, borderWidth: 1, fontSize: 16 },
  btn: { flex: 1, padding: 14, borderRadius: 8, alignItems: "center" },
});
