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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAccounts } from "@/hooks/useAccounts";
import { Ionicons } from "@expo/vector-icons";
import { transactionService, installmentService } from "@/services";
import { formatCurrency, formatDate, formatDateFull } from "@/utils";
import type { Transaction, Installment } from "@/types";
import { useInstallments } from "@/hooks/useInstallments";

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

  const [tab, setTab] = useState<Tab>("debito");
  const [newBankName, setNewBankName] = useState("");
  const [newBankColor, setNewBankColor] = useState("#830ad1");
  const [period, setPeriod] = useState<Period>("month");

  // Estado para controlar a data base do histórico
  const [baseDate, setBaseDate] = useState(new Date());
  const [monthPickerVisible, setMonthPickerVisible] = useState(false);

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);

  const { openModal } = useLocalSearchParams<{ openModal?: string }>();
  const { create: createAccount } = useAccounts();

  useEffect(() => {
    loadData();
  }, [id]);

  useEffect(() => {
    if (openModal === "1") {
      setModalVisible(true);
      router.setParams({ openModal: "" });
    }
  }, [openModal]);

  const loadData = async () => {
    setIsLoading(true);
    const [txResult, instResult] = await Promise.all([
      transactionService.list({ account_id: id }),
      installmentService.list(),
    ]);
    setTransactions(txResult.data ?? []);
    setInstallments((instResult.data ?? []).filter((i) => i.account_id === id));
    setIsLoading(false);
  };

  const income = transactions.filter((t) => t.type === "income");
  const expense = transactions.filter((t) => t.type === "expense");
  const totalIn = income.reduce((sum, t) => sum + t.amount, 0);
  const totalOut = expense.reduce((sum, t) => sum + t.amount, 0);

  // Calcula o Range usando a baseDate (data selecionada pelo utilizador)
  const periodRange = useMemo(
    () => getPeriodRange(period, baseDate),
    [period, baseDate],
  );

  // 1. Cria uma lista unificada juntando Débito e Crédito para o Histórico
  const unifiedHistory = useMemo(() => {
    // A. Pega nas transações normais (Débito/Entradas)
    const txs = transactions
      .filter((t) => isDateInsideRange(t.date, periodRange))
      .map((t) => ({
        ...t,
        isCredit: false,
        displayDate: t.date,
      }));

    // B. Pega nas compras parceladas (Crédito) e transforma-as em despesas
    const insts = installments
      .map((i) => {
        const dateString = i.start_date
          ? i.start_date.split("T")[0]
          : i.created_at.split("T")[0];
        return {
          ...i,
          type: "expense", // Força a ser despesa para abater no resultado
          amount: i.installment_amount, // Usa o valor da parcela
          isCredit: true,
          displayDate: dateString,
        };
      })
      .filter((i) => isDateInsideRange(i.displayDate, periodRange));

    // C. Junta tudo e ordena da data mais recente para a mais antiga
    return [...txs, ...insts].sort((a, b) =>
      b.displayDate.localeCompare(a.displayDate),
    );
  }, [transactions, installments, periodRange]);

  // 2. Calcula os totais com base na lista unificada
  const historyTotals = unifiedHistory.reduce(
    (acc, item) => {
      if (item.type === "income") acc.income += item.amount;
      if (item.type === "expense") acc.expense += item.amount;
      return acc;
    },
    { income: 0, expense: 0 },
  );

  const accountCurrency = currency ?? "BRL";
  const accountColor = color ?? "#6366f1";

  // Nomes dos meses para o Picker
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
    <SafeAreaView style={s.safe}>
      <View style={[s.header, { backgroundColor: accountColor }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.back}>
          <Ionicons
            name="chevron-back"
            size={18}
            color="rgba(255,255,255,0.86)"
          />
          <Text style={s.backText}>Voltar</Text>
        </TouchableOpacity>
        <Text style={s.accountName}>{name}</Text>
        <Text style={s.accountBalance}>
          {formatCurrency(parseFloat(balance ?? "0") || 0, accountCurrency)}
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
          label={`Debito`}
          icon="swap-vertical-outline"
          onPress={() => setTab("debito")}
        />
        <TabButton
          active={tab === "credito"}
          label={`Credito`}
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
          ListEmptyComponent={
            <EmptyState text="Nenhuma transação nesta conta" />
          }
          // Passamos displayDate para manter o componente TransactionRow genérico
          renderItem={({ item }) => (
            <TransactionRow
              item={{ ...item, displayDate: item.date }}
              currency={accountCurrency}
            />
          )}
        />
      ) : tab === "credito" ? (
        <FlatList
          data={installments}
          keyExtractor={(i) => i.id}
          contentContainerStyle={s.list}
          ListEmptyComponent={
            <EmptyState text="Nenhuma compra parcelada nesta conta" />
          }
          renderItem={({ item }) => (
            <InstallmentCard installment={item} currency={accountCurrency} />
          )}
        />
      ) : (
        <FlatList
          data={unifiedHistory}
          // Garante que o ID não se repita caso uma transação e parcela tenham o mesmo ID acidentalmente
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
              onOpenMonthPicker={() => setMonthPickerVisible(true)}
            />
          }
          ListEmptyComponent={
            <EmptyState text="Nenhum movimento neste período" />
          }
          renderItem={({ item }) => (
            <TransactionRow item={item} currency={accountCurrency} />
          )}
        />
      )}

      {/* MODAL DO SELETOR DE MÊS */}
      <Modal
        visible={monthPickerVisible}
        transparent={true}
        animationType="fade"
      >
        <View style={s.modalOverlay}>
          <View style={s.calendarContainer}>
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
                <Ionicons name="chevron-back" size={20} color="#111827" />
              </TouchableOpacity>
              <Text style={s.calendarMonthName}>{baseDate.getFullYear()}</Text>
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
                <Ionicons name="chevron-forward" size={20} color="#111827" />
              </TouchableOpacity>
            </View>

            <View style={s.monthGrid}>
              {monthNames.map((m, index) => {
                const isSelected = baseDate.getMonth() === index;
                return (
                  <TouchableOpacity
                    key={index}
                    style={[s.monthItem, isSelected && s.monthItemSelected]}
                    onPress={() => {
                      setBaseDate(new Date(baseDate.getFullYear(), index, 1));
                      setMonthPickerVisible(false);
                    }}
                  >
                    <Text
                      style={[s.monthItemText, isSelected && { color: "#fff" }]}
                    >
                      {m}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              style={s.closeCalendarBtn}
              onPress={() => setMonthPickerVisible(false)}
            >
              <Text style={{ color: "#fff", fontWeight: "bold" }}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL DE CONTA OMITIDO PARA ECONOMIZAR ESPAÇO, MANTENHA O SEU SE NECESSÁRIO */}
    </SafeAreaView>
  );
}

function TabButton({ active, label, icon, onPress }: any) {
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
  onOpenMonthPicker,
}: any) {
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

      {/* Botão para abrir o seletor quando estiver no modo "Mês" */}
      <TouchableOpacity
        style={s.rangePickerBtn}
        onPress={period === "month" ? onOpenMonthPicker : undefined}
        disabled={period !== "month"}
      >
        <Text style={s.historyRange}>{range.label}</Text>
        {period === "month" && (
          <Ionicons name="calendar" size={16} color="#6b7280" />
        )}
      </TouchableOpacity>

      <View style={s.historyCards}>
        <View style={[s.historyCard, { borderLeftColor: "#16a34a" }]}>
          <Text style={s.historyCardLabel}>Recebido</Text>
          <Text style={[s.historyCardValue, { color: "#16a34a" }]}>
            {formatCurrency(income, currency)}
          </Text>
        </View>
        <View style={[s.historyCard, { borderLeftColor: "#dc2626" }]}>
          <Text style={s.historyCardLabel}>Gasto</Text>
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

// ... COMPONENTES DE CARTÃO E TRANSAÇÃO MANTIDOS ...
// ============================================================
// COMPONENTES DE LISTAGEM ATUALIZADOS
// ============================================================

function TransactionRow({ item, currency }: any) {
  const isIncome = item.type === "income";
  const color = isIncome ? "#16a34a" : "#dc2626";

  // Inteligência para gerar o subtítulo correto
  let subtitle = "";
  if (item.isCredit) {
    subtitle = `Crédito · Parcela ${item.paid_installments + 1}/${item.total_installments}\nData prog.: ${formatDate(item.displayDate)}`;
  } else {
    const catName = item.category?.name ?? "Sem categoria";
    const payType = isIncome ? "Entrada" : "Compra no débito";
    subtitle = `${catName} (${payType})\nData: ${formatDate(item.displayDate)}`;
  }

  return (
    <View style={s.item}>
      <View style={[s.itemIcon, { backgroundColor: `${color}18` }]}>
        <Ionicons
          name={isIncome ? "arrow-up" : "arrow-down"}
          size={20}
          color={color}
        />
      </View>
      <View style={s.itemInfo}>
        <Text style={s.itemTitle}>{item.title}</Text>
        <Text style={[s.itemSub, { marginTop: 4, lineHeight: 16 }]}>
          {subtitle}
        </Text>
      </View>
      <Text style={[s.itemAmount, { color }]}>
        {isIncome ? "+" : "-"}
        {formatCurrency(item.amount, currency)}
      </Text>
    </View>
  );
}

function InstallmentCard({ installment: i, currency }: any) {
  // Inteligência para extrair e formatar o mês da fatura de forma segura
  const dateString = i.start_date
    ? i.start_date.split("T")[0]
    : i.created_at.split("T")[0];
  const [year, month, day] = dateString.split("-");
  const dateObj = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));

  const mesFatura = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
  }).format(dateObj);

  return (
    <View
      style={[
        s.installCard,
        { flexDirection: "row", justifyContent: "space-between" },
      ]}
    >
      <View style={{ flex: 1, paddingRight: 10 }}>
        <Text style={s.itemTitle}>{i.title}</Text>
        <Text style={[s.itemSub, { marginTop: 4 }]}>
          Mês da fatura:{" "}
          <Text
            style={{
              fontWeight: "700",
              textTransform: "capitalize",
              color: "#6366f1",
            }}
          >
            {mesFatura}
          </Text>
        </Text>
        <Text style={s.itemSub}>
          Progresso: Parcela {i.paid_installments + 1} de {i.total_installments}
        </Text>
      </View>
      <View style={{ alignItems: "flex-end", justifyContent: "center" }}>
        <Text style={[s.itemAmount, { color: "#111827" }]}>
          {formatCurrency(i.installment_amount, currency)}
        </Text>
        <Text style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>
          Total: {formatCurrency(i.total_amount, currency)}
        </Text>
      </View>
    </View>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <View style={s.empty}>
      <Text style={s.emptyText}>{text}</Text>
    </View>
  );
}

