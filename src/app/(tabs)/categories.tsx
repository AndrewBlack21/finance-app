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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useCategories } from "@/hooks/useCategories";
import { categoryService } from "@/services";
import { Input } from "@/components/ui";
import type { Category, CategoryType } from "@/types";

const schema = z.object({
  name: z.string().min(1, "Nome obrigatório"),
  type: z.enum(["income", "expense"]),
  color: z.string().min(1),
  icon: z.string().min(1),
});
type FormData = z.infer<typeof schema>;

const COLORS = [
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

const ICONS = [
  { key: "cart", label: "🛒" },
  { key: "food", label: "🍔" },
  { key: "home", label: "🏠" },
  { key: "car", label: "🚗" },
  { key: "health", label: "💊" },
  { key: "education", label: "📚" },
  { key: "travel", label: "✈️" },
  { key: "clothing", label: "👕" },
  { key: "pets", label: "🐾" },
  { key: "gift", label: "🎁" },
  { key: "sports", label: "⚽" },
  { key: "music", label: "🎵" },
  { key: "salary", label: "💰" },
  { key: "investment", label: "📈" },
  { key: "freelance", label: "💻" },
  { key: "other", label: "📦" },
];

const EMOJI_MAP: Record<string, string> = Object.fromEntries(
  ICONS.map((i) => [i.key, i.label]),
);

export default function CategoriesScreen() {
  const { categories, income, expense, refetch } = useCategories();
  const [modalVisible, setModalVisible] = useState(false);
  const [tab, setTab] = useState<CategoryType>("expense");
  const [isLoading, setIsLoading] = useState(false);

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { type: "expense", color: "#6366f1", icon: "other" },
  });

  const selectedType = watch("type");

  const onSubmit = async (values: FormData) => {
    setIsLoading(true);
    const { error } = await categoryService.create({
      name: values.name,
      type: values.type,
      color: values.color,
      icon: values.icon,
    });
    setIsLoading(false);
    if (error) return Alert.alert("Erro", error);
    await refetch();
    reset({ type: "expense", color: "#6366f1", icon: "other" });
    setModalVisible(false);
  };

  const handleDelete = (cat: Category) => {
    if (!cat.user_id)
      return Alert.alert("Aviso", "Categorias padrão não podem ser removidas.");
    Alert.alert("Remover categoria", `Remover "${cat.name}"?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Remover",
        style: "destructive",
        onPress: async () => {
          await categoryService.remove(cat.id);
          await refetch();
        },
      },
    ]);
  };

  const displayed = tab === "income" ? income : expense;

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Text style={s.title}>Categorias</Text>
        <TouchableOpacity
          style={s.addBtn}
          onPress={() => setModalVisible(true)}
        >
          <Text style={s.addBtnText}>+ Nova</Text>
        </TouchableOpacity>
      </View>

      {/* TABS */}
      <View style={s.tabs}>
        <TouchableOpacity
          style={[s.tab, tab === "expense" && s.tabActive]}
          onPress={() => setTab("expense")}
        >
          <Text style={[s.tabText, tab === "expense" && s.tabTextActive]}>
            Despesas ({expense.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.tab, tab === "income" && s.tabActive]}
          onPress={() => setTab("income")}
        >
          <Text style={[s.tabText, tab === "income" && s.tabTextActive]}>
            Receitas ({income.length})
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={displayed}
        keyExtractor={(c) => c.id}
        contentContainerStyle={s.list}
        numColumns={2}
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={s.emptyText}>Nenhuma categoria</Text>
          </View>
        }
        renderItem={({ item: c }) => (
          <TouchableOpacity
            style={[s.catCard, { borderTopColor: c.color }]}
            onLongPress={() => handleDelete(c)}
            activeOpacity={0.8}
          >
            <Text style={s.catEmoji}>{EMOJI_MAP[c.icon] ?? "📦"}</Text>
            <Text style={s.catName}>{c.name}</Text>
            {!c.user_id ? (
              <Text style={s.catDefault}>Padrão</Text>
            ) : (
              <Text style={s.catCustom}>Personalizada</Text>
            )}
          </TouchableOpacity>
        )}
      />

      <Text style={s.hint}>Segure para remover categorias personalizadas</Text>

      {/* MODAL */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={s.modal}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Nova Categoria</Text>
            <TouchableOpacity
              onPress={() => {
                setModalVisible(false);
                reset();
              }}
            >
              <Text style={s.modalClose}>Fechar</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={s.form}>
            {/* TIPO */}
            <Text style={s.label}>Tipo</Text>
            <Controller
              name="type"
              control={control}
              render={({ field: { onChange, value } }) => (
                <View style={s.typeRow}>
                  <TouchableOpacity
                    style={[
                      s.typeBtn,
                      value === "expense" && {
                        backgroundColor: "#dc2626",
                        borderColor: "#dc2626",
                      },
                    ]}
                    onPress={() => onChange("expense")}
                  >
                    <Text
                      style={[
                        s.typeBtnText,
                        value === "expense" && { color: "#fff" },
                      ]}
                    >
                      Despesa
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      s.typeBtn,
                      value === "income" && {
                        backgroundColor: "#16a34a",
                        borderColor: "#16a34a",
                      },
                    ]}
                    onPress={() => onChange("income")}
                  >
                    <Text
                      style={[
                        s.typeBtnText,
                        value === "income" && { color: "#fff" },
                      ]}
                    >
                      Receita
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            />

            <Controller
              name="name"
              control={control}
              render={({ field: { onChange, value } }) => (
                <Input
                  label="Nome da categoria"
                  placeholder="Ex: Academia, Freelance..."
                  onChangeText={onChange}
                  value={value}
                  error={errors.name?.message}
                />
              )}
            />

            {/* ÍCONE */}
            <Text style={s.label}>Ícone</Text>
            <Controller
              name="icon"
              control={control}
              render={({ field: { onChange, value } }) => (
                <View style={s.iconGrid}>
                  {ICONS.map((i) => (
                    <TouchableOpacity
                      key={i.key}
                      style={[s.iconBtn, value === i.key && s.iconBtnActive]}
                      onPress={() => onChange(i.key)}
                    >
                      <Text style={s.iconEmoji}>{i.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            />

            {/* COR */}
            <Text style={s.label}>Cor</Text>
            <Controller
              name="color"
              control={control}
              render={({ field: { onChange, value } }) => (
                <View style={s.colorRow}>
                  {COLORS.map((c) => (
                    <TouchableOpacity
                      key={c}
                      style={[
                        s.colorBtn,
                        { backgroundColor: c },
                        value === c && s.colorBtnActive,
                      ]}
                      onPress={() => onChange(c)}
                    />
                  ))}
                </View>
              )}
            />

            <TouchableOpacity
              style={[s.saveBtn, isLoading && { opacity: 0.6 }]}
              onPress={handleSubmit(onSubmit)}
              disabled={isLoading}
            >
              <Text style={s.saveBtnText}>
                {isLoading ? "Salvando..." : "Criar categoria"}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
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
    backgroundColor: "#6366f1",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  addBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },

  tabs: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  tab: { flex: 1, paddingVertical: 14, alignItems: "center" },
  tabActive: { borderBottomWidth: 2, borderBottomColor: "#6366f1" },
  tabText: { fontSize: 14, color: "#9ca3af", fontWeight: "600" },
  tabTextActive: { color: "#6366f1" },

  list: { padding: 16 },
  catCard: {
    flex: 1,
    margin: 6,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    borderTopWidth: 3,
  },
  catEmoji: { fontSize: 28, marginBottom: 8 },
  catName: {
    fontSize: 13,
    fontWeight: "700",
    color: "#111827",
    textAlign: "center",
  },
  catDefault: { fontSize: 10, color: "#9ca3af", marginTop: 4 },
  catCustom: {
    fontSize: 10,
    color: "#6366f1",
    fontWeight: "600",
    marginTop: 4,
  },

  hint: {
    textAlign: "center",
    fontSize: 12,
    color: "#9ca3af",
    paddingBottom: 16,
  },
  empty: { alignItems: "center", paddingVertical: 40 },
  emptyText: { color: "#9ca3af", fontSize: 14 },

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

  typeRow: { flexDirection: "row", gap: 12 },
  typeBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    alignItems: "center",
  },
  typeBtnText: { fontSize: 14, fontWeight: "600", color: "#6b7280" },

  iconGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  iconBtn: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  iconBtnActive: { borderColor: "#6366f1", backgroundColor: "#ede9fe" },
  iconEmoji: { fontSize: 22 },

  colorRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  colorBtn: { width: 36, height: 36, borderRadius: 18 },
  colorBtnActive: { borderWidth: 3, borderColor: "#111827" },

  saveBtn: {
    backgroundColor: "#6366f1",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  saveBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
