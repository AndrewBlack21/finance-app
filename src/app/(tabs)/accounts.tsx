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
  // ADICIONE Para mudar vencimento
  const [newBankType, setNewBankType] = useState<
    "checking" | "savings" | "credit"
  >("checking");
  const [newBankBalance, setNewBankBalance] = useState("");
  const [dueDay, setDueDay] = useState("10");
  //  ===============================
  // Estado para controlar a data base do histórico
  const [baseDate, setBaseDate] = useState(new Date());
  const [monthPickerVisible, setMonthPickerVisible] = useState(false);

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);

  const { openModal } = useLocalSearchParams<{ openModal?: string }>();

  const { to } = getCurrentMonthRange();
  // 1. Puxamos o accounts (lista) e a nova função updateAccount
  const {
    accounts,
    create: createAccount,
    update: updateAccount,
    remove: removeAccount,
  } = useAccounts();

  // 2. Estado para saber se o modal está a CRIAR ou a EDITAR
  const [isEditing, setIsEditing] = useState(false);

  // 3. Pegamos todos os detalhes da conta atual (incluindo o vencimento)
  const currentAccount = accounts.find((a) => a.id === id);

  // 4. Função que preenche o modal com os dados atuais e o abre
  const handleOpenEdit = () => {
    // 1. Procura a conta garantindo que o ID é lido da mesma forma (evita bugs de Texto vs Número)
    const acc = accounts.find((a) => String(a.id) === String(id));

    // 2. Preenche os dados. Se a lista ainda estiver a carregar, usa os dados de backup que vieram do ecrã anterior!
    setNewBankName(acc?.name || name);
    setNewBankBalance(
      acc ? String(acc.balance) : String(parseFloat(balance || "0")),
    );
    setNewBankType((acc?.type as any) || "checking");
    setDueDay(acc?.due_day ? String(acc.due_day) : "10");
    setNewBankColor(acc?.color || color || "#6366f1");

    // 3. Abre o modal imediatamente
    setIsEditing(true);
    setModalVisible(true);
  };

  const handleDelete = () => {
    const accName = currentAccount?.name || name;
    const msg = `Tem a certeza que deseja excluir ${accName}?`;

    if (Platform.OS === "web") {
      const ok = window.confirm(msg);
      if (ok) {
        removeAccount(id).then(() => router.replace("/(tabs)/"));
      }
    } else {
      Alert.alert("Excluir Conta", msg, [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Sim, Excluir",
          style: "destructive",
          onPress: async () => {
            await removeAccount(id);
            router.replace("/(tabs)/");
          },
        },
      ]);
    }
  };

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
        {/* LINHA SUPERIOR: Botão Voltar (Esquerda) e Ações (Direita) */}
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
        </View>

        {/* NOME E SALDO DA CONTA */}
        <Text style={s.accountName}>{name}</Text>

        {(() => {
          // Lógica apenas para Cartão de Crédito
          if (currentAccount?.type === "credit") {
            const currentMonthIso = new Date().toISOString().slice(0, 7);
            const currentMonthName = getCurrentMonthName();

            const allActive = installments.filter(
              (i) =>
                i.account_id === id &&
                i.paid_installments < i.total_installments,
            );

            const pendingCurrent = allActive.filter(
              (i) =>
                (!i.start_date || i.start_date <= to) &&
                i.invoice_paid_month !== currentMonthIso,
            );

            let displayValue = 0;
            let subtitleLabel = "";
            let subtitleColor = "rgba(255,255,255,0.78)";

            if (pendingCurrent.length > 0) {
              // Fatura Deste Mês
              displayValue = pendingCurrent.reduce(
                (sum, i) => sum + Number(i.installment_amount),
                0,
              );
              subtitleLabel = `Fatura de ${currentMonthName}`;
            } else {
              // Fatura do Próximo Mês
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
              </>
            );
          }

          // Lógica para Conta Corrente (Mantém o original)
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

        {/* ESTATÍSTICAS: Entradas e Saídas */}
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
      {/* ============================================== */}
      {/* MODAL DO SELETOR DE MÊS (PARA O HISTÓRICO)     */}
      {/* ============================================== */}
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

      {/* ============================================== */}
      {/* MODAL DE CRIAR/EDITAR CONTA (CORRIGIDO)        */}
      {/* ============================================== */}
      <Modal visible={modalVisible} animationType="slide" transparent={true}>
        <View style={s.modalOverlay}>
          <View style={s.calendarContainer}>
            <Text style={s.calendarMonthName}>
              {isEditing ? "Editar Conta / Cartão" : "Nova Conta / Cartão"}
            </Text>

            <View style={{ marginTop: 16 }}>
              <Text style={{ fontSize: 13, color: "#374151", marginBottom: 4 }}>
                Nome
              </Text>
              <TextInput
                style={{
                  borderWidth: 1,
                  borderColor: "#d1d5db",
                  borderRadius: 8,
                  padding: 10,
                  marginBottom: 12,
                }}
                placeholder="Ex: Nubank, Santander"
                value={newBankName}
                onChangeText={setNewBankName}
              />

              <Text style={{ fontSize: 13, color: "#374151", marginBottom: 4 }}>
                Saldo Inicial / Limite
              </Text>
              <TextInput
                style={{
                  borderWidth: 1,
                  borderColor: "#d1d5db",
                  borderRadius: 8,
                  padding: 10,
                  marginBottom: 12,
                }}
                placeholder="R$ 0,00"
                keyboardType="numeric"
                value={newBankBalance}
                onChangeText={setNewBankBalance}
              />
              {/* Tipo de Conta */}
              <Text style={{ fontSize: 13, color: "#374151", marginBottom: 4 }}>
                O que está a adicionar?
              </Text>
              <View style={{ flexDirection: "row", gap: 10, marginBottom: 12 }}>
                <TouchableOpacity
                  style={{
                    flex: 1,
                    padding: 8,
                    borderWidth: 1,
                    borderColor:
                      newBankType === "checking" ? "#6366f1" : "#d1d5db",
                    borderRadius: 8,
                    alignItems: "center",
                    backgroundColor:
                      newBankType === "checking" ? "#eef2ff" : "#fff",
                  }}
                  onPress={() => setNewBankType("checking")}
                >
                  <Text
                    style={{
                      color: newBankType === "checking" ? "#6366f1" : "#6b7280",
                      fontSize: 12,
                      fontWeight: "bold",
                      textAlign: "center",
                    }}
                  >
                    🏦 Conta Bancária{"\n"}
                    <Text style={{ fontSize: 10, fontWeight: "normal" }}>
                      (Tem Saldo Real)
                    </Text>
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={{
                    flex: 1,
                    padding: 8,
                    borderWidth: 1,
                    borderColor:
                      newBankType === "credit" ? "#6366f1" : "#d1d5db",
                    borderRadius: 8,
                    alignItems: "center",
                    backgroundColor:
                      newBankType === "credit" ? "#eef2ff" : "#fff",
                  }}
                  onPress={() => setNewBankType("credit")}
                >
                  <Text
                    style={{
                      color: newBankType === "credit" ? "#6366f1" : "#6b7280",
                      fontSize: 12,
                      fontWeight: "bold",
                      textAlign: "center",
                    }}
                  >
                    💳 Cartão de Crédito{"\n"}
                    <Text style={{ fontSize: 10, fontWeight: "normal" }}>
                      (Gera Faturas)
                    </Text>
                  </Text>
                </TouchableOpacity>
              </View>

              {newBankType === "credit" && (
                <View style={{ marginBottom: 12 }}>
                  <Text
                    style={{ fontSize: 13, color: "#374151", marginBottom: 4 }}
                  >
                    Dia de Vencimento da Fatura
                  </Text>
                  <TextInput
                    style={{
                      borderWidth: 1,
                      borderColor: "#d1d5db",
                      borderRadius: 8,
                      padding: 10,
                    }}
                    value={dueDay}
                    onChangeText={(text) => {
                      const num = text.replace(/[^0-9]/g, "");
                      if (Number(num) <= 31) setDueDay(num);
                    }}
                    keyboardType="numeric"
                    maxLength={2}
                    placeholder="Ex: 10"
                  />
                </View>
              )}

              {/* PALETA DE CORES PERFEITAMENTE ALINHADA */}
              <Text style={{ fontSize: 13, color: "#374151", marginBottom: 6 }}>
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
                      borderColor: "#374151",
                    }}
                  />
                ))}
              </View>
            </View>

            {/* BOTÕES CANCELAR E SALVAR */}
            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity
                style={[
                  s.closeCalendarBtn,
                  { flex: 1, backgroundColor: "#e5e7eb", marginTop: 0 },
                ]}
                onPress={() => {
                  setModalVisible(false);
                  setIsEditing(false);
                  setNewBankName("");
                  setNewBankBalance("");
                }}
              >
                <Text style={{ color: "#374151", fontWeight: "bold" }}>
                  Cancelar
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  s.closeCalendarBtn,
                  { flex: 1, backgroundColor: "#4f46e5", marginTop: 0 },
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
