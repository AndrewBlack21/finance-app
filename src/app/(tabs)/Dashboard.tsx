import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/hooks/useAuth";
import { useTransactions } from "@/hooks/useTransactions";
import { useAccounts } from "@/hooks/useAccounts";
import {
  formatCurrency,
  formatDate,
  getCurrentMonthRange,
  getCurrentMonthName,
} from "@/utils";
import type { Transaction } from "@/types";

// ============================================================
// DASHBOARD MOBILE
// ============================================================
export default function DashboardScreen() {
  const { profile, logout } = useAuth();
  const { from, to } = getCurrentMonthRange();

  // TransaÃ§Ãµes filtradas pelo mÃªs atual
  const { transactions, summary, isLoading } = useTransactions({
    date_from: from,
    date_to: to,
  });
  const { accounts, totalBalance } = useAccounts();

  const firstName = profile?.name?.split(" ")[0] ?? "UsuÃ¡rio";
  const month = getCurrentMonthName();

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* HEADER */}
        <View style={s.header}>
          <View>
            <View style={s.greetingRow}>
              <Text style={s.greeting}>Ola, {firstName}</Text>
              <Ionicons name="sparkles" size={18} color="#6366f1" />
            </View>
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
            {formatCurrency(totalBalance, profile?.currency ?? "BRL")}
          </Text>
          <View style={s.balanceRow}>
            <View style={s.balanceItem}>
              <View style={s.balanceItemLabelRow}>
                <Ionicons name="arrow-up-circle" size={14} color="#4ade80" />
                <Text style={s.balanceItemLabel}>Receitas</Text>
              </View>
              <Text style={[s.balanceItemValue, { color: "#4ade80" }]}>
                {formatCurrency(summary.income, profile?.currency ?? "BRL")}
              </Text>
            </View>
            <View style={s.divider} />
            <View style={s.balanceItem}>
              <View style={s.balanceItemLabelRow}>
                <Ionicons name="arrow-down-circle" size={14} color="#f87171" />
                <Text style={s.balanceItemLabel}>Despesas</Text>
              </View>
              <Text style={[s.balanceItemValue, { color: "#f87171" }]}>
                {formatCurrency(summary.expense, profile?.currency ?? "BRL")}
              </Text>
            </View>
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

        {/* As Ultimas Transações */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>As Ultimas Transações</Text>
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
                  currency={profile?.currency ?? "BRL"}
                />
              ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ============================================================
// ITEM DE TRANSAÃ‡ÃƒO â€” componente local (usado sÃ³ aqui)
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
      {/* Ãcone de categoria */}
      <View
        style={[
          s.transactionIcon,
          { backgroundColor: t.category?.color ?? "#6366f1" + "20" },
        ]}
      >
        <Ionicons
          name={isIncome ? "arrow-up" : "arrow-down"}
          size={20}
          color={isIncome ? "#16a34a" : "#dc2626"}
        />
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
  greetingRow: { flexDirection: "row", alignItems: "center", gap: 6 },
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
  balanceItemLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 4,
  },
  balanceItemLabel: { color: "#c7d2fe", fontSize: 12 },
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
  transactionInfo: { flex: 1 },
  transactionTitle: { fontSize: 14, fontWeight: "600", color: "#111827" },
  transactionCategory: { fontSize: 12, color: "#9ca3af", marginTop: 2 },
  transactionRight: { alignItems: "flex-end" },
  transactionAmount: { fontSize: 14, fontWeight: "700" },
  transactionDate: { fontSize: 11, color: "#9ca3af", marginTop: 2 },

  // Empty
  empty: { alignItems: "center", paddingVertical: 32 },
  emptyText: { color: "#9ca3af", fontSize: 14 },
});
