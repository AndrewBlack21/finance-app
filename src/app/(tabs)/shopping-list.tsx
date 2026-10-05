import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAppTheme } from "@/hooks/useTheme";
import { useShoppingList } from "@/hooks/useShoppingList";
import { formatCurrency } from "@/utils";
import { OnboardingHelp } from "@/components/onboarding/OnboardingHelp";

export default function ShoppingListScreen() {
  const router = useRouter();
  const { colors, isDark } = useAppTheme();
  const {
    pendingItems,
    purchasedItems,
    purchasedTotal,
    isLoading,
    error,
    addItem,
    markPurchased,
    markPending,
    removeItem,
    refetch,
  } = useShoppingList();

  const [productName, setProductName] = useState("");
  const [purchaseItem, setPurchaseItem] = useState<string | null>(null);
  const [purchaseValue, setPurchaseValue] = useState("");
  const [savingPurchase, setSavingPurchase] = useState(false);

  const purchaseTarget = useMemo(
    () =>
      [...pendingItems, ...purchasedItems].find(
        (item) => item.id === purchaseItem,
      ),
    [pendingItems, purchasedItems, purchaseItem],
  );

  const parseMoney = (value: string) => {
    const raw = value.replace(/[^\d,.-]/g, "");

    if (raw.includes(",") && raw.includes(".")) {
      return Number(raw.replace(/\./g, "").replace(",", "."));
    }

    if (raw.includes(",")) return Number(raw.replace(",", "."));

    return Number(raw);
  };

  const handleAdd = async () => {
    const result = await addItem(productName);

    if (result.error) {
      Alert.alert("Não foi possível adicionar", result.error);
      return;
    }

    setProductName("");
  };

  const openPurchaseModal = (id: string) => {
    setPurchaseItem(id);
    setPurchaseValue("");
  };

  const closePurchaseModal = () => {
    if (savingPurchase) return;
    setPurchaseItem(null);
    setPurchaseValue("");
  };

  const handleConfirmPurchase = async () => {
    if (!purchaseItem) return;

    const value = parseMoney(purchaseValue);

    if (!Number.isFinite(value) || value < 0) {
      Alert.alert("Valor inválido", "Informe o valor pago pelo produto.");
      return;
    }

    setSavingPurchase(true);
    const result = await markPurchased(purchaseItem, value);
    setSavingPurchase(false);

    if (result.error) {
      Alert.alert("Erro", result.error);
      return;
    }

    closePurchaseModal();
  };

  const handleDelete = (id: string) => {
    const remove = async () => {
      const result = await removeItem(id);
      if (result.error) Alert.alert("Erro", result.error);
    };

    if (Platform.OS === "web") {
      if (window.confirm("Remover este item da lista?")) remove();
      return;
    }

    Alert.alert("Remover item", "Deseja remover este produto da lista?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Remover", style: "destructive", onPress: remove },
    ]);
  };

  const buildWhatsAppMessage = () => {
    // Mantemos o texto simples para evitar caracteres quebrados ao abrir o WhatsApp.
    const pendingText =
      pendingItems.length > 0
        ? pendingItems.map((item) => `- ${item.product_name}`).join("\n")
        : "- Nenhum item pendente";

    const purchasedText =
      purchasedItems.length > 0
        ? purchasedItems
            .map(
              (item) =>
                `- ${item.product_name} - ${formatCurrency(
                  Number(item.purchased_value ?? 0),
                  "BRL",
                )}`,
            )
            .join("\n")
        : "- Nenhum item comprado";

    return [
      "LISTA DE COMPRAS",
      "",
      "FALTA COMPRAR",
      pendingText,
      "",
      "JA FOI COMPRADO",
      purchasedText,
      "",
      `TOTAL JA COMPRADO: ${formatCurrency(purchasedTotal, "BRL")}`,
      "",
      "Os valores desta lista sao apenas para controle de compras e nao alteram o saldo principal.",
    ].join("\n");
  };

  const handleShareWhatsApp = async () => {
    if (pendingItems.length === 0 && purchasedItems.length === 0) {
      Alert.alert(
        "Lista vazia",
        "Adicione pelo menos um item antes de compartilhar.",
      );
      return;
    }

    const text = encodeURIComponent(buildWhatsAppMessage());
    const url = `https://api.whatsapp.com/send?text=${text}`;

    try {
      if (Platform.OS === "web" && typeof window !== "undefined") {
        window.open(url, "_blank", "noopener,noreferrer");
      } else {
        await Linking.openURL(url);
      }
    } catch {
      Alert.alert(
        "WhatsApp",
        "Não foi possível abrir o compartilhamento do WhatsApp.",
      );
    }
  };

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: colors.bg }]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
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

          <View style={{ flex: 1, paddingHorizontal: 14 }}>
            <Text style={[s.headerTitle, { color: colors.text }]}>
              Lista de Compras
            </Text>
            <Text style={[s.headerSubtitle, { color: colors.subText }]}>
              Controle suas compras sem mexer no saldo
            </Text>
          </View>

          <View style={s.headerActions}>
            <OnboardingHelp
              title="Como funciona a Lista de Compras"
              description="Use esta área para controlar produtos que faltam em casa. Ela é independente do seu saldo financeiro."
              bullets={[
                "Adicione o produto que está faltando.",
                "Ao comprar, marque o item e informe o valor pago.",
                "O valor fica somente no controle da lista e não cria uma transação.",
                "Use o WhatsApp para compartilhar o que falta e o que já foi comprado.",
              ]}
            />
            <TouchableOpacity
              onPress={handleShareWhatsApp}
              style={s.whatsappBtn}
              accessibilityLabel="Compartilhar lista no WhatsApp"
            >
              <Ionicons name="logo-whatsapp" size={21} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={s.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={refetch}
              tintColor={colors.primary}
            />
          }
        >
          <View
            style={[
              s.infoCard,
              {
                backgroundColor: isDark
                  ? "rgba(99,102,241,0.14)"
                  : "#eef2ff",
                borderColor: isDark
                  ? "rgba(129,140,248,0.25)"
                  : "#c7d2fe",
              },
            ]}
          >
            <Ionicons
              name="shield-checkmark-outline"
              size={22}
              color={colors.primary}
            />
            <Text style={[s.infoText, { color: colors.text }]}>
              Esta lista é isolada do controle financeiro. Os valores
              registrados aqui não criam transações e não descontam do saldo
              de débito ou crédito.
            </Text>
          </View>

          <View style={s.addRow}>
            <TextInput
              style={[
                s.addInput,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  color: colors.text,
                },
              ]}
              value={productName}
              onChangeText={setProductName}
              placeholder="Ex.: arroz, leite, pão..."
              placeholderTextColor={colors.subText}
              onSubmitEditing={handleAdd}
              returnKeyType="done"
              editable={!isLoading}
            />

            <TouchableOpacity
              onPress={handleAdd}
              disabled={!productName.trim() || isLoading}
              style={[
                s.addButton,
                {
                  backgroundColor:
                    !productName.trim() || isLoading
                      ? colors.inputBg
                      : colors.primary,
                },
              ]}
            >
              <Ionicons
                name="add"
                size={24}
                color={
                  !productName.trim() || isLoading ? colors.subText : "#fff"
                }
              />
            </TouchableOpacity>
          </View>

          {error && (
            <View style={s.errorBox}>
              <Ionicons name="alert-circle-outline" size={18} color="#ef4444" />
              <Text style={s.errorText}>{error}</Text>
            </View>
          )}

          {isLoading && pendingItems.length === 0 && purchasedItems.length === 0 ? (
            <View style={s.loadingBox}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : (
            <>
              <SectionHeader
                title="Falta Comprar"
                count={pendingItems.length}
                color="#f59e0b"
              />

              <View
                style={[
                  s.listCard,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                {pendingItems.length === 0 ? (
                  <EmptyState
                    icon="checkmark-circle-outline"
                    text="Nenhum item pendente."
                    colors={colors}
                  />
                ) : (
                  pendingItems.map((item, index) => (
                    <ShoppingRow
                      key={item.id}
                      item={item}
                      colors={colors}
                      isLast={index === pendingItems.length - 1}
                      onBuy={() => openPurchaseModal(item.id)}
                      onDelete={() => handleDelete(item.id)}
                    />
                  ))
                )}
              </View>

              <SectionHeader
                title="Já Foi Comprado"
                count={purchasedItems.length}
                color="#10b981"
              />

              <View
                style={[
                  s.listCard,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                {purchasedItems.length === 0 ? (
                  <EmptyState
                    icon="cart-outline"
                    text="Nenhum produto comprado ainda."
                    colors={colors}
                  />
                ) : (
                  purchasedItems.map((item, index) => (
                    <PurchasedRow
                      key={item.id}
                      item={item}
                      colors={colors}
                      isLast={index === purchasedItems.length - 1}
                      onUndo={() => markPending(item.id)}
                      onDelete={() => handleDelete(item.id)}
                    />
                  ))
                )}
              </View>

              <View
                style={[
                  s.totalCard,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <View>
                  <Text style={[s.totalLabel, { color: colors.subText }]}>
                    Total já comprado
                  </Text>
                  <Text style={[s.totalValue, { color: colors.text }]}>
                    {formatCurrency(purchasedTotal, "BRL")}
                  </Text>
                </View>
                <Ionicons
                  name="calculator-outline"
                  size={28}
                  color={colors.primary}
                />
              </View>
            </>
          )}
        </ScrollView>

        <Modal
          visible={!!purchaseItem}
          transparent
          animationType="fade"
          onRequestClose={closePurchaseModal}
        >
          <View style={s.modalOverlay}>
            <View
              style={[
                s.modalCard,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <View style={s.modalIcon}>
                <Ionicons
                  name="cart-outline"
                  size={28}
                  color={colors.primary}
                />
              </View>

              <Text style={[s.modalTitle, { color: colors.text }]}>
                Registrar compra
              </Text>
              <Text style={[s.modalSubtitle, { color: colors.subText }]}>
                {purchaseTarget?.product_name}
              </Text>

              <Text style={[s.inputLabel, { color: colors.subText }]}>
                Valor pago
              </Text>

              <TextInput
                style={[
                  s.modalInput,
                  {
                    backgroundColor: colors.inputBg,
                    borderColor: colors.border,
                    color: colors.text,
                  },
                ]}
                value={purchaseValue}
                onChangeText={setPurchaseValue}
                placeholder="Ex.: 12,90"
                placeholderTextColor={colors.subText}
                keyboardType="decimal-pad"
                autoFocus
              />

              <View style={s.modalActions}>
                <TouchableOpacity
                  onPress={closePurchaseModal}
                  disabled={savingPurchase}
                  style={[s.secondaryBtn, { borderColor: colors.border }]}
                >
                  <Text style={[s.secondaryBtnText, { color: colors.text }]}>
                    Cancelar
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleConfirmPurchase}
                  disabled={savingPurchase}
                  style={[s.primaryBtn, { backgroundColor: colors.primary }]}
                >
                  {savingPurchase ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={s.primaryBtnText}>Marcar como comprado</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function SectionHeader({
  title,
  count,
  color,
}: {
  title: string;
  count: number;
  color: string;
}) {
  return (
    <View style={s.sectionHeader}>
      <Text style={[s.sectionTitle, { color }]}>{title}</Text>
      <View style={[s.countBadge, { backgroundColor: color + "18" }]}>
        <Text style={[s.countBadgeText, { color }]}>{count}</Text>
      </View>
    </View>
  );
}

function EmptyState({
  icon,
  text,
  colors,
}: {
  icon: any;
  text: string;
  colors: any;
}) {
  return (
    <View style={s.emptyState}>
      <Ionicons name={icon} size={28} color={colors.subText} />
      <Text style={[s.emptyText, { color: colors.subText }]}>{text}</Text>
    </View>
  );
}

function ShoppingRow({
  item,
  colors,
  isLast,
  onBuy,
  onDelete,
}: {
  item: { id: string; product_name: string };
  colors: any;
  isLast: boolean;
  onBuy: () => void;
  onDelete: () => void;
}) {
  return (
    <View
      style={[
        s.row,
        !isLast && { borderBottomWidth: 1, borderBottomColor: colors.border },
      ]}
    >
      <View style={[s.uncheckedCircle, { borderColor: colors.border }]}>
        <Ionicons name="cart-outline" size={17} color={colors.subText} />
      </View>

      <Text style={[s.productName, { color: colors.text }]} numberOfLines={2}>
        {item.product_name}
      </Text>

      <TouchableOpacity
        onPress={onBuy}
        style={[s.buyBtn, { backgroundColor: colors.primary }]}
      >
        <Ionicons name="checkmark" size={17} color="#fff" />
        <Text style={s.buyBtnText}>Comprar</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={onDelete} style={s.deleteBtn}>
        <Ionicons name="trash-outline" size={18} color="#ef4444" />
      </TouchableOpacity>
    </View>
  );
}

function PurchasedRow({
  item,
  colors,
  isLast,
  onUndo,
  onDelete,
}: {
  item: {
    id: string;
    product_name: string;
    purchased_value: number | null;
  };
  colors: any;
  isLast: boolean;
  onUndo: () => void;
  onDelete: () => void;
}) {
  return (
    <View
      style={[
        s.row,
        !isLast && { borderBottomWidth: 1, borderBottomColor: colors.border },
      ]}
    >
      <View style={s.checkedCircle}>
        <Ionicons name="checkmark" size={18} color="#fff" />
      </View>

      <View style={{ flex: 1, paddingHorizontal: 10 }}>
        <Text
          style={[
            s.productName,
            { color: colors.text, textDecorationLine: "line-through" },
          ]}
          numberOfLines={2}
        >
          {item.product_name}
        </Text>

        <Text style={s.purchasedValue}>
          {formatCurrency(Number(item.purchased_value ?? 0), "BRL")}
        </Text>
      </View>

      <TouchableOpacity onPress={onUndo} style={s.undoBtn}>
        <Ionicons
          name="return-up-back-outline"
          size={16}
          color={colors.subText}
        />
      </TouchableOpacity>

      <TouchableOpacity onPress={onDelete} style={s.deleteBtn}>
        <Ionicons name="trash-outline" size={18} color="#ef4444" />
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 19, fontWeight: "800" },
  headerSubtitle: { fontSize: 11, marginTop: 2 },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  whatsappBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#25D366",
    alignItems: "center",
    justifyContent: "center",
  },
  content: { padding: 20, paddingBottom: 40 },
  infoCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  infoText: { flex: 1, fontSize: 12, lineHeight: 18 },
  addRow: { flexDirection: "row", gap: 10, marginBottom: 18 },
  addInput: {
    flex: 1,
    minHeight: 48,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 15,
  },
  addButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  errorBox: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    padding: 12,
    marginBottom: 16,
    borderRadius: 12,
    backgroundColor: "rgba(239,68,68,0.10)",
  },
  errorText: { flex: 1, color: "#ef4444", fontSize: 12 },
  loadingBox: { paddingVertical: 40, alignItems: "center" },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
    marginBottom: 10,
  },
  sectionTitle: { fontSize: 16, fontWeight: "800" },
  countBadge: {
    minWidth: 28,
    height: 28,
    paddingHorizontal: 8,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  countBadgeText: { fontSize: 12, fontWeight: "800" },
  listCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: 20,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 32,
    gap: 8,
  },
  emptyText: { fontSize: 13 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 68,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  uncheckedCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  checkedCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#10b981",
    alignItems: "center",
    justifyContent: "center",
  },
  productName: { flex: 1, fontSize: 14, fontWeight: "600" },
  buyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
  },
  buyBtnText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  deleteBtn: { padding: 6 },
  purchasedValue: {
    color: "#10b981",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 4,
  },
  undoBtn: { padding: 8 },
  totalCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
    marginTop: 4,
  },
  totalLabel: { fontSize: 12 },
  totalValue: { fontSize: 22, fontWeight: "800", marginTop: 4 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 24,
    borderWidth: 1,
    padding: 22,
  },
  modalIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(99,102,241,0.12)",
    marginBottom: 14,
  },
  modalTitle: { fontSize: 20, fontWeight: "800" },
  modalSubtitle: { fontSize: 13, marginTop: 4, marginBottom: 20 },
  inputLabel: { fontSize: 12, fontWeight: "700", marginBottom: 7 },
  modalInput: {
    height: 50,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 18,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 20,
  },
  secondaryBtn: {
    minWidth: 100,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: "center",
  },
  secondaryBtnText: { fontWeight: "700" },
  primaryBtn: {
    minWidth: 170,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: { color: "#fff", fontWeight: "800" },
});
