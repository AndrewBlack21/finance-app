import { useState, useMemo, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
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

const { width: SW } = Dimensions.get("window");
const CHART_W = SW - 48;

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

export default function ChartsScreen() {
  const router = useRouter();
  const { profile } = useAuth();

  const { expenses: fixedList } = useFixedExpenses();
  const { installments } = useInstallments();

  // Adicionada a nova aba 'annual'
  const [chartType, setChartType] = useState<"pie" | "bar" | "annual">("pie");
  const [selected, setSelected] = useState<number | null>(null);

  const currency = profile?.currency ?? "BRL";

  // 1. LÓGICA DE DATAS INTELIGENTE
  // Precisamos de dados desde Jan 1 (para o panorama anual)
  // OU desde há 6 meses atrás (se estivermos no início do ano), até Dez 31.
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

  // 👇 Loop Silencioso de Paginação: Descarrega o histórico completo necessário
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

  // ── DADOS 1: Pizza de categorias (Mês atual com Contas e Cartões) ──
  const pieData = useMemo(() => {
    const today = new Date();
    const currentMonthFrom = new Date(today.getFullYear(), today.getMonth(), 1)
      .toISOString()
      .split("T")[0];
    const currentMonthTo = new Date(
      today.getFullYear(),
      today.getMonth() + 1,
      0,
    )
      .toISOString()
      .split("T")[0];

    const map: Record<string, { label: string; value: number; color: string }> =
      {};

    transactions
      .filter(
        (t) =>
          t.type === "expense" &&
          t.date >= currentMonthFrom &&
          t.date <= currentMonthTo,
      )
      .forEach((t) => {
        const amt = Number(t.amount) || 0;
        const key = t.category?.name ?? "Sem categoria";
        const color = t.category?.color ?? "#9ca3af";
        if (!map[key]) map[key] = { label: key, value: 0, color };
        map[key].value += amt;
      });

    installments.forEach((i) => {
      if (
        i.paid_installments < i.total_installments &&
        (!i.start_date || i.start_date <= currentMonthTo)
      ) {
        const amt = Number(i.installment_amount) || 0;
        const key = (i as any).category?.name ?? "Cartão de Crédito";
        const color = (i as any).category?.color ?? "#f97316";
        if (!map[key]) map[key] = { label: key, value: 0, color };
        map[key].value += amt;
      }
    });

    fixedList.forEach((f) => {
      if (!f.is_paid) {
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

  // ── DADOS 2: Gráfico de Barras (Últimos 6 meses) ──
  const months = useMemo(() => getLast6Months(), []);
  const barData = useMemo(() => {
    return months.map((m) => {
      const inMonth = transactions.filter(
        (t) => t.date >= m.from && t.date <= m.to,
      );
      return {
        label: m.label,
        income: inMonth
          .filter((t) => t.type === "income")
          .reduce((s, t) => s + (Number(t.amount) || 0), 0),
        expense: inMonth
          .filter((t) => t.type === "expense")
          .reduce((s, t) => s + (Number(t.amount) || 0), 0),
      };
    });
  }, [transactions, months]);

  const barMax = Math.max(...barData.flatMap((d) => [d.income, d.expense]), 1);

  // ── DADOS 3: Panorama Anual (Janeiro a Dezembro) ──
  const annualData = useMemo(() => {
    const year = new Date().getFullYear();
    return Array.from({ length: 12 }).map((_, m) => {
      const mFrom = new Date(year, m, 1).toISOString().split("T")[0];
      const mTo = new Date(year, m + 1, 0).toISOString().split("T")[0];
      const label = new Date(year, m, 1).toLocaleString("pt-BR", {
        month: "long",
      });
      const shortLabel = new Date(year, m, 1)
        .toLocaleString("pt-BR", { month: "short" })
        .replace(".", "");

      let income = 0;
      let expense = 0;

      // Baseado puramente no histórico de transações,
      // tal como as barras, para manter os gráficos fidedignos à realidade.
      transactions.forEach((t) => {
        if (t.date >= mFrom && t.date <= mTo) {
          const amt = Number(t.amount) || 0;
          if (t.type === "income") income += amt;
          else expense += amt;
        }
      });

      return {
        monthIndex: m,
        label: label.charAt(0).toUpperCase() + label.slice(1),
        shortLabel: shortLabel.charAt(0).toUpperCase() + shortLabel.slice(1),
        income,
        expense,
        diff: income - expense,
      };
    });
  }, [transactions]);

  const annualMax = Math.max(
    ...annualData.flatMap((d) => [d.income, d.expense]),
    1,
  );

  // ==========================================
  // RENDERIZADORES DOS GRÁFICOS
  // ==========================================

  const PIE_R = 110;
  const HOLE_R = 65;
  const CX = CHART_W / 2;
  const CY = 135;

  function renderPie() {
    let startAngle = 0;
    return (
      <View>
        <Svg width={CHART_W} height={280}>
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
                  stroke="#fff"
                />
              );
            })}
            <Circle cx={CX} cy={CY} r={HOLE_R} fill="#f8fafc" />
            <SvgText
              x={CX}
              y={CY - 12}
              textAnchor="middle"
              fontSize="11"
              fill="#9ca3af"
            >
              {selected !== null ? pieData[selected].label : "Total"}
            </SvgText>
            <SvgText
              x={CX}
              y={CY + 10}
              textAnchor="middle"
              fontSize="15"
              fontWeight="bold"
              fill="#111827"
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
                fill="#6b7280"
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
              style={[s.legendItem, selected === i && s.legendSelected]}
              onPress={() => setSelected(selected === i ? null : i)}
            >
              <View style={[s.legendDot, { backgroundColor: d.color }]} />
              <View style={{ flex: 1 }}>
                <Text style={s.legendLabel} numberOfLines={1}>
                  {d.label}
                </Text>
                <Text style={s.legendValue}>{d.pct.toFixed(1)}%</Text>
              </View>
              <Text style={s.legendAmount}>
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
    const BAR_W = 28;
    const GAP =
      (CHART_W - barData.length * BAR_W * 2 - 32) / (barData.length + 1);
    const PADDING = 16;

    return (
      <View>
        <View style={s.barLegend}>
          <View style={s.barLegendItem}>
            <View style={[s.barLegendDot, { backgroundColor: "#22c55e" }]} />
            <Text style={s.barLegendText}>Receitas</Text>
          </View>
          <View style={s.barLegendItem}>
            <View style={[s.barLegendDot, { backgroundColor: "#ef4444" }]} />
            <Text style={s.barLegendText}>Despesas</Text>
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
                  stroke="#e5e7eb"
                  strokeWidth={1}
                />
                <SvgText x={PADDING} y={y - 3} fontSize="9" fill="#9ca3af">
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
                  fontSize="11"
                  fill="#6b7280"
                >
                  {d.label}
                </SvgText>
              </G>
            );
          })}
        </Svg>

        <View style={s.monthSummary}>
          {barData.map((d, i) => (
            <View key={i} style={s.monthCard}>
              <Text style={s.monthCardLabel}>{d.label}</Text>
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

  // 👇 Novo Renderizador do Panorama Anual 👇
  function renderAnnual() {
    const PADDING = 20;
    const availW = CHART_W - PADDING * 2;
    const availH = 200 - PADDING * 2;

    // Calcula as posições X e Y do gráfico de linhas
    const getX = (index: number) => PADDING + index * (availW / 11);
    const getY = (val: number) => PADDING + availH - (val / annualMax) * availH;

    // Gera o "caminho" das linhas para ligar os pontos
    const incomePath = annualData
      .map((d, i) => `${i === 0 ? "M" : "L"}${getX(i)},${getY(d.income)}`)
      .join(" ");
    const expensePath = annualData
      .map((d, i) => `${i === 0 ? "M" : "L"}${getX(i)},${getY(d.expense)}`)
      .join(" ");

    return (
      <View>
        <Text style={s.annualChartTitle}>Panorama Anual</Text>

        {/* Gráfico de Linhas */}
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
                  stroke="#e5e7eb"
                  strokeWidth={1}
                />
                <SvgText x={PADDING} y={y - 5} fontSize="9" fill="#9ca3af">
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
              {/* Pontos de Receita */}
              <Circle cx={getX(i)} cy={getY(d.income)} r="4" fill="#22c55e" />
              {/* Pontos de Despesa */}
              <Circle cx={getX(i)} cy={getY(d.expense)} r="4" fill="#ef4444" />
              {/* Rótulo dos Meses */}
              <SvgText
                x={getX(i)}
                y={200 - 4}
                textAnchor="middle"
                fontSize="9"
                fill="#6b7280"
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
            <Text style={s.barLegendText}>Entradas</Text>
          </View>
          <View style={s.barLegendItem}>
            <View style={[s.barLegendDot, { backgroundColor: "#ef4444" }]} />
            <Text style={s.barLegendText}>Gastos</Text>
          </View>
        </View>

        {/* Tabela de Dados Anuais */}
        <View style={s.tableContainer}>
          <View style={s.tableHeaderRow}>
            <Text style={[s.th, { flex: 1.5 }]}>Mês</Text>
            <Text style={s.th}>Gastos</Text>
            <Text style={s.th}>Entradas</Text>
            <Text style={[s.th, { textAlign: "right" }]}>Diferença</Text>
          </View>
          {annualData.map((d, i) => (
            <View
              key={d.monthIndex}
              style={[s.tableRow, i % 2 !== 0 && s.tableRowAlt]}
            >
              <Text style={[s.td, { flex: 1.5, fontWeight: "600" }]}>
                {d.label}
              </Text>
              <Text style={s.td}>{formatCurrency(d.expense, currency)}</Text>
              <Text style={s.td}>{formatCurrency(d.income, currency)}</Text>
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
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={s.title}>Análise Financeira</Text>
        <View style={{ width: 38 }} />
      </View>

      {/* 3 Botões de Navegação */}
      <View style={s.toggle}>
        <TouchableOpacity
          style={[s.toggleBtn, chartType === "pie" && s.toggleActive]}
          onPress={() => {
            setChartType("pie");
            setSelected(null);
          }}
        >
          <Ionicons
            name="pie-chart"
            size={16}
            color={chartType === "pie" ? "#fff" : "#6b7280"}
          />
          <Text
            style={[s.toggleText, chartType === "pie" && s.toggleTextActive]}
          >
            Pizza
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[s.toggleBtn, chartType === "bar" && s.toggleActive]}
          onPress={() => {
            setChartType("bar");
            setSelected(null);
          }}
        >
          <Ionicons
            name="bar-chart"
            size={16}
            color={chartType === "bar" ? "#fff" : "#6b7280"}
          />
          <Text
            style={[s.toggleText, chartType === "bar" && s.toggleTextActive]}
          >
            Barras
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[s.toggleBtn, chartType === "annual" && s.toggleActive]}
          onPress={() => {
            setChartType("annual");
            setSelected(null);
          }}
        >
          <Ionicons
            name="calendar-outline"
            size={16}
            color={chartType === "annual" ? "#fff" : "#6b7280"}
          />
          <Text
            style={[s.toggleText, chartType === "annual" && s.toggleTextActive]}
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
          <ActivityIndicator color="#6366f1" style={{ marginBottom: 10 }} />
        )}

        <Text style={s.subtitle}>
          {chartType === "pie"
            ? "Toque em uma fatia para ver detalhes do mês"
            : chartType === "bar"
              ? "Receitas vs Despesas — últimos 6 meses"
              : "Panorama geral de Entradas e Saídas do ano"}
        </Text>

        <View style={s.chartBox}>
          {chartType === "pie"
            ? renderPie()
            : chartType === "bar"
              ? renderBar()
              : renderAnnual()}
        </View>

        {pieData.length === 0 && chartType === "pie" && (
          <View style={s.empty}>
            <Ionicons name="bar-chart-outline" size={48} color="#d1d5db" />
            <Text style={s.emptyText}>Nenhum dado disponível</Text>
            <Text style={s.emptySubtext}>
              Adicione transações para ver os gráficos
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f8fafc" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#f3f4f6",
    justifyContent: "center",
    alignItems: "center",
  },
  title: { fontSize: 17, fontWeight: "700", color: "#111827" },

  toggle: {
    flexDirection: "row",
    margin: 20,
    backgroundColor: "#e5e7eb",
    borderRadius: 12,
    padding: 4,
  },
  toggleBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  toggleActive: { backgroundColor: "#6366f1" },
  toggleText: { fontSize: 13, fontWeight: "600", color: "#6b7280" },
  toggleTextActive: { color: "#fff" },

  scroll: { paddingBottom: 40, paddingHorizontal: 24 },
  subtitle: {
    fontSize: 12,
    color: "#9ca3af",
    textAlign: "center",
    marginBottom: 16,
  },

  chartBox: {
    backgroundColor: "#fff",
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
  legendSelected: { backgroundColor: "#f5f3ff" },
  legendDot: { width: 12, height: 12, borderRadius: 6 },
  legendLabel: { fontSize: 13, fontWeight: "600", color: "#111827" },
  legendValue: { fontSize: 11, color: "#9ca3af" },
  legendAmount: { fontSize: 13, fontWeight: "700", color: "#374151" },

  barLegend: {
    flexDirection: "row",
    gap: 20,
    justifyContent: "center",
    marginBottom: 12,
    marginTop: 12,
  },
  barLegendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  barLegendDot: { width: 10, height: 10, borderRadius: 5 },
  barLegendText: { fontSize: 12, color: "#6b7280" },

  monthSummary: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 16,
  },
  monthCard: {
    flex: 1,
    minWidth: 80,
    backgroundColor: "#f8fafc",
    borderRadius: 10,
    padding: 10,
    alignItems: "center",
  },
  monthCardLabel: { fontSize: 11, color: "#9ca3af", marginBottom: 4 },
  monthCardValue: { fontSize: 10, fontWeight: "600" },
  monthCardBalance: { fontSize: 11, fontWeight: "800", marginTop: 4 },

  empty: { alignItems: "center", paddingVertical: 40, gap: 8 },
  emptyText: { fontSize: 16, fontWeight: "600", color: "#374151" },
  emptySubtext: { fontSize: 13, color: "#9ca3af" },

  // Estilos da Tabela Anual
  annualChartTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 16,
    textAlign: "center",
  },
  tableContainer: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    overflow: "hidden",
  },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: "#f3f4f6",
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  th: { flex: 1, fontSize: 11, fontWeight: "700", color: "#374151" },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  tableRowAlt: { backgroundColor: "#fafafa" },
  td: { flex: 1, fontSize: 11, color: "#4b5563" },
});
