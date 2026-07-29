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
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { PieChart } from "react-native-gifted-charts";
import { useAuth } from "@/hooks/useAuth";
import { useTransactions } from "@/hooks/useTransactions";
import { useAccounts } from "@/hooks/useAccounts";
import { useInstallments } from "@/hooks/useInstallments";
import { useFixedExpenses } from "@/hooks/useFixedExpenses";
import { useBudgetGoals } from "@/hooks/useBudgetGoals";
import { formatCurrency, formatDate } from "@/utils";
import type { Installment, Transaction } from "@/types";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "@/hooks/useTheme";

const FALLBACK_COLORS = [
  "#6366f1",
  "#14b8a6",
  "#f97316",
  "#ec4899",
  "#22c55e",
  "#0ea5e9",
];

export default function DashboardScreen() {
  const { profile, session, logout } = useAuth();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { colors, isDark } = useAppTheme();

  const [balanceView, setBalanceView] = useState<"month" | "week">("month");
  const [refreshing, setRefreshing] = useState(false);
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [monthOffset, setMonthOffset] = useState(0);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);

  const {
    totalBudget,
    globalGoal,
    upsert,
    refetch: refetchGoals,
  } = useBudgetGoals();
  const [showGlobalModal, setShowGlobalModal] = useState(false);
  const [globalInput, setGlobalInput] = useState("");

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

  // 👇 1. Separação das contas normais e de investimento
  const regularAccounts = accounts.filter((acc) => acc.type !== "investment");
  const investmentAccounts = accounts.filter(
    (acc) => acc.type === "investment",
  );

  const checkingBalance = useMemo(() => {
    return accounts
      .filter((acc) => acc.type === "checking")
      .reduce((sum, acc) => sum + (Number(acc.balance) || 0), 0);
  }, [accounts]);

  const { installments, refetch: refetchInstallments } = useInstallments();
  const { expenses: fixedExpenses, refetch: refetchFixed } = useFixedExpenses();
  const {
    transactions,
    summary,
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

  const totals = useMemo(() => {
    let monthIncome = 0;
    let monthExpense = 0;
    let weekIncome = 0;
    let weekExpense = 0;
    const checkingAccIds = new Set(
      accounts.filter((a) => a.type === "checking").map((a) => a.id),
    );
    const creditAccIds = new Set(
      accounts.filter((a) => a.type === "credit").map((a) => a.id),
    );
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    const endOfWeek = new Date(today);
    endOfWeek.setDate(today.getDate() - today.getDay() + 6);
    const startStr = startOfWeek.toISOString().split("T")[0];
    const endStr = endOfWeek.toISOString().split("T")[0];

    transactions.forEach((t) => {
      const amt = Number(t.amount) || 0;
      const isThisWeek = t.date >= startStr && t.date <= endStr;
      if (t.type === "income") {
        if (!t.account_id || !creditAccIds.has(t.account_id)) {
          monthIncome += amt;
          if (isThisWeek) weekIncome += amt;
        }
      } else {
        if (t.account_id && checkingAccIds.has(t.account_id)) {
          monthExpense += amt;
          if (isThisWeek) weekExpense += amt;
        }
      }
    });

    fixedExpenses.forEach((f) => {
      const amt = Number(f.amount) || 0;
      if (f.account_id && checkingAccIds.has(f.account_id)) {
        const dueDay = f.due_day || 10;
        const dueDateStr = `${to.slice(0, 8)}${String(dueDay).padStart(2, "0")}`;
        const isThisWeek = dueDateStr >= startStr && dueDateStr <= endStr;
        monthExpense += amt;
        if (isThisWeek) weekExpense += amt;
      }
    });
    return { monthIncome, monthExpense, weekIncome, weekExpense };
  }, [transactions, fixedExpenses, accounts, to]);

  const { categoryData, totalCategoryExpenses } = useMemo(() => {
    let total = 0;
    const grouped: Record<
      string,
      { label: string; value: number; color: string }
    > = {};

    expenses.forEach((t) => {
      const amt = Number(t.amount) || 0;
      const label = t.category?.name ?? "Outros";
      const color = t.category?.color ?? FALLBACK_COLORS[0];
      if (!grouped[label]) grouped[label] = { label, value: 0, color };
      grouped[label].value += amt;
      total += amt;
    });

    installments.forEach((i) => {
      if (
        i.paid_installments < i.total_installments &&
        (!i.start_date || i.start_date <= to)
      ) {
        const amt = Number(i.installment_amount) || 0;
        const label = (i as any).category?.name ?? "Cartão de Crédito";
        const color = (i as any).category?.color ?? FALLBACK_COLORS[2];
        if (!grouped[label]) grouped[label] = { label, value: 0, color };
        grouped[label].value += amt;
        total += amt;
      }
    });

    fixedExpenses.forEach((f) => {
      if (!f.is_paid) {
        const amt = Number(f.amount) || 0;
        const label = f.category?.name ?? "Contas Fixas";
        const color = f.category?.color ?? "#f59e0b";
        if (!grouped[label]) grouped[label] = { label, value: 0, color };
        grouped[label].value += amt;
        total += amt;
      }
    });

    const dataList = Object.values(grouped)
      .sort((a, b) => b.value - a.value)
      .map((item) => ({
        ...item,
        percentage:
          total > 0 ? Math.round((item.value / total) * 100) + "%" : "0%",
      }))
      .slice(0, 5); // Mostramos 5 para caber bem na lateral

    return { categoryData: dataList, totalCategoryExpenses: total };
  }, [expenses, installments, fixedExpenses, to]);

  const { budgetSpent } = useMemo(() => {
    let spent = 0;
    expenses.forEach((t) => (spent += Number(t.amount) || 0));
    return { budgetSpent: spent };
  }, [expenses]);

  const budgetPercentage =
    totalBudget > 0 ? (budgetSpent / totalBudget) * 100 : 0;

  const creditCardsStatus = useMemo(() => {
    const currentMonthIso = to.slice(0, 7);
    const today = new Date();
    const creditAccounts = accounts.filter((acc) => acc.type === "credit");

    return creditAccounts
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
          (sum, i) => sum + (Number(i.installment_amount) || 0),
          0,
        );
        const allActiveForLimit = installments.filter(
          (i) =>
            i.account_id === acc.id &&
            i.paid_installments < i.total_installments,
        );
        const usedLimit = allActiveForLimit.reduce(
          (sum, i) =>
            sum +
            (i.total_installments - i.paid_installments) *
              (Number(i.installment_amount) || 0),
          0,
        );
        const totalLimit = Number(acc.balance) || 0;
        const limitPercentage =
          totalLimit > 0 ? Math.min((usedLimit / totalLimit) * 100, 100) : 0;
        const dueDate = new Date(
          today.getFullYear(),
          today.getMonth(),
          acc.due_day || 10,
        );

        let statusColor = "#f59e0b";
        let statusLabel = "Pendente";
        if (isInvoicePaid) {
          statusColor = "#4ade80";
          statusLabel = "Pago";
        } else if (today > dueDate) {
          statusColor = "#f87171";
          statusLabel = "Vencido";
        }

        return {
          label: acc.name,
          color: acc.color || FALLBACK_COLORS[0],
          value: invoiceTotal,
          statusColor,
          statusLabel,
          usedLimit,
          totalLimit,
          limitPercentage,
        };
      })
      .filter((card) => card.value > 0 || card.statusLabel === "Pago");
  }, [accounts, installments, to]);

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: colors.bg }]}>
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        {/* CABEÇALHO */}
        <View style={s.header}>
          <View>
            <Text style={[s.greeting, { color: colors.text }]}>
              Olá, {firstName} 👋
            </Text>
            <Text style={[s.monthLabel, { color: colors.subText }]}>
              {fullLabel.charAt(0).toUpperCase() + fullLabel.slice(1)}
            </Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <TouchableOpacity
              style={[
                s.monthBtn,
                { backgroundColor: isDark ? "#1f2937" : "#e0e7ff" },
              ]}
              onPress={() => setShowMonthPicker(true)}
            >
              <Text
                style={[
                  s.monthBtnText,
                  { color: isDark ? "#fff" : colors.primary },
                ]}
              >
                {dynMonthLabel}
              </Text>
              <Ionicons
                name="chevron-down"
                size={12}
                color={isDark ? "#fff" : colors.primary}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                s.menuIconButton,
                { backgroundColor: isDark ? "#1f2937" : "#e0e7ff" },
              ]}
              onPress={() => setIsMenuVisible(true)}
            >
              <Ionicons
                name="menu"
                size={22}
                color={isDark ? "#fff" : colors.primary}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* CARTÃO DE SALDO */}
        <View style={[s.balanceCard, { backgroundColor: colors.primary }]}>
          <View style={s.balanceCardHeader}>
            <View>
              <Text style={s.balanceLabel}>Saldo Atual (Contas Corrente)</Text>
              <Text
                style={[
                  s.balanceValue,
                  checkingBalance < 0 && { color: "#f87171" },
                ]}
              >
                {checkingBalance < 0 ? "⚠️ " : ""}
                {formatCurrency(checkingBalance, currency)}
              </Text>
            </View>
            <View style={s.balanceToggle}>
              <TouchableOpacity
                style={[
                  s.balanceToggleBtn,
                  balanceView === "month" && s.balanceToggleBtnActive,
                ]}
                onPress={() => setBalanceView("month")}
              >
                <Text
                  style={[
                    s.balanceToggleText,
                    balanceView === "month" && s.balanceToggleTextActive,
                  ]}
                >
                  Mês
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  s.balanceToggleBtn,
                  balanceView === "week" && s.balanceToggleBtnActive,
                ]}
                onPress={() => setBalanceView("week")}
              >
                <Text
                  style={[
                    s.balanceToggleText,
                    balanceView === "week" && s.balanceToggleTextActive,
                  ]}
                >
                  Semana
                </Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={s.balanceRow}>
            <View style={s.balanceItem}>
              <Text style={s.balanceItemLabel}>↑ Receitas</Text>
              <Text style={[s.balanceItemValue, { color: "#4ade80" }]}>
                {formatCurrency(
                  balanceView === "month"
                    ? totals.monthIncome
                    : totals.weekIncome,
                  currency,
                )}
              </Text>
            </View>
            <View style={s.divider} />
            <View style={s.balanceItem}>
              <Text style={s.balanceItemLabel}>↓ Despesas</Text>
              <Text style={[s.balanceItemValue, { color: "#f87171" }]}>
                {formatCurrency(
                  balanceView === "month"
                    ? totals.monthExpense
                    : totals.weekExpense,
                  currency,
                )}
              </Text>
            </View>
          </View>
        </View>

        {/* MINHAS CONTAS (CORRENTE E CRÉDITO) */}
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
                Ver todas
              </Text>
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {regularAccounts.map((account) => (
              <TouchableOpacity
                key={account.id}
                style={[
                  s.accountCard,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    borderLeftColor: account.color || colors.primary,
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
                <Text style={[s.accountName, { color: colors.text }]}>
                  {account.name}
                </Text>
                {account.type === "checking" ? (
                  <Text style={[s.accountBalance, { color: colors.text }]}>
                    {formatCurrency(account.balance, account.currency)}
                  </Text>
                ) : (
                  <Text
                    style={[s.accountCreditLabel, { color: colors.subText }]}
                  >
                    Cartão de Crédito
                  </Text>
                )}
                <Text style={[s.accountType, { color: colors.subText }]}>
                  {account.type === "checking" ? "Conta Corrente" : "Crédito"}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              activeOpacity={0.7}
              style={[
                s.addAccountCard,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
              onPress={() => router.push("/(tabs)/accounts?openModal=1")}
            >
              <Ionicons
                name="add-circle-outline"
                size={26}
                color={colors.subText}
              />
              <Text style={[s.addAccountText, { color: colors.subText }]}>
                Nova Conta
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* 👇 MEUS INVESTIMENTOS (NOVA SECÇÃO SEPARADA) */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={[s.sectionTitle, { color: colors.text }]}>
              Meus Investimentos
            </Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {investmentAccounts.map((account) => (
              <TouchableOpacity
                key={account.id}
                style={[
                  s.accountCard,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    borderLeftColor: account.color || "#8b5cf6",
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
                <Text style={[s.accountName, { color: colors.text }]}>
                  {account.name}
                </Text>
                <Text style={[s.accountBalance, { color: colors.text }]}>
                  {formatCurrency(account.balance, account.currency)}
                </Text>
                <Text style={[s.accountType, { color: colors.subText }]}>
                  Corretora / Banco
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              activeOpacity={0.7}
              style={[
                s.addAccountCard,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
              onPress={() => router.push("/(tabs)/accounts?openModal=1")}
            >
              <Ionicons name="trending-up" size={26} color={colors.subText} />
              <Text style={[s.addAccountText, { color: colors.subText }]}>
                Novo Investimento
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* GASTOS POR CATEGORIA (PIE CHART LADO A LADO) */}
        <View style={s.section}>
          <Text style={[s.sectionTitle, { color: colors.text }]}>
            Gastos por Categoria
          </Text>
          <View
            style={[
              s.categoryMainCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            {isLoading ? (
              <ActivityIndicator
                color={colors.primary}
                style={s.chartLoading}
              />
            ) : categoryData.length === 0 ? (
              <EmptyChart message="Nenhum gasto registrado este mês." />
            ) : (
              // 👇 Estrutura flex-row para colocar lado a lado
              <View style={s.chartRowLayout}>
                <View style={s.pieWrapLeft}>
                  <PieChart
                    data={categoryData.map((item) => ({
                      value: item.value,
                      color: item.color,
                    }))}
                    donut
                    radius={65} // Tamanho reduzido para caber ao lado
                    innerRadius={45}
                    innerCircleColor={colors.card}
                    centerLabelComponent={() => (
                      <View style={s.pieCenter}>
                        <Text
                          style={[s.pieCenterLabel, { color: colors.subText }]}
                        >
                          Total
                        </Text>
                        <Text
                          style={[s.pieCenterValue, { color: colors.text }]}
                        >
                          {formatCurrency(totalCategoryExpenses, currency)}
                        </Text>
                      </View>
                    )}
                  />
                </View>

                <View style={s.legendRight}>
                  {categoryData.map((item) => (
                    <View key={item.label} style={s.legendItemRow}>
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          flex: 1,
                        }}
                      >
                        <View
                          style={[s.legendDot, { backgroundColor: item.color }]}
                        />
                        <Text
                          style={[s.legendLabel, { color: colors.subText }]}
                          numberOfLines={1}
                        >
                          {item.label}
                        </Text>
                      </View>
                      <Text style={[s.legendValue, { color: colors.text }]}>
                        {formatCurrency(item.value, currency)}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>
        </View>

        {/* METAS COM POUPAR E INVESTIR */}
        {totalBudget > 0 && (
          <View style={s.section}>
            <View style={s.sectionHeader}>
              <Text style={[s.sectionTitle, { color: colors.text }]}>
                Metas
              </Text>
              <TouchableOpacity onPress={() => router.push("/(tabs)/budget")}>
                <Text style={[s.seeAll, { color: colors.primary }]}>
                  Ver Metas
                </Text>
              </TouchableOpacity>
            </View>

            <View
              style={[
                s.budgetCard,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              {/* Orçamento Geral */}
              <View style={s.budgetHeader}>
                <Text style={[s.budgetText, { color: colors.primary }]}>
                  Orçamento do Mês
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    setGlobalInput(
                      totalBudget > 0 ? totalBudget.toString() : "",
                    );
                    setShowGlobalModal(true);
                  }}
                >
                  <Text style={[s.budgetEditText, { color: colors.text }]}>
                    {formatCurrency(budgetSpent, currency)} de{" "}
                    {formatCurrency(totalBudget, currency)}
                  </Text>
                </TouchableOpacity>
              </View>
              <View
                style={[
                  s.budgetBarBg,
                  { backgroundColor: isDark ? "#30363d" : "#e5e7eb" },
                ]}
              >
                <View
                  style={[
                    s.budgetBarFill,
                    {
                      width: `${Math.min(budgetPercentage, 100)}%`,
                      backgroundColor:
                        budgetPercentage > 100 ? "#f87171" : colors.primary,
                    },
                  ]}
                />
              </View>
              <Text style={[s.budgetPercentText, { color: colors.text }]}>
                {Math.round(budgetPercentage)}%
              </Text>

              {/* 👇 Sub-metas: Poupar e Investir */}
              <View style={s.subGoalsContainer}>
                {/* Cartão Poupar */}
                <View
                  style={[
                    s.subGoalCard,
                    { backgroundColor: colors.bg, borderColor: colors.border },
                  ]}
                >
                  <Text style={[s.subGoalTitle, { color: colors.subText }]}>
                    Poupar
                  </Text>
                  <View style={s.subGoalRow}>
                    <Text style={[s.subGoalValue, { color: colors.text }]}>
                      R$ 2.500,00
                    </Text>
                    <Text style={[s.subGoalPercent, { color: colors.text }]}>
                      83%
                    </Text>
                  </View>
                  <View
                    style={[
                      s.budgetBarBg,
                      {
                        backgroundColor: isDark ? "#30363d" : "#e5e7eb",
                        height: 4,
                      },
                    ]}
                  >
                    <View
                      style={[
                        s.budgetBarFill,
                        { width: `83%`, backgroundColor: colors.primary },
                      ]}
                    />
                  </View>
                </View>

                {/* Cartão Investir */}
                <View
                  style={[
                    s.subGoalCard,
                    { backgroundColor: colors.bg, borderColor: colors.border },
                  ]}
                >
                  <Text style={[s.subGoalTitle, { color: colors.subText }]}>
                    Investir
                  </Text>
                  <View style={s.subGoalRow}>
                    <Text style={[s.subGoalValue, { color: colors.text }]}>
                      R$ 1.000,00
                    </Text>
                    <Text style={[s.subGoalPercent, { color: colors.text }]}>
                      40%
                    </Text>
                  </View>
                  <View
                    style={[
                      s.budgetBarBg,
                      {
                        backgroundColor: isDark ? "#30363d" : "#e5e7eb",
                        height: 4,
                      },
                    ]}
                  >
                    <View
                      style={[
                        s.budgetBarFill,
                        { width: `40%`, backgroundColor: colors.primary },
                      ]}
                    />
                  </View>
                </View>
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* MENU LATERAL (MODAL) */}
      <Modal visible={isMenuVisible} transparent animationType="fade">
        <View style={s.menuOverlay}>
          <TouchableOpacity
            style={s.menuCloseArea}
            activeOpacity={1}
            onPress={() => setIsMenuVisible(false)}
          />
          <View style={[s.menuContent, { backgroundColor: colors.card }]}>
            <View style={s.menuHeader}>
              <Text style={[s.menuTitle, { color: colors.text }]}>Menu</Text>
              <TouchableOpacity onPress={() => setIsMenuVisible(false)}>
                <Ionicons name="close" size={28} color={colors.text} />
              </TouchableOpacity>
            </View>

            <View style={s.menuBody}>
              <TouchableOpacity
                style={[s.menuItem, { borderBottomColor: colors.border }]}
                onPress={() => {
                  setIsMenuVisible(false);
                  router.push("/(tabs)/investments" as any);
                }}
              >
                <View
                  style={[
                    s.menuIconWrapper,
                    { backgroundColor: isDark ? "#1f2937" : "#e0e7ff" },
                  ]}
                >
                  <Ionicons name="trending-up" size={20} color="#38bdf8" />
                </View>
                <Text style={[s.menuItemText, { color: colors.text }]}>
                  Meus Investimentos
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[s.menuItem, { borderBottomColor: colors.border }]}
                onPress={() => {
                  setIsMenuVisible(false);
                  router.push("/(tabs)/charts");
                }}
              >
                <View
                  style={[
                    s.menuIconWrapper,
                    { backgroundColor: isDark ? "#1f2937" : "#e0e7ff" },
                  ]}
                >
                  <Ionicons name="pie-chart" size={20} color={colors.primary} />
                </View>
                <Text style={[s.menuItemText, { color: colors.text }]}>
                  Análise Gráfica
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[s.menuItem, { borderBottomColor: colors.border }]}
                onPress={() => {
                  setIsMenuVisible(false);
                  router.push("/(tabs)/budget");
                }}
              >
                <View
                  style={[
                    s.menuIconWrapper,
                    { backgroundColor: isDark ? "#1f2937" : "#e0e7ff" },
                  ]}
                >
                  <Ionicons name="flag-outline" size={20} color="#4ade80" />
                </View>
                <Text style={[s.menuItemText, { color: colors.text }]}>
                  Metas de Gastos
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[s.menuItem, { borderBottomColor: colors.border }]}
                onPress={() => {
                  setIsMenuVisible(false);
                  setShowHelpModal(true);
                }}
              >
                <View
                  style={[
                    s.menuIconWrapper,
                    { backgroundColor: isDark ? "#1f2937" : "#e0e7ff" },
                  ]}
                >
                  <Ionicons name="help-circle" size={22} color="#facc15" />
                </View>
                <Text style={[s.menuItemText, { color: colors.text }]}>
                  Ajuda e Tutorial
                </Text>
              </TouchableOpacity>
            </View>

            <View style={[s.menuFooter, { borderTopColor: colors.border }]}>
              <TouchableOpacity
                style={[s.menuItem, { borderBottomColor: colors.border }]}
                onPress={() => {
                  setIsMenuVisible(false);
                  router.push("/(tabs)/settings");
                }}
              >
                <Ionicons
                  name="settings-outline"
                  size={22}
                  color={colors.subText}
                />
                <Text
                  style={[
                    s.menuItemText,
                    { color: colors.subText, marginLeft: 14 },
                  ]}
                >
                  Configurações
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[s.menuItem, { borderBottomWidth: 0 }]}
                onPress={async () => {
                  setIsMenuVisible(false);
                  try {
                    await logout();
                    router.replace("/");
                  } catch (error) {
                    Alert.alert("Erro", "Não foi possível sair da conta.");
                  }
                }}
              >
                <Ionicons name="log-out-outline" size={22} color="#f87171" />
                <Text
                  style={[s.menuItemText, { color: "#f87171", marginLeft: 14 }]}
                >
                  Sair da conta
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      {/* MODAL: SELETOR DE MÊS */}
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

// ============================================================
// COMPONENTES E ESTILOS
// ============================================================

function EmptyChart({ message }: { message: string }) {
  const { colors } = useAppTheme();
  return (
    <View style={s.emptyChart}>
      <Text style={[s.emptyText, { color: colors.subText }]}>{message}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { paddingBottom: 32 },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  greeting: { fontSize: 22, fontWeight: "bold" },
  monthLabel: { fontSize: 13, marginTop: 2, textTransform: "capitalize" },
  monthBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  monthBtnText: { fontSize: 12, fontWeight: "700" },
  menuIconButton: { padding: 8, borderRadius: 20 },

  balanceCard: {
    marginHorizontal: 20,
    marginTop: 8,
    borderRadius: 24,
    padding: 22,
  },
  balanceCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 14,
  },
  balanceLabel: { color: "#d1d5db", fontSize: 12, marginBottom: 4 },
  balanceValue: { fontSize: 30, fontWeight: "bold", color: "#fff" },
  balanceToggle: {
    flexDirection: "row",
    backgroundColor: "rgba(0,0,0,0.2)",
    borderRadius: 12,
    padding: 2,
  },
  balanceToggleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  balanceToggleBtnActive: { backgroundColor: "#fff" },
  balanceToggleText: { fontSize: 10, fontWeight: "700", color: "#d1d5db" },
  balanceToggleTextActive: { color: "#000" },
  balanceRow: {
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.15)",
    paddingTop: 14,
  },
  balanceItem: { flex: 1 },
  balanceItemLabel: { color: "#d1d5db", fontSize: 11, marginBottom: 2 },
  balanceItemValue: { fontSize: 14, fontWeight: "bold" },
  divider: {
    width: 1,
    height: 26,
    backgroundColor: "rgba(255,255,255,0.15)",
    marginHorizontal: 12,
  },

  section: { marginTop: 24, paddingHorizontal: 20 },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 16, fontWeight: "700" },
  seeAll: { fontSize: 13, fontWeight: "600" },

  accountCard: {
    borderRadius: 16,
    padding: 16,
    marginRight: 12,
    minWidth: 140,
    borderLeftWidth: 4,
    borderWidth: 1,
  },
  accountName: { fontSize: 13, fontWeight: "600", marginBottom: 6 },
  accountBalance: { fontSize: 15, fontWeight: "bold", marginBottom: 4 },
  accountCreditLabel: { fontSize: 12, marginBottom: 4 },
  accountType: { fontSize: 11, textTransform: "capitalize" },
  addAccountCard: {
    width: 140,
    height: 100,
    borderRadius: 16,
    borderWidth: 2,
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
  },
  addAccountText: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: 6,
    textAlign: "center",
  },

  // 👇 Novos estilos do Gráfico Lado a Lado
  categoryMainCard: { borderRadius: 16, padding: 16, borderWidth: 1 },
  chartRowLayout: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  pieWrapLeft: { alignItems: "center", justifyContent: "center" },
  pieCenter: { alignItems: "center", justifyContent: "center" },
  pieCenterLabel: { fontSize: 9, fontWeight: "600" },
  pieCenterValue: { fontSize: 11, fontWeight: "800", marginTop: 2 },
  legendRight: { flex: 1, marginLeft: 20, gap: 10 },
  legendItemRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  legendDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  legendLabel: { fontSize: 11, fontWeight: "500", marginRight: 8 },
  legendValue: { fontSize: 11, fontWeight: "700" },
  chartLoading: { paddingVertical: 36 },
  emptyChart: {
    minHeight: 120,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: { fontSize: 13, fontStyle: "italic" },

  // 👇 Novos estilos das Metas
  budgetCard: { borderRadius: 16, padding: 16, borderWidth: 1 },
  budgetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  budgetText: { fontSize: 13, fontWeight: "700" },
  budgetEditText: { fontSize: 11, fontWeight: "500" },
  budgetBarBg: {
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
    marginBottom: 6,
  },
  budgetBarFill: { height: "100%", borderRadius: 3 },
  budgetPercentText: { fontSize: 11, fontWeight: "bold", textAlign: "right" },

  subGoalsContainer: { flexDirection: "row", gap: 12, marginTop: 16 },
  subGoalCard: { flex: 1, borderRadius: 12, padding: 12, borderWidth: 1 },
  subGoalTitle: { fontSize: 11, fontWeight: "600", marginBottom: 8 },
  subGoalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  subGoalValue: { fontSize: 13, fontWeight: "bold" },
  subGoalPercent: { fontSize: 11, fontWeight: "bold" }, // Estilos do Menu Lateral
  menuOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  menuCloseArea: { flex: 1 },
  menuContent: {
    width: "80%",
    maxWidth: 320,
    height: "100%",
    padding: 24,
    justifyContent: "space-between",
  },
  menuHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 30,
    marginTop: Platform.OS === "ios" ? 30 : 0,
  },
  menuTitle: { fontSize: 22, fontWeight: "bold" },
  menuBody: { flex: 1 },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  menuIconWrapper: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  menuItemText: { fontSize: 15, fontWeight: "600", flex: 1 },
  menuFooter: { borderTopWidth: 1, paddingTop: 14 },
  // Estilos do Seletor de Mês
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
});
