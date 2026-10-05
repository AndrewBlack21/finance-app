import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "@/hooks/useTheme";

type Step = {
  icon: keyof typeof Ionicons.glyphMap;
  accent: string;
  title: string;
  description: string;
  bullets?: string[];
  preview?: "home" | "account" | "transaction" | "credit" | "invoice" | "shopping" | "fixed" | "report" | "menu" | "finish";
};

const STEPS: Step[] = [
  { icon: "hand-left-outline", accent: "#6366F1", title: "Bem-vindo ao Se Controla Ai", description: "Seu dinheiro organizado de um jeito simples.", bullets: ["Contas, receitas e despesas", "Cartões, faturas e parcelas", "Contas fixas, compras e relatórios"], preview: "finish" },
  { icon: "home-outline", accent: "#6366F1", title: "Seu painel financeiro", description: "Na Home você acompanha seu saldo disponível, receitas, despesas e acessa rapidamente as principais funções.", bullets: ["Saldo disponível", "Receitas e despesas", "Contas, cartões, relatórios e lançamentos recentes"], preview: "home" },
  { icon: "wallet-outline", accent: "#3B82F6", title: "Cadastre suas contas", description: "Adicione contas bancárias, carteira ou outras fontes de dinheiro para acompanhar seus saldos.", bullets: ["Nubank", "Santander", "Conta salário", "Dinheiro"], preview: "account" },
  { icon: "swap-horizontal-outline", accent: "#10B981", title: "Registre suas transações", description: "Use Transações para registrar o dinheiro que entra e sai das suas contas.", bullets: ["Receita: dinheiro entrando", "Despesa: dinheiro saindo", "Adicione o lançamento pela área de Transações"], preview: "transaction" },
  { icon: "card-outline", accent: "#8B5CF6", title: "Controle seus cartões", description: "Cadastre seus cartões e acompanhe faturas, compras parceladas e pagamentos.", bullets: ["Compras parceladas", "Próximas faturas", "Pagar fatura, histórico e balanço mensal"], preview: "credit" },
  { icon: "receipt-outline", accent: "#8B5CF6", title: "Acompanhe suas faturas", description: "Na área de cartões você visualiza o valor da fatura, seus itens, parcelas e pagamentos.", bullets: ["Fatura atual e próximo mês", "Parcelas pendentes e finalizadas", "Histórico de pagamentos"], preview: "invoice" },
  { icon: "cart-outline", accent: "#10B981", title: "Organize suas compras", description: "Crie uma lista com o que está faltando e marque os itens conforme forem comprados.", bullets: ["Controle separado do saldo financeiro", "Informe o valor quando comprar", "Compartilhe a lista pelo WhatsApp"], preview: "shopping" },
  { icon: "calendar-outline", accent: "#F59E0B", title: "Organize suas contas fixas", description: "Cadastre despesas recorrentes para acompanhar compromissos que acontecem regularmente.", bullets: ["Aluguel", "Internet", "Netflix", "Condomínio e outros"], preview: "fixed" },
  { icon: "bar-chart-outline", accent: "#38BDF8", title: "Entenda seus gastos", description: "Use os relatórios para visualizar gastos, receitas, categorias e evolução ao longo do tempo.", bullets: ["Visão mensal", "Comparação de períodos", "Categorias e principais despesas"], preview: "report" },
  { icon: "menu-outline", accent: "#6366F1", title: "Mais opções", description: "O menu hambúrguer reúne funcionalidades e configurações adicionais do aplicativo.", bullets: ["Configurações", "Lista de Compras", "Como usar o Se Controla Ai"], preview: "menu" },
  { icon: "sparkles-outline", accent: "#6366F1", title: "Tudo pronto!", description: "Agora você já conhece as principais funções do Se Controla Ai.", bullets: ["Cadastre sua primeira conta", "Registre sua primeira transação", "Volte ao tutorial pelo menu quando precisar"], preview: "finish" },
];

