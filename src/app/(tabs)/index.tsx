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
} from "react-native";
import React, { useState, useRef, useCallback, useMemo } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { PieChart } from "react-native-gifted-charts";
import { useAuth } from "@/hooks/useAuth";
import { useTransactions } from "@/hooks/useTransactions";
import { useAccounts } from "@/hooks/useAccounts";
import { useInstallments } from "@/hooks/useInstallments";
import { useFixedExpenses } from "@/hooks/useFixedExpenses";
import {
  formatCurrency,
  formatDate,
  getCurrentMonthRange,
  getCurrentMonthName,
} from "@/utils";
import type { Installment, Transaction } from "@/types";
import { Ionicons } from "@expo/vector-icons";

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
  const { from, to } = getCurrentMonthRange();
  const { width } = useWindowDimensions();

  const [refreshing, setRefreshing] = useState(false);
  const [isMenuVisible, setIsMenuVisible] = useState(false);

  const { accounts, totalBalance, refetch: refetchAccounts } = useAccounts();
  const { installments, refetch: refetchInstallments } = useInstallments();
  const { expenses: fixedExpenses, refetch: refetchFixed } = useFixedExpenses();
  const {
    transactions,
    summary,
    isLoading,
    refetch: refetchTransactions,
  } = useTransactions({
    date_from: from,
    date_to: to,
  });

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
      // 👇 TRAVA DE SEGURANÇA: Impede a busca antes do token de segurança estar pronto
      if (!session?.user?.id) return;

      if (refetchAccounts) refetchAccounts();
      if (refetchInstallments) refetchInstallments();
      if (refetchTransactions) refetchTransactions();
      if (refetchFixed) refetchFixed();
    }, [session?.user?.id]), // <-- A MÁGICA: O Dashboard agora escuta a chegada da sessão!
  );

  const firstName = profile?.name?.split(" ")[0] ?? "Usuário";
  const month = getCurrentMonthName();
  const currency = profile?.currency ?? "BRL";

  const expenses = transactions.filter((t) => t.type === "expense");

  const { categoryData, totalCategoryExpenses } = useMemo(() => {
    let total = 0;
    const grouped: Record<
      string,
      { label: string; value: number; color: string }
    > = {};

    expenses.forEach((t) => {
      const label = t.category?.name ?? "Outros";
      const color = t.category?.color ?? FALLBACK_COLORS[0];
      if (!grouped[label]) grouped[label] = { label, value: 0, color };
      grouped[label].value += t.amount;
      total += t.amount;
    });

    installments.forEach((i) => {
      if (i.paid_installments < i.total_installments && i.start_date <= to) {
        const label = (i as any).category?.name ?? "Cartão de Crédito";
        const color = (i as any).category?.color ?? FALLBACK_COLORS[2];
        if (!grouped[label]) grouped[label] = { label, value: 0, color };
        grouped[label].value += i.installment_amount;
        total += i.installment_amount;
      }
    });

    fixedExpenses.forEach((f) => {
      if (!f.is_paid) {
        const label = f.category?.name ?? "Contas Fixas";
        const color = f.category?.color ?? "#f59e0b";
        if (!grouped[label]) grouped[label] = { label, value: 0, color };
        grouped[label].value += f.amount;
        total += f.amount;
      }
    });

    const dataList = Object.values(grouped)
      .sort((a, b) => b.value - a.value)
      .map((item) => ({
        ...item,
        percentage:
          total > 0 ? Math.round((item.value / total) * 100) + "%" : "0%",
      }))
      .slice(0, 6);

    return { categoryData: dataList, totalCategoryExpenses: total };
  }, [expenses, installments, fixedExpenses]);

  const creditPurchasesChart = useMemo(() => {
    let total = 0;

    const activeInstallments = installments.filter(
      (i) => i.paid_installments < i.total_installments && i.start_date <= to,
    );

    const data = activeInstallments
      .map((i, index) => {
        total += i.total_amount;
        return {
          label: shortenLabel(i.title),
          value: i.total_amount,
          color: FALLBACK_COLORS[index % FALLBACK_COLORS.length],
        };
      })
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    const withPercentage = data.map((item) => ({
      ...item,
      percentage:
        total > 0 ? Math.round((item.value / total) * 100) + "%" : "0%",
    }));

    return { data: withPercentage, total };
  }, [installments]);

  const creditCardsStatus = useMemo(() => {
    const currentMonth = new Date().toISOString().slice(0, 7);
    const today = new Date();

    const creditAccounts = accounts.filter((acc) => acc.type === "credit");

    return creditAccounts
      .map((acc) => {
        const allRelevant = installments.filter(
          (i) =>
            i.account_id === acc.id &&
            (Number(i.paid_installments) < Number(i.total_installments) ||
              i.invoice_paid_month === currentMonth),
        );

        const currentInstallments = allRelevant.filter(
          (i) => !i.start_date || i.start_date <= to,
        );

        const pendingCurrent = currentInstallments.filter(
          (i) => i.invoice_paid_month !== currentMonth,
        );

        const isInvoicePaid =
          currentInstallments.length > 0 && pendingCurrent.length === 0;

        const invoiceTotal = currentInstallments.reduce(
          (sum, i) => sum + Number(i.installment_amount),
          0,
        );

        const allActiveForLimit = installments.filter(
          (i) =>
            i.account_id === acc.id &&
            i.paid_installments < i.total_installments,
        );
        const usedLimit = allActiveForLimit.reduce((sum, i) => {
          return (
            sum +
            (i.total_installments - i.paid_installments) * i.installment_amount
          );
        }, 0);
        const totalLimit = acc.balance || 0;
        const limitPercentage =
          totalLimit > 0 ? Math.min((usedLimit / totalLimit) * 100, 100) : 0;

        const dueDay = acc.due_day || 10;
        const dueDate = new Date(today.getFullYear(), today.getMonth(), dueDay);

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
    <SafeAreaView style={s.safe}>
      {/* 👇 BLOQUEIO DE ZOOM PARA NAVEGADORES */}

      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#6366f1"]}
            tintColor={"#6366f1"} // Adicionado para a bolinha também ficar roxa no iOS
          />
        }
      >
        <View style={s.header}>
          <View>
            <Text style={s.greeting}>Olá, {firstName} 👋</Text>
            <Text style={s.monthLabel}>{month}</Text>
          </View>
          <TouchableOpacity onPress={() => setIsMenuVisible(true)}>
            <Ionicons name="menu-outline" size={34} color="#111827" />
          </TouchableOpacity>
        </View>

        <View style={s.balanceCard}>
          <Text style={s.balanceLabel}>Saldo Atual (Todas as Contas)</Text>
          <Text
            style={[
              s.balanceValue,
              totalBalance < 0 ? { color: "#ef4444" } : { color: "#fff" },
            ]}
          >
            {totalBalance < 0 ? "⚠️ " : ""}
            {formatCurrency(totalBalance, currency)}
          </Text>

          <View style={s.balanceRow}>
            <View style={s.balanceItem}>
              <Text style={s.balanceItemLabel}>↑ Receitas</Text>
              <Text style={[s.balanceItemValue, { color: "#4ade80" }]}>
                {formatCurrency(summary.income, currency)}
              </Text>
            </View>
            <View style={s.divider} />
            <View style={s.balanceItem}>
              <Text style={s.balanceItemLabel}>↓ Despesas</Text>
              <Text style={[s.balanceItemValue, { color: "#f87171" }]}>
                {formatCurrency(summary.expense, currency)}
              </Text>
            </View>
          </View>
        </View>

        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>Minhas Contas</Text>
            <TouchableOpacity
              onPress={() =>
                router.push({
                  pathname: "/(tabs)/accounts",
                  params: {
                    id: "all",
                    name: "Todas as Contas",
                    color: "#6366f1",
                  },
                })
              }
            >
              <Text style={s.seeAll}>Ver todas</Text>
            </TouchableOpacity>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {accounts.map((account) => (
              <TouchableOpacity
                key={account.id}
                style={[
                  s.accountCard,
                  { borderLeftColor: account.color || "#6366f1" },
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
                <Text style={s.accountName}>{account.name}</Text>
                {account.type === "checking" ? (
                  <Text style={s.accountBalance}>
                    {formatCurrency(account.balance, account.currency)}
                  </Text>
                ) : (
                  <Text
                    style={[
                      s.accountBalance,
                      { fontSize: 12, color: "#9ca3af" },
                    ]}
                  >
                    Cartão de Crédito
                  </Text>
                )}
                <Text style={s.accountType}>
                  {account.type === "checking" ? "Conta Corrente" : "Crédito"}
                </Text>
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              activeOpacity={0.7}
              style={{
                width: 140,
                height: 90,
                borderRadius: 16,
                borderWidth: 2,
                borderColor: "#d1d5db",
                borderStyle: "dashed",
                justifyContent: "center",
                alignItems: "center",
                backgroundColor: "#f8fafc",
                marginRight: 16,
                marginLeft: accounts.length === 0 ? 0 : 8,
              }}
              onPress={() => router.push("/(tabs)/accounts?openModal=1")}
            >
              <Ionicons name="add-circle-outline" size={28} color="#9ca3af" />
              <Text
                style={{
                  color: "#6b7280",
                  fontSize: 13,
                  fontWeight: "600",
                  marginTop: 8,
                  textAlign: "center",
                }}
              >
                Criar Nova{"\n"}Conta
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        <ScrollView style={s.section}>
          <Text style={s.sectionTitle}>Faturas de Crédito Ativas</Text>
          <View
            style={[
              s.chartCard,
              { backgroundColor: "transparent", elevation: 0, padding: 0 },
            ]}
          >
            <CreditCardCarousel data={creditCardsStatus} currency={currency} />
          </View>
        </ScrollView>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Gastos por categoria</Text>
          <View style={s.chartCard}>
            {isLoading ? (
              <ActivityIndicator color="#6366f1" style={s.chartLoading} />
            ) : categoryData.length === 0 ? (
              <EmptyChart message="Nenhum gasto registrado este mês." />
            ) : (
              <>
                <View style={s.pieWrap}>
                  <PieChart
                    data={categoryData.map((item) => ({
                      value: item.value,
                      color: item.color,
                    }))}
                    donut
                    radius={82}
                    innerRadius={52}
                    centerLabelComponent={() => (
                      <View style={s.pieCenter}>
                        <Text style={s.pieCenterLabel}>Total</Text>
                        <Text style={s.pieCenterValue}>
                          {formatCurrency(totalCategoryExpenses, currency)}
                        </Text>
                      </View>
                    )}
                  />
                </View>
                <View style={s.legend}>
                  {categoryData.map((item) => (
                    <ChartLegendItem
                      key={item.label}
                      label={item.label}
                      color={item.color}
                      value={`${formatCurrency(item.value, currency)} (${item.percentage})`}
                    />
                  ))}
                </View>
              </>
            )}
          </View>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Maiores gastos no crédito</Text>
          <View style={s.chartCard}>
            {creditPurchasesChart.data.length === 0 ? (
              <EmptyChart message="Nenhuma compra de crédito cadastrada." />
            ) : (
              <>
                <View style={s.pieWrap}>
                  <PieChart
                    data={creditPurchasesChart.data.map((item) => ({
                      value: item.value,
                      color: item.color,
                    }))}
                    donut
                    radius={82}
                    innerRadius={52}
                    centerLabelComponent={() => (
                      <View style={s.pieCenter}>
                        <Text style={s.pieCenterLabel}>Total</Text>
                        <Text style={s.pieCenterValue}>
                          {formatCurrency(creditPurchasesChart.total, currency)}
                        </Text>
                      </View>
                    )}
                  />
                </View>
                <View style={s.legend}>
                  {creditPurchasesChart.data.map((item) => (
                    <ChartLegendItem
                      key={item.label}
                      label={item.label}
                      color={item.color}
                      value={`${formatCurrency(item.value, currency)} (${item.percentage})`}
                    />
                  ))}
                </View>
              </>
            )}
          </View>
        </View>
      </ScrollView>

      <Modal visible={isMenuVisible} transparent animationType="fade">
        <View style={s.menuOverlay}>
          <TouchableOpacity
            style={s.menuCloseArea}
            activeOpacity={1}
            onPress={() => setIsMenuVisible(false)}
          />
          <View style={s.menuContent}>
            <View style={s.menuHeader}>
              <Text style={s.menuTitle}>Menu</Text>
              <TouchableOpacity onPress={() => setIsMenuVisible(false)}>
                <Ionicons name="close" size={28} color="#111827" />
              </TouchableOpacity>
            </View>

            <View style={s.menuBody}>
              <TouchableOpacity
                style={s.menuItem}
                onPress={() => {
                  setIsMenuVisible(false);
                  alert("Em breve: Exportar para Excel");
                }}
              >
                <View
                  style={[s.menuIconWrapper, { backgroundColor: "#e0f2fe" }]}
                >
                  <Ionicons name="document-text" size={20} color="#0284c7" />
                </View>
                <Text style={s.menuItemText}>Exportar dados para planilha</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={s.menuItem}
                onPress={() => {
                  setIsMenuVisible(false);
                  alert("Em breve: Central de Ajuda");
                }}
              >
                <View
                  style={[s.menuIconWrapper, { backgroundColor: "#fef08a" }]}
                >
                  <Ionicons name="help-circle" size={22} color="#ca8a04" />
                </View>
                <Text style={s.menuItemText}>Ajuda e Tutorial</Text>
              </TouchableOpacity>
            </View>

            <View style={s.menuFooter}>
              <TouchableOpacity
                style={s.menuItem}
                onPress={() => {
                  setIsMenuVisible(false);
                  alert("Em breve: Configurações");
                }}
              >
                <Ionicons name="settings-outline" size={24} color="#4b5563" />
                <Text
                  style={[s.menuItemText, { color: "#4b5563", marginLeft: 16 }]}
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
                <Ionicons name="log-out-outline" size={24} color="#dc2626" />
                <Text
                  style={[s.menuItemText, { color: "#dc2626", marginLeft: 16 }]}
                >
                  Sair da conta
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function shortenLabel(label: string) {
  return label.length > 15 ? `${label.slice(0, 14)}...` : label;
}

function EmptyChart({ message }: { message: string }) {
  return (
    <View style={s.emptyChart}>
      <Text style={s.emptyText}>{message}</Text>
    </View>
  );
}

function ChartLegendItem({
  label,
  color,
  value,
}: {
  label: string;
  color: string;
  value: string;
}) {
  return (
    <View style={s.legendItem}>
      <View style={[s.legendDot, { backgroundColor: color }]} />
      <Text style={s.legendLabel} numberOfLines={1}>
        {label}
      </Text>
      <Text style={s.legendValue}>{value}</Text>
    </View>
  );
}

function TransactionItem({
  transaction: t,
  currency,
}: {
  transaction: Transaction;
  currency: string;
}) {
  const isIncome = t.type === "income";
  return (
    <View style={s.transactionItem}>
      <View
        style={[
          s.transactionIcon,
          { backgroundColor: t.category?.color ?? "#6366f1" + "20" },
        ]}
      >
        <Text style={s.transactionEmoji}>{isIncome ? "↑" : "↓"}</Text>
      </View>
      <View style={s.transactionInfo}>
        <Text style={s.transactionTitle}>{t.title}</Text>
        <Text style={s.transactionCategory}>
          {t.category?.name ?? "Sem categoria"}
        </Text>
      </View>
      <View style={s.transactionRight}>
        <Text
          style={[
            s.transactionAmount,
            { color: isIncome ? "#16a34a" : "#dc2626" },
          ]}
        >
          {isIncome ? "+" : "-"} {formatCurrency(t.amount, currency)}
        </Text>
        <Text style={s.transactionDate}>{formatDate(t.date)}</Text>
      </View>
    </View>
  );
}

function CreditCardCarousel({
  data,
  currency,
}: {
  data: any[];
  currency: string;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const router = useRouter();
  const CARD_WIDTH = 280;

  const handleScroll = (event: any) => {
    const scrollPosition = event.nativeEvent.contentOffset.x;
    const index = Math.round(scrollPosition / CARD_WIDTH);
    setActiveIndex(index);
  };

  const scrollToIndex = (index: number) => {
    if (index >= 0 && index <= data.length) {
      const offsetToScroll = index * (CARD_WIDTH + 16);
      flatListRef.current?.scrollToOffset({
        offset: offsetToScroll,
        animated: true,
      });
      setActiveIndex(index);
    }
  };

  return (
    <View style={s.carouselContainer}>
      <View style={s.carouselRow}>
        <TouchableOpacity
          onPress={() => scrollToIndex(activeIndex - 1)}
          style={s.arrowBtn}
        >
          <Text style={s.arrowText}>{"<"}</Text>
        </TouchableOpacity>

        <FlatList
          ref={flatListRef}
          data={data}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={CARD_WIDTH + 16}
          decelerationRate="fast"
          onScroll={handleScroll}
          scrollEventThrottle={16}
          keyExtractor={(item) => item.label}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 16 }}
          ListFooterComponent={
            <TouchableOpacity
              activeOpacity={0.7}
              style={{
                width: CARD_WIDTH,
                height: 190,
                borderRadius: 16,
                borderWidth: 2,
                borderColor: "#d1d5db",
                borderStyle: "dashed",
                justifyContent: "center",
                alignItems: "center",
                backgroundColor: "#f8fafc",
                marginHorizontal: 8,
              }}
              onPress={() => router.push("/(tabs)/accounts?openModal=1")}
            >
              <Ionicons name="card-outline" size={36} color="#9ca3af" />
              <Text
                style={{
                  color: "#6b7280",
                  fontSize: 16,
                  fontWeight: "bold",
                  marginTop: 12,
                }}
              >
                Novo Cartão
              </Text>
            </TouchableOpacity>
          }
          renderItem={({ item, index }) => {
            const isFocused = index === activeIndex;
            const nomeBanco = item.label.toLowerCase();
            let bgColor = item.color;
            if (nomeBanco.includes("nubank")) bgColor = "#8A05BE";
            if (nomeBanco.includes("itaú") || nomeBanco.includes("itau"))
              bgColor = "#EC7000";

            return (
              <View
                style={[
                  s.physicalCard,
                  {
                    backgroundColor: bgColor,
                    transform: [{ scale: isFocused ? 1 : 0.9 }],
                  },
                ]}
              >
                <View style={s.cardTop}>
                  <View style={s.chip}>
                    <View style={s.chipLine} />
                    <View style={s.chipLine} />
                    <View style={s.chipLine} />
                  </View>
                  <Text style={s.bankLogoText}>{item.label}</Text>
                </View>

                <View>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      marginBottom: 6,
                    }}
                  >
                    <View
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 5,
                        backgroundColor: item.statusColor,
                        marginRight: 6,
                        borderWidth: 1,
                        borderColor: "rgba(255,255,255,0.3)",
                      }}
                    />
                    <Text
                      style={{
                        color: item.statusColor,
                        fontSize: 13,
                        fontWeight: "bold",
                      }}
                    >
                      {item.statusLabel}
                    </Text>
                  </View>

                  <Text style={s.cardLabel}>Valor da Fatura</Text>
                  <Text style={s.cardAmount}>
                    {formatCurrency(item.value, currency)}
                  </Text>

                  <View style={{ marginTop: 12 }}>
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        marginBottom: 4,
                      }}
                    >
                      <Text
                        style={{ color: "rgba(255,255,255,0.8)", fontSize: 11 }}
                      >
                        Limite Utilizado
                      </Text>
                      <Text
                        style={{
                          color: "rgba(255,255,255,0.9)",
                          fontSize: 11,
                          fontWeight: "bold",
                        }}
                      >
                        {Math.round(item.limitPercentage)}%
                      </Text>
                    </View>
                    <View
                      style={{
                        height: 4,
                        backgroundColor: "rgba(255,255,255,0.3)",
                        borderRadius: 2,
                        overflow: "hidden",
                      }}
                    >
                      <View
                        style={{
                          width: `${item.limitPercentage}%`,
                          height: "100%",
                          backgroundColor:
                            item.limitPercentage > 90 ? "#f87171" : "#4ade80",
                        }}
                      />
                    </View>
                    <Text
                      style={{
                        color: "rgba(255,255,255,0.7)",
                        fontSize: 10,
                        marginTop: 4,
                      }}
                    >
                      Disp:{" "}
                      {formatCurrency(
                        item.totalLimit - item.usedLimit,
                        currency,
                      )}
                    </Text>
                  </View>
                </View>
              </View>
            );
          }}
        />

        <TouchableOpacity
          onPress={() => scrollToIndex(activeIndex + 1)}
          style={s.arrowBtn}
        >
          <Text style={s.arrowText}>{">"}</Text>
        </TouchableOpacity>
      </View>
      <View style={s.pagination}>
        {Array.from({ length: data.length + 1 }).map((_, index) => (
          <View
            key={index}
            style={[s.dot, activeIndex === index ? s.dotActive : s.dotInactive]}
          />
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  // 👇 ESTILO BLINDADO PARA NÃO VAZAR O TAMANHO DA JANELA
  safe: {
    flex: 1,
    backgroundColor: "#f8fafc",
    ...(Platform.OS === "web" ? { overflow: "hidden", maxWidth: "100%" } : {}),
  },
  scroll: { paddingBottom: 32 },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  greeting: { fontSize: 22, fontWeight: "bold", color: "#111827" },
  monthLabel: {
    fontSize: 13,
    color: "#6b7280",
    marginTop: 2,
    textTransform: "capitalize",
  },
  logoutBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: "#fee2e2",
  },
  logoutText: { color: "#dc2626", fontSize: 13, fontWeight: "600" },

  balanceCard: {
    margin: 20,
    borderRadius: 20,
    backgroundColor: "#6366f1",
    padding: 24,
  },
  balanceLabel: { color: "#c7d2fe", fontSize: 13, marginBottom: 6 },
  balanceValue: {
    color: "#fff",
    fontSize: 32,
    fontWeight: "bold",
    marginBottom: 20,
  },
  balanceRow: { flexDirection: "row", alignItems: "center" },
  balanceItem: { flex: 1 },
  balanceItemLabel: { color: "#c7d2fe", fontSize: 12, marginBottom: 4 },
  balanceItemValue: { fontSize: 16, fontWeight: "600" },
  divider: {
    width: 1,
    height: 32,
    backgroundColor: "#818cf8",
    marginHorizontal: 16,
  },

  section: { marginTop: 8, paddingHorizontal: 20, marginBottom: 16 },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 12,
  },
  seeAll: { fontSize: 13, color: "#6366f1", fontWeight: "600" },

  chartCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    overflow: "hidden",
  },
  chartLoading: { paddingVertical: 36 },
  pieWrap: { alignItems: "center", paddingVertical: 8 },
  pieCenter: { alignItems: "center", justifyContent: "center" },
  pieCenterLabel: { fontSize: 11, color: "#9ca3af", fontWeight: "600" },
  pieCenterValue: {
    fontSize: 12,
    color: "#111827",
    fontWeight: "800",
    marginTop: 2,
  },
  legend: { gap: 10, marginTop: 8 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 8 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { flex: 1, fontSize: 13, color: "#374151", fontWeight: "600" },
  legendValue: { fontSize: 13, color: "#111827", fontWeight: "700" },
  emptyChart: {
    minHeight: 120,
    alignItems: "center",
    justifyContent: "center",
  },

  transactionItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  transactionIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  transactionEmoji: { fontSize: 18 },
  transactionInfo: { flex: 1 },
  transactionTitle: { fontSize: 14, fontWeight: "600", color: "#111827" },
  transactionCategory: { fontSize: 12, color: "#9ca3af", marginTop: 2 },
  transactionRight: { alignItems: "flex-end" },
  transactionAmount: { fontSize: 14, fontWeight: "700" },
  transactionDate: { fontSize: 11, color: "#9ca3af", marginTop: 2 },
  empty: { paddingVertical: 20, alignItems: "center" },
  emptyText: { color: "#9ca3af", fontSize: 14, fontStyle: "italic" },

  carouselContainer: { alignItems: "center", marginTop: 4 },
  carouselRow: {
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
    justifyContent: "space-between",
    width: "100%",
  },
  arrowBtn: { padding: 8, zIndex: 10 },
  arrowText: { fontSize: 24, fontWeight: "bold", color: "#9ca3af" },
  physicalCard: {
    width: 280,
    height: 190,
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 8,
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  chip: {
    width: 38,
    height: 28,
    backgroundColor: "#fbbf24",
    borderRadius: 6,
    justifyContent: "space-evenly",
    paddingHorizontal: 4,
    opacity: 0.9,
  },
  chipLine: { height: 1, backgroundColor: "#d97706", width: "100%" },
  bankLogoText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "900",
    textTransform: "uppercase",
    opacity: 0.9,
  },
  cardLabel: { color: "rgba(255,255,255,0.7)", fontSize: 12, marginBottom: 2 },
  cardAmount: {
    color: "#fff",
    fontSize: 26,
    fontWeight: "bold",
    letterSpacing: 1,
  },
  pagination: { flexDirection: "row", marginTop: 20, gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotActive: { backgroundColor: "#6366f1", width: 20 },
  dotInactive: { backgroundColor: "#cbd5e1" },
  accountCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginRight: 12,
    minWidth: 140,
    borderLeftWidth: 4,
    elevation: 2,
  },
  accountName: {
    fontSize: 13,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 6,
  },
  accountBalance: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#111827",
    marginBottom: 4,
  },
  accountType: { fontSize: 11, color: "#9ca3af", textTransform: "capitalize" },
  emptyAccounts: {
    padding: 20,
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderStyle: "dashed",
    width: 200,
    alignItems: "center",
  },
  emptyAccountsText: { color: "#6b7280", fontSize: 13, fontWeight: "600" },

  menuOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  menuCloseArea: { flex: 1 },
  menuContent: {
    width: "75%",
    maxWidth: 320,
    height: "100%",
    backgroundColor: "#fff",
    padding: 24,
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOffset: { width: -2, height: 0 },
    shadowOpacity: 0.2,
    elevation: 5,
  },
  menuHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 40,
    marginTop: Platform.OS === "ios" ? 40 : 10,
  },
  menuTitle: { fontSize: 24, fontWeight: "bold", color: "#111827" },
  menuBody: { flex: 1 },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  menuIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  menuItemText: { fontSize: 16, color: "#111827", fontWeight: "600", flex: 1 },
  menuFooter: {
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    paddingTop: 16,
    paddingBottom: Platform.OS === "ios" ? 20 : 0,
  },
});
