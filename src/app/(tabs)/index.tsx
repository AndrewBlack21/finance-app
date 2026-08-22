import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  useWindowDimensions,
  FlatList,
  RefreshControl,
  Modal,
  Platform,
  Alert,
  TextInput,
} from "react-native";
import React, {
  useState,
  useRef,
  useCallback,
  useMemo,
  useEffect,
} from "react";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { PieChart } from "react-native-gifted-charts";
import { useAuth } from "@/hooks/useAuth";
import { useTransactions } from "@/hooks/useTransactions";
import { useAccounts } from "@/hooks/useAccounts";
import { useInstallments } from "@/hooks/useInstallments";
import { useFixedExpenses } from "@/hooks/useFixedExpenses";
import { useBudgetGoals } from "@/hooks/useBudgetGoals";
import { formatCurrency, formatDate } from "@/utils";
import type { Installment, Transaction, FixedExpense } from "@/types";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "@/hooks/useTheme";

const globalIgnoredBills = new Set<string>();

export default function DashboardScreen() {
  const { profile, session, logout } = useAuth();
  const router = useRouter();
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();

  const [balanceView, setBalanceView] = useState<"month" | "week">("month");
  const [refreshing, setRefreshing] = useState(false);
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [monthOffset, setMonthOffset] = useState(0);
  const [showMonthPicker, setShowMonthPicker] = useState(false);

  // 👇 A variável de estado do modal de ajuda já existia
  const [showHelpModal, setShowHelpModal] = useState(false);

  const [ignoredBills, setIgnoredBills] =
    useState<Set<string>>(globalIgnoredBills);

  const {
    totalBudget,
    globalGoal,
    upsert,
    refetch: refetchGoals,
  } = useBudgetGoals();
  const [showGlobalModal, setShowGlobalModal] = useState(false);
  const [globalInput, setGlobalInput] = useState("");

  const [showPouparModal, setShowPouparModal] = useState(false);
  const [pouparInput, setPouparInput] = useState("");
  const [metaPoupanca, setMetaPoupanca] = useState(2500);

  const getMonthRange = (offset: number) => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() + offset);
    const y = d.getFullYear(),
      m = d.getMonth();
    return {
      from: new Date(y, m, 1).toISOString().split("T")[0],
      to: new Date(y, m + 1, 0).toISOString().split("T")[0],
      label: d
        .toLocaleString("pt-BR", { month: "short" })
        .toUpperCase()
        .replace(".", ""),
      fullLabel: d.toLocaleString("pt-BR", { month: "long", year: "numeric" }),
    };
  };

  const {
    from,
    to,
    label: dynMonthLabel,
    fullLabel,
  } = getMonthRange(monthOffset);
  const { accounts, totalBalance, refetch: refetchAccounts } = useAccounts();

  const checkingAccounts = accounts.filter((acc) => acc.type === "checking");
  const investmentAccounts = accounts.filter(
    (acc) => acc.type === "investment",
  );

  const totalInvestido = useMemo(() => {
    return investmentAccounts.reduce(
      (sum, acc) => sum + (Number(acc.balance) || 0),
      0,
    );
  }, [investmentAccounts]);

  const checkingBalance = useMemo(() => {
    return checkingAccounts.reduce(
      (sum, acc) => sum + (Number(acc.balance) || 0),
      0,
    );
  }, [checkingAccounts]);

  const { installments, refetch: refetchInstallments } = useInstallments();
  const {
    expenses: fixedExpenses,
    refetch: refetchFixed,
    markAsPaid,
  } = useFixedExpenses();

  const {
    transactions,
    isLoading,
    isLoadingMore,
    hasMore,
    fetchMore,
    refetch: refetchTransactions,
    setFilters,
  } = useTransactions({ date_from: from, date_to: to });

  useEffect(() => {
    setFilters({ date_from: from, date_to: to });
  }, [from, to, setFilters]);

  useEffect(() => {
    if (hasMore && !isLoading && !isLoadingMore && fetchMore) fetchMore();
  }, [hasMore, isLoading, isLoadingMore, fetchMore]);

  const onRefresh = async () => {
    setRefreshing(true);
    if (refetchAccounts) await refetchAccounts();
    if (refetchInstallments) await refetchInstallments();
    if (refetchTransactions) await refetchTransactions();
    if (refetchFixed) await refetchFixed();
    setRefreshing(false);
  };

  useFocusEffect(
    useCallback(() => {
      if (!session?.user?.id) return;
      if (refetchAccounts) refetchAccounts();
      if (refetchInstallments) refetchInstallments();
      if (refetchTransactions) refetchTransactions();
      if (refetchFixed) refetchFixed();
      if (refetchGoals) refetchGoals();
    }, [session?.user?.id]),
  );

  const firstName = profile?.name?.split(" ")[0] ?? "Usuário";
  const currency = profile?.currency ?? "BRL";
  const expenses = transactions.filter((t) => t.type === "expense");

  const upcomingBills = useMemo(() => {
    const todayDay = new Date().getDate();
    return fixedExpenses.filter((f) => {
      if (f.is_paid || ignoredBills.has(f.id)) return false;
      const diff = f.due_day - todayDay;
      return diff >= 0 && diff <= 3;
    });
  }, [fixedExpenses, ignoredBills]);

  const handleIgnoreUpcoming = (id: string) => {
    globalIgnoredBills.add(id);
    setIgnoredBills(new Set(globalIgnoredBills));
  };

  const handlePayUpcoming = async (expense: FixedExpense) => {
    const confirmAction = async () => {
      globalIgnoredBills.add(expense.id);
      setIgnoredBills(new Set(globalIgnoredBills));
      const { error } = await markAsPaid(expense);
      if (error) {
        globalIgnoredBills.delete(expense.id);
        setIgnoredBills(new Set(globalIgnoredBills));
        Alert.alert("Erro", error);
      } else {
        if (refetchFixed) refetchFixed();
        if (refetchAccounts) refetchAccounts();
        if (refetchTransactions) refetchTransactions();
      }
    };
    if (Platform.OS === "web") {
      if (window.confirm(`Confirmar pagamento de ${expense.title}?`))
        confirmAction();
    } else {
      Alert.alert("Pagar conta", `Confirmar pagamento de ${expense.title}?`, [
        { text: "Cancelar", style: "cancel" },
        { text: "Confirmar", onPress: confirmAction },
      ]);
    }
  };

  const totals = useMemo(() => {
    let monthIncome = 0;
    let monthExpense = 0;
    const checkingAccIds = new Set(checkingAccounts.map((a) => a.id));
    const creditAccIds = new Set(
      accounts.filter((a) => a.type === "credit").map((a) => a.id),
    );

    transactions.forEach((t) => {
      const amt = Number(t.amount) || 0;
      if (t.type === "income") {
        if (!t.account_id || !creditAccIds.has(t.account_id))
          monthIncome += amt;
      } else {
        if (t.account_id && checkingAccIds.has(t.account_id))
          monthExpense += amt;
      }
    });

    fixedExpenses.forEach((f) => {
      const amt = Number(f.amount) || 0;
      if (f.account_id && checkingAccIds.has(f.account_id)) monthExpense += amt;
    });
    return { monthIncome, monthExpense };
  }, [transactions, fixedExpenses, checkingAccounts, accounts, to]);

  const { budgetSpent } = useMemo(() => {
    let spent = 0;
    expenses.forEach((t) => (spent += Number(t.amount) || 0));
    return { budgetSpent: spent };
  }, [expenses]);

  const budgetPercentage =
    totalBudget > 0 ? (budgetSpent / totalBudget) * 100 : 0;
  const valorPoupado = Math.max(0, totals.monthIncome - totals.monthExpense);
  const percentagemPoupada =
    metaPoupanca > 0 ? (valorPoupado / metaPoupanca) * 100 : 0;

  const creditCardsStatus = useMemo(() => {
    const currentMonthRef = from.slice(0, 7);
    const today = new Date().toISOString().split("T")[0];
    const creditAccounts = accounts.filter((acc) => acc.type === "credit");

    return creditAccounts.map((acc) => {
      const accInstallments = installments.filter(
        (i) => i.account_id === acc.id,
      );
      const allActive = accInstallments.filter(
        (i) => Number(i.paid_installments) < Number(i.total_installments),
      );

      const paymentTx = transactions.find(
        (t) =>
          t.type === "expense" &&
          t.title?.toLowerCase().includes("fatura") &&
          t.title?.toLowerCase().includes(acc.name.toLowerCase()) &&
          t.date >= from &&
          t.date <= to,
      );

      const pendingCurrent = allActive.filter((item) => {
        if (
          item.invoice?.status === "aberta" ||
          item.invoice?.status === "fechada"
        )
          return true;
        if (item.invoice?.status === "paga") return false;

        const paidInst = Number(item.paid_installments) || 0;
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

        return itemRef <= currentMonthRef;
      });

      const currentInvoice =
        pendingCurrent.find((i) => i.invoice)?.invoice ?? null;

      const hasPaidInvoice = accInstallments.some(
        (i) =>
          i.invoice?.status === "paga" &&
          i.invoice?.reference === currentMonthRef,
      );
      const isInvoicePaid =
        Boolean(paymentTx) ||
        hasPaidInvoice ||
        (pendingCurrent.length === 0 && accInstallments.length > 0);

      let invoiceTotal = 0;
      if (paymentTx) {
        invoiceTotal = Number(paymentTx.amount) || 0;
      } else if (hasPaidInvoice) {
        const paidInv = accInstallments.find(
          (i) =>
            i.invoice?.status === "paga" &&
            i.invoice?.reference === currentMonthRef,
        )?.invoice;
        invoiceTotal =
          Number(paidInv?.paid_amount) ||
          pendingCurrent.reduce(
            (sum, i) => sum + (Number(i.installment_amount) || 0),
            0,
          );
      } else {
        invoiceTotal = pendingCurrent.reduce(
          (sum, i) => sum + (Number(i.installment_amount) || 0),
          0,
        );
      }

      const usedLimit = allActive.reduce(
        (sum, i) =>
          sum +
          (Number(i.total_installments) - Number(i.paid_installments)) *
            (Number(i.installment_amount) || 0),
        0,
      );
      const totalLimit = Number(acc.balance) || 0;
      const limitPercentage =
        totalLimit > 0 ? Math.min((usedLimit / totalLimit) * 100, 100) : 0;

      let statusColor = "#facc15";
      let statusLabel = "Pendente";

      if (isInvoicePaid || (!currentInvoice && allActive.length === 0)) {
        statusColor = "#4ade80";
        statusLabel = "Pago";
      } else if (currentInvoice) {
        if (
          currentInvoice.status === "fechada" &&
          today > currentInvoice.due_date
        ) {
          statusColor = "#ef4444";
          statusLabel = "Vencido";
        } else if (currentInvoice.status === "fechada") {
          statusColor = "#facc15";
          statusLabel = "Fechada";
        }
      }

      return {
        id: acc.id,
        currency: acc.currency,
        balance: String(acc.balance),
        label: acc.name,
        color: acc.color || "#6366f1",
        value: invoiceTotal,
        statusColor,
        statusLabel,
        usedLimit,
        totalLimit,
        limitPercentage,
      };
    });
  }, [accounts, installments, transactions, from, to]);

  const recentTransactions = [...transactions]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 4);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        <View
          style={[
            s.superHeader,
            {
              backgroundColor: colors.primary,
              paddingTop: Math.max(insets.top, 20) + 10,
            },
          ]}
        >
          <View style={s.headerTopRow}>
            <View style={s.headerProfile}>
              <View style={s.profileAvatar}>
                <Text style={s.profileInitials}>
                  {firstName.substring(0, 2).toUpperCase()}
                </Text>
              </View>
              <View>
                <Text style={s.greetingText}>Bom dia!</Text>
                <Text style={s.nameText}>{profile?.name || "Usuário"}</Text>
              </View>
            </View>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <TouchableOpacity
                onPress={() => setShowMonthPicker(true)}
                style={s.headerIconBtn}
              >
                <Text
                  style={{ color: "#fff", fontSize: 12, fontWeight: "bold" }}
                >
                  {dynMonthLabel}
                </Text>
                <Ionicons name="chevron-down" size={14} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setIsMenuVisible(true)}
                style={s.headerIconBtn}
              >
                <Ionicons name="menu" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={s.balanceArea}>
            <Text style={s.balanceLabel}>Saldo Disponível</Text>
            <Text style={s.balanceValue}>
              {formatCurrency(checkingBalance, currency)}
            </Text>
            <Text style={s.balanceMonthLabel}>
              {fullLabel.charAt(0).toUpperCase() + fullLabel.slice(1)}
            </Text>
          </View>

          <View style={s.incomesExpensesRow}>
            <View style={s.ieBox}>
              <View
                style={[s.ieIcon, { backgroundColor: "rgba(255,255,255,0.2)" }]}
              >
                <Ionicons name="arrow-down" size={16} color="#fff" />
              </View>
              <View>
                <Text style={s.ieLabel}>Receitas</Text>
                <Text style={s.ieValue}>
                  {formatCurrency(totals.monthIncome, currency)}
                </Text>
              </View>
            </View>
            <View style={s.ieBox}>
              <View
                style={[s.ieIcon, { backgroundColor: "rgba(255,255,255,0.2)" }]}
              >
                <Ionicons name="arrow-up" size={16} color="#fff" />
              </View>
              <View>
                <Text style={s.ieLabel}>Despesas</Text>
                <Text style={s.ieValue}>
                  {formatCurrency(totals.monthExpense, currency)}
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View style={s.quickActionsRow}>
          <TouchableOpacity
            style={s.actionBtn}
            onPress={() => router.push("/(tabs)/accounts?openModal=1")}
          >
            <View
              style={[
                s.actionIconBox,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <Ionicons name="add" size={24} color={colors.primary} />
            </View>
            <Text style={[s.actionLabel, { color: colors.subText }]}>
              Adicionar
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={s.actionBtn}
            onPress={() =>
              router.push({
                pathname: "/(tabs)/accounts",
                params: {
                  id: "all",
                  name: "Todas as Contas",
                  color: colors.primary,
                },
              })
            }
          >
            <View
              style={[
                s.actionIconBox,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <Ionicons name="wallet-outline" size={20} color={colors.text} />
            </View>
            <Text style={[s.actionLabel, { color: colors.subText }]}>
              Contas
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={s.actionBtn}
            onPress={() => router.push("/(tabs)/credit")}
          >
            <View
              style={[
                s.actionIconBox,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <Ionicons name="card-outline" size={20} color={colors.text} />
            </View>
            <Text style={[s.actionLabel, { color: colors.subText }]}>
              Cartões
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={s.actionBtn}
            onPress={() => router.push("/(tabs)/charts")}
          >
            <View
              style={[
                s.actionIconBox,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <Ionicons
                name="pie-chart-outline"
                size={20}
                color={colors.text}
              />
            </View>
            <Text style={[s.actionLabel, { color: colors.subText }]}>
              Relatório
            </Text>
          </TouchableOpacity>
        </View>

        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={[s.sectionTitle, { color: colors.text }]}>
              Minhas Contas
            </Text>
            <TouchableOpacity
              onPress={() =>
                router.push({
                  pathname: "/(tabs)/accounts",
                  params: {
                    id: "all",
                    name: "Todas as Contas",
                    color: colors.primary,
                  },
                })
              }
            >
              <Text style={[s.seeAll, { color: colors.primary }]}>
                Ver todas &gt;
              </Text>
            </TouchableOpacity>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 20 }}
          >
            {checkingAccounts.map((account) => (
              <TouchableOpacity
                key={account.id}
                activeOpacity={0.9}
                style={[
                  s.accountCardModern,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
                onPress={() =>
                  router.push({
                    pathname: "/(tabs)/accounts",
                    params: {
                      id: account.id,
                      name: account.name,
                      balance: String(account.balance),
                      currency: account.currency,
                      color: account.color,
                    },
                  })
                }
              >
                <View
                  style={[
                    s.accountCardIconBox,
                    {
                      backgroundColor: (account.color || colors.primary) + "20",
                    },
                  ]}
                >
                  <Ionicons
                    name="wallet"
                    size={20}
                    color={account.color || colors.primary}
                  />
                </View>
                <Text
                  style={[s.accountCardName, { color: colors.text }]}
                  numberOfLines={1}
                >
                  {account.name}
                </Text>
                <Text style={[s.accountCardBalance, { color: colors.text }]}>
                  {formatCurrency(account.balance, account.currency)}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              activeOpacity={0.7}
              style={[
                s.addAccountCardModern,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
              onPress={() => router.push("/(tabs)/accounts?openModal=1")}
            >
              <View
                style={[
                  s.accountCardIconBox,
                  { backgroundColor: colors.inputBg },
                ]}
              >
                <Ionicons name="add" size={20} color={colors.subText} />
              </View>
              <Text style={[s.addAccountTextModern, { color: colors.subText }]}>
                Nova Conta
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {investmentAccounts.length > 0 && (
          <View style={s.section}>
            <View style={s.sectionHeader}>
              <Text style={[s.sectionTitle, { color: colors.text }]}>
                Meus Investimentos
              </Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 20 }}
            >
              {investmentAccounts.map((account) => (
                <TouchableOpacity
                  key={account.id}
                  activeOpacity={0.9}
                  style={[
                    s.accountCardModern,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                    },
                  ]}
                  onPress={() =>
                    router.push({
                      pathname: "/(tabs)/accounts",
                      params: {
                        id: account.id,
                        name: account.name,
                        balance: String(account.balance),
                        currency: account.currency,
                        color: account.color,
                      },
                    })
                  }
                >
                  <View
                    style={[
                      s.accountCardIconBox,
                      {
                        backgroundColor: (account.color || "#8b5cf6") + "20",
                      },
                    ]}
                  >
                    <Ionicons
                      name="trending-up"
                      size={20}
                      color={account.color || "#8b5cf6"}
                    />
                  </View>
                  <Text
                    style={[s.accountCardName, { color: colors.text }]}
                    numberOfLines={1}
                  >
                    {account.name}
                  </Text>
                  <Text style={[s.accountCardBalance, { color: colors.text }]}>
                    {formatCurrency(account.balance, account.currency)}
                  </Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                activeOpacity={0.7}
                style={[
                  s.addAccountCardModern,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
                onPress={() => router.push("/(tabs)/accounts?openModal=1")}
              >
                <View
                  style={[
                    s.accountCardIconBox,
                    { backgroundColor: colors.inputBg },
                  ]}
                >
                  <Ionicons name="add" size={20} color={colors.subText} />
                </View>
                <Text
                  style={[s.addAccountTextModern, { color: colors.subText }]}
                >
                  Novo Invest.
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        )}

        {totalBudget > 0 && (
          <View style={s.section}>
            <TouchableOpacity
              style={[
                s.cleanCard,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
              onPress={() => router.push("/(tabs)/budget")}
            >
              <View style={s.budgetHeaderNew}>
                <Text style={[s.budgetTitleNew, { color: colors.text }]}>
                  Orçamento do Mês
                </Text>
                <Text style={[s.budgetMetaNew, { color: colors.subText }]}>
                  Meta: {formatCurrency(totalBudget, currency)}
                </Text>
              </View>

              <View
                style={[
                  s.budgetBarBgNew,
                  { backgroundColor: isDark ? "#30363d" : "#e5e7eb" },
                ]}
              >
                <View
                  style={[
                    s.budgetBarFillNew,
                    {
                      width: `${Math.min(budgetPercentage, 100)}%`,
                      backgroundColor:
                        budgetPercentage > 100 ? "#ef4444" : colors.primary,
                    },
                  ]}
                />
              </View>

              <View style={s.budgetFooterNew}>
                <Text style={[s.budgetFooterText, { color: colors.subText }]}>
                  <Text
                    style={{
                      fontWeight: "bold",
                      color: budgetPercentage > 100 ? "#ef4444" : colors.text,
                    }}
                  >
                    {formatCurrency(budgetSpent, currency)}
                  </Text>{" "}
                  gastos
                </Text>
                <Text style={[s.budgetFooterText, { color: colors.subText }]}>
                  <Text style={{ fontWeight: "bold", color: colors.text }}>
                    {formatCurrency(
                      Math.max(0, totalBudget - budgetSpent),
                      currency,
                    )}
                  </Text>{" "}
                  restam
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        )}

        {upcomingBills.length > 0 && (
          <View style={s.section}>
            <Text style={[s.sectionTitle, { color: colors.text }]}>
              Contas a Pagar
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 20 }}
            >
              {upcomingBills.map((bill) => {
                const diff = bill.due_day - new Date().getDate();
                const textDue =
                  diff === 0
                    ? "Vence hoje!"
                    : `Vence em ${diff} dia${diff > 1 ? "s" : ""}`;

                return (
                  <View
                    key={bill.id}
                    style={[
                      s.upcomingCardNew,
                      {
                        backgroundColor: colors.card,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <View style={s.upcomingIconBox}>
                      <Ionicons
                        name="receipt-outline"
                        size={20}
                        color="#f59e0b"
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[s.upcomingTitleNew, { color: colors.text }]}
                        numberOfLines={1}
                      >
                        {bill.title}
                      </Text>
                      <Text style={[s.upcomingSubNew, { color: "#f59e0b" }]}>
                        {textDue}
                      </Text>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text
                        style={[s.upcomingValueNew, { color: colors.text }]}
                      >
                        {formatCurrency(bill.amount, currency)}
                      </Text>
                      <TouchableOpacity
                        style={[
                          s.upcomingBtnNew,
                          { backgroundColor: colors.primary },
                        ]}
                        onPress={() => handlePayUpcoming(bill)}
                      >
                        <Text style={s.upcomingBtnTextNew}>Pagar</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        )}

        {creditCardsStatus.length > 0 && (
          <View style={s.section}>
            <View style={s.sectionHeader}>
              <Text style={[s.sectionTitle, { color: colors.text }]}>
                Meus Cartões
              </Text>
              <TouchableOpacity onPress={() => router.push("/(tabs)/credit")}>
                <Text style={[s.seeAll, { color: colors.primary }]}>
                  Ver todos &gt;
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 20 }}
            >
              {creditCardsStatus.map((card, index) => (
                <TouchableOpacity
                  key={index}
                  activeOpacity={0.9}
                  style={[
                    s.creditCardPhysical,
                    { backgroundColor: card.color },
                  ]}
                  onPress={() =>
                    router.push({
                      pathname: "/(tabs)/accounts",
                      params: {
                        id: card.id,
                        name: card.label,
                        balance: card.balance,
                        currency: card.currency,
                        color: card.color,
                      },
                    })
                  }
                >
                  <View style={s.ccTopRow}>
                    <Text style={s.ccCreditLabel}>Cartão de Crédito</Text>
                    <Text style={s.ccVisaLabel}>VISA</Text>
                  </View>
                  <Text style={s.ccBankName}>{card.label.toUpperCase()}</Text>

                  <Text style={s.ccDots}>•••• •••• •••• 4521</Text>

                  <View style={s.ccAmountArea}>
                    <View>
                      <Text style={s.ccAmountLabel}>Fatura Atual</Text>
                      <Text style={s.ccAmountValue}>
                        {formatCurrency(card.value, currency)}
                      </Text>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={s.ccLimitLabel}>Limite Total</Text>
                      <Text style={s.ccLimitValue}>
                        {formatCurrency(card.totalLimit, currency)}
                      </Text>
                    </View>
                  </View>

                  <View style={s.ccLimitBarBg}>
                    <View
                      style={[
                        s.ccLimitBarFill,
                        { width: `${Math.min(card.limitPercentage, 100)}%` },
                      ]}
                    />
                  </View>
                  <Text style={s.ccLimitAvailable}>
                    {Math.round(card.limitPercentage)}% utilizado
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={[s.sectionTitle, { color: colors.text }]}>
              Lançamentos Recentes
            </Text>
            <TouchableOpacity
              onPress={() => router.push("/(tabs)/transactions" as any)}
            >
              <Text style={[s.seeAll, { color: colors.primary }]}>
                Ver todas &gt;
              </Text>
            </TouchableOpacity>
          </View>

          <View
            style={[
              s.cleanCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                padding: 0,
              },
            ]}
          >
            {recentTransactions.length === 0 ? (
              <Text
                style={{
                  padding: 20,
                  textAlign: "center",
                  color: colors.subText,
                }}
              >
                Nenhuma transação ainda.
              </Text>
            ) : (
              recentTransactions.map((tx, index) => {
                const isIncome = tx.type === "income";
                return (
                  <View
                    key={tx.id}
                    style={[
                      s.recentTxRow,
                      { borderBottomColor: colors.border },
                      index === recentTransactions.length - 1 && {
                        borderBottomWidth: 0,
                      },
                    ]}
                  >
                    <View
                      style={[
                        s.recentTxIcon,
                        { backgroundColor: colors.inputBg },
                      ]}
                    >
                      <Ionicons
                        name={isIncome ? "arrow-down" : "cart"}
                        size={18}
                        color={isIncome ? "#10b981" : colors.subText}
                      />
                    </View>
                    <View style={{ flex: 1, paddingHorizontal: 12 }}>
                      <Text
                        style={[s.recentTxTitle, { color: colors.text }]}
                        numberOfLines={1}
                      >
                        {tx.title}
                      </Text>
                      <Text style={[s.recentTxCat, { color: colors.subText }]}>
                        {tx.category?.name || "Geral"}
                      </Text>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text
                        style={[
                          s.recentTxAmount,
                          { color: isIncome ? "#10b981" : "#ef4444" },
                        ]}
                      >
                        {isIncome ? "+" : "-"}
                        {formatCurrency(tx.amount, currency)}
                      </Text>
                      <Text style={[s.recentTxDate, { color: colors.subText }]}>
                        {formatDate(tx.date).substring(0, 6)}
                      </Text>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        </View>
      </ScrollView>

      {/* MENU LATERAL RESTAURADO */}
      <Modal
        visible={isMenuVisible}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={{ flex: 1, backgroundColor: colors.bg }}>
          <View
            style={[
              s.menuHeaderNew,
              {
                backgroundColor: colors.primary,
                paddingTop: Math.max(insets.top, 20) + 20,
              },
            ]}
          >
            <View style={s.menuHeaderTop}>
              <View style={s.menuProfile}>
                <View style={s.menuAvatar}>
                  <Text style={s.menuAvatarText}>
                    {firstName.substring(0, 2).toUpperCase()}
                  </Text>
                </View>
                <View>
                  <Text style={s.menuName}>{profile?.name || "Usuário"}</Text>
                  <Text style={s.menuEmail}>
                    {session?.user?.email || "usuario@email.com"}
                  </Text>
                  <View style={s.menuBadge}>
                    <Text style={s.menuBadgeText}>✨ Plano Premium</Text>
                  </View>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => setIsMenuVisible(false)}
                style={s.menuCloseBtn}
              >
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={s.menuStatsRow}>
            <View
              style={[
                s.menuStatCard,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <View
                style={[
                  s.menuStatIcon,
                  { backgroundColor: "rgba(16, 185, 129, 0.15)" },
                ]}
              >
                <Ionicons name="trending-up" size={18} color="#10b981" />
              </View>
              <View>
                <Text style={[s.menuStatLabel, { color: colors.subText }]}>
                  Poupança
                </Text>
                <Text style={[s.menuStatValue, { color: "#10b981" }]}>
                  {Math.round(percentagemPoupada)}%
                </Text>
              </View>
            </View>
            <View
              style={[
                s.menuStatCard,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <View
                style={[
                  s.menuStatIcon,
                  { backgroundColor: "rgba(59, 130, 246, 0.15)" },
                ]}
              >
                <Ionicons name="receipt" size={18} color="#3b82f6" />
              </View>
              <View>
                <Text style={[s.menuStatLabel, { color: colors.subText }]}>
                  Transações
                </Text>
                <Text style={[s.menuStatValue, { color: "#3b82f6" }]}>
                  {transactions.length} este mês
                </Text>
              </View>
            </View>
          </View>

          <ScrollView
            contentContainerStyle={s.menuScroll}
            showsVerticalScrollIndicator={false}
          >
            <Text style={[s.menuSectionTitle, { color: colors.subText }]}>
              NAVEGAÇÃO
            </Text>
            <View
              style={[
                s.menuSection,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <MenuOption
                icon="pie-chart"
                color="#10b981"
                title="Análise Gráfica"
                subtitle="Relatórios detalhados"
                onPress={() => {
                  setIsMenuVisible(false);
                  router.push("/(tabs)/charts");
                }}
              />
              <View
                style={[s.menuDivider, { backgroundColor: colors.border }]}
              />
              <MenuOption
                icon="flag"
                color="#f59e0b"
                title="Metas de Gastos"
                subtitle="Controle o seu orçamento"
                onPress={() => {
                  setIsMenuVisible(false);
                  router.push("/(tabs)/budget");
                }}
              />
              <View
                style={[s.menuDivider, { backgroundColor: colors.border }]}
              />
              <MenuOption
                icon="trending-up"
                color="#3b82f6"
                title="Meus Investimentos"
                subtitle="Acompanhe rendimentos"
                onPress={() => {
                  setIsMenuVisible(false);
                  router.push("/(tabs)/investments" as any);
                }}
              />
            </View>

            <Text style={[s.menuSectionTitle, { color: colors.subText }]}>
              PREFERÊNCIAS
            </Text>
            <View
              style={[
                s.menuSection,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <MenuOption
                icon="settings"
                color={colors.subText}
                title="Configurações"
                subtitle="Ajustes da aplicação"
                onPress={() => {
                  setIsMenuVisible(false);
                  router.push("/(tabs)/settings");
                }}
              />
              <View
                style={[s.menuDivider, { backgroundColor: colors.border }]}
              />
              <MenuOption
                icon="help-circle"
                color="#8b5cf6"
                title="Ajuda e Tutorial"
                subtitle="Aprenda a usar a app"
                onPress={() => {
                  setIsMenuVisible(false);
                  setShowHelpModal(true);
                }}
              />
            </View>

            <Text style={[s.menuSectionTitle, { color: colors.subText }]}>
              SEGURANÇA
            </Text>
            <View
              style={[
                s.menuSection,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <MenuOption
                icon="log-out"
                color="#ef4444"
                title="Sair da Conta"
                subtitle="Encerrar sessão atual"
                onPress={() => {
                  setIsMenuVisible(false);
                  const executeLogout = async () => {
                    try {
                      await logout();
                      router.replace("/");
                    } catch (error) {
                      if (Platform.OS === "web")
                        window.alert("Não foi possível sair.");
                      else Alert.alert("Erro", "Não foi possível sair.");
                    }
                  };

                  if (Platform.OS === "web") {
                    if (window.confirm("Deseja realmente sair?")) {
                      executeLogout();
                    }
                  } else {
                    Alert.alert("Sair", "Deseja realmente sair?", [
                      { text: "Cancelar", style: "cancel" },
                      {
                        text: "Sair",
                        style: "destructive",
                        onPress: executeLogout,
                      },
                    ]);
                  }
                }}
                hideArrow
              />
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* MODAL DE AJUDA E TUTORIAL (PWA) ADICIONADO AQUI */}
      <Modal visible={showHelpModal} transparent animationType="fade">
        <View style={s.modalOverlayCenter}>
          <View
            style={[
              s.modalCardCenter,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <View style={{ alignItems: "center", marginBottom: 16 }}>
              <View
                style={{
                  width: 50,
                  height: 50,
                  borderRadius: 25,
                  backgroundColor: "rgba(139, 92, 246, 0.15)",
                  justifyContent: "center",
                  alignItems: "center",
                  marginBottom: 12,
                }}
              >
                <Ionicons
                  name="phone-portrait-outline"
                  size={24}
                  color="#8b5cf6"
                />
              </View>
              <Text
                style={[
                  s.modalTitleCenter,
                  { color: colors.text, marginBottom: 4, textAlign: "center" },
                ]}
              >
                Instalar a Aplicação
              </Text>
              <Text
                style={{
                  color: colors.subText,
                  textAlign: "center",
                  fontSize: 13,
                }}
              >
                Tenha acesso rápido direto da sua tela inicial (PWA).
              </Text>
            </View>

            <ScrollView
              style={{ maxHeight: 300 }}
              showsVerticalScrollIndicator={false}
            >
              <Text
                style={{
                  color: colors.text,
                  fontWeight: "bold",
                  marginBottom: 8,
                  marginTop: 10,
                }}
              >
                🍎 Para utilizadores iOS (Safari):
              </Text>
              <Text
                style={{ color: colors.subText, fontSize: 13, marginBottom: 4 }}
              >
                1. Toque no ícone de "Compartilhar" (quadrado com seta para
                cima) na barra inferior.
              </Text>
              <Text
                style={{
                  color: colors.subText,
                  fontSize: 13,
                  marginBottom: 16,
                }}
              >
                2. Role para baixo e selecione "Adicionar à Tela de Início".
              </Text>

              <Text
                style={{
                  color: colors.text,
                  fontWeight: "bold",
                  marginBottom: 8,
                }}
              >
                🤖 Para utilizadores Android (Chrome):
              </Text>
              <Text
                style={{ color: colors.subText, fontSize: 13, marginBottom: 4 }}
              >
                1. Toque no ícone de "Menu" (três pontos) no canto superior
                direito.
              </Text>
              <Text
                style={{
                  color: colors.subText,
                  fontSize: 13,
                  marginBottom: 16,
                }}
              >
                2. Selecione "Instalar Aplicação" ou "Adicionar à Tela Inicial".
              </Text>
            </ScrollView>

            <TouchableOpacity
              style={[
                s.btn,
                { backgroundColor: colors.primary, marginTop: 16 },
              ]}
              onPress={() => setShowHelpModal(false)}
            >
              <Text style={{ color: "#fff", fontWeight: "bold" }}>
                Entendi, fechar
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* SELETOR DE MÊS RESTAURADO */}
      <Modal visible={showMonthPicker} transparent animationType="fade">
        <TouchableOpacity
          style={s.monthPickerOverlay}
          activeOpacity={1}
          onPress={() => setShowMonthPicker(false)}
        >
          <View
            style={[
              s.monthPickerContent,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Text style={[s.monthPickerTitle, { color: colors.text }]}>
              Selecionar mês
            </Text>
            {Array.from({ length: 12 }, (_, i) => i - 11).map((offset) => {
              const { fullLabel: fl } = getMonthRange(offset);
              const active = offset === monthOffset;
              return (
                <TouchableOpacity
                  key={offset}
                  style={[
                    s.monthPickerItem,
                    active && {
                      backgroundColor: isDark ? "#1f2937" : "#e0e7ff",
                    },
                  ]}
                  onPress={() => {
                    setMonthOffset(offset);
                    setShowMonthPicker(false);
                  }}
                >
                  <Text
                    style={[
                      s.monthPickerItemText,
                      { color: colors.text },
                      active && { fontWeight: "700", color: colors.primary },
                    ]}
                  >
                    {fl.charAt(0).toUpperCase() + fl.slice(1)}
                  </Text>
                  {active && (
                    <Ionicons
                      name="checkmark"
                      size={16}
                      color={colors.primary}
                    />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

function MenuOption({ icon, color, title, subtitle, onPress, hideArrow }: any) {
  const { colors } = useAppTheme();
  return (
    <TouchableOpacity style={s.menuOptionRow} onPress={onPress}>
      <View style={[s.menuOptionIcon, { backgroundColor: color + "15" }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[s.menuOptionTitle, { color: colors.text }]}>{title}</Text>
        {subtitle && (
          <Text style={[s.menuOptionSubtitle, { color: colors.subText }]}>
            {subtitle}
          </Text>
        )}
      </View>
      {!hideArrow && (
        <Ionicons name="chevron-forward" size={20} color={colors.subText} />
      )}
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { paddingBottom: 40 },

  superHeader: {
    paddingHorizontal: 20,
    paddingBottom: 30,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  headerTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  headerProfile: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  profileAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  profileInitials: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  greetingText: { color: "rgba(255,255,255,0.8)", fontSize: 12 },
  nameText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  headerIconBtn: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.2)",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  balanceArea: { marginBottom: 24 },
  balanceLabel: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 13,
    marginBottom: 4,
  },
  balanceValue: {
    color: "#fff",
    fontSize: 36,
    fontWeight: "900",
    letterSpacing: -1,
  },
  balanceMonthLabel: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 12,
    marginTop: 4,
  },

  incomesExpensesRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 16,
  },
  ieBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.15)",
    padding: 12,
    borderRadius: 16,
    gap: 10,
  },
  ieIcon: { padding: 6, borderRadius: 10 },
  ieLabel: { color: "rgba(255,255,255,0.7)", fontSize: 11, marginBottom: 2 },
  ieValue: { color: "#fff", fontSize: 14, fontWeight: "bold" },

  quickActionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    marginTop: 20,
    marginBottom: 10,
  },
  actionBtn: { alignItems: "center", gap: 8 },
  actionIconBox: {
    width: 56,
    height: 56,
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  actionLabel: { fontSize: 12, fontWeight: "600" },

  section: { marginTop: 24 },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    paddingHorizontal: 20,
  },
  sectionTitle: { fontSize: 16, fontWeight: "bold" },
  seeAll: { fontSize: 13, fontWeight: "600" },

  accountCardModern: {
    width: 140,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 12,
  },
  accountCardIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  accountCardName: { fontSize: 13, fontWeight: "600", marginBottom: 4 },
  accountCardBalance: { fontSize: 15, fontWeight: "bold" },

  addAccountCardModern: {
    width: 140,
    padding: 16,
    borderRadius: 20,
    borderWidth: 2,
    borderStyle: "dashed",
    marginRight: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  addAccountTextModern: { fontSize: 13, fontWeight: "600", marginTop: 8 },

  cleanCard: {
    marginHorizontal: 20,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 1,
  },

  budgetHeaderNew: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 12,
  },
  budgetTitleNew: { fontSize: 16, fontWeight: "bold" },
  budgetMetaNew: { fontSize: 12 },
  budgetBarBgNew: {
    height: 10,
    borderRadius: 5,
    overflow: "hidden",
    marginBottom: 10,
  },
  budgetBarFillNew: { height: "100%", borderRadius: 5 },
  budgetFooterNew: { flexDirection: "row", justifyContent: "space-between" },
  budgetFooterText: { fontSize: 12 },

  upcomingCardNew: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginRight: 12,
    minWidth: 280,
  },
  upcomingIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(245, 158, 11, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  upcomingTitleNew: { fontSize: 15, fontWeight: "bold", marginBottom: 4 },
  upcomingSubNew: { fontSize: 12, fontWeight: "600" },
  upcomingValueNew: { fontSize: 16, fontWeight: "800", marginBottom: 6 },
  upcomingBtnNew: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  upcomingBtnTextNew: { color: "#fff", fontSize: 11, fontWeight: "bold" },

  creditCardPhysical: {
    width: 300,
    height: 180,
    borderRadius: 20,
    padding: 20,
    marginRight: 16,
    justifyContent: "space-between",
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  ccTopRow: { flexDirection: "row", justifyContent: "space-between" },
  ccCreditLabel: { color: "rgba(255,255,255,0.7)", fontSize: 11 },
  ccVisaLabel: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "bold",
    fontStyle: "italic",
  },
  ccBankName: { color: "#fff", fontWeight: "bold", fontSize: 18, marginTop: 4 },
  ccDots: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 14,
    letterSpacing: 2,
    marginTop: 12,
  },
  ccAmountArea: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 16,
    alignItems: "flex-end",
  },
  ccAmountLabel: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 10,
    marginBottom: 2,
  },
  ccAmountValue: { color: "#fff", fontSize: 20, fontWeight: "bold" },
  ccLimitLabel: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 10,
    marginBottom: 2,
  },
  ccLimitValue: { color: "#fff", fontSize: 12, fontWeight: "600" },
  ccLimitBarBg: {
    height: 4,
    backgroundColor: "rgba(0,0,0,0.2)",
    borderRadius: 2,
    overflow: "hidden",
    marginTop: 12,
  },
  ccLimitBarFill: {
    height: "100%",
    backgroundColor: "rgba(255,255,255,0.5)",
    borderRadius: 2,
  },
  ccLimitAvailable: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 10,
    marginTop: 6,
  },

  recentTxRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
  },
  recentTxIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  recentTxTitle: { fontSize: 15, fontWeight: "600", marginBottom: 2 },
  recentTxCat: { fontSize: 12 },
  recentTxAmount: { fontSize: 15, fontWeight: "bold", marginBottom: 2 },
  recentTxDate: { fontSize: 11 },

  menuHeaderNew: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  menuHeaderTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  menuProfile: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  menuAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  menuAvatarText: { fontSize: 20, fontWeight: "bold", color: "#fff" },
  menuName: { fontSize: 20, fontWeight: "bold", color: "#fff" },
  menuEmail: { fontSize: 13, color: "rgba(255,255,255,0.8)" },
  menuBadge: {
    backgroundColor: "rgba(255,255,255,0.2)",
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 6,
  },
  menuBadgeText: { fontSize: 10, color: "#fff", fontWeight: "bold" },
  menuCloseBtn: {
    backgroundColor: "rgba(255,255,255,0.2)",
    padding: 8,
    borderRadius: 16,
  },
  menuStatsRow: {
    flexDirection: "row",
    paddingHorizontal: 24,
    gap: 12,
    marginTop: -24,
    marginBottom: 16,
  },
  menuStatCard: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  menuStatIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  menuStatLabel: { fontSize: 12, marginBottom: 2 },
  menuStatValue: { fontSize: 16, fontWeight: "bold" },
  menuScroll: { padding: 24, paddingBottom: 60 },
  menuSectionTitle: {
    fontSize: 11,
    fontWeight: "bold",
    letterSpacing: 1,
    marginBottom: 12,
    marginLeft: 4,
  },
  menuSection: {
    borderRadius: 20,
    paddingHorizontal: 16,
    borderWidth: 1,
    marginBottom: 24,
  },
  menuDivider: { height: 1, width: "100%" },
  menuOptionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
  },
  menuOptionIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  menuOptionTitle: { fontSize: 15, fontWeight: "600" },
  menuOptionSubtitle: { fontSize: 12, marginTop: 2 },

  monthPickerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  monthPickerContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    borderWidth: 1,
  },
  monthPickerTitle: { fontSize: 16, fontWeight: "700", marginBottom: 12 },
  monthPickerItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  monthPickerItemText: { fontSize: 14 },

  // Estilos da Ajuda (PWA)
  modalOverlayCenter: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalCardCenter: {
    width: "100%",
    maxWidth: 400,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
  },
  modalTitleCenter: { fontSize: 20, fontWeight: "bold" },
  btn: { paddingVertical: 14, borderRadius: 12, alignItems: "center" },
});
