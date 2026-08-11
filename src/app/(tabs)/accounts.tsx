import { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAccounts } from "@/hooks/useAccounts";
import { Ionicons } from "@expo/vector-icons";
import { transactionService, installmentService } from "@/services";
import {
  formatCurrency,
  formatDate,
  formatDateFull,
  getCurrentMonthRange,
  getCurrentMonthName,
} from "@/utils";
import type { Transaction, Installment, Account } from "@/types";
import { useInstallments } from "@/hooks/useInstallments";
import { TransactionForm } from "@/components/forms/TransactionForm";
import { useAppTheme } from "@/hooks/useTheme";

type Tab = "debito" | "credito" | "historico";
type Period = "day" | "week" | "month";

type PeriodRange = {
  from: string;
  to: string;
  label: string;
};

const PERIODS: {
  value: Period;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { value: "day", label: "Dia", icon: "today-outline" },
  { value: "week", label: "Semana", icon: "calendar-outline" },
  { value: "month", label: "Mes", icon: "calendar-number-outline" },
];

export default function AccountDetailScreen() {
  const { id, name, balance, currency, color } = useLocalSearchParams<{
    id: string;
    name: string;
    balance: string;
    currency: string;
    color: string;
  }>();
  const router = useRouter();
  const { colors, isDark } = useAppTheme();
  const [type, setType] = useState("checking");
  const isAllAccounts = id === "all";

  const [tab, setTab] = useState<Tab>("debito");
  const [newBankName, setNewBankName] = useState("");
  const [newBankColor, setNewBankColor] = useState("#830ad1");
  const [period, setPeriod] = useState<Period>("month");
  const [newBankType, setNewBankType] = useState<
    "checking" | "savings" | "credit" | "investment"
  >("checking");
  const [newBankBalance, setNewBankBalance] = useState("");
  const [dueDay, setDueDay] = useState("10");
  const [closingDay, setClosingDay] = useState("3");
  const [baseDate, setBaseDate] = useState(new Date());
  const [monthPickerVisible, setMonthPickerVisible] = useState(false);

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);

  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [editingInst, setEditingInst] = useState<Installment | null>(null);
  const [txModalVisible, setTxModalVisible] = useState(false);
  const [instModalVisible, setInstModalVisible] = useState(false);

  const { openModal } = useLocalSearchParams<{ openModal?: string }>();
  const { to } = getCurrentMonthRange();
  const {
    accounts,
    create: createAccount,
    update: updateAccount,
    remove: removeAccount,
  } = useAccounts();

  const [isEditing, setIsEditing] = useState(false);
  const currentAccount = accounts.find((a) => a.id === id);

  const handleOpenEdit = () => {
    if (isAllAccounts) return;
    const acc = accounts.find((a) => String(a.id) === String(id));

    setClosingDay(acc?.closing_day ? String(acc.closing_day) : "3");
    setNewBankName(acc?.name || name);
    setNewBankBalance(
      acc ? String(acc.balance) : String(parseFloat(balance || "0")),
    );
    setNewBankType((acc?.type as any) || "checking");
    setDueDay(acc?.due_day ? String(acc.due_day) : "10");
    setNewBankColor(acc?.color || color || "#6366f1");

    setIsEditing(true);
    setModalVisible(true);
  };

  const handleDelete = () => {
    if (isAllAccounts) return;
    const accName = currentAccount?.name || name;
    const msg = `Tem a certeza que deseja excluir ${accName}?`;

    if (Platform.OS === "web") {
      const ok = window.confirm(msg);
      if (ok) {
        removeAccount(id).then(() => router.replace("/"));
      }
    } else {
      Alert.alert("Excluir Conta", msg, [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Sim, Excluir",
          style: "destructive",
          onPress: async () => {
            await removeAccount(id);
            router.replace("/");
          },
        },
      ]);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  useEffect(() => {
    if (openModal === "1" && !isAllAccounts) {
      setModalVisible(true);
      router.setParams({ openModal: "" });
    }
  }, [openModal, isAllAccounts]);

  const loadData = async () => {
    setIsLoading(true);
    const txParams = isAllAccounts ? {} : { account_id: id };

    const [txResult, instResult] = await Promise.all([
      transactionService.list(txParams),
      installmentService.list(),
    ]);

    setTransactions(txResult.data ?? []);

    const allInst = instResult.data ?? [];
    setInstallments(
      isAllAccounts ? allInst : allInst.filter((i) => i.account_id === id),
    );
    setIsLoading(false);
  };

  const handleDeleteTx = (itemId: string) => {
    const confirmAction = async () => {
      const tx = transactions.find((t) => t.id === itemId);
      if (tx && tx.account_id) {
        const acc = accounts.find((a) => a.id === tx.account_id);
        if (acc) {
          const modifier = tx.type === "expense" ? tx.amount : -tx.amount;
          await updateAccount(acc.id, {
            balance: Number(acc.balance) + modifier,
          });
        }
      }
      await transactionService.remove(itemId);
      loadData();
    };

    if (Platform.OS === "web") {
      if (window.confirm("Deseja remover esta transação do banco de dados?"))
        confirmAction();
    } else {
      Alert.alert(
        "Remover",
        "Deseja remover esta transação do banco de dados?",
        [
          { text: "Cancelar", style: "cancel" },
          { text: "Remover", style: "destructive", onPress: confirmAction },
        ],
      );
    }
  };

  const handleUpdateTx = async (data: any) => {
    if (!editingTx) return;
    setIsLoading(true);

    const oldAcc = accounts.find((a) => a.id === editingTx.account_id);
    const newAcc = accounts.find((a) => a.id === data.account_id);

    await transactionService.update(editingTx.id, data);

    if (oldAcc && newAcc) {
      const revertModifier =
        editingTx.type === "expense" ? editingTx.amount : -editingTx.amount;
      const oldBalance = Number(oldAcc.balance) + revertModifier;

      if (oldAcc.id === newAcc.id) {
        const applyModifier =
          data.type === "expense" ? -data.amount : data.amount;
        await updateAccount(oldAcc.id, { balance: oldBalance + applyModifier });
      } else {
        await updateAccount(oldAcc.id, { balance: oldBalance });
        const applyModifier =
          data.type === "expense" ? -data.amount : data.amount;
        await updateAccount(newAcc.id, {
          balance: Number(newAcc.balance) + applyModifier,
        });
      }
    }

    setTxModalVisible(false);
    setEditingTx(null);
    loadData();
  };

  const handleDeleteInst = (itemId: string) => {
    const msg = "Deseja remover esta compra parcelada?";
    if (Platform.OS === "web") {
      if (window.confirm(msg)) {
        installmentService.remove(itemId).then(() => loadData());
      }
    } else {
      Alert.alert("Remover", msg, [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Remover",
          style: "destructive",
          onPress: async () => {
            await installmentService.remove(itemId);
            loadData();
          },
        },
      ]);
    }
  };

  const handleUpdateInst = async (data: any) => {
    if (!editingInst) return;
    setIsLoading(true);
    await installmentService.update(editingInst.id, data);
    setInstModalVisible(false);
    setEditingInst(null);
    loadData();
  };

  const periodRange = useMemo(
    () => getPeriodRange(period, baseDate),
    [period, baseDate],
  );

  const unifiedHistory = useMemo(() => {
    const txs = transactions
      .filter((t) => isDateInsideRange(t.date, periodRange))
      .map((t) => ({
        ...t,
        isCredit: false,
        displayDate: t.date,
      }));

    const insts = installments
      .map((i) => {
        const dateString = i.start_date
          ? i.start_date.split("T")[0]
          : i.created_at.split("T")[0];
        return {
          ...i,
          type: "expense",
          amount: i.installment_amount,
          isCredit: true,
          displayDate: dateString,
        };
      })
      .filter((i) => isDateInsideRange(i.displayDate, periodRange));

    return [...txs, ...insts].sort((a, b) =>
      b.displayDate.localeCompare(a.displayDate),
    );
  }, [transactions, installments, periodRange]);

  const historyTotals = unifiedHistory.reduce(
    (acc, item) => {
      if (item.type === "income") acc.income += item.amount;
      if (item.type === "expense") acc.expense += item.amount;
      return acc;
    },
    { income: 0, expense: 0 },
  );

  const { currentTotalIn, currentTotalOut } = useMemo(() => {
    if (tab === "debito") {
      const inc = transactions
        .filter((t) => t.type === "income")
        .reduce((sum, t) => sum + t.amount, 0);
      const exp = transactions
        .filter((t) => t.type === "expense")
        .reduce((sum, t) => sum + t.amount, 0);
      return { currentTotalIn: inc, currentTotalOut: exp };
    }
    if (tab === "credito") {
      // 👇 LÓGICA BLINDADA: Atualiza o calculador de despesas na aba de Crédito
      const currentMonthIso = new Date().toISOString().slice(0, 7);
      const pendingCurrent = installments.filter((item) => {
        if (item.paid_installments >= item.total_installments) return false;
        if (
          item.invoice?.status === "aberta" ||
          item.invoice?.status === "fechada"
        )
          return true;
        if (item.invoice?.status === "paga") return false;

        const dateStr = item.start_date
          ? item.start_date.split("T")[0]
          : item.created_at
            ? item.created_at.split("T")[0]
            : new Date().toISOString().split("T")[0];
        const [y, m] = dateStr.split("-").map(Number);
        const totalMonths = y * 12 + (m - 1) + item.paid_installments;
        const refY = Math.floor(totalMonths / 12);
        const refM = (totalMonths % 12) + 1;
        const itemRef = `${refY}-${String(refM).padStart(2, "0")}`;

        return itemRef <= currentMonthIso;
      });
      const exp = pendingCurrent.reduce(
        (sum, i) => sum + Number(i.installment_amount),
        0,
      );
      return { currentTotalIn: 0, currentTotalOut: exp };
    }
    return {
      currentTotalIn: historyTotals.income,
      currentTotalOut: historyTotals.expense,
    };
  }, [tab, transactions, installments, historyTotals, to]);

  const calculatedBalance = useMemo(() => {
    if (!isAllAccounts) return parseFloat(balance ?? "0") || 0;

    if (tab === "debito" || tab === "historico") {
      return currentTotalIn - currentTotalOut;
    }

    if (tab === "credito") {
      // 👇 LÓGICA BLINDADA: Garante o Saldo Global quando "Todas as Contas" é de crédito
      const currentMonthIso = new Date().toISOString().slice(0, 7);
      const pendingCurrent = installments.filter((item) => {
        if (item.paid_installments >= item.total_installments) return false;
        if (
          item.invoice?.status === "aberta" ||
          item.invoice?.status === "fechada"
        )
          return true;
        if (item.invoice?.status === "paga") return false;

        const dateStr = item.start_date
          ? item.start_date.split("T")[0]
          : item.created_at
            ? item.created_at.split("T")[0]
            : new Date().toISOString().split("T")[0];
        const [y, m] = dateStr.split("-").map(Number);
        const totalMonths = y * 12 + (m - 1) + item.paid_installments;
        const refY = Math.floor(totalMonths / 12);
        const refM = (totalMonths % 12) + 1;
        const itemRef = `${refY}-${String(refM).padStart(2, "0")}`;

        return itemRef <= currentMonthIso;
      });
      return pendingCurrent.reduce(
        (sum, i) => sum + Number(i.installment_amount),
        0,
      );
    }

    return 0;
  }, [
    isAllAccounts,
    balance,
    tab,
    currentTotalIn,
    currentTotalOut,
    installments,
    to,
  ]);

  const accountCurrency = currency ?? "BRL";
  const accountColor = isAllAccounts ? "#6366f1" : (color ?? "#6366f1");
  const displayName = isAllAccounts ? "Todas as Contas" : name;

  const monthNames = [
    "Jan",
    "Fev",
    "Mar",
    "Abr",
    "Mai",
    "Jun",
    "Jul",
    "Ago",
    "Set",
    "Out",
    "Nov",
    "Dez",
  ];

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: colors.bg }]}>
      <View style={[s.header, { backgroundColor: accountColor }]}>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 12,
          }}
        >
          <TouchableOpacity
            onPress={() => router.back()}
            style={{ flexDirection: "row", alignItems: "center", gap: 3 }}
          >
            <Ionicons
              name="chevron-back"
              size={18}
              color="rgba(255,255,255,0.86)"
            />
            <Text style={s.backText}>Voltar</Text>
          </TouchableOpacity>

          {!isAllAccounts && (
            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity
                onPress={handleOpenEdit}
                style={{
                  backgroundColor: "rgba(255,255,255,0.2)",
                  padding: 8,
                  borderRadius: 8,
                }}
              >
                <Ionicons name="pencil" size={18} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleDelete}
                style={{
                  backgroundColor: "rgba(255,0,0,0.4)",
                  padding: 8,
                  borderRadius: 8,
                }}
              >
                <Ionicons name="trash" size={18} color="#fee2e2" />
              </TouchableOpacity>
            </View>
          )}
        </View>

        <Text style={s.accountName}>{displayName}</Text>

        {(() => {
          if (isAllAccounts) {
            let subtitleText = "Saldo Geral";
            if (tab === "debito") subtitleText = "Saldo Restante (Débito)";
            if (tab === "credito")
              subtitleText = "Faturas Pendentes (Neste Mês)";

            return (
              <>
                <Text style={s.accountBalance}>
                  {formatCurrency(calculatedBalance, accountCurrency)}
                </Text>
                <Text
                  style={{
                    color: "rgba(255,255,255,0.78)",
                    fontSize: 13,
                    marginBottom: 16,
                    marginTop: -12,
                  }}
                >
                  {subtitleText}
                </Text>
              </>
            );
          }

          if (currentAccount?.type === "credit") {
            const currentMonthIso = new Date().toISOString().slice(0, 7);
            const currentMonthName = getCurrentMonthName();

            const allActive = installments.filter(
              (i) =>
                i.account_id === id &&
                i.paid_installments < i.total_installments,
            );

            const usedLimit = allActive.reduce(
              (sum, i) =>
                sum +
                (i.total_installments - i.paid_installments) *
                  i.installment_amount,
              0,
            );
            const totalLimit =
              currentAccount?.balance || parseFloat(balance || "0") || 0;
            const availableLimit = totalLimit - usedLimit;
            const limitPercentage =
              totalLimit > 0
                ? Math.min((usedLimit / totalLimit) * 100, 100)
                : 0;

            // 👇 LÓGICA BLINDADA: Valor que aparece bem grande no topo da conta
            const pendingCurrent = allActive.filter((item) => {
              if (
                item.invoice?.status === "aberta" ||
                item.invoice?.status === "fechada"
              )
                return true;
              if (item.invoice?.status === "paga") return false;

              const dateStr = item.start_date
                ? item.start_date.split("T")[0]
                : item.created_at
                  ? item.created_at.split("T")[0]
                  : new Date().toISOString().split("T")[0];
              const [y, m] = dateStr.split("-").map(Number);
              const totalMonths = y * 12 + (m - 1) + item.paid_installments;
              const refY = Math.floor(totalMonths / 12);
              const refM = (totalMonths % 12) + 1;
              const itemRef = `${refY}-${String(refM).padStart(2, "0")}`;

              return itemRef <= currentMonthIso;
            });

            let displayValue = 0;
            let subtitleLabel = "";
            let subtitleColor = "rgba(255,255,255,0.78)";

            if (pendingCurrent.length > 0) {
              displayValue = pendingCurrent.reduce(
                (sum, i) => sum + Number(i.installment_amount),
                0,
              );
              subtitleLabel = `Fatura de ${currentMonthName}`;
            } else {
              const nextMonthDate = new Date();
              nextMonthDate.setMonth(nextMonthDate.getMonth() + 1);
              const rawNextMonth = new Intl.DateTimeFormat("pt-BR", {
                month: "long",
              }).format(nextMonthDate);
              const nextMonthName =
                rawNextMonth.charAt(0).toUpperCase() + rawNextMonth.slice(1);
              const nextMonthEnd = new Date(
                nextMonthDate.getFullYear(),
                nextMonthDate.getMonth() + 1,
                0,
              )
                .toISOString()
                .split("T")[0];

              const nextInstallments = allActive.filter(
                (i) => !i.start_date || i.start_date <= nextMonthEnd,
              );

              displayValue = nextInstallments.reduce(
                (sum, i) => sum + Number(i.installment_amount),
                0,
              );
              subtitleLabel =
                displayValue > 0
                  ? `Fatura de ${nextMonthName}`
                  : "Nenhuma fatura pendente";
            }

            return (
              <>
                <Text style={s.accountBalance}>
                  {formatCurrency(displayValue, accountCurrency)}
                </Text>
                <Text
                  style={{
                    color: subtitleColor,
                    fontSize: 13,
                    marginBottom: 16,
                    marginTop: -12,
                  }}
                >
                  {subtitleLabel}
                </Text>

                <View style={{ marginBottom: 16 }}>
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      marginBottom: 6,
                    }}
                  >
                    <Text
                      style={{
                        color: "rgba(255,255,255,0.9)",
                        fontSize: 13,
                        fontWeight: "600",
                      }}
                    >
                      Limite: {formatCurrency(totalLimit, accountCurrency)}
                    </Text>
                    <Text
                      style={{
                        color: "rgba(255,255,255,0.9)",
                        fontSize: 13,
                        fontWeight: "600",
                      }}
                    >
                      Utilizado: {formatCurrency(usedLimit, accountCurrency)}
                    </Text>
                  </View>
                  <View
                    style={{
                      height: 6,
                      backgroundColor: "rgba(255,255,255,0.3)",
                      borderRadius: 3,
                      overflow: "hidden",
                    }}
                  >
                    <View
                      style={{
                        width: `${limitPercentage}%`,
                        height: "100%",
                        backgroundColor:
                          limitPercentage > 90 ? "#ef4444" : "#4ade80",
                      }}
                    />
                  </View>
                  <Text
                    style={{
                      color: "rgba(255,255,255,0.7)",
                      fontSize: 12,
                      marginTop: 4,
                      textAlign: "right",
                    }}
                  >
                    Disponível:{" "}
                    {formatCurrency(availableLimit, accountCurrency)}
                  </Text>
                </View>
              </>
            );
          }

          return (
            <>
              <Text style={s.accountBalance}>
                {formatCurrency(
                  parseFloat(balance ?? "0") || 0,
                  accountCurrency,
                )}
              </Text>
              <Text
                style={{
                  color: "rgba(255,255,255,0.78)",
                  fontSize: 13,
                  marginBottom: 16,
                  marginTop: -12,
                }}
              >
                Conta Corrente
              </Text>
            </>
          );
        })()}

        <View style={s.headerRow}>
          <View style={s.headerStat}>
            <View style={s.headerStatLabelRow}>
              <Ionicons name="arrow-up-circle" size={14} color="#bbf7d0" />
              <Text style={s.headerStatLabel}>Entradas</Text>
            </View>
            <Text style={s.headerStatValue}>
              {formatCurrency(currentTotalIn, accountCurrency)}
            </Text>
          </View>
          <View style={s.headerDivider} />
          <View style={s.headerStat}>
            <View style={s.headerStatLabelRow}>
              <Ionicons name="arrow-down-circle" size={14} color="#fecaca" />
              <Text style={s.headerStatLabel}>Saidas</Text>
            </View>
            <Text style={s.headerStatValue}>
              {formatCurrency(currentTotalOut, accountCurrency)}
            </Text>
          </View>
        </View>
      </View>

      <View
        style={[
          s.tabs,
          { backgroundColor: colors.card, borderBottomColor: colors.border },
        ]}
      >
        <TabButton
          active={tab === "debito"}
          label={`Debito`}
          icon="swap-vertical-outline"
          colors={colors}
          onPress={() => setTab("debito")}
        />
        <TabButton
          active={tab === "credito"}
          label={`Credito`}
          icon="card-outline"
          colors={colors}
          onPress={() => setTab("credito")}
        />
        <TabButton
          active={tab === "historico"}
          label="Historico"
          icon="time-outline"
          colors={colors}
          onPress={() => setTab("historico")}
        />
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 32 }} />
      ) : tab === "debito" ? (
        <FlatList
          data={transactions}
          keyExtractor={(t) => t.id}
          contentContainerStyle={s.list}
          ListEmptyComponent={
            <EmptyState
              text={
                isAllAccounts
                  ? "Nenhuma transação encontrada"
                  : "Nenhuma transação nesta conta"
              }
              colors={colors}
            />
          }
          renderItem={({ item }) => (
            <TransactionRow
              item={{ ...item, displayDate: item.date }}
              currency={accountCurrency}
              colors={colors}
              onEdit={() => {
                setEditingTx(item);
                setTxModalVisible(true);
              }}
              onDelete={() => handleDeleteTx(item.id)}
            />
          )}
        />
      ) : tab === "credito" ? (
        <FlatList
          data={installments}
          keyExtractor={(i) => i.id}
          contentContainerStyle={s.list}
          ListEmptyComponent={
            <EmptyState
              text={
                isAllAccounts
                  ? "Nenhuma compra parcelada encontrada"
                  : "Nenhuma compra parcelada nesta conta"
              }
              colors={colors}
            />
          }
          renderItem={({ item }) => (
            <InstallmentCard
              installment={item}
              currency={accountCurrency}
              colors={colors}
              onEdit={() => {
                setEditingInst(item);
                setInstModalVisible(true);
              }}
              onDelete={() => handleDeleteInst(item.id)}
            />
          )}
        />
      ) : (
        <FlatList
          data={unifiedHistory}
          keyExtractor={(t) => t.id + (t.isCredit ? "-C" : "-D")}
          contentContainerStyle={s.list}
          ListHeaderComponent={
            <HistoryHeader
              period={period}
              onChangePeriod={setPeriod}
              range={periodRange}
              income={historyTotals.income}
              expense={historyTotals.expense}
              currency={accountCurrency}
              colors={colors}
              onOpenMonthPicker={() => setMonthPickerVisible(true)}
            />
          }
          ListEmptyComponent={
            <EmptyState text="Nenhum movimento neste período" colors={colors} />
          }
          renderItem={({ item }) => (
            <TransactionRow
              item={item}
              currency={accountCurrency}
              colors={colors}
              onEdit={() => {
                if (item.isCredit) {
                  setEditingInst(item as any);
                  setInstModalVisible(true);
                } else {
                  setEditingTx(item as any);
                  setTxModalVisible(true);
                }
              }}
              onDelete={() => {
                if (item.isCredit) handleDeleteInst(item.id);
                else handleDeleteTx(item.id);
              }}
            />
          )}
        />
      )}

      {/* MODAL DO CALENDÁRIO */}
      <Modal
        visible={monthPickerVisible}
        transparent={true}
        animationType="fade"
      >
        <View style={s.modalOverlay}>
          <View style={[s.calendarContainer, { backgroundColor: colors.card }]}>
            <View style={s.calendarHeader}>
              <TouchableOpacity
                onPress={() =>
                  setBaseDate(
                    new Date(
                      baseDate.getFullYear() - 1,
                      baseDate.getMonth(),
                      1,
                    ),
                  )
                }
                style={{ padding: 10 }}
              >
                <Ionicons name="chevron-back" size={20} color={colors.text} />
              </TouchableOpacity>
              <Text style={[s.calendarMonthName, { color: colors.text }]}>
                {baseDate.getFullYear()}
              </Text>
              <TouchableOpacity
                onPress={() =>
                  setBaseDate(
                    new Date(
                      baseDate.getFullYear() + 1,
                      baseDate.getMonth(),
                      1,
                    ),
                  )
                }
                style={{ padding: 10 }}
              >
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={colors.text}
                />
              </TouchableOpacity>
            </View>
            <View style={s.monthGrid}>
              {monthNames.map((m, index) => {
                const isSelected = baseDate.getMonth() === index;
                return (
                  <TouchableOpacity
                    key={index}
                    style={[
                      s.monthItem,
                      { backgroundColor: colors.inputBg },
                      isSelected && [
                        s.monthItemSelected,
                        { backgroundColor: colors.primary },
                      ],
                    ]}
                    onPress={() => {
                      setBaseDate(new Date(baseDate.getFullYear(), index, 1));
                      setMonthPickerVisible(false);
                    }}
                  >
                    <Text
                      style={[
                        s.monthItemText,
                        { color: colors.text },
                        isSelected && { color: "#fff" },
                      ]}
                    >
                      {m}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <TouchableOpacity
              style={[s.closeCalendarBtn, { backgroundColor: colors.primary }]}
              onPress={() => setMonthPickerVisible(false)}
            >
              <Text style={{ color: "#fff", fontWeight: "bold" }}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL DE EDIÇÃO DE CONTA */}
      <Modal visible={modalVisible} animationType="slide" transparent={true}>
        <View style={s.modalOverlay}>
          <View style={[s.calendarContainer, { backgroundColor: colors.card }]}>
            <Text style={[s.calendarMonthName, { color: colors.text }]}>
              {isEditing ? "Editar Conta / Cartão" : "Nova Conta / Cartão"}
            </Text>

            <View style={{ marginTop: 16 }}>
              <Text
                style={{ fontSize: 13, color: colors.subText, marginBottom: 4 }}
              >
                Nome
              </Text>
              <TextInput
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.inputBg,
                  color: colors.text,
                  borderRadius: 8,
                  padding: 10,
                  marginBottom: 12,
                  fontSize: 16,
                }}
                placeholder="Ex: Nubank, Santander"
                placeholderTextColor={colors.subText}
                value={newBankName}
                onChangeText={setNewBankName}
              />

              <Text
                style={{ fontSize: 13, color: colors.subText, marginBottom: 4 }}
              >
                Saldo Inicial / Limite
              </Text>
              <TextInput
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.inputBg,
                  color: colors.text,
                  borderRadius: 8,
                  padding: 10,
                  marginBottom: 12,
                  fontSize: 16,
                }}
                placeholder="R$ 0,00"
                placeholderTextColor={colors.subText}
                keyboardType="decimal-pad"
                value={newBankBalance}
                onChangeText={setNewBankBalance}
              />
              <Text
                style={{ fontSize: 13, color: colors.subText, marginBottom: 4 }}
              >
                O que está a adicionar?
              </Text>
              <View style={{ flexDirection: "row", gap: 10, marginBottom: 12 }}>
                <View style={s.typeSelectorContainer}>
                  {/* Botão Conta Bancária */}
                  <TouchableOpacity
                    style={[
                      s.typeBtn,
                      {
                        backgroundColor: colors.inputBg,
                        borderColor: colors.border,
                      },
                      newBankType === "checking" && {
                        borderColor: colors.primary,
                        backgroundColor: colors.primary + "20",
                      },
                    ]}
                    onPress={() => setNewBankType("checking")}
                  >
                    <Text style={s.typeIcon}>🏦</Text>
                    <Text style={[s.typeText, { color: colors.text }]}>
                      Conta Bancária
                    </Text>
                    <Text style={[s.typeSubText, { color: colors.subText }]}>
                      (Tem Saldo Real)
                    </Text>
                  </TouchableOpacity>

                  {/* Botão Cartão de Crédito */}
                  <TouchableOpacity
                    style={[
                      s.typeBtn,
                      {
                        backgroundColor: colors.inputBg,
                        borderColor: colors.border,
                      },
                      newBankType === "credit" && {
                        borderColor: colors.primary,
                        backgroundColor: colors.primary + "20",
                      },
                    ]}
                    onPress={() => setNewBankType("credit")}
                  >
                    <Text style={s.typeIcon}>💳</Text>
                    <Text style={[s.typeText, { color: colors.text }]}>
                      Cartão de Crédito
                    </Text>
                    <Text style={[s.typeSubText, { color: colors.subText }]}>
                      (Gera Faturas)
                    </Text>
                  </TouchableOpacity>

                  {/* Botão Investimento */}
                  <TouchableOpacity
                    style={[
                      s.typeBtn,
                      {
                        backgroundColor: colors.inputBg,
                        borderColor: colors.border,
                      },
                      newBankType === "investment" && {
                        borderColor: colors.primary,
                        backgroundColor: colors.primary + "20",
                      },
                    ]}
                    onPress={() => setNewBankType("investment")}
                  >
                    <Text style={s.typeIcon}>📈</Text>
                    <Text style={[s.typeText, { color: colors.text }]}>
                      Investimento
                    </Text>
                    <Text style={[s.typeSubText, { color: colors.subText }]}>
                      (Rende Juros)
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {newBankType === "credit" && (
                <View
                  style={{ flexDirection: "row", gap: 10, marginBottom: 12 }}
                >
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: 13,
                        color: colors.subText,
                        marginBottom: 4,
                      }}
                    >
                      Dia de Fechamento
                    </Text>
                    <TextInput
                      style={{
                        borderWidth: 1,
                        borderColor: colors.border,
                        backgroundColor: colors.inputBg,
                        color: colors.text,
                        borderRadius: 8,
                        padding: 10,
                        fontSize: 16,
                      }}
                      value={closingDay}
                      onChangeText={(text) => {
                        const num = text.replace(/[^0-9]/g, "");
                        if (Number(num) <= 31) setClosingDay(num);
                      }}
                      keyboardType="decimal-pad"
                      maxLength={2}
                      placeholder="Ex: 3"
                      placeholderTextColor={colors.subText}
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: 13,
                        color: colors.subText,
                        marginBottom: 4,
                      }}
                    >
                      Dia de Vencimento
                    </Text>
                    <TextInput
                      style={{
                        borderWidth: 1,
                        borderColor: colors.border,
                        backgroundColor: colors.inputBg,
                        color: colors.text,
                        borderRadius: 8,
                        padding: 10,
                        fontSize: 16,
                      }}
                      value={dueDay}
                      onChangeText={(text) => {
                        const num = text.replace(/[^0-9]/g, "");
                        if (Number(num) <= 31) setDueDay(num);
                      }}
                      keyboardType="decimal-pad"
                      maxLength={2}
                      placeholder="Ex: 10"
                      placeholderTextColor={colors.subText}
                    />
                  </View>
                </View>
              )}

              <Text
                style={{ fontSize: 13, color: colors.subText, marginBottom: 6 }}
              >
                Cor de Identificação
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  gap: 10,
                  flexWrap: "wrap",
                  marginBottom: 16,
                }}
              >
                {[
                  "#6366f1",
                  "#14b8a6",
                  "#f97316",
                  "#ec4899",
                  "#8A05BE",
                  "#EC7000",
                  "#dc2626",
                  "#111827",
                ].map((corOpcao) => (
                  <TouchableOpacity
                    key={corOpcao}
                    onPress={() => setNewBankColor(corOpcao)}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      backgroundColor: corOpcao,
                      borderWidth: newBankColor === corOpcao ? 3 : 0,
                      borderColor: colors.text,
                    }}
                  />
                ))}
              </View>
            </View>

            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity
                style={[
                  s.closeCalendarBtn,
                  { flex: 1, backgroundColor: colors.border, marginTop: 0 },
                ]}
                onPress={() => {
                  setModalVisible(false);
                  setIsEditing(false);
                  setNewBankName("");
                  setNewBankBalance("");
                }}
              >
                <Text style={{ color: colors.text, fontWeight: "bold" }}>
                  Cancelar
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  s.closeCalendarBtn,
                  { flex: 1, backgroundColor: colors.primary, marginTop: 0 },
                ]}
                onPress={async () => {
                  if (!newBankName) return;
                  const payload = {
                    name: newBankName,
                    balance: parseFloat(newBankBalance.replace(",", ".")) || 0,
                    type: newBankType,
                    color: newBankColor,
                    currency: "BRL",
                    due_day:
                      newBankType === "credit" ? parseInt(dueDay, 10) : null,
                    closing_day:
                      newBankType === "credit"
                        ? parseInt(closingDay, 10)
                        : null,
                  };
                  if (isEditing) {
                    await updateAccount(id, payload);
                  } else {
                    await createAccount(payload);
                  }
                  setModalVisible(false);
                  setIsEditing(false);
                  setNewBankName("");
                  setNewBankBalance("");
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "bold" }}>
                  Salvar
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL DE EDIÇÃO DE TRANSAÇÃO */}
      <Modal
        visible={txModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView
          style={[s.modalFullScreen, { backgroundColor: colors.bg }]}
        >
          <View
            style={[
              s.modalHeaderFullScreen,
              {
                backgroundColor: colors.card,
                borderBottomColor: colors.border,
              },
            ]}
          >
            <Text style={[s.modalTitleFullScreen, { color: colors.text }]}>
              Editar Transação
            </Text>
            <TouchableOpacity
              onPress={() => {
                setTxModalVisible(false);
                setEditingTx(null);
              }}
            >
              <Text style={[s.modalCloseFullScreen, { color: colors.primary }]}>
                Fechar
              </Text>
            </TouchableOpacity>
          </View>
          <TransactionForm
            isLoading={isLoading}
            initialValues={editingTx ?? undefined}
            onSubmit={handleUpdateTx}
            onCancel={() => {
              setTxModalVisible(false);
              setEditingTx(null);
            }}
          />
        </SafeAreaView>
      </Modal>

      <InstallmentFormModal
        visible={instModalVisible}
        initialData={editingInst}
        accounts={accounts.filter((a) => a.type === "credit")}
        colors={colors}
        onClose={() => {
          setInstModalVisible(false);
          setEditingInst(null);
        }}
        onSave={handleUpdateInst}
      />
    </SafeAreaView>
  );
}

