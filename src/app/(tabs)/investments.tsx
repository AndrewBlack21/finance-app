import { useState, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Modal,
  StyleSheet,
  Alert,
  TextInput,
  Switch,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAccounts } from "@/hooks/useAccounts";
import { useTransactions } from "@/hooks/useTransactions";
import { useAppTheme } from "@/hooks/useTheme"; // 👈 Motor de temas global

const INVESTMENT_TYPES = [
  { key: "CDB", label: "CDB", rate: 10.5 },
  { key: "CDI", label: "CDI", rate: 10.65 },
  { key: "SELIC", label: "Selic", rate: 10.75 },
  { key: "Tesouro", label: "Tesouro Direto", rate: 10.0 },
  { key: "LCI/LCA", label: "LCI/LCA", rate: 9.0 },
  { key: "Fundo FII", label: "Fundo FII", rate: 12.0 },
  { key: "Poupança", label: "Poupança", rate: 6.17 },
  { key: "Outros", label: "Outros", rate: 10.0 },
];

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    v,
  );

export default function InvestmentsScreen() {
  const router = useRouter();
  const { accounts, update: updateAccount } = useAccounts();
  const { transactions, create } = useTransactions();
  const { colors, isDark } = useAppTheme(); // 👈 Cores dinâmicas ativas

  const investmentAccounts = accounts.filter((a) => a.type === "investment");
  const totalInvested = investmentAccounts.reduce(
    (s, a) => s + Number(a.balance || 0),
    0,
  );

  const [showTransfer, setShowTransfer] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState("");
  const [selectedType, setSelectedType] = useState("CDB");
  const [transferValue, setTransferValue] = useState("");
  const [includeYield, setIncludeYield] = useState(true);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const [rates, setRates] = useState<Record<string, number>>(
    Object.fromEntries(INVESTMENT_TYPES.map((t) => [t.key, t.rate])),
  );

  const balancesByType = useMemo(() => {
    const balances: Record<string, number> = {};
    INVESTMENT_TYPES.forEach((t) => (balances[t.key] = 0));

    const invAccIds = investmentAccounts.map((a) => a.id);
    const invTransactions = (transactions || []).filter((t) =>
      invAccIds.includes(t.account_id),
    );

    invTransactions.forEach((t) => {
      let foundType = "Outros";
      for (const inv of INVESTMENT_TYPES) {
        if (t.notes && t.notes.includes(`[${inv.key}]`)) {
          foundType = inv.key;
          break;
        }
      }

      const amount = Number(t.amount || 0);
      if (t.type === "income") balances[foundType] += amount;
      else if (t.type === "expense") balances[foundType] -= amount;
    });

    Object.keys(balances).forEach((key) => {
      if (balances[key] < 0) balances[key] = 0;
    });

    const totalFromTx = Object.values(balances).reduce(
      (acc, val) => acc + val,
      0,
    );

    if (totalInvested === 0) {
      Object.keys(balances).forEach((key) => (balances[key] = 0));
    } else if (totalFromTx > 0) {
      const ratio = totalInvested / totalFromTx;
      Object.keys(balances).forEach((key) => {
        balances[key] = balances[key] * ratio;
      });
    } else {
      balances["Outros"] = totalInvested;
    }

    return balances;
  }, [transactions, investmentAccounts, totalInvested]);

  let totalYieldAmount = 0;
  const portfolioData = INVESTMENT_TYPES.map((t) => {
    const balance = balancesByType[t.key] || 0;
    const annualRate = (rates[t.key] ?? t.rate) / 100;
    const expectedYield = balance > 0 ? balance * (annualRate * (30 / 365)) : 0;

    totalYieldAmount += expectedYield;
    return { ...t, balance, expectedYield };
  });

  const baseAmount = Number(transferValue.replace(",", ".")) || 0;
  const availableInType = balancesByType[selectedType] || 0;
  const isAmountExceeded = baseAmount > availableInType + 0.01;

  const specificYield =
    portfolioData.find((t) => t.key === selectedType)?.expectedYield || 0;
  const totalWithYield = includeYield ? baseAmount + specificYield : baseAmount;

  const handleTransfer = async () => {
    if (!selectedAccount)
      return Alert.alert("Atenção", "Selecione uma conta de destino.");
    if (!baseAmount || baseAmount <= 0)
      return Alert.alert("Atenção", "Digite um valor válido para o resgate.");
    if (isAmountExceeded)
      return Alert.alert("Atenção", "Saldo insuficiente no ativo selecionado.");

    setIsTransferring(true);

    try {
      const destAccount = accounts.find((a) => a.id === selectedAccount);
      const sourceAcc = investmentAccounts[0];

      const resSaida = await create({
        account_id: sourceAcc.id,
        title: `Resgate ${selectedType}`,
        amount: baseAmount,
        type: "expense",
        date: new Date().toISOString().split("T")[0],
        currency: "BRL",
        category_id: null,
        notes: `[SAÍDA] [${selectedType}] Resgate de investimento.`,
        recurring: false,
      } as any);

      if (resSaida?.error) throw new Error(String(resSaida.error));

      const resEntrada = await create({
        account_id: selectedAccount,
        title: `Resgate ${selectedType}`,
        amount: totalWithYield,
        type: "income",
        date: new Date().toISOString().split("T")[0],
        currency: "BRL",
        category_id: null,
        notes: `[ENTRADA] [${selectedType}] Principal: ${fmt(baseAmount)} + Rendimento: ${fmt(includeYield ? specificYield : 0)}.`,
        recurring: false,
      } as any);

      if (resEntrada?.error) throw new Error(String(resEntrada.error));

      if (destAccount) {
        await updateAccount(destAccount.id, {
          balance: Number(destAccount.balance || 0) + totalWithYield,
        });
      }
      await updateAccount(sourceAcc.id, {
        balance: Number(sourceAcc.balance || 0) - baseAmount,
      });

      setShowTransfer(false);
      setTransferValue("");
      setShowSuccess(true);
    } catch (error: any) {
      Alert.alert(
        "Erro no resgate",
        error.message || "Ocorreu um problema ao salvar.",
      );
    } finally {
      setIsTransferring(false);
    }
  };

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: colors.bg }]}>
      {/* HEADER */}
      <View
        style={[
          s.header,
          { backgroundColor: colors.card, borderBottomColor: colors.border },
        ]}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={[s.backBtn, { backgroundColor: colors.inputBg }]}
        >
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <View>
          <Text style={[s.headerSub, { color: colors.subText }]}>
            Patrimônio
          </Text>
          <Text style={[s.headerTitle, { color: colors.text }]}>
            Investimentos
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => setShowSettings(true)}
          style={[s.settingsBtn, { backgroundColor: colors.inputBg }]}
        >
          <Ionicons name="settings-outline" size={22} color={colors.subText} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* CARD TOTAL INVESTIDO */}
        <View style={s.totalCard}>
          <Text style={s.totalLabel}>Total Investido</Text>
          <Text style={s.totalValue}>{fmt(Number(totalInvested))}</Text>
          <View style={s.yieldBadge}>
            <Ionicons name="trending-up" size={14} color="#4ade80" />
            <Text style={s.yieldBadgeText}>
              Rendimento global previsto: +{fmt(totalYieldAmount)}/mês
            </Text>
          </View>
          <TouchableOpacity
            style={s.transferBtn}
            onPress={() => setShowTransfer(true)}
          >
            <Ionicons name="swap-horizontal-outline" size={16} color="#fff" />
            <Text style={s.transferBtnText}>Resgatar Investimento</Text>
          </TouchableOpacity>
        </View>

        {/* CARTEIRA POR ATIVO */}
        <Text style={[s.sectionTitle, { color: colors.text }]}>
          Carteira por Ativo
        </Text>

        {portfolioData.map((inv) => (
          <View
            key={inv.key}
            style={[
              s.accCard,
              { backgroundColor: colors.card, borderLeftColor: "#8b5cf6" },
            ]}
          >
            <View style={{ flex: 1 }}>
              <Text style={[s.accName, { color: colors.text }]}>
                {inv.label}
              </Text>
              <Text style={[s.accType, { color: colors.subText }]}>
                Taxa Base: {(rates[inv.key] ?? inv.rate).toFixed(2)}% a.a.
              </Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={[s.accBalance, { color: colors.text }]}>
                {fmt(inv.balance)}
              </Text>
              <Text style={s.accYield}>+{fmt(inv.expectedYield)}/mês</Text>
            </View>
          </View>
        ))}

        {/* SALDOS POR INSTITUIÇÃO */}
        <Text style={[s.sectionTitle, { color: colors.text, marginTop: 10 }]}>
          Saldos por Instituição
        </Text>
        {investmentAccounts.length === 0 && (
          <View style={s.empty}>
            <Ionicons
              name="business-outline"
              size={40}
              color={colors.subText}
            />
            <Text style={[s.emptyText, { color: colors.text }]}>
              Nenhuma conta encontrada
            </Text>
            <Text style={[s.emptySubtext, { color: colors.subText }]}>
              Crie uma conta do tipo "Investimento" na aba Contas.
            </Text>
          </View>
        )}

        {investmentAccounts.map((acc) => (
          <View
            key={acc.id}
            style={[
              s.accCard,
              {
                backgroundColor: colors.card,
                borderLeftColor: acc.color,
                marginBottom: 8,
              },
            ]}
          >
            <View style={{ flex: 1 }}>
              <Text style={[s.accName, { color: colors.text }]}>
                {acc.name}
              </Text>
              <Text style={[s.accType, { color: colors.subText }]}>
                Conta Investimento
              </Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={[s.accBalance, { color: colors.text }]}>
                {fmt(Number(acc.balance || 0))}
              </Text>
            </View>
          </View>
        ))}

        {/* TAXAS ATUAIS - INTERATIVAS */}
        <Text style={[s.sectionTitle, { color: colors.text, marginTop: 10 }]}>
          Taxas configuradas
        </Text>
        <View style={[s.ratesCard, { backgroundColor: colors.card }]}>
          {INVESTMENT_TYPES.map((t) => (
            <TouchableOpacity
              key={t.key}
              style={[s.rateRow, { borderBottomColor: colors.border }]}
              onPress={() => setShowSettings(true)}
            >
              <Text style={[s.rateLabel, { color: colors.text }]}>
                {t.label}
              </Text>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
              >
                <Text style={[s.rateValue, { color: colors.primary }]}>
                  {(rates[t.key] ?? t.rate).toFixed(2)}% a.a.
                </Text>
                <Ionicons
                  name="pencil-outline"
                  size={14}
                  color={colors.subText}
                />
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* ── MODAL: Transferência ─────────────────────────── */}
      <Modal
        visible={showTransfer}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={[s.modal, { backgroundColor: colors.bg }]}>
          <View
            style={[
              s.modalHeader,
              {
                backgroundColor: colors.card,
                borderBottomColor: colors.border,
              },
            ]}
          >
            <Text style={[s.modalTitle, { color: colors.text }]}>
              Resgatar Investimento
            </Text>
            <TouchableOpacity onPress={() => setShowTransfer(false)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={s.modalScroll}>
            <Text style={[s.label, { color: colors.subText }]}>
              Valor do resgate
            </Text>
            <View
              style={[
                s.inputWrapperMain,
                { backgroundColor: colors.inputBg, borderColor: colors.border },
                isAmountExceeded && { borderColor: "#ef4444" },
              ]}
            >
              <Text style={[s.inputCurrency, { color: colors.subText }]}>
                R$
              </Text>
              <TextInput
                style={[s.mainInput, { color: colors.text }]}
                placeholder="0,00"
                placeholderTextColor={colors.subText}
                keyboardType="decimal-pad"
                value={transferValue}
                onChangeText={setTransferValue}
              />
            </View>

            {isAmountExceeded && (
              <Text style={s.errorText}>
                ⚠️ Saldo insuficiente. O máximo disponível neste ativo é{" "}
                {fmt(availableInType)}.
              </Text>
            )}

            <Text style={[s.label, { color: colors.subText }]}>
              De qual ativo deseja resgatar?
            </Text>
            <View style={s.optionRow}>
              {portfolioData.map((t) => (
                <TouchableOpacity
                  key={t.key}
                  style={[
                    s.optionBtn,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                    },
                    selectedType === t.key && [
                      s.optionBtnActive,
                      {
                        backgroundColor: colors.primary,
                        borderColor: colors.primary,
                      },
                    ],
                  ]}
                  onPress={() => setSelectedType(t.key)}
                >
                  <Text
                    style={[
                      s.optionText,
                      { color: colors.subText },
                      selectedType === t.key && { color: "#fff" },
                    ]}
                  >
                    {t.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[s.label, { color: colors.subText }]}>
              Para qual conta corrente irá enviar?
            </Text>
            {accounts
              .filter((a) => a.type === "checking")
              .map((acc) => (
                <TouchableOpacity
                  key={acc.id}
                  style={[
                    s.accountRow,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                    },
                    selectedAccount === acc.id && [
                      s.accountRowActive,
                      {
                        borderColor: colors.primary,
                        backgroundColor: isDark ? "#312e81" : "#f5f3ff",
                      },
                    ],
                  ]}
                  onPress={() => setSelectedAccount(acc.id)}
                >
                  <View
                    style={[s.accountDot, { backgroundColor: acc.color }]}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={[s.accountName, { color: colors.text }]}>
                      {acc.name}
                    </Text>
                    <Text style={[s.accountBalance, { color: colors.subText }]}>
                      {fmt(Number(acc.balance || 0))}
                    </Text>
                  </View>
                  {selectedAccount === acc.id && (
                    <Ionicons
                      name="checkmark-circle"
                      size={20}
                      color={colors.primary}
                    />
                  )}
                </TouchableOpacity>
              ))}

            <View style={[s.yieldToggle, { backgroundColor: colors.card }]}>
              <View>
                <Text style={[s.yieldToggleLabel, { color: colors.text }]}>
                  Incluir rendimento
                </Text>
                <Text style={s.yieldToggleSub}>
                  +{fmt(specificYield)} em {selectedType}
                </Text>
              </View>
              <Switch
                value={includeYield}
                onValueChange={setIncludeYield}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor="#fff"
              />
            </View>

            <View style={[s.summary, { backgroundColor: colors.card }]}>
              <View style={s.summaryRow}>
                <Text style={[s.summaryLabel, { color: colors.subText }]}>
                  Valor Principal
                </Text>
                <Text style={[s.summaryValue, { color: colors.text }]}>
                  {fmt(baseAmount)}
                </Text>
              </View>
              <View style={s.summaryRow}>
                <Text style={[s.summaryLabel, { color: colors.subText }]}>
                  Rendimento ({selectedType})
                </Text>
                <Text
                  style={[
                    s.summaryValue,
                    { color: includeYield ? "#22c55e" : colors.subText },
                  ]}
                >
                  {includeYield ? "+" : ""}
                  {fmt(includeYield ? specificYield : 0)}
                </Text>
              </View>
              <View
                style={[
                  s.summaryRow,
                  s.summaryTotal,
                  { borderTopColor: colors.border },
                ]}
              >
                <Text style={[s.summaryTotalLabel, { color: colors.text }]}>
                  Total a receber
                </Text>
                <Text style={[s.summaryTotalValue, { color: colors.primary }]}>
                  {fmt(totalWithYield)}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={[
                s.confirmBtn,
                { backgroundColor: colors.primary },
                (isTransferring || isAmountExceeded || baseAmount <= 0) && {
                  opacity: 0.6,
                },
              ]}
              onPress={handleTransfer}
              disabled={isTransferring || isAmountExceeded || baseAmount <= 0}
            >
              <Ionicons name="swap-horizontal-outline" size={18} color="#fff" />
              <Text style={s.confirmBtnText}>
                {isTransferring ? "Resgatando..." : "Confirmar Resgate"}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* ── MODAL: Tela de Sucesso Personalizada ─────────── */}
      <Modal visible={showSuccess} animationType="fade" transparent={true}>
        <View style={s.successOverlay}>
          <View style={[s.successCard, { backgroundColor: colors.card }]}>
            <View style={s.successIconBox}>
              <Ionicons name="checkmark" size={40} color="#fff" />
            </View>
            <Text style={[s.successTitle, { color: colors.text }]}>
              Transferência Concluída!
            </Text>
            <Text style={[s.successText, { color: colors.subText }]}>
              O seu resgate foi efetuado com sucesso e o saldo atualizado.
            </Text>

            <TouchableOpacity
              style={[s.successBtn, { backgroundColor: colors.primary }]}
              onPress={() => setShowSuccess(false)}
            >
              <Text style={s.successBtnText}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── MODAL: Configurar taxas ──────────────────────── */}
      <Modal
        visible={showSettings}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={[s.modal, { backgroundColor: colors.bg }]}>
          <View
            style={[
              s.modalHeader,
              {
                backgroundColor: colors.card,
                borderBottomColor: colors.border,
              },
            ]}
          >
            <Text style={[s.modalTitle, { color: colors.text }]}>
              Configurar Taxas
            </Text>
            <TouchableOpacity onPress={() => setShowSettings(false)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={s.modalScroll}>
            <Text style={[s.modalSub, { color: colors.subText }]}>
              Atualize as taxas (% a.a.) de acordo com a sua corretora. O
              cálculo de rendimento ajusta-se automaticamente a todos os seus
              ativos.
            </Text>

            {INVESTMENT_TYPES.map((t) => (
              <View
                key={t.key}
                style={[s.rateInputRow, { backgroundColor: colors.card }]}
              >
                <Text style={[s.rateInputLabel, { color: colors.text }]}>
                  {t.label}
                </Text>
                <View
                  style={[s.inputWrapper, { backgroundColor: colors.inputBg }]}
                >
                  <TextInput
                    style={[s.input, { color: colors.text }]}
                    defaultValue={(rates[t.key] ?? t.rate).toString()}
                    keyboardType="decimal-pad"
                    onChangeText={(val) => {
                      const num = parseFloat(val.replace(",", "."));
                      if (!isNaN(num)) {
                        setRates((prev) => ({ ...prev, [t.key]: num }));
                      }
                    }}
                  />
                  <Text style={[s.inputSymbol, { color: colors.subText }]}>
                    %
                  </Text>
                </View>
              </View>
            ))}

            <TouchableOpacity
              style={[
                s.confirmBtn,
                { backgroundColor: colors.primary, marginTop: 24 },
              ]}
              onPress={() => setShowSettings(false)}
            >
              <Text style={s.confirmBtnText}>Salvar Taxas</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: {
    flex: 1,
    ...(Platform.OS === "web" ? { overflow: "hidden", maxWidth: "100%" } : {}),
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: "center",
    alignItems: "center",
  },
  settingsBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: "center",
    alignItems: "center",
  },
  headerSub: { fontSize: 12 },
  headerTitle: { fontSize: 20, fontWeight: "800" },
  scroll: { padding: 20, gap: 16, paddingBottom: 40 },

  totalCard: { backgroundColor: "#1e1b4b", borderRadius: 20, padding: 22 },
  totalLabel: { fontSize: 13, color: "#a5b4fc", marginBottom: 6 },
  totalValue: {
    fontSize: 32,
    fontWeight: "800",
    color: "#fff",
    marginBottom: 12,
  },
  yieldBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(74,222,128,0.15)",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignSelf: "flex-start",
    marginBottom: 14,
  },
  yieldBadgeText: { fontSize: 13, color: "#4ade80", fontWeight: "600" },
  transferBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 9,
    alignSelf: "flex-start",
  },
  transferBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },

  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    marginTop: 4,
  },
  accCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    marginBottom: 8,
  },
  accName: { fontSize: 14, fontWeight: "700" },
  accType: { fontSize: 12, marginTop: 2 },
  accBalance: { fontSize: 15, fontWeight: "800" },
  accYield: { fontSize: 12, color: "#22c55e", marginTop: 2 },

  ratesCard: {
    borderRadius: 14,
    padding: 16,
    gap: 10,
  },
  rateRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  rateLabel: { fontSize: 14, fontWeight: "600" },
  rateValue: { fontSize: 14, fontWeight: "700" },

  empty: { alignItems: "center", paddingVertical: 32, gap: 8 },
  emptyText: { fontSize: 15, fontWeight: "600" },
  emptySubtext: {
    fontSize: 13,
    textAlign: "center",
    paddingHorizontal: 20,
    lineHeight: 18,
  },

  modal: { flex: 1 },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  modalTitle: { fontSize: 18, fontWeight: "700" },
  modalScroll: { padding: 20, gap: 16 },
  modalSub: { fontSize: 13, lineHeight: 20 },
  label: { fontSize: 13, fontWeight: "600" },

  inputWrapperMain: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
  },
  inputCurrency: {
    fontSize: 18,
    fontWeight: "700",
    marginRight: 8,
  },
  mainInput: { flex: 1, fontSize: 18, fontWeight: "700" },

  errorText: {
    color: "#ef4444",
    fontSize: 13,
    fontWeight: "600",
    marginTop: 4,
  },

  optionRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  optionBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
  },
  optionBtnActive: {},
  optionText: { fontSize: 13, fontWeight: "700" },

  accountRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1.5,
  },
  accountRowActive: {},
  accountDot: { width: 12, height: 12, borderRadius: 6 },
  accountName: { fontSize: 14, fontWeight: "600" },
  accountBalance: { fontSize: 12, marginTop: 2 },

  yieldToggle: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  yieldToggleLabel: { fontSize: 14, fontWeight: "600" },
  yieldToggleSub: { fontSize: 12, color: "#22c55e", marginTop: 2 },

  summary: { borderRadius: 14, padding: 16, gap: 10 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between" },
  summaryLabel: { fontSize: 13 },
  summaryValue: { fontSize: 13, fontWeight: "600" },
  summaryTotal: {
    borderTopWidth: 1,
    paddingTop: 10,
    marginTop: 4,
  },
  summaryTotalLabel: { fontSize: 14, fontWeight: "700" },
  summaryTotalValue: { fontSize: 16, fontWeight: "800" },

  confirmBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 14,
    paddingVertical: 16,
    marginTop: 10,
  },
  confirmBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },

  rateInputRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 12,
    padding: 14,
  },
  rateInputLabel: { fontSize: 14, fontWeight: "600" },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 4,
  },
  input: {
    fontSize: 16,
    fontWeight: "700",
    minWidth: 60,
    textAlign: "right",
  },
  inputSymbol: { fontSize: 14, fontWeight: "600" },

  successOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  successCard: {
    borderRadius: 24,
    padding: 32,
    alignItems: "center",
    width: "100%",
    elevation: 10,
  },
  successIconBox: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#22c55e",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 8,
    textAlign: "center",
  },
  successText: {
    fontSize: 14,
    textAlign: "center",
    marginBottom: 30,
    lineHeight: 20,
  },
  successBtn: {
    paddingVertical: 16,
    borderRadius: 14,
    width: "100%",
    alignItems: "center",
  },
  successBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
