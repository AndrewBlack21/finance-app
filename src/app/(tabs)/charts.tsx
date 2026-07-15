/**
 * charts.tsx — Tela de Gráficos
 * Acessível pelo menu hambúrguer do Dashboard
 * Gráfico Pizza: gastos por categoria
 * Gráfico Barras: receitas vs despesas por mês
 */
import { useState, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Dimensions,
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
import { formatCurrency } from "@/utils";
import { useAuth } from "@/hooks/useAuth";

const { width: SW } = Dimensions.get("window");
const CHART_W = SW - 48;

// Paleta de cores para categorias
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

// ── Últimos 6 meses para o gráfico de barras ────────────────
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

// ── Cálculo de arco SVG para pizza ──────────────────────────
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

// ── Tela principal ───────────────────────────────────────────
export default function ChartsScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const { transactions } = useTransactions();
  const { expenses: fixedList, totalPaid: fixedPaid } = useFixedExpenses();

  const [chartType, setChartType] = useState<"pie" | "bar">("pie");
  const [selected, setSelected] = useState<number | null>(null);

  const currency = profile?.currency ?? "BRL";

  // ── Dados: pizza de categorias ───────────────────────────
  const pieData = useMemo(() => {
    const expenses = transactions.filter((t) => t.type === "expense");
    const map: Record<string, { label: string; value: number; color: string }> =
      {};

    expenses.forEach((t) => {
      const key = t.category?.name ?? "Sem categoria";
      const color = t.category?.color ?? "#9ca3af";
      if (!map[key]) map[key] = { label: key, value: 0, color };
      map[key].value += t.amount;
    });

    // Adiciona fixas como categoria separada
    if (fixedPaid > 0) {
      map["Contas Fixas"] = {
        label: "Contas Fixas",
        value: fixedPaid,
        color: "#f97316",
      };
    }

    const arr = Object.values(map).sort((a, b) => b.value - a.value);
    const total = arr.reduce((s, d) => s + d.value, 0);

    // Aplica paleta se não tiver cor
    return arr.map((d, i) => ({
      ...d,
      color: d.color ?? PALETTE[i % PALETTE.length],
      pct: total > 0 ? (d.value / total) * 100 : 0,
      deg: total > 0 ? (d.value / total) * 360 : 0,
    }));
  }, [transactions, fixedPaid]);

  const pieTotal = pieData.reduce((s, d) => s + d.value, 0);

  // ── Dados: barras por mês ────────────────────────────────
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
          .reduce((s, t) => s + t.amount, 0),
        expense: inMonth
          .filter((t) => t.type === "expense")
          .reduce((s, t) => s + t.amount, 0),
      };
    });
  }, [transactions, months]);

  const barMax = Math.max(...barData.flatMap((d) => [d.income, d.expense]), 1);

  // ── Pizza SVG ───────────────────────────────────────────
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
            {/* Buraco do meio */}
            <Circle cx={CX} cy={CY} r={HOLE_R} fill="#f8fafc" />
            {/* Texto central */}
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

        {/* Legenda */}
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

  // ── Barras SVG ───────────────────────────────────────────
  function renderBar() {
    const BAR_H = 200;
    const BAR_W = 28;
    const GAP =
      (CHART_W - barData.length * BAR_W * 2 - 32) / (barData.length + 1);
    const PADDING = 16;

    return (
      <View>
        {/* Legenda das barras */}
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
          {/* Linhas de referência */}
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

          {/* Barras */}
          {barData.map((d, i) => {
            const x = PADDING + i * (BAR_W * 2 + GAP) + GAP;
            const availH = BAR_H - PADDING * 2;
            const incH =
              d.income > 0 ? Math.max((d.income / barMax) * availH, 4) : 0;
            const expH =
              d.expense > 0 ? Math.max((d.expense / barMax) * availH, 4) : 0;

            return (
              <G key={i}>
                {/* Barra de receita */}
                <Rect
                  x={x}
                  y={PADDING + availH - incH}
                  width={BAR_W}
                  height={incH}
                  fill="#22c55e"
                  rx={4}
                />
                {/* Barra de despesa */}
                <Rect
                  x={x + BAR_W + 2}
                  y={PADDING + availH - expH}
                  width={BAR_W}
                  height={expH}
                  fill="#ef4444"
                  rx={4}
                />
                {/* Label do mês */}
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

        {/* Resumo dos meses */}
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
                  {
                    color: d.income - d.expense >= 0 ? "#22c55e" : "#ef4444",
                  },
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

  return (
    <SafeAreaView style={s.safe}>
      {/* HEADER */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={s.title}>Análise Financeira</Text>
        <View style={{ width: 38 }} />
      </View>

      {/* TOGGLE PIZZA / BARRAS */}
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
      </View>

      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* SUBTÍTULO */}
        <Text style={s.subtitle}>
          {chartType === "pie"
            ? "Toque em uma fatia para ver detalhes"
            : "Receitas vs Despesas — últimos 6 meses"}
        </Text>

        {/* GRÁFICO */}
        <View style={s.chartBox}>
          {chartType === "pie" ? renderPie() : renderBar()}
        </View>

        {/* ESTADO VAZIO */}
        {pieData.length === 0 && (
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

// ── Helper: formata valor abreviado para eixos (diferente do utils) ──
function fmtShort(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return value.toFixed(0);
}

// ── Estilos ──────────────────────────────────────────────────
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
  toggleText: { fontSize: 14, fontWeight: "600", color: "#6b7280" },
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

  // Legenda pizza
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

  // Barras
  barLegend: {
    flexDirection: "row",
    gap: 20,
    justifyContent: "center",
    marginBottom: 12,
  },
  barLegendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  barLegendDot: { width: 10, height: 10, borderRadius: 5 },
  barLegendText: { fontSize: 12, color: "#6b7280" },

  // Resumo meses
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

  // Vazio
  empty: { alignItems: "center", paddingVertical: 40, gap: 8 },
  emptyText: { fontSize: 16, fontWeight: "600", color: "#374151" },
  emptySubtext: { fontSize: 13, color: "#9ca3af" },
});