function TabButton({ active, label, icon, colors, onPress }: any) {
  return (
    <TouchableOpacity
      style={[
        s.tab,
        active && [s.tabActive, { borderBottomColor: colors.primary }],
      ]}
      onPress={onPress}
    >
      <Ionicons
        name={icon}
        size={16}
        color={active ? colors.primary : colors.subText}
      />
      <Text
        style={[
          s.tabText,
          { color: colors.subText },
          active && { color: colors.primary },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function HistoryHeader({
  period,
  onChangePeriod,
  range,
  income,
  expense,
  currency,
  colors,
  onOpenMonthPicker,
}: any) {
  return (
    <View style={s.historyHeader}>
      <View style={[s.periodRow, { backgroundColor: colors.card }]}>
        {PERIODS.map((item) => {
          const active = period === item.value;
          return (
            <TouchableOpacity
              key={item.value}
              style={[
                s.periodBtn,
                active && { backgroundColor: colors.primary },
              ]}
              onPress={() => onChangePeriod(item.value)}
            >
              <Ionicons
                name={item.icon}
                size={15}
                color={active ? "#fff" : colors.subText}
              />
              <Text
                style={[
                  s.periodText,
                  { color: colors.subText },
                  active && s.periodTextActive,
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <TouchableOpacity
        style={[
          s.rangePickerBtn,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
        onPress={period === "month" ? onOpenMonthPicker : undefined}
        disabled={period !== "month"}
      >
        <Text style={[s.historyRange, { color: colors.text }]}>
          {range.label}
        </Text>
        {period === "month" && (
          <Ionicons name="calendar" size={16} color={colors.subText} />
        )}
      </TouchableOpacity>

      <View style={s.historyCards}>
        <View
          style={[
            s.historyCard,
            { backgroundColor: colors.card, borderLeftColor: "#16a34a" },
          ]}
        >
          <Text style={[s.historyCardLabel, { color: colors.subText }]}>
            Recebido
          </Text>
          <Text style={[s.historyCardValue, { color: "#16a34a" }]}>
            {formatCurrency(income, currency)}
          </Text>
        </View>
        <View
          style={[
            s.historyCard,
            { backgroundColor: colors.card, borderLeftColor: "#dc2626" },
          ]}
        >
          <Text style={[s.historyCardLabel, { color: colors.subText }]}>
            Gasto
          </Text>
          <Text style={[s.historyCardValue, { color: "#dc2626" }]}>
            {formatCurrency(expense, currency)}
          </Text>
        </View>
      </View>

      <View style={[s.netCard, { backgroundColor: colors.card }]}>
        <Text style={[s.netLabel, { color: colors.subText }]}>
          Resultado do periodo
        </Text>
        <Text
          style={[
            s.netValue,
            { color: income - expense >= 0 ? "#16a34a" : "#dc2626" },
          ]}
        >
          {formatCurrency(income - expense, currency)}
        </Text>
      </View>
    </View>
  );
}

function TransactionRow({ item, currency, colors, onEdit, onDelete }: any) {
  const isIncome = item.type === "income";
  const color = isIncome ? "#16a34a" : "#dc2626";

  let subtitle = "";
  if (item.isCredit) {
    subtitle = `Crédito · Parcela ${item.paid_installments + 1}/${item.total_installments}\nData prog.: ${formatDate(item.displayDate)}`;
  } else {
    const catName = item.category?.name ?? "Sem categoria";
    const payType = isIncome ? "Entrada" : "Compra no débito";
    subtitle = `${catName} (${payType})\nData: ${formatDate(item.displayDate)}`;
  }

  return (
    <View style={[s.item, { backgroundColor: colors.card }]}>
      <View style={[s.itemIcon, { backgroundColor: `${color}18` }]}>
        <Ionicons
          name={isIncome ? "arrow-up" : "arrow-down"}
          size={20}
          color={color}
        />
      </View>
      <View style={s.itemInfo}>
        <Text style={[s.itemTitle, { color: colors.text }]}>{item.title}</Text>
        <Text
          style={[
            s.itemSub,
            { color: colors.subText, marginTop: 4, lineHeight: 16 },
          ]}
        >
          {subtitle}
        </Text>
      </View>

      <View style={{ alignItems: "flex-end" }}>
        <Text style={[s.itemAmount, { color }]}>
          {isIncome ? "+" : "-"}
          {formatCurrency(item.amount, currency)}
        </Text>
        {onEdit && onDelete && (
          <View style={{ flexDirection: "row", gap: 12, marginTop: 6 }}>
            <TouchableOpacity onPress={onEdit} style={{ padding: 4 }}>
              <Ionicons name="pencil" size={16} color={colors.subText} />
            </TouchableOpacity>
            <TouchableOpacity onPress={onDelete} style={{ padding: 4 }}>
              <Ionicons name="trash" size={16} color="#dc2626" />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

function InstallmentCard({
  installment: i,
  currency,
  colors,
  onEdit,
  onDelete,
}: any) {
  const dateString = i.start_date
    ? i.start_date.split("T")[0]
    : i.created_at.split("T")[0];
  const [year, month, day] = dateString.split("-");
  const dateObj = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));

  const mesFatura = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
  }).format(dateObj);

  const remainingCount = i.total_installments - i.paid_installments;
  const remainingAmount = remainingCount * i.installment_amount;

  return (
    <View
      style={[
        s.installCard,
        {
          backgroundColor: colors.card,
          flexDirection: "row",
          justifyContent: "space-between",
        },
      ]}
    >
      <View style={{ flex: 1, paddingRight: 10 }}>
        <Text style={[s.itemTitle, { color: colors.text }]}>{i.title}</Text>
        <Text style={[s.itemSub, { color: colors.subText, marginTop: 4 }]}>
          Mês da fatura:{" "}
          <Text
            style={{
              fontWeight: "700",
              textTransform: "capitalize",
              color: colors.primary,
            }}
          >
            {mesFatura}
          </Text>
        </Text>
        <Text style={[s.itemSub, { color: colors.subText }]}>
          Progresso: Parcela {i.paid_installments + 1} de {i.total_installments}
        </Text>
        {remainingCount > 0 && (
          <Text
            style={[
              s.itemSub,
              { color: colors.primary, fontWeight: "600", marginTop: 2 },
            ]}
          >
            Restam {remainingCount} parcelas (Total:{" "}
            {formatCurrency(remainingAmount, currency)})
          </Text>
        )}
      </View>

      <View style={{ alignItems: "flex-end", justifyContent: "center" }}>
        <Text style={[s.itemAmount, { color: colors.text }]}>
          {formatCurrency(i.installment_amount, currency)}
        </Text>
        <Text style={{ fontSize: 11, color: colors.subText, marginTop: 4 }}>
          Total: {formatCurrency(i.total_amount, currency)}
        </Text>
        {onEdit && onDelete && (
          <View style={{ flexDirection: "row", gap: 12, marginTop: 8 }}>
            <TouchableOpacity onPress={onEdit} style={{ padding: 4 }}>
              <Ionicons name="pencil" size={16} color={colors.subText} />
            </TouchableOpacity>
            <TouchableOpacity onPress={onDelete} style={{ padding: 4 }}>
              <Ionicons name="trash" size={16} color="#dc2626" />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

function EmptyState({ text, colors }: { text: string; colors: any }) {
  return (
    <View style={s.empty}>
      <Text style={[s.emptyText, { color: colors.subText }]}>{text}</Text>
    </View>
  );
}

function getPeriodRange(period: Period, baseDate: Date): PeriodRange {
  const start = new Date(baseDate);
  const end = new Date(baseDate);

  if (period === "day") {
    return {
      from: toDateKey(start),
      to: toDateKey(end),
      label: formatDateFull(toDateKey(baseDate)),
    };
  }
  if (period === "week") {
    const day = baseDate.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    start.setDate(baseDate.getDate() + diffToMonday);
    end.setDate(start.getDate() + 6);
    return {
      from: toDateKey(start),
      to: toDateKey(end),
      label: `${formatDate(start.toISOString())} ate ${formatDate(end.toISOString())}`,
    };
  }
  start.setDate(1);
  end.setMonth(baseDate.getMonth() + 1, 0);
  return {
    from: toDateKey(start),
    to: toDateKey(end),
    label: new Intl.DateTimeFormat("pt-BR", {
      month: "long",
      year: "numeric",
    }).format(baseDate),
  };
}

function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
function isDateInsideRange(date: string, range: PeriodRange) {
  const key = date.split("T")[0];
  return key >= range.from && key <= range.to;
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
          <View
            style={[
              s.calendarContainer,
              { backgroundColor: colors.card, width: "90%" },
            ]}
          >
            <Text
              style={[
                s.calendarMonthName,
                { color: colors.text, marginBottom: 16 },
              ]}
            >
              {initialData ? "Editar Compra" : "Nova Compra Parcelada"}
            </Text>

            <View style={s.alertContainer}>
              <Ionicons name="information-circle" size={18} color="#1e40af" />
              <Text style={s.alertText}>
                Apenas cartões de crédito são exibidos aqui.
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
                Nenhum cartão cadastrado.
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
                        borderColor: colors.border,
                        backgroundColor: colors.inputBg,
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
                    s.inputModal,
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
                    s.inputModal,
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
                Fatura já fechou? (Lançar no próximo mês)
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
  header: { padding: 20, paddingTop: 12, paddingBottom: 24 },
  backText: {
    color: "rgba(255,255,255,0.86)",
    fontSize: 14,
    fontWeight: "600",
  },
  accountName: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 4,
  },
  accountBalance: {
    color: "#fff",
    fontSize: 32,
    fontWeight: "bold",
    marginBottom: 16,
  },
  headerRow: { flexDirection: "row" },
  headerStat: { flex: 1 },
  headerStatLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 2,
  },
  headerStatLabel: { color: "rgba(255,255,255,0.78)", fontSize: 12 },
  headerStatValue: { color: "#fff", fontSize: 15, fontWeight: "700" },
  headerDivider: {
    width: 1,
    backgroundColor: "rgba(255,255,255,0.3)",
    marginHorizontal: 16,
  },
  tabs: {
    flexDirection: "row",
    borderBottomWidth: 1,
  },
  tab: { flex: 1, paddingVertical: 12, alignItems: "center", gap: 3 },
  tabActive: { borderBottomWidth: 2 },
  tabText: { fontSize: 12, fontWeight: "700" },
  list: { padding: 16, paddingBottom: 32 },
  item: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  itemIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  itemInfo: { flex: 1 },
  itemTitle: { fontSize: 14, fontWeight: "600" },
  itemSub: { fontSize: 12, marginTop: 2 },
  itemAmount: { fontSize: 14, fontWeight: "700" },
  installCard: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  historyHeader: { marginBottom: 12 },
  periodRow: {
    flexDirection: "row",
    borderRadius: 12,
    padding: 4,
    marginBottom: 12,
  },
  periodBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 9,
    borderRadius: 9,
  },
  periodText: { fontSize: 12, fontWeight: "700" },
  periodTextActive: { color: "#fff" },

  rangePickerBtn: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 10,
    justifyContent: "space-between",
  },
  historyRange: {
    fontSize: 14,
    fontWeight: "600",
    textTransform: "capitalize",
  },

  historyCards: { flexDirection: "row", gap: 10, marginBottom: 10 },
  historyCard: {
    flex: 1,
    borderRadius: 12,
    padding: 12,
    borderLeftWidth: 4,
  },
  historyCardLabel: { fontSize: 12, fontWeight: "600" },
  historyCardValue: { fontSize: 15, fontWeight: "800", marginTop: 4 },
  netCard: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  netLabel: { fontSize: 13, fontWeight: "600" },
  netValue: { fontSize: 16, fontWeight: "800" },
  empty: { alignItems: "center", paddingVertical: 56, gap: 8 },
  emptyText: { fontSize: 14, textAlign: "center" },

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
  calendarMonthName: { fontSize: 18, fontWeight: "bold" },
  monthGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    justifyContent: "center",
  },
  monthItem: {
    width: "30%",
    paddingVertical: 15,
    alignItems: "center",
    borderRadius: 8,
  },
  monthItemSelected: {},
  monthItemText: { fontWeight: "600" },
  closeCalendarBtn: {
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 24,
  },

  modalFullScreen: { flex: 1 },
  modalHeaderFullScreen: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  modalTitleFullScreen: { fontSize: 18, fontWeight: "bold" },
  modalCloseFullScreen: { fontWeight: "600" },

  label: {
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 6,
  },
  inputModal: {
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
  alertText: { color: "#1e40af", fontSize: 12, fontWeight: "600", flex: 1 },
  typeSelectorContainer: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 20,
  },
  typeBtn: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#30363d",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#161b22",
  },
  typeBtnActive: {
    borderColor: "#3b30ff",
    backgroundColor: "rgba(59, 48, 255, 0.15)",
  },
  typeIcon: {
    fontSize: 20,
    marginBottom: 6,
  },
  typeText: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 2,
    textAlign: "center",
  },
  typeSubText: {
    fontSize: 9,
    color: "#9ca3af",
    textAlign: "center",
  },
});
