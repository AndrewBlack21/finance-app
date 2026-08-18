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
  const { colors, isDark } = useAppTheme();
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

  // 👇 LÓGICA BLINDADA E SIMPLIFICADA PARA EVITAR ZERAR OS VALORES
  const invoiceGroups = useMemo(() => {
    const currentMonthIso = new Date().toISOString().slice(0, 7);
    const nextMonthDate = new Date();
    nextMonthDate.setMonth(nextMonthDate.getMonth() + 1);
    const nextMonthIso = nextMonthDate.toISOString().slice(0, 7);

    return creditAccountsOnly.map((acc) => {
      const accInstallments = installments.filter(
        (i) => i.account_id === acc.id,
      );
      const allActive = accInstallments.filter(
        (i) => Number(i.paid_installments) < Number(i.total_installments),
      );

      const currentInstallments: Installment[] = [];
      const nextInstallments: Installment[] = [];

      allActive.forEach((item) => {
        const paidInst = Number(item.paid_installments) || 0;
        const totalInst = Number(item.total_installments) || 1;

        // Matemática direta baseada na data da compra
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

        let isCurrent = false;

        if (
          item.invoice?.status === "aberta" ||
          item.invoice?.status === "fechada"
        ) {
          isCurrent = true;
        } else if (item.invoice?.status === "paga") {
          isCurrent = false;
        } else {
          isCurrent = itemRef <= currentMonthIso;
        }

        if (isCurrent) {
          currentInstallments.push(item);
          if (paidInst + 1 < totalInst) {
            nextInstallments.push({ ...item, paid_installments: paidInst + 1 });
          }
        } else if (itemRef === nextMonthIso) {
          nextInstallments.push(item);
        }
      });

      const currentInvoice =
        currentInstallments.find((i) => i.invoice)?.invoice ?? null;
      const isInvoicePaid =
        currentInstallments.length === 0 && allActive.length > 0;

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
        currentRef: currentInvoice ? currentInvoice.reference : currentMonthIso,
        nextRef: nextMonthIso,
        currentInstallments,
        nextInstallments,
        invoiceTotal,
        nextInvoiceTotal,
        isInvoicePaid,
      };
    });
  }, [creditAccountsOnly, installments]);

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
      <View style={s.headerContainer}>
        <Text style={[s.headerTitle, { color: colors.text }]}>
          Cartões de Crédito
        </Text>
        <Text style={[s.headerSubtitle, { color: colors.subText }]}>
          Acompanhe faturas e compras parceladas
        </Text>
      </View>

      <FlatList
        data={invoiceGroups}
        keyExtractor={(item) => item.account.id}
        contentContainerStyle={s.listContent}
        showsVerticalScrollIndicator={false}
        renderItem={({ item: group }) => (
          <InvoiceCard
            group={group}
            colors={colors}
            isDark={isDark}
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
        <Ionicons name="add" size={32} color="#fff" />
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
            <Text style={{ color: colors.subText, marginBottom: 20 }}>
              Pagar a fatura de{" "}
              <Text style={{ fontWeight: "bold", color: colors.text }}>
                {payingGroup?.account?.name}
              </Text>{" "}
              no valor de{" "}
              <Text style={{ fontWeight: "bold", color: "#10b981" }}>
                {formatCurrency(payingGroup?.invoiceTotal || 0, "BRL")}
              </Text>
            </Text>

            <Text style={[s.label, { color: colors.subText }]}>
              Origem do pagamento (Conta Corrente):
            </Text>
            {checkingAccounts.length === 0 ? (
              <Text
                style={{
                  color: "#ef4444",
                  fontStyle: "italic",
                  marginBottom: 24,
                  marginTop: 8,
                }}
              >
                Nenhuma Conta Corrente cadastrada.
              </Text>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginBottom: 24, maxHeight: 44 }}
              >
                {checkingAccounts.map((acc) => (
                  <TouchableOpacity
                    key={acc.id}
                    style={[
                      s.accBtn,
                      {
                        borderColor: colors.border,
                        backgroundColor:
                          sourceAccountId === acc.id
                            ? colors.primary
                            : colors.inputBg,
                      },
                    ]}
                    onPress={() => setSourceAccountId(acc.id)}
                  >
                    <Text
                      style={[
                        s.accBtnText,
                        {
                          color:
                            sourceAccountId === acc.id ? "#fff" : colors.text,
                        },
                      ]}
                    >
                      {acc.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            <View style={{ flexDirection: "row", gap: 12 }}>
              <TouchableOpacity
                style={[
                  s.btn,
                  {
                    backgroundColor: colors.inputBg,
                    borderWidth: 1,
                    borderColor: colors.border,
                  },
                ]}
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
                  Pagar Fatura
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
            if (editingItem) await update(editingItem.id, payload);
            else await create(payload);
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
  isDark,
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
    <View style={s.cardWrapper}>
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => setExpanded(!expanded)}
        style={[
          s.physicalCard,
          { backgroundColor: account.color || colors.primary, zIndex: 2 },
        ]}
      >
        <View style={s.ccTopRow}>
          <View style={s.ccChip}>
            <View style={s.ccChipLine} />
            <View style={s.ccChipLine} />
            <View style={s.ccChipLine} />
          </View>
          <Text style={s.ccBankName}>{account.name.toUpperCase()}</Text>
        </View>

        <View style={s.ccAmountArea}>
          <Text style={s.ccAmountLabel}>
            {showNext
              ? `Previsto: ${nextMonthName}`
              : `Fatura: ${currentMonthName}`}
          </Text>
          <Text style={s.ccAmountValue}>
            {formatCurrency(displayTotal, account.currency)}
          </Text>
        </View>

        <View style={s.ccBottomRow}>
          <View
            style={[
              s.ccStatusBadge,
              {
                backgroundColor: isInvoicePaid
                  ? "#10b981"
                  : "rgba(255,255,255,0.2)",
              },
            ]}
          >
            <Text style={s.ccStatusText}>
              {isInvoicePaid
                ? "Pago"
                : invoice
                  ? "Fechada/Pendente"
                  : "Em Aberto"}
            </Text>
          </View>
          <Ionicons
            name={expanded ? "chevron-up-circle" : "chevron-down-circle"}
            size={28}
            color="rgba(255,255,255,0.6)"
          />
        </View>
      </TouchableOpacity>

      {expanded && (
        <View
          style={[
            s.expandedCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              zIndex: 1,
            },
          ]}
        >
          {!showNext && invoice && !isInvoicePaid && (
            <TouchableOpacity
              style={[s.payBtn, { backgroundColor: "#10b981" }]}
              onPress={onPayInvoice}
            >
              <Ionicons name="checkmark-done-circle" size={20} color="#fff" />
              <Text style={s.payBtnText}>Pagar Fatura Completa</Text>
            </TouchableOpacity>
          )}
          {!showNext && isInvoicePaid && (
            <View style={{ marginBottom: 16 }}>
              <Text
                style={{
                  color: "#10b981",
                  fontWeight: "bold",
                  textAlign: "center",
                  marginBottom: 12,
                }}
              >
                Fatura Paga com Sucesso! 🎉
              </Text>
              <TouchableOpacity
                style={[
                  s.payBtn,
                  {
                    backgroundColor: colors.inputBg,
                    borderWidth: 1,
                    borderColor: colors.border,
                  },
                ]}
                onPress={onCancelPayment}
              >
                <Ionicons name="arrow-undo" size={20} color="#ef4444" />
                <Text style={[s.payBtnText, { color: "#ef4444" }]}>
                  Desfazer Pagamento
                </Text>
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity
            style={[
              s.nextInvoiceBox,
              {
                backgroundColor: colors.inputBg,
                borderColor: showNext ? colors.primary : colors.border,
              },
            ]}
            onPress={() => setShowNext(!showNext)}
          >
            <Ionicons
              name="calendar-outline"
              size={20}
              color={colors.primary}
            />
            <View style={{ marginLeft: 12, flex: 1 }}>
              {showNext ? (
                <>
                  <Text style={{ color: colors.text, fontSize: 13 }}>
                    Total do Mês Atual:{" "}
                    <Text style={{ fontWeight: "bold" }}>
                      {formatCurrency(invoiceTotal, account.currency)}
                    </Text>
                  </Text>
                  <Text
                    style={{
                      color: colors.primary,
                      fontSize: 11,
                      marginTop: 4,
                      fontWeight: "600",
                    }}
                  >
                    ↑ Ver Fatura Atual
                  </Text>
                </>
              ) : (
                <>
                  <Text style={{ color: colors.text, fontSize: 13 }}>
                    Previsão Próximo Mês:{" "}
                    <Text style={{ fontWeight: "bold" }}>
                      {formatCurrency(nextInvoiceTotal, account.currency)}
                    </Text>
                  </Text>
                  <Text
                    style={{
                      color: colors.primary,
                      fontSize: 11,
                      marginTop: 4,
                      fontWeight: "600",
                    }}
                  >
                    ↓ Ver Próximas Compras
                  </Text>
                </>
              )}
            </View>
          </TouchableOpacity>

          <Text
            style={{
              color: colors.text,
              fontWeight: "bold",
              marginTop: 8,
              marginBottom: 8,
              fontSize: 14,
            }}
          >
            {showNext
              ? `Detalhes de ${nextMonthName}:`
              : `Detalhes de ${currentMonthName}:`}
          </Text>

          {displayList.length === 0 && (
            <Text
              style={{
                color: colors.subText,
                fontStyle: "italic",
                textAlign: "center",
                paddingVertical: 20,
              }}
            >
              Nenhuma compra para exibir.
            </Text>
          )}

          {displayList.map((item: Installment, idx: number) => {
            const currentParcela = Number(item.paid_installments) + 1;
            return (
              <View
                key={item.id}
                style={[
                  s.itemRow,
                  {
                    borderBottomColor: colors.border,
                    borderBottomWidth: idx === displayList.length - 1 ? 0 : 1,
                  },
                ]}
              >
                <View style={[s.itemIcon, { backgroundColor: colors.inputBg }]}>
                  <Ionicons
                    name="card-outline"
                    size={18}
                    color={colors.primary}
                  />
                </View>
                <View style={s.itemInfo}>
                  <Text
                    style={[s.itemTitle, { color: colors.text }]}
                    numberOfLines={1}
                  >
                    {item.title}
                  </Text>
                  <Text style={[s.itemSub, { color: colors.subText }]}>
                    Parcela {currentParcela} de {item.total_installments}
                  </Text>
                </View>
                <View style={s.itemRight}>
                  <Text style={[s.itemValue, { color: colors.text }]}>
                    {formatCurrency(item.installment_amount, account.currency)}
                  </Text>
                  <View style={s.itemActions}>
                    <TouchableOpacity onPress={() => onEdit(item)}>
                      <Ionicons
                        name="create-outline"
                        size={18}
                        color={colors.subText}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => onDelete(item.id)}>
                      <Ionicons
                        name="trash-outline"
                        size={18}
                        color="#ef4444"
                      />
                    </TouchableOpacity>
                  </View>
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

    if (day >= closingDay)
      finalStartDate.setMonth(finalStartDate.getMonth() + 1);
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

            <View style={s.alertContainer}>
              <Ionicons name="information-circle" size={18} color="#1e40af" />
              <Text style={s.alertText}>
                Apenas cartões de crédito são exibidos aqui.
              </Text>
            </View>

            <Text style={[s.label, { color: colors.subText }]}>
              Selecione o Cartão
            </Text>
            <View style={{ flexDirection: "row", marginBottom: 16 }}>
              {accounts.map((acc: any) => (
                <TouchableOpacity
                  key={acc.id}
                  style={[
                    s.accBtn,
                    {
                      borderColor: colors.border,
                      backgroundColor: colors.inputBg,
                    },
                    accountId === acc.id && {
                      backgroundColor: colors.primary,
                      borderColor: colors.primary,
                    },
                  ]}
                  onPress={() => setAccountId(acc.id)}
                >
                  <Text
                    style={[
                      s.accBtnText,
                      { color: accountId === acc.id ? "#fff" : colors.text },
                    ]}
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
                  s.inputModal,
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
                    s.inputModal,
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
              O que comprou?
            </Text>
            <TextInput
              style={[
                s.inputModal,
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
                    s.inputModal,
                    {
                      backgroundColor: colors.inputBg,
                      color: colors.text,
                      borderColor: colors.border,
                    },
                  ]}
                  value={totalAmount}
                  onChangeText={setTotalAmount}
                  keyboardType="decimal-pad"
                  placeholderTextColor={colors.subText}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.label, { color: colors.subText }]}>
                  Nº de Parcelas
                </Text>
                <TextInput
                  style={[
                    s.inputModal,
                    {
                      backgroundColor: colors.inputBg,
                      color: colors.text,
                      borderColor: colors.border,
                    },
                  ]}
                  value={installmentsCount}
                  onChangeText={setInstallmentsCount}
                  keyboardType="decimal-pad"
                  placeholderTextColor={colors.subText}
                />
              </View>
            </View>

            <View style={{ flexDirection: "row", gap: 10, marginTop: 24 }}>
              <TouchableOpacity
                style={[
                  s.btn,
                  {
                    backgroundColor: colors.inputBg,
                    borderWidth: 1,
                    borderColor: colors.border,
                  },
                ]}
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
  container: { flex: 1 },
  headerContainer: { paddingHorizontal: 24, paddingTop: 10, paddingBottom: 20 },
  headerTitle: { fontSize: 28, fontWeight: "bold" },
  headerSubtitle: { fontSize: 14, marginTop: 4 },

  listContent: { paddingHorizontal: 20, paddingBottom: 120 },

  cardWrapper: { marginBottom: 20 },
  physicalCard: {
    borderRadius: 20,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  ccTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  ccChip: {
    width: 38,
    height: 26,
    backgroundColor: "#fcd34d",
    borderRadius: 6,
    justifyContent: "space-evenly",
    padding: 4,
  },
  ccChipLine: { height: 1.5, backgroundColor: "rgba(0,0,0,0.2)" },
  ccBankName: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 1,
  },
  ccAmountArea: { marginTop: 28 },
  ccAmountLabel: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 12,
    marginBottom: 4,
  },
  ccAmountValue: { color: "#fff", fontSize: 32, fontWeight: "bold" },
  ccBottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 20,
  },
  ccStatusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  ccStatusText: { color: "#fff", fontSize: 12, fontWeight: "bold" },

  expandedCard: {
    marginTop: -20,
    paddingTop: 36,
    borderRadius: 20,
    borderWidth: 1,
    borderTopWidth: 0,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  nextInvoiceBox: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
  },
  payBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 16,
    marginBottom: 16,
  },
  payBtnText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "bold",
    marginLeft: 8,
  },

  itemRow: { flexDirection: "row", alignItems: "center", paddingVertical: 16 },
  itemIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  itemInfo: { flex: 1, paddingRight: 8 },
  itemTitle: { fontSize: 15, fontWeight: "bold", marginBottom: 2 },
  itemSub: { fontSize: 13 },
  itemRight: { alignItems: "flex-end" },
  itemValue: { fontSize: 15, fontWeight: "bold" },
  itemActions: { flexDirection: "row", gap: 16, marginTop: 6 },

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

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalCard: {
    width: "100%",
    maxWidth: 400,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
  },
  modalTitle: { fontSize: 20, fontWeight: "bold", marginBottom: 8 },
  label: { fontSize: 13, fontWeight: "bold", marginBottom: 6, marginTop: 12 },
  inputModal: { padding: 14, borderRadius: 12, borderWidth: 1, fontSize: 16 },
  btn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: "center" },
  accBtn: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
  },
  accBtnText: { fontWeight: "600", fontSize: 13 },
  modeToggle: {
    flexDirection: "row",
    borderRadius: 10,
    padding: 4,
    marginBottom: 8,
  },
  modeBtn: { flex: 1, padding: 12, alignItems: "center", borderRadius: 8 },
  modeBtnActive: {},
  modeText: { fontWeight: "bold" },
  alertContainer: {
    flexDirection: "row",
    backgroundColor: "#dbeafe",
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    alignItems: "center",
    gap: 8,
  },
  alertText: { color: "#1e40af", fontSize: 12, fontWeight: "600", flex: 1 },
});
