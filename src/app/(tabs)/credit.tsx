import { useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Modal,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useInstallments } from "@/hooks/useInstallments";
import { useAccounts } from "@/hooks/useAccounts";
import { Input, Button } from "@/components/ui";
import { formatCurrency } from "@/utils";
import { useAuth } from "@/hooks/useAuth";
import type { Installment } from "@/types";

// ============================================================
// SCHEMA
// ============================================================
const schema = z.object({
  title: z.string().min(1, "Nome obrigatÃ³rio"),
  total_amount: z.string().min(1, "Valor obrigatÃ³rio"),
  total_installments: z.string().min(1, "Parcelas obrigatÃ³rio"),
  account_id: z.string().min(1, "Selecione uma conta"),
  currency: z.string().min(1),
  start_date: z.string().min(1),
});
type FormData = z.infer<typeof schema>;

const CURRENCIES = ["BRL", "USD", "EUR", "GBP"];

export default function CreditScreen() {
  const { profile } = useAuth();
  const {
    installments,
    isLoading,
    monthlyTotal,
    create,
    payInstallment,
    remove,
  } = useInstallments();
  const { accounts } = useAccounts();
  const [modalVisible, setModalVisible] = useState(false);

  const today = new Date().toISOString().split("T")[0];

  const {
    control,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { currency: "BRL", start_date: today },
  });

  const totalAmount = watch("total_amount");
  const totalInstallments = watch("total_installments");

  // Calcula valor da parcela em tempo real
  const installmentPreview =
    totalAmount && totalInstallments
      ? (
          Number(totalAmount.replace(",", ".")) / Number(totalInstallments)
        ).toFixed(2)
      : "0,00";

  const onSubmit = async (values: FormData) => {
    const total = Number(values.total_amount.replace(",", "."));
    const parcelas = Number(values.total_installments);
    const { error } = await create({
      title: values.title,
      total_amount: total,
      installment_amount: parseFloat((total / parcelas).toFixed(2)),
      total_installments: parcelas,
      paid_installments: 0,
      account_id: values.account_id,
      currency: values.currency,
      start_date: values.start_date,
    });
    if (error) Alert.alert("Erro", error);
    else {
      reset();
      setModalVisible(false);
    }
  };

  const handlePay = (item: Installment) => {
    if (item.paid_installments >= item.total_installments) return;
    Alert.alert(
      "Pagar parcela",
      `Confirmar pagamento de ${formatCurrency(item.installment_amount, item.currency)}?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Confirmar",
          onPress: () => payInstallment(item.id, item.paid_installments),
        },
      ],
    );
  };

  return (
    <SafeAreaView style={s.safe}>
      {/* HEADER */}
      <View style={s.header}>
        <Text style={s.title}>Credito</Text>
        <TouchableOpacity
          style={s.addBtn}
          onPress={() => setModalVisible(true)}
        >
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={s.addBtnText}>Novo</Text>
        </TouchableOpacity>
      </View>

      {/* CARD TOTAL MENSAL */}
      <View style={s.totalCard}>
        <Text style={s.totalLabel}>Total de parcelas este mês</Text>
        <Text style={s.totalValue}>
          {formatCurrency(monthlyTotal, profile?.currency)}
        </Text>
        <Text style={s.totalSub}>
          {installments.filter((i) => i.remaining_installments! > 0).length}{" "}
          compras em aberto
        </Text>
      </View>

      {/* LISTA */}
      {isLoading ? (
        <ActivityIndicator color="#6366f1" style={{ marginTop: 32 }} />
      ) : (
        <FlatList
          data={installments}
          keyExtractor={(i) => i.id}
          contentContainerStyle={s.list}
          ListEmptyComponent={
            <View style={s.empty}>
              <Text style={s.emptyText}>Nenhuma compra parcelada</Text>
              <Text style={s.emptySubtext}>
                Toque em "+ Novo" para adicionar
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <InstallmentCard
              item={item}
              onPay={() => handlePay(item)}
              onDelete={() =>
                Alert.alert("Remover", "Remover esta compra?", [
                  { text: "Cancelar", style: "cancel" },
                  {
                    text: "Remover",
                    style: "destructive",
                    onPress: () => remove(item.id),
                  },
                ])
              }
            />
          )}
        />
      )}

      {/* MODAL */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={s.modal}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Nova Compra Parcelada</Text>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Text style={s.modalClose}>Fechar</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={s.form}>
            <Controller
              name="title"
              control={control}
              render={({ field: { onChange, value } }) => (
                <Input
                  label="Nome do produto/compra"
                  placeholder="Ex: iPhone, SofÃ¡..."
                  onChangeText={onChange}
                  value={value}
                  error={errors.title?.message}
                />
              )}
            />

            <View style={{ flexDirection: "row", gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Controller
                  name="total_amount"
                  control={control}
                  render={({ field: { onChange, value } }) => (
                    <Input
                      label="Valor total"
                      placeholder="0,00"
                      keyboardType="numeric"
                      onChangeText={onChange}
                      value={value}
                      error={errors.total_amount?.message}
                    />
                  )}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Controller
                  name="total_installments"
                  control={control}
                  render={({ field: { onChange, value } }) => (
                    <Input
                      label="NÂº de parcelas"
                      placeholder="12"
                      keyboardType="numeric"
                      onChangeText={onChange}
                      value={value}
                      error={errors.total_installments?.message}
                    />
                  )}
                />
              </View>
            </View>

            {/* Preview do valor da parcela */}
            {totalAmount && totalInstallments && (
              <View style={s.preview}>
                <Text style={s.previewText}>
                  Valor por parcela:{" "}
                  <Text style={s.previewValue}>R$ {installmentPreview}</Text>
                </Text>
              </View>
            )}

            {/* CONTA */}
            <Text style={s.label}>Conta/Cartão</Text>
            <Controller
              name="account_id"
              control={control}
              render={({ field: { onChange, value } }) => (
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={s.optionRow}>
                    {accounts.map((a) => (
                      <TouchableOpacity
                        key={a.id}
                        style={[
                          s.optionBtn,
                          value === a.id && {
                            backgroundColor: a.color,
                            borderColor: a.color,
                          },
                        ]}
                        onPress={() => onChange(a.id)}
                      >
                        <Text
                          style={[
                            s.optionText,
                            value === a.id && { color: "#fff" },
                          ]}
                        >
                          {a.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              )}
            />

            {/* MOEDA */}
            <Text style={s.label}>Moeda</Text>
            <Controller
              name="currency"
              control={control}
              render={({ field: { onChange, value } }) => (
                <View style={s.optionRow}>
                  {CURRENCIES.map((c) => (
                    <TouchableOpacity
                      key={c}
                      style={[s.optionBtn, value === c && s.optionBtnActive]}
                      onPress={() => onChange(c)}
                    >
                      <Text
                        style={[s.optionText, value === c && { color: "#fff" }]}
                      >
                        {c}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            />

            <Controller
              name="start_date"
              control={control}
              render={({ field: { onChange, value } }) => (
                <Input
                  label="Data da compra"
                  placeholder="AAAA-MM-DD"
                  onChangeText={onChange}
                  value={value}
                />
              )}
            />

            <Button
              label="Adicionar compra"
              loading={isLoading}
              onPress={handleSubmit(onSubmit)}
            />
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

// ============================================================
// CARD DE PARCELA
// ============================================================
function InstallmentCard({
  item: i,
  onPay,
  onDelete,
}: {
  item: Installment;
  onPay: () => void;
  onDelete: () => void;
}) {
  const isDone = i.paid_installments >= i.total_installments;
  return (
    <View style={[cs.card, isDone && cs.cardDone]}>
      <View style={cs.cardTop}>
        <View style={{ flex: 1 }}>
          <Text style={cs.cardTitle}>{i.title}</Text>
          <Text style={cs.cardAccount}>{i.account?.name ?? "â€”"}</Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={cs.cardAmount}>
            {formatCurrency(i.installment_amount, i.currency)}/mês
          </Text>
          <Text style={cs.cardParcelas}>
            {i.paid_installments}/{i.total_installments} parcelas
          </Text>
        </View>
      </View>

      {/* BARRA DE PROGRESSO */}
      <View style={cs.progressBar}>
        <View
          style={[
            cs.progressFill,
            {
              width: `${i.progress ?? 0}%` as any,
              backgroundColor: isDone ? "#16a34a" : "#6366f1",
            },
          ]}
        />
      </View>

      <View style={cs.cardFooter}>
        <Text style={cs.cardTotal}>
          Total: {formatCurrency(i.total_amount, i.currency)}
        </Text>
        <View style={{ flexDirection: "row", gap: 12 }}>
          {!isDone && (
            <TouchableOpacity onPress={onPay}>
              <View style={cs.actionPill}>
                <Ionicons name="card-outline" size={14} color="#6366f1" />
                <Text style={cs.payText}>Pagar</Text>
              </View>
            </TouchableOpacity>
          )}
          {isDone && (
            <View style={cs.actionPill}>
              <Ionicons name="checkmark-circle" size={14} color="#16a34a" />
              <Text style={cs.doneText}>Quitado</Text>
            </View>
          )}
          <TouchableOpacity onPress={onDelete}>
            <Ionicons name="trash-outline" size={14} color="#ef4444" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f8fafc" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  title: { fontSize: 22, fontWeight: "bold", color: "#111827" },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#6366f1",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  addBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  totalCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: "#6366f1",
    borderRadius: 16,
    padding: 20,
  },
  totalLabel: { color: "#c7d2fe", fontSize: 13, marginBottom: 6 },
  totalValue: { color: "#fff", fontSize: 28, fontWeight: "bold" },
  totalSub: { color: "#a5b4fc", fontSize: 12, marginTop: 4 },
  list: { paddingHorizontal: 20, paddingBottom: 32 },
  empty: { alignItems: "center", paddingVertical: 60 },
  emptyText: { fontSize: 16, fontWeight: "600", color: "#374151" },
  emptySubtext: { fontSize: 13, color: "#9ca3af", marginTop: 6 },
  modal: { flex: 1, backgroundColor: "#f8fafc" },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  modalTitle: { fontSize: 18, fontWeight: "bold", color: "#111827" },
  modalClose: { color: "#6366f1", fontWeight: "600" },
  form: { padding: 20, gap: 16 },
  label: { fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 2 },
  optionRow: { flexDirection: "row", gap: 8, marginBottom: 4 },
  optionBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  optionBtnActive: { backgroundColor: "#6366f1", borderColor: "#6366f1" },
  optionText: { fontSize: 13, color: "#6b7280", fontWeight: "500" },
  preview: { backgroundColor: "#ede9fe", borderRadius: 10, padding: 12 },
  previewText: { fontSize: 13, color: "#4c1d95" },
  previewValue: { fontWeight: "700" },
});

const cs = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  cardDone: { opacity: 0.7 },
  cardTop: { flexDirection: "row", marginBottom: 12 },
  cardTitle: { fontSize: 15, fontWeight: "700", color: "#111827" },
  cardAccount: { fontSize: 12, color: "#9ca3af", marginTop: 2 },
  cardAmount: { fontSize: 15, fontWeight: "700", color: "#6366f1" },
  cardParcelas: { fontSize: 12, color: "#9ca3af", marginTop: 2 },
  progressBar: {
    height: 6,
    backgroundColor: "#e5e7eb",
    borderRadius: 3,
    marginBottom: 10,
  },
  progressFill: { height: 6, borderRadius: 3 },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardTotal: { fontSize: 12, color: "#6b7280" },
  actionPill: { flexDirection: "row", alignItems: "center", gap: 4 },
  payText: { fontSize: 12, color: "#6366f1", fontWeight: "600" },
  doneText: { fontSize: 12, color: "#16a34a", fontWeight: "600" },
  deleteText: { fontSize: 12, color: "#ef4444" },
});
