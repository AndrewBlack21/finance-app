import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { BarChart, PieChart } from "react-native-gifted-charts";
import { useAuth } from "@/hooks/useAuth";
import { useTransactions } from "@/hooks/useTransactions";
import { useAccounts } from "@/hooks/useAccounts";
import { useInstallments } from "@/hooks/useInstallments";
import {
  formatCurrency,
  formatDate,
  getCurrentMonthRange,
  getCurrentMonthName,
} from "@/utils";
import type { Installment, Transaction } from "@/types";

const FALLBACK_COLORS = [
  "#6366f1",
  "#14b8a6",
  "#f97316",
  "#ec4899",
  "#22c55e",
  "#0ea5e9",
];

// ============================================================
// DASHBOARD MOBILE
// ============================================================
export default function DashboardScreen() {
  const { profile, logout } = useAuth();
  const router = useRouter();
  const { from, to } = getCurrentMonthRange();
  const { width } = useWindowDimensions();

  // Transações filtradas pelo mês atual
  const { transactions, summary, isLoading } = useTransactions({
    date_from: from,
    date_to: to,
  });
  const { accounts, totalBalance } = useAccounts();
  const { installments } = useInstallments();

  const firstName = profile?.name?.split(" ")[0] ?? "Usuário";
  const month = getCurrentMonthName();
  const currency = profile?.currency ?? "BRL";
  const chartWidth = Math.max(width - 72, 260);
  const expenses = transactions.filter((t) => t.type === "expense");
  const creditExpenses = expenses.filter((t) => t.account?.type === "credit");
  const categoryExpenses = groupTransactionsByCategory(expenses);
  const creditCategoryExpenses = groupTransactionsByCategory(creditExpenses);
  const topCreditPurchases = getTopCreditPurchases(installments);
  const maxCreditPurchase = Math.max(
    ...topCreditPurchases.map((item) => item.value),
    0,
  );

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* HEADER */}
        <View style={s.header}>
          <View>
            <Text style={s.greeting}>Olá, {firstName} 👋</Text>
            <Text style={s.monthLabel}>{month}</Text>
          </View>
          <TouchableOpacity style={s.logoutBtn} onPress={logout}>
            <Text style={s.logoutText}>Sair</Text>
          </TouchableOpacity>
        </View>

        {/* CARD SALDO TOTAL */}
        <View style={s.balanceCard}>
          <Text style={s.balanceLabel}>Saldo total</Text>
          <Text style={s.balanceValue}>
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

        {/* GRAFICOS */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Gastos por categoria</Text>
          <View style={s.chartCard}>
            {isLoading ? (
              <ActivityIndicator color="#6366f1" style={s.chartLoading} />
            ) : categoryExpenses.length === 0 ? (
              <EmptyChart message="Nenhum gasto por categoria este mes" />
            ) : (
              <>
                <View style={s.pieWrap}>
                  <PieChart
                    data={categoryExpenses.map((item) => ({
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
                          {formatCurrency(summary.expense, currency)}
                        </Text>
                      </View>
                    )}
                  />
                </View>
                <View style={s.legend}>
                  {categoryExpenses.map((item) => (
                    <ChartLegendItem
                      key={item.label}
                      label={item.label}
                      color={item.color}
                      value={formatCurrency(item.value, currency)}
                    />
                  ))}
                </View>
              </>
            )}
          </View>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Maiores gastos no credito</Text>
          <View style={s.chartCard}>
            {topCreditPurchases.length === 0 ? (
              <EmptyChart message="Nenhuma compra de credito cadastrada" />
            ) : (
              <BarChart
                data={topCreditPurchases.map((item, index) => ({
                  value: item.value,
                  label: item.label,
                  frontColor: FALLBACK_COLORS[index % FALLBACK_COLORS.length],
                  topLabelComponent: () => (
                    <Text style={s.barValue}>
                      {formatCompactCurrency(item.value, currency)}
                    </Text>
                  ),
                }))}
                width={chartWidth}
                height={180}
                barWidth={34}
                spacing={18}
                initialSpacing={10}
                maxValue={maxCreditPurchase || 1}
                noOfSections={4}
                yAxisThickness={0}
                xAxisThickness={0}
                rulesColor="#e5e7eb"
                yAxisTextStyle={s.axisText}
                xAxisLabelTextStyle={s.axisLabel}
                isAnimated
              />
            )}
          </View>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Categorias mais usadas no credito</Text>
          <View style={s.chartCard}>
            {creditCategoryExpenses.length === 0 ? (
              <EmptyChart message="Sem gastos de cartao categorizados este mes" />
            ) : (
              <View style={s.categoryBars}>
                {creditCategoryExpenses.map((item) => (
                  <CategoryProgress
                    key={item.label}
                    label={item.label}
                    color={item.color}
                    value={item.value}
                    total={creditCategoryExpenses[0]?.value ?? item.value}
                    currency={currency}
                  />
                ))}
              </View>
            )}
          </View>
        </View>

        {/* CONTAS */}
        {accounts.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Minhas Contas</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {accounts.map((account) => (
                <View
                  key={account.id}
                  style={[s.accountCard, { borderLeftColor: account.color }]}
                >
                  <Text style={s.accountName}>{account.name}</Text>
                  <Text style={s.accountBalance}>
                    {formatCurrency(account.balance, account.currency)}
                  </Text>
                  <Text style={s.accountType}>{account.type}</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* ÚLTIMAS TRANSAÇÕES */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>Últimas Transações</Text>
            <Text style={s.seeAll}>Ver todas</Text>
          </View>

          {isLoading && (
            <ActivityIndicator color="#6366f1" style={{ marginTop: 16 }} />
          )}

          {!isLoading && transactions.length === 0 && (
            <View style={s.empty}>
              <Text style={s.emptyText}>Nenhuma transação este mês</Text>
            </View>
          )}

          {!isLoading &&
            transactions
              .slice(0, 5)
              .map((t) => (
                <TransactionItem
                  key={t.id}
                  transaction={t}
                  currency={currency}
                />
              ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function groupTransactionsByCategory(transactions: Transaction[]) {
  const grouped = transactions.reduce<Record<string, ChartSummary>>(
    (acc, transaction) => {
      const label = transaction.category?.name ?? "Sem categoria";
      const color =
        transaction.category?.color ??
        FALLBACK_COLORS[Object.keys(acc).length % FALLBACK_COLORS.length];

      if (!acc[label]) acc[label] = { label, value: 0, color };
      acc[label].value += transaction.amount;
      return acc;
    },
    {},
  );

  return Object.values(grouped)
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);
}

function getTopCreditPurchases(installments: Installment[]) {
  return installments
    .map((item) => ({
      label: shortenLabel(item.title),
      value: item.total_amount,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);
}

function shortenLabel(label: string) {
  return label.length > 9 ? `${label.slice(0, 8)}.` : label;
}

function formatCompactCurrency(amount: number, currency: string) {
  if (amount >= 1000) return `${formatCurrency(amount / 1000, currency)} mil`;
  return formatCurrency(amount, currency);
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

function CategoryProgress({
  label,
  color,
  value,
  total,
  currency,
}: {
  label: string;
  color: string;
  value: number;
  total: number;
  currency: string;
}) {
  const fillWidth = total > 0 ? `${Math.max((value / total) * 100, 8)}%` : "0%";

  return (
    <View style={s.progressItem}>
      <View style={s.progressTop}>
        <Text style={s.progressLabel}>{label}</Text>
        <Text style={s.progressValue}>{formatCurrency(value, currency)}</Text>
      </View>
      <View style={s.progressTrack}>
        <View
          style={[
            s.progressFill,
            { width: fillWidth as any, backgroundColor: color },
          ]}
        />
      </View>
    </View>
  );
}

// ============================================================
// ITEM DE TRANSAÇÃO — componente local (usado só aqui)
// ============================================================
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
      {/* Ícone de categoria */}
      <View
        style={[
          s.transactionIcon,
          { backgroundColor: t.category?.color ?? "#6366f1" + "20" },
        ]}
      >
        <Text style={s.transactionEmoji}>{isIncome ? "↑" : "↓"}</Text>
      </View>

      {/* Info */}
      <View style={s.transactionInfo}>
        <Text style={s.transactionTitle}>{t.title}</Text>
        <Text style={s.transactionCategory}>
          {t.category?.name ?? "Sem categoria"}
        </Text>
      </View>

      {/* Valor + data */}
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

type ChartSummary = {
  label: string;
  value: number;
  color: string;
};

// ============================================================
// STYLES
// ============================================================
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f8fafc" },
  scroll: { paddingBottom: 32 },

  // Header
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

  // Balance card
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

  // Accounts
  accountCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginRight: 12,
    minWidth: 140,
    borderLeftWidth: 4,
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

  // Section
  section: { marginTop: 8, paddingHorizontal: 20 },
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

  // Charts
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
  barValue: {
    width: 58,
    textAlign: "center",
    fontSize: 10,
    color: "#6b7280",
    fontWeight: "700",
  },
  axisText: { color: "#9ca3af", fontSize: 10 },
  axisLabel: { color: "#6b7280", fontSize: 10, fontWeight: "600" },
  categoryBars: { gap: 14 },
  progressItem: { gap: 8 },
  progressTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  progressLabel: { flex: 1, fontSize: 13, color: "#374151", fontWeight: "700" },
  progressValue: { fontSize: 13, color: "#111827", fontWeight: "700" },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: "#e5e7eb",
    overflow: "hidden",
  },
  progressFill: { height: 8, borderRadius: 4 },
  emptyChart: { minHeight: 120, alignItems: "center", justifyContent: "center" },

  // Transaction item
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

  empty: {
    paddingVertical: 20,
    alignItems: "center",
  },
  emptyAccounts: {
    backgroundColor: "#f5f3ff",
    borderRadius: 12,
    padding: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e0e7ff",
    borderStyle: "dashed",
  },
  emptyAccountsText: { color: "#6366f1", fontWeight: "600", fontSize: 14 },
  emptyText: { color: "#9ca3af", fontSize: 14 },
});