// Lógica ajustada para aceitar o baseDate
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
  // Month
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

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f8fafc" },
  header: { padding: 20, paddingTop: 12, paddingBottom: 24 },
  back: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginBottom: 12,
  },
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
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  tab: { flex: 1, paddingVertical: 12, alignItems: "center", gap: 3 },
  tabActive: { borderBottomWidth: 2, borderBottomColor: "#6366f1" },
  tabText: { fontSize: 12, color: "#9ca3af", fontWeight: "700" },
  tabTextActive: { color: "#6366f1" },
  list: { padding: 16, paddingBottom: 32 },
  item: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
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
  itemTitle: { fontSize: 14, fontWeight: "600", color: "#111827" },
  itemSub: { fontSize: 12, color: "#9ca3af", marginTop: 2 },
  itemAmount: { fontSize: 14, fontWeight: "700" },
  installCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  historyHeader: { marginBottom: 12 },
  periodRow: {
    flexDirection: "row",
    backgroundColor: "#eef2ff",
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
  periodBtnActive: { backgroundColor: "#6366f1" },
  periodText: { color: "#6b7280", fontSize: 12, fontWeight: "700" },
  periodTextActive: { color: "#fff" },

  // Estilo do botão que abre o calendário no Histórico
  rangePickerBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginBottom: 10,
    justifyContent: "space-between",
  },
  historyRange: {
    color: "#374151",
    fontSize: 14,
    fontWeight: "600",
    textTransform: "capitalize",
  },

  historyCards: { flexDirection: "row", gap: 10, marginBottom: 10 },
  historyCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    borderLeftWidth: 4,
  },
  historyCardLabel: { color: "#6b7280", fontSize: 12, fontWeight: "600" },
  historyCardValue: { fontSize: 15, fontWeight: "800", marginTop: 4 },
  netCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  netLabel: { color: "#6b7280", fontSize: 13, fontWeight: "600" },
  netValue: { fontSize: 16, fontWeight: "800" },
  empty: { alignItems: "center", paddingVertical: 56, gap: 8 },
  emptyText: { fontSize: 14, color: "#9ca3af", textAlign: "center" },

  // Estilos do Modal do Seletor de Mês
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  calendarContainer: {
    width: 320,
    backgroundColor: "#fff",
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
  calendarMonthName: { fontSize: 18, fontWeight: "bold", color: "#111827" },
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
    backgroundColor: "#f3f4f6",
  },
  monthItemSelected: { backgroundColor: "#6366f1" },
  monthItemText: { fontWeight: "600", color: "#374151" },
  closeCalendarBtn: {
    backgroundColor: "#6366f1",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 24,
  },
});