function PreviewCard({ type, colors }: { type?: Step["preview"]; colors: ReturnType<typeof useAppTheme>["colors"] }) {
  const content = useMemo(() => {
    switch (type) {
      case "home": return { icon: "wallet-outline" as const, title: "Saldo disponível", value: "R$ 4.850,00", secondary: "Receitas   R$ 6.300,00   •   Despesas   R$ 1.450,00" };
      case "account": return { icon: "wallet-outline" as const, title: "Minhas Contas", value: "Nubank   R$ 2.850,00", secondary: "Santander   R$ 2.000,00" };
      case "transaction": return { icon: "swap-horizontal-outline" as const, title: "Transações", value: "Salário   + R$ 3.500,00", secondary: "Mercado   - R$ 320,00" };
      case "credit": return { icon: "card-outline" as const, title: "NUBANK", value: "Fatura   R$ 850,00", secondary: "Pendente   •   Próxima fatura disponível" };
      case "invoice": return { icon: "receipt-outline" as const, title: "Notebook", value: "Parcela 3 de 10", secondary: "R$ 350,00   •   Pendente" };
      case "shopping": return { icon: "cart-outline" as const, title: "Lista de Compras", value: "☐ Arroz   •   ☐ Feijão", secondary: "☑ Leite — R$ 5,90   •   ☑ Café — R$ 18,90" };
      case "fixed": return { icon: "calendar-outline" as const, title: "Contas Fixas", value: "Internet   R$ 100,00", secondary: "Netflix   R$ 39,90   •   Aluguel   R$ 1.200,00" };
      case "report": return { icon: "bar-chart-outline" as const, title: "Relatórios", value: "Despesas   R$ 1.450,00", secondary: "Alimentação  •  Moradia  •  Transporte" };
      case "menu": return { icon: "menu-outline" as const, title: "Menu", value: "Como usar o Se Controla Ai", secondary: "Configurações   •   Lista de Compras   •   Relatórios" };
      default: return { icon: "sparkles-outline" as const, title: "Se Controla Ai", value: "Mais clareza para suas finanças", secondary: "Simples • intuitivo • organizado" };
    }
  }, [type]);
  return (
    <View style={[styles.preview, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
      <View style={[styles.previewIcon, { backgroundColor: colors.primary + "18" }]}><Ionicons name={content.icon} size={22} color={colors.primary} /></View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[styles.previewTitle, { color: colors.subText }]} numberOfLines={1}>{content.title}</Text>
        <Text style={[styles.previewValue, { color: colors.text }]} numberOfLines={1}>{content.value}</Text>
        <Text style={[styles.previewSecondary, { color: colors.subText }]} numberOfLines={2}>{content.secondary}</Text>
      </View>
    </View>
  );
}

export function OnboardingModal({ visible, onComplete, onSkip }: { visible: boolean; onComplete: () => void | Promise<void>; onSkip: () => void | Promise<void>; }) {
  const { colors } = useAppTheme();
  const { width, height } = useWindowDimensions();
  const [stepIndex, setStepIndex] = useState(0);
  const opacity = useRef(new Animated.Value(1)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const step = STEPS[stepIndex];
  const isLast = stepIndex === STEPS.length - 1;

  useEffect(() => {
    if (!visible) { setStepIndex(0); return; }
    opacity.setValue(0); translateX.setValue(24);
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.timing(translateX, { toValue: 0, duration: 260, useNativeDriver: true }),
    ]).start();
  }, [stepIndex, visible, opacity, translateX]);

  const requestSkip = () => {
    const message = "Pular o tutorial? Você poderá acessá-lo novamente pelo menu.";
    if (Platform.OS === "web") { if (window.confirm(message)) void onSkip(); return; }
    Alert.alert("Pular tutorial?", message, [{ text: "Continuar tutorial", style: "cancel" }, { text: "Pular", style: "destructive", onPress: () => void onSkip() }]);
  };

  const goNext = async () => { if (isLast) { await onComplete(); return; } setStepIndex((current) => current + 1); };
  const goBack = () => { if (stepIndex > 0) setStepIndex((current) => current - 1); };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={requestSkip}>
      <SafeAreaView style={styles.overlay}>
        <View style={[styles.modal, { backgroundColor: colors.card, borderColor: colors.border, width: Math.min(width - 28, 520), maxHeight: Math.min(height - 28, 760) }]}
        >
          <View style={styles.header}>
            <View style={[styles.stepBadge, { backgroundColor: step.accent + "18" }]}><Text style={[styles.stepBadgeText, { color: step.accent }]}>{stepIndex + 1}/{STEPS.length}</Text></View>
            <TouchableOpacity onPress={requestSkip} style={styles.skipTop} accessibilityRole="button" accessibilityLabel="Pular tutorial"><Text style={[styles.skipText, { color: colors.subText }]}>Pular</Text><Ionicons name="close" size={20} color={colors.subText} /></TouchableOpacity>
          </View>

          <Animated.View style={[styles.animatedContent, { opacity, transform: [{ translateX }] }]}
          >
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scrollContent, height < 700 && { paddingVertical: 8 }]}
            >
              <View style={[styles.heroIcon, { backgroundColor: step.accent + "16" }]}><Ionicons name={step.icon} size={34} color={step.accent} /></View>
              <Text style={[styles.title, { color: colors.text }]}>{step.title}</Text>
              <Text style={[styles.description, { color: colors.subText }]}>{step.description}</Text>
              {step.bullets?.map((bullet) => (<View key={bullet} style={styles.bulletRow}><View style={[styles.bulletDot, { backgroundColor: step.accent }]} /><Text style={[styles.bulletText, { color: colors.text }]}>{bullet}</Text></View>))}
              <PreviewCard type={step.preview} colors={colors} />
              {stepIndex === 6 && <View style={[styles.infoCallout, { backgroundColor: colors.success + "14", borderColor: colors.success + "35" }]}><Ionicons name="shield-checkmark-outline" size={19} color={colors.success} /><Text style={[styles.infoCalloutText, { color: colors.text }]}>Os valores da Lista de Compras são apenas para controle da lista e não alteram o saldo financeiro principal.</Text></View>}
            </ScrollView>
          </Animated.View>

          <View style={styles.footer}>
            <View style={styles.progressRow}>{STEPS.map((item, index) => (<View key={item.title} style={[styles.progressDot, { backgroundColor: index <= stepIndex ? item.accent : colors.border, width: index === stepIndex ? 22 : 7 }]} />))}</View>
            <View style={styles.navigationRow}>
              <TouchableOpacity onPress={goBack} disabled={stepIndex === 0} style={[styles.backButton, { borderColor: colors.border, opacity: stepIndex === 0 ? 0.35 : 1 }]}><Ionicons name="arrow-back" size={18} color={colors.text} /><Text style={[styles.backButtonText, { color: colors.text }]}>Voltar</Text></TouchableOpacity>
              <TouchableOpacity onPress={goNext} style={[styles.nextButton, { backgroundColor: colors.primary }]}><Text style={styles.nextButtonText}>{stepIndex === 0 ? "Começar tutorial" : isLast ? "Começar a usar" : "Próximo"}</Text><Ionicons name={isLast ? "checkmark" : "arrow-forward"} size={18} color="#fff" /></TouchableOpacity>
            </View>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(2, 6, 23, 0.72)", alignItems: "center", justifyContent: "center", padding: 14 },
  modal: { borderRadius: 28, borderWidth: 1, overflow: "hidden", shadowColor: "#000", shadowOffset: { width: 0, height: 16 }, shadowOpacity: 0.26, shadowRadius: 26, elevation: 12 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 18, paddingTop: 16, paddingBottom: 6 },
  stepBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  stepBadgeText: { fontSize: 11, fontWeight: "800" },
  skipTop: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 6, paddingVertical: 6 },
  skipText: { fontSize: 12, fontWeight: "700" },
  animatedContent: { flex: 1, minHeight: 0 },
  scrollContent: { paddingHorizontal: 22, paddingTop: 10, paddingBottom: 16 },
  heroIcon: { width: 72, height: 72, borderRadius: 24, alignItems: "center", justifyContent: "center", marginBottom: 16 },
  title: { fontSize: 25, lineHeight: 30, fontWeight: "900", letterSpacing: -0.5, marginBottom: 8 },
  description: { fontSize: 14, lineHeight: 21, marginBottom: 14 },
  bulletRow: { flexDirection: "row", alignItems: "flex-start", gap: 9, marginBottom: 8 },
  bulletDot: { width: 7, height: 7, borderRadius: 4, marginTop: 6 },
  bulletText: { flex: 1, fontSize: 13, lineHeight: 19 },
  preview: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 18, borderWidth: 1, padding: 14, marginTop: 10 },
  previewIcon: { width: 46, height: 46, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  previewTitle: { fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.4 },
  previewValue: { fontSize: 15, fontWeight: "900", marginTop: 3 },
  previewSecondary: { fontSize: 11, marginTop: 4, lineHeight: 16 },
  infoCallout: { flexDirection: "row", alignItems: "flex-start", gap: 9, borderRadius: 14, borderWidth: 1, padding: 12, marginTop: 12 },
  infoCalloutText: { flex: 1, fontSize: 12, lineHeight: 18, fontWeight: "600" },
  footer: { borderTopWidth: 1, borderTopColor: "rgba(148,163,184,0.12)", paddingHorizontal: 18, paddingTop: 12, paddingBottom: 16 },
  progressRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, marginBottom: 13 },
  progressDot: { height: 7, borderRadius: 999 },
  navigationRow: { flexDirection: "row", gap: 10 },
  backButton: { flex: 0.35, minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderWidth: 1, borderRadius: 14 },
  backButtonText: { fontSize: 12, fontWeight: "800" },
  nextButton: { flex: 0.65, minHeight: 48, borderRadius: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingHorizontal: 14 },
  nextButtonText: { color: "#fff", fontSize: 13, fontWeight: "900" },
});