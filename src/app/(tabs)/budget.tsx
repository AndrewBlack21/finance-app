import { useState, useMemo, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Modal,
  StyleSheet,
  TextInput,
  Alert,
  Dimensions,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Circle, Text as SvgText } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import { useTransactions } from "@/hooks/useTransactions";
import { useCategories } from "@/hooks/useCategories";
import { useBudgetGoals } from "@/hooks/useBudgetGoals";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "expo-router";
import { useAppTheme } from "@/hooks/useTheme"; // 👈 Motor de temas global

const { width: SW } = Dimensions.get("window");

function Ring({
  pct,
  color,
  size = 48,
}: {
  pct: number;
  color: string;
  size?: number;
}) {
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const fill = Math.min(pct / 100, 1) * circ;
  const c = pct > 100 ? "#ef4444" : color;

  return (
    <Svg width={size} height={size}>
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke="#e5e7eb"
        strokeWidth={5}
        fill="none"
      />
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke={c}
        strokeWidth={5}
        fill="none"
        strokeDasharray={`${fill} ${circ}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <SvgText
        x={size / 2}
        y={size / 2 + 4}
        textAnchor="middle"
        fontSize="10"
        fontWeight="bold"
        fill={c}
      >
        {Math.round(pct)}%
      </SvgText>
    </Svg>
  );
}

function getMonthRange(offset = 0) {
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
}

export default function BudgetScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const { categories } = useCategories();
  const { goals, totalBudget, upsert, remove } = useBudgetGoals();
  const { colors, isDark } = useAppTheme(); // 👈 Cores dinâmicas ativas

  const [showGlobalModal, setShowGlobalModal] = useState(false);
  const [globalInput, setGlobalInput] = useState("");
  const [monthOffset, setMonthOffset] = useState(0);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [showCatPicker, setShowCatPicker] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const [editModal, setEditModal] = useState<{
    id: string | null;
    catId: string | null;
    label: string;
    color: string;
  } | null>(null);
  const [limitInput, setLimitInput] = useState("");

  const { from, to, label: mLabel, fullLabel } = getMonthRange(monthOffset);
  const currency = profile?.currency ?? "BRL";

  const fmt = (v: number, cur: string) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: cur,
      minimumFractionDigits: 2,
    }).format(v);

  const {
    transactions,
    setFilters,
    hasMore,
    isLoading,
    isLoadingMore,
    fetchMore,
  } = useTransactions({
    date_from: from,
    date_to: to,
  });

  useEffect(() => {
    if (setFilters) setFilters({ date_from: from, date_to: to });
  }, [from, to, setFilters]);

  useEffect(() => {
    if (hasMore && !isLoading && !isLoadingMore && fetchMore) {
      fetchMore();
    }
  }, [hasMore, isLoading, isLoadingMore, fetchMore]);

  const spentByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    transactions
      .filter((t) => t.type === "expense")
      .forEach((t) => {
        const key = t.category_id ?? "__none__";
        map[key] = (map[key] ?? 0) + (Number(t.amount) || 0);
      });
    return map;
  }, [transactions]);

  const totalSpent = Object.values(spentByCategory).reduce((s, v) => s + v, 0);
  const totalPct = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

  const catRows = useMemo(() => {
    const seen = new Set<string>();
    const rows: {
      id: string;
      name: string;
      color: string;
      spent: number;
      limit: number | null;
      goalId: string | null;
    }[] = [];

    goals.forEach((g) => {
      if (!g.category_id) return;
      const cat = categories.find((c) => c.id === g.category_id);
      if (!cat) return;
      seen.add(cat.id);
      rows.push({
        id: cat.id,
        name: cat.name,
        color: cat.color,
        spent: spentByCategory[cat.id] ?? 0,
        limit: g.monthly_limit,
        goalId: g.id,
      });
    });

    categories.forEach((cat) => {
      if (seen.has(cat.id)) return;
      const spent = spentByCategory[cat.id] ?? 0;
      if (spent === 0) return;
      rows.push({
        id: cat.id,
        name: cat.name,
        color: cat.color,
        spent,
        limit: null,
        goalId: null,
      });
    });

    return rows.sort((a, b) => b.spent - a.spent);
  }, [goals, categories, spentByCategory]);

  const availableCats = categories.filter(
    (c) => !goals.some((g) => g.category_id === c.id),
  );

  const insight = useMemo(() => {
    if (catRows.length === 0)
      return "Nenhum gasto registado neste mês. Que tal começar a definir as suas metas?";

    const biggestExpense = catRows[0];
    const biggestPct =
      totalBudget > 0 ? (biggestExpense.spent / totalBudget) * 100 : 0;

    if (totalPct > 100) {
      return `⚠️ ${biggestExpense.name} concentra o maior gasto: ${biggestPct.toFixed(0)}% da meta. Orçamento estourado!`;
    }

    return `💡 ${biggestExpense.name} concentra o maior gasto: ${biggestPct.toFixed(0)}% da meta. Tudo dentro do planejado.`;
  }, [catRows, totalBudget, totalPct]);

  const projection = useMemo(() => {
    const today = new Date();
    const [yearStr, monthStr] = from.split("-");
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);

    const daysInMonth = new Date(year, month, 0).getDate();
    let daysPassed = 1;
    let daysLeft = 0;

    if (today.getFullYear() === year && today.getMonth() + 1 === month) {
      daysPassed = today.getDate();
      daysLeft = daysInMonth - daysPassed;
    } else if (
      today.getFullYear() > year ||
      (today.getFullYear() === year && today.getMonth() + 1 > month)
    ) {
      daysPassed = daysInMonth;
      daysLeft = 0;
    } else {
      daysPassed = 0;
      daysLeft = daysInMonth;
    }

    const dailyAvg = daysPassed > 0 ? totalSpent / daysPassed : 0;
    const projTotal = daysPassed > 0 ? totalSpent + dailyAvg * daysLeft : 0;
    const projStatusColor = projTotal > totalBudget ? "#ef4444" : "#22c55e";

    return { dailyAvg, daysLeft, projTotal, projStatusColor };
  }, [from, totalSpent, totalBudget]);

  const openEdit = (
    catId: string,
    name: string,
    color: string,
    currentLimit?: number,
    goalId?: string | null,
  ) => {
    setEditModal({ id: goalId || null, catId, label: name, color });
    setLimitInput(currentLimit?.toString() ?? "");
  };

  const saveGoal = async () => {
    const val = parseFloat(limitInput.replace(",", "."));
    if (!editModal || isNaN(val) || val <= 0)
      return Alert.alert("Erro", "Digite um valor válido.");

    const { error } = await upsert(
      editModal.catId,
      editModal.label,
      val,
      currency,
    );
    if (error) {
      Alert.alert("Erro ao salvar", "Ocorreu um erro ao gravar a sua meta.");
    } else {
      setEditModal(null);
      setLimitInput("");
    }
  };

  const deleteGoalInline = async (goalId: string) => {
    const confirmAction = async () => {
      const { error } = await remove(goalId);
      if (error) Alert.alert("Erro", "Não foi possível remover a meta.");
    };

    if (Platform.OS === "web") {
      if (window.confirm("Deseja remover esta meta?")) await confirmAction();
    } else {
      Alert.alert("Remover Meta", "Tem certeza que deseja apagar esta meta?", [
        { text: "Cancelar", style: "cancel" },
        { text: "Remover", style: "destructive", onPress: confirmAction },
      ]);
    }
  };

  const handleDeleteGoal = async () => {
    if (editModal?.id) {
      const { error } = await remove(editModal.id);
      if (error) {
        Alert.alert("Erro", "Não foi possível remover a meta.");
      } else {
        setEditModal(null);
      }
    }
  };

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: colors.bg }]}>
      <View
        style={[
          s.header,
          {
            backgroundColor: colors.card,
            borderBottomColor: colors.border,
            borderBottomWidth: 1,
          },
        ]}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={[s.backBtn, { backgroundColor: colors.inputBg }]}
          >
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <View>
            <Text style={[s.headerSub, { color: colors.subText }]}>
              Análise
            </Text>
            <Text style={[s.headerTitle, { color: colors.text }]}>Metas</Text>
          </View>
        </View>
        <TouchableOpacity
          style={[
            s.monthBtn,
            { backgroundColor: isDark ? "#312e81" : "#ede9fe" },
          ]}
          onPress={() => setShowMonthPicker(true)}
        >
          <Text style={[s.monthBtnText, { color: colors.primary }]}>
            {mLabel}
          </Text>
          <Ionicons name="chevron-down" size={12} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.darkCard}>
          <View style={s.darkCardTop}>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
            >
              <Text style={s.darkCardSmall}>ORÇAMENTO MENSAL</Text>
              <TouchableOpacity
                onPress={() => {
                  setGlobalInput(totalBudget > 0 ? totalBudget.toString() : "");
                  setShowGlobalModal(true);
                }}
              >
                <Ionicons name="pencil" size={14} color="#a5b4fc" />
              </TouchableOpacity>
            </View>
            <Text style={s.darkCardSmall}>{mLabel}</Text>
          </View>

          <View style={s.darkCardMid}>
            <Text style={s.darkCardBig}>{fmt(totalBudget, currency)}</Text>
          </View>

          <View style={s.darkProgressBg}>
            <View
              style={[
                s.darkProgressFill,
                {
                  width: `${Math.min(totalPct, 100)}%` as any,
                  backgroundColor: totalPct > 100 ? "#ef4444" : "#22c55e",
                },
              ]}
            />
          </View>

          <View style={s.darkCardFooter}>
            <View>
              <Text style={s.darkCardFooterLabel}>Gasto</Text>
              <Text style={s.darkCardFooterValue}>
                {fmt(totalSpent, currency)}
              </Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={s.darkCardFooterLabel}>Do orçamento</Text>
              <Text style={s.darkCardFooterValue}>{totalPct.toFixed(0)}%</Text>
            </View>
          </View>

          <View style={{ alignItems: "center", marginTop: 16 }}>
            <TouchableOpacity
              style={s.detailsBtn}
              onPress={() => setShowDetails(true)}
            >
              <Text style={s.detailsBtnText}>Ver detalhes</Text>
            </TouchableOpacity>
          </View>
        </View>

        {insight && (
          <View
            style={[
              s.insightCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderLeftColor: colors.primary,
                borderWidth: 1,
              },
            ]}
          >
            <Text style={[s.insightText, { color: colors.text }]}>
              {insight}
            </Text>
          </View>
        )}

        <Text style={[s.sectionTitle, { color: colors.text }]}>
          Por categoria
        </Text>
        {catRows.length === 0 && (
          <View style={s.empty}>
            <Ionicons name="flag-outline" size={40} color={colors.subText} />
            <Text style={[s.emptyText, { color: colors.subText }]}>
              Nenhum gasto registrado este mês
            </Text>
          </View>
        )}

        {catRows.map((row) => {
          const pct = row.limit ? (row.spent / row.limit) * 100 : 0;
          return (
            <View
              key={row.id}
              style={[
                s.catRow,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  borderWidth: 1,
                },
              ]}
            >
              <Ring pct={row.limit ? pct : 0} color={row.color} size={52} />
              <View style={s.catInfo}>
                <View style={s.catNameRow}>
                  <View style={[s.catDot, { backgroundColor: row.color }]} />
                  <Text style={[s.catName, { color: colors.text }]}>
                    {row.name}
                  </Text>
                </View>
                <Text style={[s.catValues, { color: colors.subText }]}>
                  {fmt(row.spent, currency)}{" "}
                  {row.limit ? ` / ${fmt(row.limit, currency)}` : ""}
                </Text>
                {row.limit && (
                  <View style={[s.catBar, { backgroundColor: colors.border }]}>
                    <View
                      style={[
                        s.catBarFill,
                        {
                          width: `${Math.min(pct, 100)}%` as any,
                          backgroundColor: pct > 100 ? "#ef4444" : row.color,
                        },
                      ]}
                    />
                  </View>
                )}
              </View>

              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
              >
                {row.goalId && (
                  <TouchableOpacity
                    style={[
                      s.editBtn,
                      {
                        backgroundColor: isDark ? "#450a0a" : "#fee2e2",
                        paddingHorizontal: 10,
                      },
                    ]}
                    onPress={() => deleteGoalInline(row.goalId!)}
                  >
                    <Ionicons name="trash" size={14} color="#dc2626" />
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[
                    s.editBtn,
                    { backgroundColor: isDark ? "#312e81" : "#ede9fe" },
                  ]}
                  onPress={() =>
                    openEdit(
                      row.id,
                      row.name,
                      row.color,
                      row.limit ?? undefined,
                      row.goalId,
                    )
                  }
                >
                  <Ionicons
                    name={row.limit ? "pencil" : "add"}
                    size={14}
                    color={colors.primary}
                  />
                  <Text style={[s.editBtnText, { color: colors.primary }]}>
                    {row.limit ? "Editar" : "Definir"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}

        <TouchableOpacity
          style={[
            s.addGoalBtn,
            { borderColor: colors.primary, backgroundColor: colors.card },
          ]}
          onPress={() => setShowCatPicker(true)}
        >
          <Ionicons
            name="add-circle-outline"
            size={16}
            color={colors.primary}
          />
          <Text style={[s.addGoalText, { color: colors.primary }]}>
            Definir meta em outra categoria
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* MODAL: DETALHES DO ORÇAMENTO */}
      <Modal visible={showDetails} transparent animationType="slide">
        <View style={s.detailsDarkOverlay}>
          <View style={s.detailsDarkSheet}>
            <View style={s.detailsHeader}>
              <View>
                <Text style={s.detailsMonthLabel}>{fullLabel}</Text>
                <Text style={s.detailsTitle}>Detalhes do orçamento</Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowDetails(false)}
                style={s.detailsCloseBtn}
              >
                <Ionicons name="close" size={20} color="#9ca3af" />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 40 }}
            >
              <View style={s.detailsBox}>
                <View style={s.detailsRowBetween}>
                  <View>
                    <Text style={s.detailsLabel}>Gasto até agora</Text>
                    <Text style={s.detailsMainValue}>
                      {fmt(totalSpent, currency)}
                    </Text>
                    <Text style={s.detailsSubValue}>
                      de {fmt(totalBudget, currency)} no orçamento
                    </Text>
                  </View>
                  <View style={s.detailsCircleWrap}>
                    <Text style={s.detailsCircleText}>
                      {totalPct.toFixed(0)}%
                    </Text>
                  </View>
                </View>
              </View>

              <Text style={s.detailsSectionTitle}>PROJEÇÃO DO MÊS</Text>
              <View style={s.detailsBox}>
                <View
                  style={[
                    s.detailsRowBetween,
                    {
                      borderBottomWidth: 1,
                      borderBottomColor: "#333",
                      paddingBottom: 16,
                      marginBottom: 16,
                    },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={s.detailsLabel}>Gasto diário médio</Text>
                    <Text style={s.detailsMediumValue}>
                      {fmt(projection.dailyAvg, currency)}/dia
                    </Text>
                  </View>
                  <View style={{ flex: 1, alignItems: "flex-end" }}>
                    <Text style={s.detailsLabel}>Dias restantes</Text>
                    <Text style={s.detailsMediumValue}>
                      {projection.daysLeft} dias
                    </Text>
                  </View>
                </View>
                <View style={s.detailsRowBetween}>
                  <Text style={s.detailsLabel}>
                    Projeção dentro do orçamento
                  </Text>
                  <Text
                    style={[
                      s.detailsMediumValue,
                      { color: projection.projStatusColor },
                    ]}
                  >
                    {fmt(projection.projTotal, currency)}
                  </Text>
                </View>
              </View>

              <Text style={s.detailsSectionTitle}>POR CATEGORIA</Text>
              <View style={s.detailsBox}>
                {catRows.map((cat, index) => (
                  <View
                    key={cat.id}
                    style={[
                      s.detailsCatRow,
                      index === catRows.length - 1 && { borderBottomWidth: 0 },
                    ]}
                  >
                    <View style={s.detailsCatLeft}>
                      <View
                        style={[s.catDot, { backgroundColor: cat.color }]}
                      />
                      <Text style={s.detailsCatName} numberOfLines={1}>
                        {cat.name}
                      </Text>
                    </View>
                    <View style={s.detailsCatDashedLine} />
                    <Text style={s.detailsCatValue}>
                      {fmt(cat.spent, currency)}
                    </Text>
                  </View>
                ))}
                {catRows.length === 0 && (
                  <Text
                    style={{
                      color: "#9ca3af",
                      fontSize: 13,
                      textAlign: "center",
                    }}
                  >
                    Sem gastos registrados.
                  </Text>
                )}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* MODAL: SELETOR DE MÊS */}
      <Modal visible={showMonthPicker} transparent animationType="fade">
        <TouchableOpacity
          style={s.overlay}
          activeOpacity={1}
          onPress={() => setShowMonthPicker(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={[s.pickerBox, { backgroundColor: colors.card }]}
          >
            <Text style={[s.pickerTitle, { color: colors.text }]}>
              Selecionar mês
            </Text>
            {Array.from({ length: 12 }, (_, i) => i - 11).map((offset) => {
              const { label, fullLabel: fl } = getMonthRange(offset);
              const active = offset === monthOffset;
              return (
                <TouchableOpacity
                  key={offset}
                  style={[
                    s.pickerItem,
                    active && [
                      s.pickerItemActive,
                      { backgroundColor: isDark ? "#312e81" : "#ede9fe" },
                    ],
                  ]}
                  onPress={() => {
                    setMonthOffset(offset);
                    setShowMonthPicker(false);
                  }}
                >
                  <Text
                    style={[
                      s.pickerItemText,
                      { color: colors.text },
                      active && [
                        s.pickerItemTextActive,
                        { color: colors.primary },
                      ],
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
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* MODAL: SELETOR DE CATEGORIA OU EDIÇÃO DE META */}
      <Modal
        visible={showCatPicker || !!editModal}
        transparent
        animationType="slide"
      >
        <TouchableOpacity
          style={s.overlay}
          activeOpacity={1}
          onPress={() => {
            setShowCatPicker(false);
            setEditModal(null);
          }}
        >
          {showCatPicker && !editModal && (
            <TouchableOpacity
              activeOpacity={1}
              style={[s.pickerBox, { backgroundColor: colors.card }]}
            >
              <Text style={[s.pickerTitle, { color: colors.text }]}>
                Escolher Categoria
              </Text>
              <ScrollView style={{ maxHeight: 300 }}>
                {availableCats.length === 0 ? (
                  <Text
                    style={{
                      color: colors.subText,
                      textAlign: "center",
                      padding: 20,
                    }}
                  >
                    Todas as categorias já possuem metas.
                  </Text>
                ) : (
                  availableCats.map((c) => (
                    <TouchableOpacity
                      key={c.id}
                      style={s.pickerItem}
                      onPress={() => {
                        setShowCatPicker(false);
                        openEdit(c.id, c.name, c.color);
                      }}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <View
                          style={[s.catDot, { backgroundColor: c.color }]}
                        />
                        <Text
                          style={[s.pickerItemText, { color: colors.text }]}
                        >
                          {c.name}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))
                )}
              </ScrollView>
            </TouchableOpacity>
          )}

          {!!editModal && (
            <TouchableOpacity
              activeOpacity={1}
              style={[s.editBox, { backgroundColor: colors.card }]}
            >
              <Text style={[s.editTitle, { color: colors.text }]}>
                Meta para {editModal.label}
              </Text>
              <Text style={[s.editSub, { color: colors.subText }]}>
                Defina o limite mensal de gastos
              </Text>
              <View
                style={[
                  s.editInputRow,
                  {
                    backgroundColor: colors.inputBg,
                    borderColor: colors.border,
                    borderWidth: 1,
                  },
                ]}
              >
                <Text style={[s.editCurrency, { color: colors.subText }]}>
                  {currency}
                </Text>
                <TextInput
                  style={[s.editInput, { color: colors.text }]}
                  value={limitInput}
                  onChangeText={setLimitInput}
                  keyboardType="numeric"
                  placeholder="0,00"
                  placeholderTextColor={colors.subText}
                  autoFocus
                />
              </View>
              <View style={{ flexDirection: "row", gap: 10 }}>
                {editModal.id && (
                  <TouchableOpacity
                    style={[
                      s.saveBtn,
                      {
                        backgroundColor: isDark ? "#450a0a" : "#fee2e2",
                        flex: 1,
                      },
                    ]}
                    onPress={handleDeleteGoal}
                  >
                    <Text style={[s.saveBtnText, { color: "#dc2626" }]}>
                      Remover
                    </Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[
                    s.saveBtn,
                    { backgroundColor: colors.primary, flex: 2 },
                  ]}
                  onPress={saveGoal}
                >
                  <Text style={s.saveBtnText}>Salvar meta</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          )}
        </TouchableOpacity>
      </Modal>

      {/* MODAL: ORÇAMENTO GLOBAL DO MÊS */}
      <Modal visible={showGlobalModal} transparent animationType="slide">
        <TouchableOpacity
          style={s.overlay}
          activeOpacity={1}
          onPress={() => setShowGlobalModal(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={[s.editBox, { backgroundColor: colors.card }]}
          >
            <Text style={[s.editTitle, { color: colors.text }]}>
              Meta do Mês
            </Text>
            <Text style={[s.editSub, { color: colors.subText }]}>
              Defina o valor máximo de gastos para este mês.
            </Text>

            <View
              style={[
                s.editInputRow,
                {
                  backgroundColor: colors.inputBg,
                  borderColor: colors.border,
                  borderWidth: 1,
                },
              ]}
            >
              <Text style={[s.editCurrency, { color: colors.subText }]}>
                {currency}
              </Text>
              <TextInput
                style={[s.editInput, { color: colors.text }]}
                value={globalInput}
                onChangeText={setGlobalInput}
                keyboardType="numeric"
                placeholder="0,00"
                placeholderTextColor={colors.subText}
                autoFocus
              />
            </View>

            <TouchableOpacity
              style={[s.saveBtn, { backgroundColor: colors.primary }]}
              onPress={async () => {
                const val = parseFloat(globalInput.replace(",", "."));
                if (isNaN(val) || val <= 0)
                  return Alert.alert("Erro", "Digite um valor válido.");

                await upsert(null, "Orçamento do Mês", val, currency);
                setShowGlobalModal(false);
              }}
            >
              <Text style={s.saveBtnText}>Salvar Meta do Mês</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
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
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: "center",
    alignItems: "center",
  },
  headerSub: { fontSize: 13 },
  headerTitle: { fontSize: 26, fontWeight: "800" },
  monthBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  monthBtnText: { fontSize: 13, fontWeight: "700" },
  scroll: { paddingHorizontal: 20, paddingBottom: 40, gap: 14 },

  darkCard: { backgroundColor: "#1e1b4b", borderRadius: 24, padding: 20 },
  darkCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  darkCardSmall: {
    fontSize: 11,
    color: "#a5b4fc",
    fontWeight: "600",
    letterSpacing: 1,
  },
  darkCardMid: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  darkCardBig: { fontSize: 32, fontWeight: "800", color: "#fff" },
  darkProgressBg: {
    height: 4,
    backgroundColor: "#312e81",
    borderRadius: 2,
    marginBottom: 14,
  },
  darkProgressFill: { height: 4, borderRadius: 2 },
  darkCardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  darkCardFooterLabel: { fontSize: 11, color: "#818cf8", marginBottom: 2 },
  darkCardFooterValue: { fontSize: 14, color: "#fff", fontWeight: "700" },

  detailsBtn: {
    backgroundColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  detailsBtnText: { color: "#fff", fontSize: 12, fontWeight: "600" },

  insightCard: {
    borderRadius: 14,
    padding: 16,
    borderLeftWidth: 3,
  },
  insightText: { fontSize: 13, lineHeight: 20 },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    marginTop: 4,
  },
  catRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    padding: 14,
    gap: 12,
  },
  catInfo: { flex: 1 },
  catNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  catDot: { width: 8, height: 8, borderRadius: 4 },
  catName: { fontSize: 14, fontWeight: "700" },
  catValues: { fontSize: 12, marginBottom: 4 },
  catBar: { height: 4, borderRadius: 2 },
  catBarFill: { height: 4, borderRadius: 2 },
  editBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  editBtnText: { fontSize: 11, fontWeight: "700" },
  addGoalBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderStyle: "dashed",
  },
  addGoalText: { fontSize: 14, fontWeight: "600" },
  empty: { alignItems: "center", paddingVertical: 32, gap: 8 },
  emptyText: { fontSize: 14 },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  pickerBox: {
    borderRadius: 20,
    padding: 20,
    margin: 12,
    maxHeight: "70%",
  },
  pickerTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 12,
  },
  pickerItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 13,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  pickerItemActive: {},
  pickerItemText: { fontSize: 14 },
  pickerItemTextActive: { fontWeight: "700" },
  editBox: {
    borderRadius: 24,
    padding: 24,
    margin: 12,
  },
  editTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 4,
  },
  editSub: { fontSize: 13, marginBottom: 20 },
  editInputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
  },
  editCurrency: {
    fontSize: 14,
    fontWeight: "600",
    marginRight: 8,
  },
  editInput: { flex: 1, fontSize: 20, fontWeight: "700" },
  saveBtn: {
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
  },
  saveBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  // Card (Detalhameto de meta)
  detailsDarkOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  detailsDarkSheet: {
    backgroundColor: "#312e81",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    height: "85%",
  },
  detailsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 24,
  },
  detailsMonthLabel: {
    color: "#9ca3af",
    fontSize: 12,
    textTransform: "capitalize",
    marginBottom: 4,
  },
  detailsTitle: { color: "#fff", fontSize: 22, fontWeight: "700" },
  detailsCloseBtn: { backgroundColor: "#2c2c2e", padding: 6, borderRadius: 16 },

  detailsBox: {
    backgroundColor: "#2c2c2e",
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  detailsRowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  detailsLabel: {
    color: "#9ca3af",
    fontSize: 11,
    marginBottom: 4,
    fontWeight: "500",
    textTransform: "uppercase",
  },
  detailsMainValue: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "800",
    marginBottom: 2,
  },
  detailsSubValue: { color: "#6b7280", fontSize: 12 },

  detailsCircleWrap: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 3,
    borderColor: "#3f3f46",
    justifyContent: "center",
    alignItems: "center",
  },
  detailsCircleText: { color: "#fff", fontSize: 12, fontWeight: "bold" },

  detailsSectionTitle: {
    color: "#9ca3af",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: 10,
    marginLeft: 4,
  },
  detailsMediumValue: { color: "#fff", fontSize: 16, fontWeight: "700" },

  detailsCatRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#3f3f46",
  },
  detailsCatLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    width: 100,
  },
  detailsCatName: { color: "#d1d5db", fontSize: 13, fontWeight: "500" },
  detailsCatDashedLine: {
    flex: 1,
    borderBottomWidth: 1,
    borderColor: "#4b5563",
    borderStyle: "dashed",
    marginHorizontal: 12,
    opacity: 0.5,
  },
  detailsCatValue: { color: "#fff", fontSize: 13, fontWeight: "600" },
});
