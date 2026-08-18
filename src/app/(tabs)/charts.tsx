import { useState, useMemo, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Platform,
  useWindowDimensions,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import Svg, {
  Path,
  Circle,
  G,
  Text as SvgText,
  Rect,
  Line,
} from "react-native-svg";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTransactions } from "@/hooks/useTransactions";
import { useFixedExpenses } from "@/hooks/useFixedExpenses";
import { useInstallments } from "@/hooks/useInstallments";
import { formatCurrency } from "@/utils";
import { useAuth } from "@/hooks/useAuth";
import { useAppTheme } from "@/hooks/useTheme";

const PALETTE = [
  "#3b82f6",
  "#f97316",
  "#8b5cf6",
  "#ec4899",
  "#eab308",
  "#06b6d4",
  "#14b8a6",
  "#f43f5e",
  "#6366f1",
  "#84cc16",
];

// 👇 FUNÇÃO AUXILIAR: Para detetar ícones da lista Top Despesas
const getCategoryIcon = (name: string): keyof typeof Ionicons.glyphMap => {
  const n = name.toLowerCase();
  if (n.includes("aliment") || n.includes("mercado") || n.includes("comida"))
    return "cart";
  if (n.includes("morad") || n.includes("casa") || n.includes("aluguel"))
    return "home";
  if (n.includes("transport") || n.includes("carro") || n.includes("gasolina"))
    return "car";
  if (n.includes("educa") || n.includes("faculdade") || n.includes("curso"))
    return "school";
  if (
    n.includes("saúde") ||
    n.includes("farmácia") ||
    n.includes("médico") ||
    n.includes("exame")
  )
    return "medkit";
  if (n.includes("assinatura") || n.includes("netflix") || n.includes("tv"))
    return "tv";
  if (n.includes("lazer") || n.includes("festa") || n.includes("presente"))
    return "gift";
  if (n.includes("roupa") || n.includes("vestuário")) return "shirt";
  if (n.includes("serviço")) return "build";
  if (n.includes("luz") || n.includes("energia")) return "flash";
  if (n.includes("internet") || n.includes("telefone")) return "wifi";
  if (n.includes("cartão") || n.includes("fatura")) return "card";
  return "pricetag";
};

function getLast6Months() {
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    months.push({
      label: d.toLocaleString("pt-BR", { month: "short" }).replace(".", ""),
      from: new Date(d.getFullYear(), d.getMonth(), 1)
        .toISOString()
        .split("T")[0],
      to: new Date(d.getFullYear(), d.getMonth() + 1, 0)
        .toISOString()
        .split("T")[0],
    });
  }
  return months;
}

