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
import { SafeAreaView } from "react-native-safe-area-context";
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
  "#6366f1",
  "#ec4899",
  "#f97316",
  "#22c55e",
  "#3b82f6",
  "#eab308",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
  "#14b8a6",
  "#f43f5e",
  "#84cc16",
];

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

// 👇 1. MÁQUINA DO TEMPO: Descobre se uma compra a crédito estava ativa num mês específico do passado/futuro
function isInstallmentActiveInMonth(inst: any, year: number, month: number) {
  const dateStr = inst.start_date
    ? inst.start_date.split("T")[0]
    : inst.created_at.split("T")[0];
  const [sYear, sMonth] = dateStr.split("-").map(Number);
  const startM = sMonth - 1; // Ajuste porque em Javascript os meses vão de 0 a 11
  const monthsDiff = (year - sYear) * 12 + (month - startM);
  return monthsDiff >= 0 && monthsDiff < inst.total_installments;
}

// 👇 2. MÁQUINA DO TEMPO: Descobre se uma conta fixa já existia num mês específico do passado/futuro
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

  const { width: SW } = useWindowDimensions();
  const CHART_W = SW - 80;

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

  // 👇 LÓGICA DO GRÁFICO DE PIZZA CORRIGIDA
  const pieData = useMemo(() => {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();
    const currentMonthFrom = new Date(currentYear, currentMonth, 1)
      .toISOString()
      .split("T")[0];
    const currentMonthTo = new Date(currentYear, currentMonth + 1, 0)
      .toISOString()
      .split("T")[0];

    const map: Record<string, { label: string; value: number; color: string }> =
      {};

    // 1. Transações Normais (Excluindo pagamentos de Fatura!)
    transactions
      .filter(
        (t) =>
          t.type === "expense" &&
          t.date >= currentMonthFrom &&
          t.date <= currentMonthTo &&
          !t.title?.includes("Fatura"), // 👈 O segredo para não contar 2x
      )
      .forEach((t) => {
        const amt = Number(t.amount) || 0;
        const key = t.category?.name ?? "Outros (Sem Categoria / Cartão)";
        const color = t.category?.color ?? "#9ca3af";
        if (!map[key]) map[key] = { label: key, value: 0, color };
        map[key].value += amt;
      });

    // 2. Compras no Cartão de Crédito
    installments.forEach((i) => {
      if (isInstallmentActiveInMonth(i, currentYear, currentMonth)) {
        const amt = Number(i.installment_amount) || 0;
        const key =
          (i as any).category?.name ?? "Outros (Sem Categoria / Cartão)";
        const color = (i as any).category?.color ?? "#9ca3af";
        if (!map[key]) map[key] = { label: key, value: 0, color };
        map[key].value += amt;
      }
    });

    // 3. Contas Fixas
    fixedList.forEach((f) => {
      if (isFixedActiveInMonth(f, currentYear, currentMonth)) {
        const amt = Number(f.amount) || 0;
        const key = f.category?.name ?? "Contas Fixas";
        const color = f.category?.color ?? "#f59e0b";
        if (!map[key]) map[key] = { label: key, value: 0, color };
        map[key].value += amt;
      }
    });

    const arr = Object.values(map).sort((a, b) => b.value - a.value);
    const total = arr.reduce((s, d) => s + d.value, 0);

    return arr.map((d, i) => ({
      ...d,
      color: d.color ?? PALETTE[i % PALETTE.length],
      pct: total > 0 ? (d.value / total) * 100 : 0,
      deg: total > 0 ? (d.value / total) * 360 : 0,
    }));
  }, [transactions, fixedList, installments]);

  const pieTotal = pieData.reduce((s, d) => s + d.value, 0);

  const months = useMemo(() => getLast6Months(), []);

  // 👇 LÓGICA DO GRÁFICO DE BARRAS CORRIGIDA
  const barData = useMemo(() => {
    return months.map((m) => {
      const mDate = new Date(m.from + "T00:00:00");
      const y = mDate.getFullYear();
      const mo = mDate.getMonth();

      let income = 0;
      let expense = 0;

      // 1. Transações (Excluindo as faturas para não baralhar as receitas e despesas)
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

      // 2. Adicionando o Cartão de Crédito ao histórico de Barras
      installments.forEach((inst) => {
        if (isInstallmentActiveInMonth(inst, y, mo)) {
          expense += Number(inst.installment_amount) || 0;
        }
      });

      // 3. Adicionando as Contas Fixas ao histórico de Barras
      fixedList.forEach((f) => {
        if (isFixedActiveInMonth(f, y, mo)) {
          expense += Number(f.amount) || 0;
        }
      });

      return {
        label: m.label,
        income,
        expense,
      };
    });
  }, [transactions, installments, fixedList, months]);

  const barMax = Math.max(...barData.flatMap((d) => [d.income, d.expense]), 1);

  // 👇 LÓGICA DO GRÁFICO ANUAL CORRIGIDA
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

      // 1. Transações sem faturas
      transactions.forEach((t) => {
        if (t.date >= mFrom && t.date <= mTo && !t.title?.includes("Fatura")) {
          const amt = Number(t.amount) || 0;
          if (t.type === "income") income += amt;
          else expense += amt;
        }
      });

      // 2. Cartões de Crédito Anual
      installments.forEach((inst) => {
        if (isInstallmentActiveInMonth(inst, year, mo)) {
          expense += Number(inst.installment_amount) || 0;
        }
      });

      // 3. Contas Fixas Anual
      fixedList.forEach((f) => {
        if (isFixedActiveInMonth(f, year, mo)) {
          expense += Number(f.amount) || 0;
        }
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

  function renderPie() {
    const PIE_R = Math.min(110, CHART_W / 2 - 10);
    const HOLE_R = PIE_R * 0.6;
    const CX = CHART_W / 2;
    const CY = PIE_R + 25;
    const SVG_H = PIE_R * 2 + 50;

    let startAngle = 0;

    return (
      <View>
        <Svg width={CHART_W} height={SVG_H}>
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
                  opacity={selected === null || isSelected ? 1 : 0.4}
                  onPress={() => setSelected(isSelected ? null : i)}
                  strokeWidth={isSelected ? 2 : 0}
                  stroke={colors.card}
                />
              );
            })}
            <Circle cx={CX} cy={CY} r={HOLE_R} fill={colors.card} />
            <SvgText
              x={CX}
              y={CY - 12}
              textAnchor="middle"
              fontSize="11"
              fill={colors.subText}
            >
              {selected !== null ? pieData[selected].label : "Total"}
            </SvgText>
            <SvgText
              x={CX}
              y={CY + 10}
              textAnchor="middle"
              fontSize="15"
              fontWeight="bold"
              fill={colors.text}
            >
              {selected !== null
                ? `${pieData[selected].pct.toFixed(1)}%`
                : formatCurrency(pieTotal, currency)}
            </SvgText>
            {selected !== null && (
              <SvgText
                x={CX}
                y={CY + 28}
                textAnchor="middle"
                fontSize="11"
                fill={colors.subText}
              >
                {formatCurrency(pieData[selected].value, currency)}
              </SvgText>
            )}
          </G>
        </Svg>

        <View style={s.legend}>
          {pieData.map((d, i) => (
            <TouchableOpacity
              key={i}
              style={[
                s.legendItem,
                selected === i && {
                  backgroundColor: isDark ? "#312e81" : "#f5f3ff",
                },
              ]}
              onPress={() => setSelected(selected === i ? null : i)}
            >
              <View style={[s.legendDot, { backgroundColor: d.color }]} />
              <View style={{ flex: 1 }}>
                <Text
                  style={[s.legendLabel, { color: colors.text }]}
                  numberOfLines={1}
                >
                  {d.label}
                </Text>
                <Text style={[s.legendValue, { color: colors.subText }]}>
                  {d.pct.toFixed(1)}%
                </Text>
              </View>
              <Text style={[s.legendAmount, { color: colors.text }]}>
                {formatCurrency(d.value, currency)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  }

  function renderBar() {
    const BAR_H = 200;
    const PADDING = 16;

    const availW = CHART_W - PADDING * 2;
    const BAR_W = Math.min(20, availW / (barData.length * 3));
    const GAP = (availW - barData.length * BAR_W * 2) / (barData.length + 1);

    return (
      <View>
        <View style={s.barLegend}>
          <View style={s.barLegendItem}>
            <View style={[s.barLegendDot, { backgroundColor: "#22c55e" }]} />
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

        <Svg width={CHART_W} height={BAR_H + 40}>
          {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
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
                />
                <SvgText
                  x={PADDING}
                  y={y - 3}
                  fontSize="9"
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
                  fill="#22c55e"
                  rx={4}
                />
                <Rect
                  x={x + BAR_W + 2}
                  y={PADDING + availH - expH}
                  width={BAR_W}
                  height={expH}
                  fill="#ef4444"
                  rx={4}
                />
                <SvgText
                  x={x + BAR_W}
                  y={BAR_H + 20}
                  textAnchor="middle"
                  fontSize="10"
                  fill={colors.subText}
                >
                  {d.label}
                </SvgText>
              </G>
            );
          })}
        </Svg>

        <View style={s.monthSummary}>
          {barData.map((d, i) => (
            <View
              key={i}
              style={[s.monthCard, { backgroundColor: colors.inputBg }]}
            >
              <Text style={[s.monthCardLabel, { color: colors.subText }]}>
                {d.label}
              </Text>
              <Text style={[s.monthCardValue, { color: "#22c55e" }]}>
                +{formatCurrency(d.income, currency)}
              </Text>
              <Text style={[s.monthCardValue, { color: "#ef4444" }]}>
                -{formatCurrency(d.expense, currency)}
              </Text>
              <Text
                style={[
                  s.monthCardBalance,
                  { color: d.income - d.expense >= 0 ? "#22c55e" : "#ef4444" },
                ]}
              >
                {formatCurrency(d.income - d.expense, currency)}
              </Text>
            </View>
          ))}
        </View>
      </View>
    );
  }

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
      <View>
        <Text style={[s.annualChartTitle, { color: colors.text }]}>
          Panorama Anual
        </Text>

        <Svg width={CHART_W} height={200}>
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
                />
                <SvgText
                  x={PADDING}
                  y={y - 5}
                  fontSize="9"
                  fill={colors.subText}
                >
                  {formatCurrency(annualMax * pct, currency, true)}
                </SvgText>
              </G>
            );
          })}

          <Path
            d={incomePath}
            stroke="#22c55e"
            strokeWidth="2.5"
            fill="none"
            opacity={0.7}
          />
          <Path
            d={expensePath}
            stroke="#ef4444"
            strokeWidth="2.5"
            fill="none"
            opacity={0.7}
          />

          {annualData.map((d, i) => (
            <G key={`points-${i}`}>
              <Circle cx={getX(i)} cy={getY(d.income)} r="3" fill="#22c55e" />
              <Circle cx={getX(i)} cy={getY(d.expense)} r="3" fill="#ef4444" />
              <SvgText
                x={getX(i)}
                y={200 - 4}
                textAnchor="middle"
                fontSize="9"
                fill={colors.subText}
                rotation={-45}
                origin={`${getX(i)}, ${200 - 4}`}
              >
                {d.shortLabel}
              </SvgText>
            </G>
          ))}
        </Svg>

        <View style={s.barLegend}>
          <View style={s.barLegendItem}>
            <View style={[s.barLegendDot, { backgroundColor: "#22c55e" }]} />
            <Text style={[s.barLegendText, { color: colors.subText }]}>
              Entradas
            </Text>
          </View>
          <View style={s.barLegendItem}>
            <View style={[s.barLegendDot, { backgroundColor: "#ef4444" }]} />
            <Text style={[s.barLegendText, { color: colors.subText }]}>
              Gastos
            </Text>
          </View>
        </View>

        <View style={[s.tableContainer, { borderColor: colors.border }]}>
          <View
            style={[
              s.tableHeaderRow,
              {
                backgroundColor: colors.inputBg,
                borderBottomColor: colors.border,
              },
            ]}
          >
            <Text style={[s.th, { flex: 1.5, color: colors.text }]}>Mês</Text>
            <Text style={[s.th, { color: colors.text }]}>Gastos</Text>
            <Text style={[s.th, { color: colors.text }]}>Entradas</Text>
            <Text style={[s.th, { textAlign: "right", color: colors.text }]}>
              Diferença
            </Text>
          </View>
          {annualData.map((d, i) => (
            <View
              key={d.monthIndex}
              style={[
                s.tableRow,
                { borderBottomColor: colors.border },
                i % 2 !== 0 && { backgroundColor: colors.inputBg },
              ]}
            >
              <Text
                style={[
                  s.td,
                  { flex: 1.5, fontWeight: "600", color: colors.text },
                ]}
              >
                {d.label}
              </Text>
              <Text style={[s.td, { color: colors.subText }]}>
                {formatCurrency(d.expense, currency)}
              </Text>
              <Text style={[s.td, { color: colors.subText }]}>
                {formatCurrency(d.income, currency)}
              </Text>
              <Text
                style={[
                  s.td,
                  {
                    textAlign: "right",
                    fontWeight: "bold",
                    color: d.diff >= 0 ? "#22c55e" : "#ef4444",
                  },
                ]}
              >
                {formatCurrency(d.diff, currency)}
              </Text>
            </View>
          ))}
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: colors.bg }]}>
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
        <Text style={[s.title, { color: colors.text }]}>
          Análise Financeira
        </Text>
        <View style={{ width: 38 }} />
      </View>

      <View style={[s.toggle, { backgroundColor: colors.inputBg }]}>
        <TouchableOpacity
          style={[
            s.toggleBtn,
            chartType === "pie" && [
              s.toggleActive,
              { backgroundColor: colors.primary },
            ],
          ]}
          onPress={() => {
            setChartType("pie");
            setSelected(null);
          }}
        >
          <Ionicons
            name="pie-chart"
            size={16}
            color={chartType === "pie" ? "#fff" : colors.subText}
          />
          <Text
            style={[
              s.toggleText,
              { color: colors.subText },
              chartType === "pie" && s.toggleTextActive,
            ]}
          >
            Pizza
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            s.toggleBtn,
            chartType === "bar" && [
              s.toggleActive,
              { backgroundColor: colors.primary },
            ],
          ]}
          onPress={() => {
            setChartType("bar");
            setSelected(null);
          }}
        >
          <Ionicons
            name="bar-chart"
            size={16}
            color={chartType === "bar" ? "#fff" : colors.subText}
          />
          <Text
            style={[
              s.toggleText,
              { color: colors.subText },
              chartType === "bar" && s.toggleTextActive,
            ]}
          >
            Barras
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            s.toggleBtn,
            chartType === "annual" && [
              s.toggleActive,
              { backgroundColor: colors.primary },
            ],
          ]}
          onPress={() => {
            setChartType("annual");
            setSelected(null);
          }}
        >
          <Ionicons
            name="calendar-outline"
            size={16}
            color={chartType === "annual" ? "#fff" : colors.subText}
          />
          <Text
            style={[
              s.toggleText,
              { color: colors.subText },
              chartType === "annual" && s.toggleTextActive,
            ]}
          >
            Anual
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
      >
        {isLoadingMore && (
          <ActivityIndicator
            color={colors.primary}
            style={{ marginBottom: 10 }}
          />
        )}

        <Text style={[s.subtitle, { color: colors.subText }]}>
          {chartType === "pie"
            ? "Toque em uma fatia para ver detalhes do mês"
            : chartType === "bar"
              ? "Receitas vs Despesas — últimos 6 meses"
              : "Panorama geral de Entradas e Saídas do ano"}
        </Text>

        <View
          style={[
            s.chartBox,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          {chartType === "pie"
            ? renderPie()
            : chartType === "bar"
              ? renderBar()
              : renderAnnual()}
        </View>

        {pieData.length === 0 && chartType === "pie" && (
          <View style={s.empty}>
            <Ionicons
              name="bar-chart-outline"
              size={48}
              color={colors.subText}
            />
            <Text style={[s.emptyText, { color: colors.text }]}>
              Nenhum dado disponível
            </Text>
            <Text style={[s.emptySubtext, { color: colors.subText }]}>
              Adicione transações para ver os gráficos
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
  title: { fontSize: 17, fontWeight: "700" },

  toggle: { flexDirection: "row", margin: 20, borderRadius: 12, padding: 4 },
  toggleBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  toggleActive: {},
  toggleText: { fontSize: 13, fontWeight: "600" },
  toggleTextActive: { color: "#fff" },

  scroll: { paddingBottom: 40, paddingHorizontal: 24 },
  subtitle: { fontSize: 12, textAlign: "center", marginBottom: 16 },

  chartBox: {
    borderRadius: 20,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },

  legend: { marginTop: 8, gap: 6 },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 10,
    borderRadius: 10,
  },
  legendDot: { width: 12, height: 12, borderRadius: 6 },
  legendLabel: { fontSize: 13, fontWeight: "600" },
  legendValue: { fontSize: 11 },
  legendAmount: { fontSize: 13, fontWeight: "700" },

  barLegend: {
    flexDirection: "row",
    gap: 20,
    justifyContent: "center",
    marginBottom: 12,
    marginTop: 12,
  },
  barLegendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  barLegendDot: { width: 10, height: 10, borderRadius: 5 },
  barLegendText: { fontSize: 12 },

  monthSummary: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 16,
  },
  monthCard: {
    flex: 1,
    minWidth: 80,
    borderRadius: 10,
    padding: 10,
    alignItems: "center",
  },
  monthCardLabel: { fontSize: 11, marginBottom: 4 },
  monthCardValue: { fontSize: 10, fontWeight: "600" },
  monthCardBalance: { fontSize: 11, fontWeight: "800", marginTop: 4 },

  empty: { alignItems: "center", paddingVertical: 40, gap: 8 },
  emptyText: { fontSize: 16, fontWeight: "600" },
  emptySubtext: { fontSize: 13 },

  annualChartTitle: {
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 16,
    textAlign: "center",
  },
  tableContainer: {
    marginTop: 16,
    borderWidth: 1,
    borderRadius: 8,
    overflow: "hidden",
  },
  tableHeaderRow: {
    flexDirection: "row",
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
  },
  th: { flex: 1, fontSize: 11, fontWeight: "700" },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
  },
  td: { flex: 1, fontSize: 11 },
});
