import { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { transactionService, installmentService } from "@/services";
import { formatCurrency, formatDate, formatDateFull } from "@/utils";
import type { Transaction, Installment } from "@/types";

type Tab = "debito" | "credito" | "historico";
type Period = "day" | "week" | "month";

type PeriodRange = {
  from: string;
  to: string;
  label: string;
};

const PERIODS: { value: Period; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
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

  const [tab, setTab] = useState<Tab>("debito");
  const [period, setPeriod] = useState<Period>("month");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    setIsLoading(true);
    const { data: txData } = await transactionService.list({ account_id: id });
    setTransactions(txData ?? []);

    const { data: instData } = await installmentService.list();
    setInstallments((instData ?? []).filter((i) => i.account_id === id));

    setIsLoading(false);
  };

  const income = transactions.filter((t) => t.type === "income");
  const expense = transactions.filter((t) => t.type === "expense");
  const totalIn = income.reduce((sum, t) => sum + t.amount, 0);
  const totalOut = expense.reduce((sum, t) => sum + t.amount, 0);

  const periodRange = useMemo(() => getPeriodRange(period), [period]);
  const historyTransactions = useMemo(
    () => transactions.filter((t) => isDateInsideRange(t.date, periodRange)),
    [transactions, periodRange],
  );
  const historyTotals = historyTransactions.reduce(
    (acc, t) => {
      if (t.type === "income") acc.income += t.amount;
      if (t.type === "expense") acc.expense += t.amount;
      return acc;
    },
    { income: 0, expense: 0 },
  );

  const accountCurrency = currency ?? "BRL";
  const accountColor = color ?? "#6366f1";

  return (
    <SafeAreaView style={s.safe}>
      <View style={[s.header, { backgroundColor: accountColor }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.back}>
          <Ionicons name="chevron-back" size={18} color="rgba(255,255,255,0.86)" />
          <Text style={s.backText}>Voltar</Text>
        </TouchableOpacity>
        <Text style={s.accountName}>{name}</Text>
        <Text style={s.accountBalance}>
          {formatCurrency(Number(balance), accountCurrency)}
        </Text>
        <View style={s.headerRow}>
          <View style={s.headerStat}>
            <View style={s.headerStatLabelRow}>
              <Ionicons name="arrow-up-circle" size={14} color="#bbf7d0" />
              <Text style={s.headerStatLabel}>Entradas</Text>
            </View>
            <Text style={s.headerStatValue}>
              {formatCurrency(totalIn, accountCurrency)}
            </Text>
          </View>
          <View style={s.headerDivider} />
          <View style={s.headerStat}>
            <View style={s.headerStatLabelRow}>
              <Ionicons name="arrow-down-circle" size={14} color="#fecaca" />
              <Text style={s.headerStatLabel}>Saidas</Text>
            </View>
            <Text style={s.headerStatValue}>
              {formatCurrency(totalOut, accountCurrency)}
            </Text>
          </View>
        </View>
      </View>

      <View style={s.tabs}>
        <TabButton
          active={tab === "debito"}
          label={`Debito (${transactions.length})`}
          icon="swap-vertical-outline"
          onPress={() => setTab("debito")}
        />
        <TabButton
          active={tab === "credito"}
          label={`Credito (${installments.length})`}
          icon="card-outline"
          onPress={() => setTab("credito")}
        />
        <TabButton
          active={tab === "historico"}
          label="Historico"
          icon="time-outline"
          onPress={() => setTab("historico")}
        />
      </View>

      {isLoading ? (
        <ActivityIndicator color="#6366f1" style={{ marginTop: 32 }} />
      ) : tab === "debito" ? (
        <FlatList
          data={transactions}
          keyExtractor={(t) => t.id}
          contentContainerStyle={s.list}
          ListEmptyComponent={<EmptyState text="Nenhuma transacao nesta conta" />}
          renderItem={({ item }) => (
            <TransactionRow transaction={item} currency={accountCurrency} />
          )}
        />
      ) : tab === "credito" ? (
        <FlatList
          data={installments}
          keyExtractor={(i) => i.id}
          contentContainerStyle={s.list}
          ListEmptyComponent={<EmptyState text="Nenhuma compra parcelada nesta conta" />}
          renderItem={({ item }) => (
            <InstallmentCard installment={item} currency={accountCurrency} />
          )}
        />
      ) : (
        <FlatList
          data={historyTransactions}
          keyExtractor={(t) => t.id}
          contentContainerStyle={s.list}
          ListHeaderComponent={
            <HistoryHeader
              period={period}
              onChangePeriod={setPeriod}
              range={periodRange}
              income={historyTotals.income}
              expense={historyTotals.expense}
              currency={accountCurrency}
            />
          }
          ListEmptyComponent={<EmptyState text="Nenhum movimento neste periodo" />}
          renderItem={({ item }) => (
            <TransactionRow transaction={item} currency={accountCurrency} />
          )}
        />
      )}
    </SafeAreaView>
  );
}

function TabButton({
  active,
  label,
  icon,
  onPress,
}: {
  active: boolean;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={[s.tab, active && s.tabActive]} onPress={onPress}>
      <Ionicons name={icon} size={16} color={active ? "#6366f1" : "#9ca3af"} />
      <Text style={[s.tabText, active && s.tabTextActive]}>{label}</Text>
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
}: {
  period: Period;
  onChangePeriod: (period: Period) => void;
  range: PeriodRange;
  income: number;
  expense: number;
  currency: string;
}) {
  return (
    <View style={s.historyHeader}>
      <View style={s.periodRow}>
        {PERIODS.map((item) => {
          const active = period === item.value;
          return (
            <TouchableOpacity
              key={item.value}
              style={[s.periodBtn, active && s.periodBtnActive]}
              onPress={() => onChangePeriod(item.value)}
            >
              <Ionicons
                name={item.icon}
                size={15}
                color={active ? "#fff" : "#6b7280"}
              />
              <Text style={[s.periodText, active && s.periodTextActive]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={s.historyRange}>{range.label}</Text>

      <View style={s.historyCards}>
        <View style={[s.historyCard, { borderLeftColor: "#16a34a" }]}>
          <View style={s.historyCardLabelRow}>
            <Ionicons name="trending-up" size={16} color="#16a34a" />
            <Text style={s.historyCardLabel}>Recebido</Text>
          </View>
          <Text style={[s.historyCardValue, { color: "#16a34a" }]}>
            {formatCurrency(income, currency)}
          </Text>
        </View>
        <View style={[s.historyCard, { borderLeftColor: "#dc2626" }]}>
          <View style={s.historyCardLabelRow}>
            <Ionicons name="trending-down" size={16} color="#dc2626" />
            <Text style={s.historyCardLabel}>Gasto</Text>
          </View>
          <Text style={[s.historyCardValue, { color: "#dc2626" }]}>
            {formatCurrency(expense, currency)}
          </Text>
        </View>
      </View>

      <View style={s.netCard}>
        <Text style={s.netLabel}>Resultado do periodo</Text>
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

function TransactionRow({
  transaction: t,
  currency,
}: {
  transaction: Transaction;
  currency: string;
}) {
  const isIncome = t.type === "income";
  const color = isIncome ? "#16a34a" : "#dc2626";

  return (
    <View style={s.item}>
      <View style={[s.itemIcon, { backgroundColor: `${color}18` }]}>
        <Ionicons name={isIncome ? "arrow-up" : "arrow-down"} size={20} color={color} />
      </View>
      <View style={s.itemInfo}>
        <Text style={s.itemTitle}>{t.title}</Text>
        <Text style={s.itemSub}>
          {t.category?.name ?? "Sem categoria"} · {formatDate(t.date)}
        </Text>
      </View>
      <Text style={[s.itemAmount, { color }]}>
        {isIncome ? "+" : "-"}
        {formatCurrency(t.amount, currency)}
      </Text>
    </View>
  );
}

function InstallmentCard({
  installment: i,
  currency,
}: {
  installment: Installment;
  currency: string;
}) {
  const isDone = i.paid_installments >= i.total_installments;
  const progress = Math.round((i.paid_installments / i.total_installments) * 100);

  return (
    <View style={s.installCard}>
      <View style={s.installTop}>
        <View style={s.installTitleRow}>
          <Ionicons name="card-outline" size={18} color="#6366f1" />
          <Text style={s.installTitle}>{i.title}</Text>
        </View>
        <View style={s.installStatusRow}>
          {isDone && <Ionicons name="checkmark-circle" size={15} color="#16a34a" />}
          <Text style={[s.installStatus, { color: isDone ? "#16a34a" : "#6366f1" }]}>
            {isDone ? "Quitado" : `${i.paid_installments}/${i.total_installments}`}
          </Text>
        </View>
      </View>
      <View style={s.progressBar}>
        <View
          style={[
            s.progressFill,
            {
              width: `${progress}%` as any,
              backgroundColor: isDone ? "#16a34a" : "#6366f1",
            },
          ]}
        />
      </View>
      <View style={s.installBottom}>
        <Text style={s.installSub}>
          {formatCurrency(i.installment_amount, i.currency ?? currency)}/mes
        </Text>
        <Text style={s.installTotal}>
          Total: {formatCurrency(i.total_amount, i.currency ?? currency)}
        </Text>
      </View>
    </View>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <View style={s.empty}>
      <Ionicons name="file-tray-outline" size={30} color="#cbd5e1" />
      <Text style={s.emptyText}>{text}</Text>
    </View>
  );
}

function getPeriodRange(period: Period): PeriodRange {
  const now = new Date();
  const start = new Date(now);
  const end = new Date(now);

  if (period === "day") {
    return {
      from: toDateKey(start),
      to: toDateKey(end),
      label: formatDateFull(toDateKey(now)),
    };
  }

  if (period === "week") {
    const day = now.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    start.setDate(now.getDate() + diffToMonday);
    end.setDate(start.getDate() + 6);
    return {
      from: toDateKey(start),
      to: toDateKey(end),
      label: `${formatDate(start.toISOString())} ate ${formatDate(end.toISOString())}`,
    };
  }

  start.setDate(1);
  end.setMonth(now.getMonth() + 1, 0);
  return {
    from: toDateKey(start),
    to: toDateKey(end),
    label: new Intl.DateTimeFormat("pt-BR", {
      month: "long",
      year: "numeric",
    }).format(now),
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

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f8fafc" },
  header: { padding: 20, paddingTop: 12, paddingBottom: 24 },
  back: { flexDirection: "row", alignItems: "center", gap: 3, marginBottom: 12 },
  backText: { color: "rgba(255,255,255,0.86)", fontSize: 14, fontWeight: "600" },
  accountName: { color: "#fff", fontSize: 20, fontWeight: "bold", marginBottom: 4 },
  accountBalance: { color: "#fff", fontSize: 32, fontWeight: "bold", marginBottom: 16 },
  headerRow: { flexDirection: "row" },
  headerStat: { flex: 1 },
  headerStatLabelRow: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 2 },
  headerStatLabel: { color: "rgba(255,255,255,0.78)", fontSize: 12 },
  headerStatValue: { color: "#fff", fontSize: 15, fontWeight: "700" },
  headerDivider: { width: 1, backgroundColor: "rgba(255,255,255,0.3)", marginHorizontal: 16 },
  tabs: { flexDirection: "row", backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#e5e7eb" },
  tab: { flex: 1, paddingVertical: 12, alignItems: "center", gap: 3 },
  tabActive: { borderBottomWidth: 2, borderBottomColor: "#6366f1" },
  tabText: { fontSize: 12, color: "#9ca3af", fontWeight: "700" },
  tabTextActive: { color: "#6366f1" },
  list: { padding: 16, paddingBottom: 32 },
  item: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 12, padding: 14, marginBottom: 8 },
  itemIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", marginRight: 12 },
  itemInfo: { flex: 1 },
  itemTitle: { fontSize: 14, fontWeight: "600", color: "#111827" },
  itemSub: { fontSize: 12, color: "#9ca3af", marginTop: 2 },
  itemAmount: { fontSize: 14, fontWeight: "700" },
  installCard: { backgroundColor: "#fff", borderRadius: 12, padding: 14, marginBottom: 10 },
  installTop: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10, gap: 12 },
  installTitleRow: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  installTitle: { fontSize: 14, fontWeight: "700", color: "#111827", flex: 1 },
  installStatusRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  installStatus: { fontSize: 13, fontWeight: "700" },
  progressBar: { height: 6, backgroundColor: "#e5e7eb", borderRadius: 3, marginBottom: 8 },
  progressFill: { height: 6, borderRadius: 3 },
  installBottom: { flexDirection: "row", justifyContent: "space-between" },
  installSub: { fontSize: 12, color: "#6366f1", fontWeight: "600" },
  installTotal: { fontSize: 12, color: "#9ca3af" },
  historyHeader: { marginBottom: 12 },
  periodRow: { flexDirection: "row", backgroundColor: "#eef2ff", borderRadius: 12, padding: 4, marginBottom: 12 },
  periodBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 9, borderRadius: 9 },
  periodBtnActive: { backgroundColor: "#6366f1" },
  periodText: { color: "#6b7280", fontSize: 12, fontWeight: "700" },
  periodTextActive: { color: "#fff" },
  historyRange: { color: "#6b7280", fontSize: 13, fontWeight: "600", marginBottom: 10, textTransform: "capitalize" },
  historyCards: { flexDirection: "row", gap: 10, marginBottom: 10 },
  historyCard: { flex: 1, backgroundColor: "#fff", borderRadius: 12, padding: 12, borderLeftWidth: 4 },
  historyCardLabelRow: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 5 },
  historyCardLabel: { color: "#6b7280", fontSize: 12, fontWeight: "600" },
  historyCardValue: { fontSize: 15, fontWeight: "800" },
  netCard: { backgroundColor: "#fff", borderRadius: 12, padding: 14, marginBottom: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  netLabel: { color: "#6b7280", fontSize: 13, fontWeight: "600" },
  netValue: { fontSize: 16, fontWeight: "800" },
  empty: { alignItems: "center", paddingVertical: 56, gap: 8 },
  emptyText: { fontSize: 14, color: "#9ca3af", textAlign: "center" },
});