function polarToXY(cx: number, cy: number, r: number, angle: number) {
  const rad = (angle - 90) * (Math.PI / 180);
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function slicePath(
  cx: number,
  cy: number,
  r: number,
  start: number,
  end: number,
) {
  const s = polarToXY(cx, cy, r, start);
  const e = polarToXY(cx, cy, r, end);
  const large = end - start > 180 ? 1 : 0;
  return `M${cx},${cy} L${s.x},${s.y} A${r},${r} 0 ${large} 1 ${e.x},${e.y} Z`;
}

function isInstallmentActiveInMonth(inst: any, year: number, month: number) {
  const dateStr = inst.start_date
    ? inst.start_date.split("T")[0]
    : inst.created_at.split("T")[0];
  const [sYear, sMonth] = dateStr.split("-").map(Number);
  const startM = sMonth - 1;
  const monthsDiff = (year - sYear) * 12 + (month - startM);
  return monthsDiff >= 0 && monthsDiff < inst.total_installments;
}

function isFixedActiveInMonth(f: any, year: number, month: number) {
  if (!f.created_at) return true;
  const dateStr = f.created_at.split("T")[0];
  const [sYear, sMonth] = dateStr.split("-").map(Number);
  const startM = sMonth - 1;
  const monthsDiff = (year - sYear) * 12 + (month - startM);
  return monthsDiff >= 0;
}

export default function ChartsScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();

  const { width: SW } = useWindowDimensions();
  const CHART_W = SW - 48; // Padding ajustado

  const { expenses: fixedList } = useFixedExpenses();
  const { installments } = useInstallments();

  const [chartType, setChartType] = useState<"pie" | "bar" | "annual">("pie");
  const [selected, setSelected] = useState<number | null>(null);

  const currency = profile?.currency ?? "BRL";

  const fetchRange = useMemo(() => {
    const today = new Date();
    const year = today.getFullYear();
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(today.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    const firstDayOfYear = new Date(year, 0, 1);
    const fetchFrom =
      sixMonthsAgo < firstDayOfYear ? sixMonthsAgo : firstDayOfYear;
    return {
      from: fetchFrom.toISOString().split("T")[0],
      to: new Date(year, 11, 31).toISOString().split("T")[0],
    };
  }, []);

  const { transactions, hasMore, isLoading, isLoadingMore, fetchMore } =
    useTransactions({
      date_from: fetchRange.from,
      date_to: fetchRange.to,
    });

  useEffect(() => {
    if (hasMore && !isLoading && !isLoadingMore && fetchMore) {
      fetchMore();
    }
  }, [hasMore, isLoading, isLoadingMore, fetchMore]);

  // VARIÁVEIS DO MÊS ATUAL (Mantêm a lógica exata de cálculo)
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();
  const currentMonthFrom = new Date(currentYear, currentMonth, 1)
    .toISOString()
    .split("T")[0];
  const currentMonthTo = new Date(currentYear, currentMonth + 1, 0)
    .toISOString()
    .split("T")[0];

  const currentMonthIncome = useMemo(() => {
    return transactions
      .filter(
        (t) =>
          t.type === "income" &&
          t.date >= currentMonthFrom &&
          t.date <= currentMonthTo &&
          !t.title?.includes("Fatura"),
      )
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  }, [transactions, currentMonthFrom, currentMonthTo]);

  const pieData = useMemo(() => {
    const map: Record<string, { label: string; value: number; color: string }> =
      {};

    transactions
      .filter(
        (t) =>
          t.type === "expense" &&
          t.date >= currentMonthFrom &&
          t.date <= currentMonthTo &&
          !t.title?.includes("Fatura"),
      )
      .forEach((t) => {
        const amt = Number(t.amount) || 0;
        const key = t.category?.name ?? "Outros";
        const color = t.category?.color ?? "#9ca3af";
        if (!map[key]) map[key] = { label: key, value: 0, color };
        map[key].value += amt;
      });

    installments.forEach((i) => {
      if (isInstallmentActiveInMonth(i, currentYear, currentMonth)) {
        const amt = Number(i.installment_amount) || 0;
        const key = (i as any).category?.name ?? "Cartão de Crédito";
        const color = (i as any).category?.color ?? "#f97316";
        if (!map[key]) map[key] = { label: key, value: 0, color };
        map[key].value += amt;
      }
    });

    fixedList.forEach((f) => {
      if (isFixedActiveInMonth(f, currentYear, currentMonth)) {
        const amt = Number(f.amount) || 0;
        const key = f.title ?? f.category?.name ?? "Contas Fixas"; // Puxamos o título para separar as contas fixas visualmente
        const color = f.category?.color ?? "#ef4444";
        if (!map[key]) map[key] = { label: key, value: 0, color };
        map[key].value += amt;
      }
    });

    const arr = Object.values(map).sort((a, b) => b.value - a.value);
    const total = arr.reduce((s, d) => s + d.value, 0);

    return arr.map((d, i) => ({
      ...d,
      color:
        d.color !== "#9ca3af" && d.color !== "#f97316" && d.color !== "#ef4444"
          ? PALETTE[i % PALETTE.length]
          : d.color,
      pct: total > 0 ? (d.value / total) * 100 : 0,
      deg: total > 0 ? (d.value / total) * 360 : 0,
    }));
  }, [
    transactions,
    fixedList,
    installments,
    currentMonthFrom,
    currentMonthTo,
    currentYear,
    currentMonth,
  ]);

  const pieTotal = pieData.reduce((s, d) => s + d.value, 0);
  const currentMonthBalance = currentMonthIncome - pieTotal;
  const poupancaPct =
    currentMonthIncome > 0
      ? Math.max(0, (currentMonthBalance / currentMonthIncome) * 100)
      : 0;

  const months = useMemo(() => getLast6Months(), []);

  const barData = useMemo(() => {
    return months.map((m) => {
      const mDate = new Date(m.from + "T00:00:00");
      const y = mDate.getFullYear();
      const mo = mDate.getMonth();

      let income = 0;
      let expense = 0;

      transactions.forEach((t) => {
        if (
          t.date >= m.from &&
          t.date <= m.to &&
          !t.title?.includes("Fatura")
        ) {
          const amt = Number(t.amount) || 0;
          if (t.type === "income") income += amt;
          else expense += amt;
        }
      });

      installments.forEach((inst) => {
        if (isInstallmentActiveInMonth(inst, y, mo))
          expense += Number(inst.installment_amount) || 0;
      });

      fixedList.forEach((f) => {
        if (isFixedActiveInMonth(f, y, mo)) expense += Number(f.amount) || 0;
      });

      return { label: m.label, income, expense };
    });
  }, [transactions, installments, fixedList, months]);

  const barMax = Math.max(...barData.flatMap((d) => [d.income, d.expense]), 1);

  const annualData = useMemo(() => {
    const year = new Date().getFullYear();
    return Array.from({ length: 12 }).map((_, mo) => {
      const mFrom = new Date(year, mo, 1).toISOString().split("T")[0];
      const mTo = new Date(year, mo + 1, 0).toISOString().split("T")[0];
      const label = new Date(year, mo, 1).toLocaleString("pt-BR", {
        month: "long",
      });
      const shortLabel = new Date(year, mo, 1)
        .toLocaleString("pt-BR", { month: "short" })
        .replace(".", "");

      let income = 0;
      let expense = 0;

      transactions.forEach((t) => {
        if (t.date >= mFrom && t.date <= mTo && !t.title?.includes("Fatura")) {
          const amt = Number(t.amount) || 0;
          if (t.type === "income") income += amt;
          else expense += amt;
        }
      });

      installments.forEach((inst) => {
        if (isInstallmentActiveInMonth(inst, year, mo))
          expense += Number(inst.installment_amount) || 0;
      });

      fixedList.forEach((f) => {
        if (isFixedActiveInMonth(f, year, mo)) expense += Number(f.amount) || 0;
      });

      return {
        monthIndex: mo,
        label: label.charAt(0).toUpperCase() + label.slice(1),
        shortLabel: shortLabel.charAt(0).toUpperCase() + shortLabel.slice(1),
        income,
        expense,
        diff: income - expense,
      };
    });
  }, [transactions, installments, fixedList]);

  const annualMax = Math.max(
    ...annualData.flatMap((d) => [d.income, d.expense]),
    1,
  );

  // 👇 RENDERIZAÇÃO: MÊS ATUAL (Pizza Lado a Lado + Top Despesas Embaixo)
  function renderPie() {
    const PIE_R = Math.min(75, CHART_W / 4); // Gráfico menor para caber legenda ao lado
    const HOLE_R = PIE_R * 0.65;
    const CX = PIE_R;
    const CY = PIE_R;

    let startAngle = 0;

    return (
      <View>
        <View
          style={[
            s.modernChartCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Text style={[s.chartCardTitle, { color: colors.text }]}>
            Despesas por Categoria
          </Text>

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <View style={{ width: PIE_R * 2, height: PIE_R * 2 }}>
              <Svg width={PIE_R * 2} height={PIE_R * 2}>
                <G>
                  {pieData.map((d, i) => {
                    const end = startAngle + d.deg;
                    const path = slicePath(CX, CY, PIE_R, startAngle, end);
                    const isSelected = selected === i;
                    startAngle = end;
                    return (
                      <Path
                        key={i}
                        d={path}
                        fill={d.color}
                        opacity={selected === null || isSelected ? 1 : 0.3}
                        onPress={() => setSelected(isSelected ? null : i)}
                        strokeWidth={isSelected ? 3 : 1.5}
                        stroke={colors.card}
                      />
                    );
                  })}
                  <Circle cx={CX} cy={CY} r={HOLE_R} fill={colors.card} />
                  <SvgText
                    x={CX}
                    y={CY + 5}
                    textAnchor="middle"
                    fontSize="14"
                    fontWeight="bold"
                    fill={colors.text}
                  >
                    {selected !== null
                      ? `${pieData[selected].pct.toFixed(0)}%`
                      : "100%"}
                  </SvgText>
                </G>
              </Svg>
            </View>

            {/* Legenda Lateral (Estilo Imagem 2) */}
            <View style={{ flex: 1, paddingLeft: 20 }}>
              {pieData.slice(0, 4).map((d, i) => (
                <View
                  key={i}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    marginBottom: 10,
                    justifyContent: "space-between",
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      flex: 1,
                    }}
                  >
                    <View
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 4,
                        backgroundColor: d.color,
                        marginRight: 8,
                      }}
                    />
                    <Text
                      style={{
                        color: colors.text,
                        fontSize: 12,
                        fontWeight: "500",
                      }}
                      numberOfLines={1}
                    >
                      {d.label}
                    </Text>
                  </View>
                  <Text
                    style={{ color: d.color, fontSize: 12, fontWeight: "bold" }}
                  >
                    {formatCurrency(d.value, currency)}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* 👇 DESIGN ATUALIZADO: Lista Top Despesas Inspirada na Imagem */}
        {pieData.length > 0 && (
          <View
            style={[
              s.modernChartCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Text style={[s.chartCardTitle, { color: colors.text }]}>
              Top Despesas
            </Text>

            {pieData.slice(0, 6).map((d, i) => (
              <View key={i} style={s.topDespesaItem}>
                <View style={s.topDespesaRow}>
                  <View style={s.topDespesaLeft}>
                    <Ionicons
                      name={getCategoryIcon(d.label)}
                      size={18}
                      color={colors.subText}
                      style={{ marginRight: 10 }}
                    />
                    <Text
                      style={[s.topDespesaLabel, { color: colors.text }]}
                      numberOfLines={1}
                    >
                      {d.label}
                    </Text>
                  </View>
                  {/* Cor Vermelha no valor, exatamente como na imagem */}
                  <Text style={[s.topDespesaValue, { color: "#ef4444" }]}>
                    {formatCurrency(d.value, currency)}
                  </Text>
                </View>

                <View
                  style={[
                    s.topDespesaBarBg,
                    { backgroundColor: colors.inputBg },
                  ]}
                >
                  <View
                    style={[
                      s.topDespesaBarFill,
                      { width: `${d.pct}%`, backgroundColor: d.color },
                    ]}
                  />
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  }

  // 👇 RENDERIZAÇÃO: BARRAS SEMESTRAIS
  function renderBar() {
    const BAR_H = 200;
    const PADDING = 20;

    const availW = CHART_W - PADDING * 2;
    const BAR_W = Math.min(14, availW / (barData.length * 3));
    const GAP = (availW - barData.length * BAR_W * 2) / (barData.length + 1);

    return (
      <View
        style={[
          s.modernChartCard,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <Text style={[s.chartCardTitle, { color: colors.text }]}>
          Gastos vs Entradas (6 meses)
        </Text>

        <Svg width={CHART_W} height={BAR_H + 40}>
          {[0, 0.5, 1].map((pct, i) => {
            const y = PADDING + (BAR_H - PADDING * 2) * (1 - pct);
            return (
              <G key={i}>
                <Line
                  x1={PADDING}
                  y1={y}
                  x2={CHART_W - PADDING}
                  y2={y}
                  stroke={colors.border}
                  strokeWidth={1}
                  strokeDasharray="4 4"
                />
                <SvgText
                  x={PADDING}
                  y={y - 6}
                  fontSize="10"
                  fill={colors.subText}
                >
                  {formatCurrency(barMax * pct, currency, true)}
                </SvgText>
              </G>
            );
          })}

          {barData.map((d, i) => {
            const x = PADDING + i * (BAR_W * 2 + GAP) + GAP;
            const availH = BAR_H - PADDING * 2;
            const incH =
              d.income > 0 ? Math.max((d.income / barMax) * availH, 4) : 0;
            const expH =
              d.expense > 0 ? Math.max((d.expense / barMax) * availH, 4) : 0;

            return (
              <G key={i}>
                <Rect
                  x={x}
                  y={PADDING + availH - incH}
                  width={BAR_W}
                  height={incH}
                  fill="#10b981"
                  rx={BAR_W / 2}
                />
                <Rect
                  x={x + BAR_W + 4}
                  y={PADDING + availH - expH}
                  width={BAR_W}
                  height={expH}
                  fill="#ef4444"
                  rx={BAR_W / 2}
                />
                <SvgText
                  x={x + BAR_W + 2}
                  y={BAR_H + 16}
                  textAnchor="middle"
                  fontSize="11"
                  fill={colors.subText}
                  fontWeight="500"
                >
                  {d.label}
                </SvgText>
              </G>
            );
          })}
        </Svg>

        <View style={s.barLegendContainer}>
          <View style={s.barLegendItem}>
            <View style={[s.barLegendDot, { backgroundColor: "#10b981" }]} />
            <Text style={[s.barLegendText, { color: colors.subText }]}>
              Receitas
            </Text>
          </View>
          <View style={s.barLegendItem}>
            <View style={[s.barLegendDot, { backgroundColor: "#ef4444" }]} />
            <Text style={[s.barLegendText, { color: colors.subText }]}>
              Despesas
            </Text>
          </View>
        </View>
      </View>
    );
  }

  // 👇 RENDERIZAÇÃO: ANUAL (FLUXO MENSAL)
  function renderAnnual() {
    const PADDING = 20;
    const availW = CHART_W - PADDING * 2;
    const availH = 200 - PADDING * 2;

    const getX = (index: number) => PADDING + index * (availW / 11);
    const getY = (val: number) => PADDING + availH - (val / annualMax) * availH;

    const incomePath = annualData
      .map((d, i) => `${i === 0 ? "M" : "L"}${getX(i)},${getY(d.income)}`)
      .join(" ");
    const expensePath = annualData
      .map((d, i) => `${i === 0 ? "M" : "L"}${getX(i)},${getY(d.expense)}`)
      .join(" ");

    return (
      <View
        style={[
          s.modernChartCard,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        {/* Título com a Badge de Ano estilo Imagem 1 */}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 24,
          }}
        >
          <Text
            style={[s.chartCardTitle, { color: colors.text, marginBottom: 0 }]}
          >
            Fluxo Mensal
          </Text>
          <View
            style={{
              backgroundColor: "rgba(16, 185, 129, 0.15)",
              paddingHorizontal: 12,
              paddingVertical: 4,
              borderRadius: 12,
            }}
          >
            <Text style={{ color: "#10b981", fontWeight: "bold" }}>
              {new Date().getFullYear()}
            </Text>
          </View>
        </View>

        <Svg width={CHART_W} height={210}>
          {[0, 0.5, 1].map((pct, i) => {
            const y = PADDING + availH * (1 - pct);
            return (
              <G key={`grid-${i}`}>
                <Line
                  x1={PADDING}
                  y1={y}
                  x2={CHART_W - PADDING}
                  y2={y}
                  stroke={colors.border}
                  strokeWidth={1}
                  strokeDasharray="4 4"
                />
                <SvgText
                  x={PADDING}
                  y={y - 6}
                  fontSize="10"
                  fill={colors.subText}
                >
                  {formatCurrency(annualMax * pct, currency, true)}
                </SvgText>
              </G>
            );
          })}

          <Path
            d={incomePath}
            stroke="#10b981"
            strokeWidth="3"
            fill="none"
            strokeLinejoin="round"
          />
          <Path
            d={expensePath}
            stroke="#ef4444"
            strokeWidth="3"
            fill="none"
            strokeLinejoin="round"
          />

          {annualData.map((d, i) => (
            <G key={`points-${i}`}>
              <Circle
                cx={getX(i)}
                cy={getY(d.income)}
                r="4.5"
                fill="#10b981"
                stroke={colors.card}
                strokeWidth={2}
              />
              <Circle
                cx={getX(i)}
                cy={getY(d.expense)}
                r="4.5"
                fill="#ef4444"
                stroke={colors.card}
                strokeWidth={2}
              />
              <SvgText
                x={getX(i)}
                y={210 - 4}
                textAnchor="middle"
                fontSize="10"
                fill={colors.subText}
              >
                {d.shortLabel}
              </SvgText>
            </G>
          ))}
        </Svg>

        <View style={[s.barLegendContainer, { marginBottom: 0 }]}>
          <View style={s.barLegendItem}>
            <View style={[s.barLegendDot, { backgroundColor: "#10b981" }]} />
            <Text style={[s.barLegendText, { color: colors.subText }]}>
              Receitas
            </Text>
          </View>
          <View style={s.barLegendItem}>
            <View style={[s.barLegendDot, { backgroundColor: "#ef4444" }]} />
            <Text style={[s.barLegendText, { color: colors.subText }]}>
              Despesas
            </Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: colors.bg }]}>
      {/* 👇 CABEÇALHO LIMPO E MODERNO */}
      <View
        style={[s.headerContainer, { paddingTop: Math.max(insets.top, 10) }]}
      >
        <View style={{ marginTop: 16 }}>
          <Text style={[s.headerTitle, { color: colors.text }]}>
            Estatísticas
          </Text>
          <Text style={[s.headerSubtitle, { color: colors.subText }]}>
            Análise financeira detalhada
          </Text>
        </View>
      </View>

      {/* 👇 SELETOR TIPO PÍLULA (Design Moderno da Imagem 1) */}
      <View style={s.toggleWrapper}>
        <View
          style={[
            s.toggleContainer,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderWidth: 1,
            },
          ]}
        >
          <TouchableOpacity
            style={[
              s.toggleBtn,
              chartType === "pie" && {
                backgroundColor: colors.primary,
                shadowColor: "#000",
                elevation: 2,
              },
            ]}
            onPress={() => {
              setChartType("pie");
              setSelected(null);
            }}
          >
            <Text
              style={[
                s.toggleText,
                { color: colors.subText },
                chartType === "pie" && { color: "#fff" },
              ]}
            >
              Mês
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              s.toggleBtn,
              chartType === "bar" && {
                backgroundColor: colors.primary,
                shadowColor: "#000",
                elevation: 2,
              },
            ]}
            onPress={() => {
              setChartType("bar");
              setSelected(null);
            }}
          >
            <Text
              style={[
                s.toggleText,
                { color: colors.subText },
                chartType === "bar" && { color: "#fff" },
              ]}
            >
              Semestral
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              s.toggleBtn,
              chartType === "annual" && {
                backgroundColor: colors.primary,
                shadowColor: "#000",
                elevation: 2,
              },
            ]}
            onPress={() => {
              setChartType("annual");
              setSelected(null);
            }}
          >
            <Text
              style={[
                s.toggleText,
                { color: colors.subText },
                chartType === "annual" && { color: "#fff" },
              ]}
            >
              Ano
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* 👇 CARTÕES DE RESUMO SUPERIORES (Imagem 1) */}
        <View style={s.topSummaryRow}>
          <View
            style={[
              s.topSummaryCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <View
              style={[
                s.topSummaryIconBox,
                { backgroundColor: "rgba(16, 185, 129, 0.15)" },
              ]}
            >
              <Ionicons name="arrow-down" size={16} color="#10b981" />
            </View>
            <Text style={[s.topSummaryLabel, { color: colors.subText }]}>
              Receitas
            </Text>
            <Text style={[s.topSummaryValue, { color: "#10b981" }]}>
              {formatCurrency(currentMonthIncome, currency, true)}
            </Text>
          </View>
          <View
            style={[
              s.topSummaryCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <View
              style={[
                s.topSummaryIconBox,
                { backgroundColor: "rgba(239, 68, 68, 0.15)" },
              ]}
            >
              <Ionicons name="arrow-up" size={16} color="#ef4444" />
            </View>
            <Text style={[s.topSummaryLabel, { color: colors.subText }]}>
              Despesas
            </Text>
            <Text style={[s.topSummaryValue, { color: "#ef4444" }]}>
              {formatCurrency(pieTotal, currency, true)}
            </Text>
          </View>
          <View
            style={[
              s.topSummaryCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <View
              style={[
                s.topSummaryIconBox,
                { backgroundColor: colors.primary + "20" },
              ]}
            >
              <Ionicons name="wallet" size={16} color={colors.primary} />
            </View>
            <Text style={[s.topSummaryLabel, { color: colors.subText }]}>
              Poupança
            </Text>
            <Text style={[s.topSummaryValue, { color: colors.primary }]}>
              {poupancaPct > 0 ? `${Math.round(poupancaPct)}%` : "0%"}
            </Text>
          </View>
        </View>

        {isLoadingMore && (
          <ActivityIndicator
            color={colors.primary}
            style={{ marginBottom: 16 }}
          />
        )}

        {/* 👇 RENDERIZAÇÃO CONDICIONAL DOS GRÁFICOS */}
        {chartType === "pie"
          ? renderPie()
          : chartType === "bar"
            ? renderBar()
            : renderAnnual()}

        {pieData.length === 0 && chartType === "pie" && (
          <View style={s.empty}>
            <Ionicons
              name="pie-chart-outline"
              size={48}
              color={colors.border}
            />
            <Text style={[s.emptyText, { color: colors.text }]}>
              Nenhum dado neste mês
            </Text>
            <Text style={[s.emptySubtext, { color: colors.subText }]}>
              As suas transações aparecerão aqui.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: {
    flex: 1,
    ...(Platform.OS === "web" ? { overflow: "hidden", maxWidth: "100%" } : {}),
  },

  headerContainer: { paddingHorizontal: 24, paddingBottom: 16 },
  headerTitle: { fontSize: 26, fontWeight: "bold" },
  headerSubtitle: { fontSize: 14, marginTop: 4 },

  toggleWrapper: { paddingHorizontal: 24, marginBottom: 20 },
  toggleContainer: { flexDirection: "row", borderRadius: 100, padding: 4 },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 100,
  },
  toggleText: { fontSize: 13, fontWeight: "bold" },

  scroll: { paddingBottom: 40, paddingHorizontal: 24 },

  topSummaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 24,
  },
  topSummaryCard: {
    flex: 1,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
  },
  topSummaryIconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  topSummaryLabel: { fontSize: 11, fontWeight: "600", marginBottom: 6 },
  topSummaryValue: { fontSize: 13, fontWeight: "bold" },

  modernChartCard: {
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
    marginBottom: 20,
  },
  chartCardTitle: { fontSize: 18, fontWeight: "bold", marginBottom: 20 },

  // Lista Top Despesas
  topDespesasWrapper: { marginTop: 16 },
  topDespesaItem: { marginBottom: 16 },
  topDespesaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  topDespesaLeft: { flexDirection: "row", alignItems: "center", flex: 1 },
  topDespesaLabel: { fontSize: 14, fontWeight: "600", flex: 1 },
  topDespesaValue: { fontSize: 14, fontWeight: "bold", marginLeft: 10 },
  topDespesaBarBg: {
    height: 6,
    borderRadius: 3,
    width: "100%",
    overflow: "hidden",
  },
  topDespesaBarFill: { height: "100%", borderRadius: 3 },

  barLegendContainer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 24,
    marginTop: 24,
  },
  barLegendItem: { flexDirection: "row", alignItems: "center", gap: 8 },
  barLegendDot: { width: 12, height: 12, borderRadius: 6 },
  barLegendText: { fontSize: 13, fontWeight: "600" },

  empty: { alignItems: "center", paddingVertical: 60, gap: 12 },
  emptyText: { fontSize: 16, fontWeight: "bold" },
  emptySubtext: { fontSize: 14 },
});
