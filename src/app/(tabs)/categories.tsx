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
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useCategories } from "@/hooks/useCategories";
import { categoryService } from "@/services";
import { Input } from "@/components/ui";
import type { Category, CategoryType } from "@/types";
import { useRouter } from "expo-router";
import { useAppTheme } from "@/hooks/useTheme"; // 👈 Sistema de temas adicionado

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

const ICONS: { key: string; name: keyof typeof Ionicons.glyphMap }[] = [
  { key: "cart", name: "cart" },
  { key: "food", name: "fast-food" },
  { key: "home", name: "home" },
  { key: "car", name: "car" },
  { key: "health", name: "medkit" },
  { key: "education", name: "school" },
  { key: "travel", name: "airplane" },
  { key: "clothing", name: "shirt" },
  { key: "pets", name: "paw" },
  { key: "gift", name: "gift" },
  { key: "sports", name: "football" },
  { key: "music", name: "musical-notes" },
  { key: "salary", name: "cash" },
  { key: "investment", name: "trending-up" },
  { key: "freelance", name: "laptop" },
  { key: "other", name: "ellipsis-horizontal-circle" },
];

export default function CategoriesScreen() {
  const router = useRouter();
  const { categories, income, expense, refetch, remove } = useCategories();
  const { colors, isDark } = useAppTheme(); // 👈 Cores dinâmicas
  const [modalVisible, setModalVisible] = useState(false);
  const [tab, setTab] = useState<CategoryType>("expense");
  const [isLoading, setIsLoading] = useState(false);

  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { type: "expense", color: "#6366f1", icon: "other" },
  });

  const selectedColor = watch("color"); // 👈 Monitoriza a cor escolhida

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
    if (!cat.user_id) {
      if (Platform.OS === "web")
        window.alert("Categorias padrão não podem ser removidas.");
      else Alert.alert("Aviso", "Categorias padrão não podem ser removidas.");
      return;
    }

    const mensagem = `Tem certeza que deseja remover "${cat.name}"?`;

    if (Platform.OS === "web") {
      if (window.confirm(mensagem)) {
        remove(cat.id).then(({ error }) => {
          if (error) window.alert("Erro: " + error);
        });
      }
    } else {
      Alert.alert("Remover", mensagem, [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Remover",
          style: "destructive",
          onPress: async () => {
            const { error } = await remove(cat.id);
            if (error) Alert.alert("Erro", error);
          },
        },
      ]);
    }
  };

  const displayed = tab === "income" ? income : expense;

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: colors.bg }]}>
      <View style={s.header}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={26} color={colors.text} />
          </TouchableOpacity>
          <Text style={[s.title, { color: colors.text }]}>Categorias</Text>
        </View>

        <TouchableOpacity
          style={[s.addBtn, { backgroundColor: colors.primary }]}
          onPress={() => setModalVisible(true)}
        >
          <Text style={s.addBtnText}>+ Nova</Text>
        </TouchableOpacity>
      </View>

      <View
        style={[
          s.tabs,
          { backgroundColor: colors.card, borderBottomColor: colors.border },
        ]}
      >
        <TouchableOpacity
          style={[
            s.tab,
            tab === "expense" && {
              borderBottomWidth: 2,
              borderBottomColor: "#ef4444",
            },
          ]}
          onPress={() => setTab("expense")}
        >
          <Text
            style={[
              s.tabText,
              { color: colors.subText },
              tab === "expense" && { color: "#ef4444" },
            ]}
          >
            Despesas ({expense.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            s.tab,
            tab === "income" && {
              borderBottomWidth: 2,
              borderBottomColor: "#22c55e",
            },
          ]}
          onPress={() => setTab("income")}
        >
          <Text
            style={[
              s.tabText,
              { color: colors.subText },
              tab === "income" && { color: "#22c55e" },
            ]}
          >
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
            <Text style={[s.emptyText, { color: colors.subText }]}>
              Nenhuma categoria
            </Text>
          </View>
        }
        renderItem={({ item: c }) => (
          <TouchableOpacity
            style={[
              s.catCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderTopColor: c.color,
              },
            ]}
            onLongPress={() => handleDelete(c)}
            activeOpacity={0.8}
          >
            <Ionicons
              name={
                (ICONS.find((i) => i.key === c.icon)?.name ??
                  "ellipsis-horizontal-circle") as any
              }
              size={26}
              color={c.color}
            />
            <Text style={[s.catName, { color: c.color }]} numberOfLines={1}>
              {c.name}
            </Text>
            {!c.user_id ? (
              <Text style={[s.catDefault, { color: colors.subText }]}>
                Padrão
              </Text>
            ) : (
              <Text style={[s.catCustom, { color: c.color }]}>
                Personalizada
              </Text>
            )}
          </TouchableOpacity>
        )}
      />

      <Text style={[s.hint, { color: colors.subText }]}>
        Segure para remover categorias personalizadas
      </Text>

      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={[s.modal, { backgroundColor: colors.bg }]}>
          <View style={[s.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[s.modalTitle, { color: colors.text }]}>
              Nova Categoria
            </Text>
            <TouchableOpacity
              onPress={() => {
                setModalVisible(false);
                reset();
              }}
            >
              <Text style={[s.modalClose, { color: colors.primary }]}>
                Fechar
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={s.form}>
            <Text style={[s.label, { color: colors.text }]}>Tipo</Text>
            <Controller
              name="type"
              control={control}
              render={({ field: { onChange, value } }) => (
                <View style={s.typeRow}>
                  <TouchableOpacity
                    style={[
                      s.typeBtn,
                      { borderColor: colors.border },
                      value === "expense" && {
                        backgroundColor: "#ef4444",
                        borderColor: "#ef4444",
                      },
                    ]}
                    onPress={() => onChange("expense")}
                  >
                    <Text
                      style={[
                        s.typeBtnText,
                        { color: colors.subText },
                        value === "expense" && { color: "#fff" },
                      ]}
                    >
                      Despesa
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      s.typeBtn,
                      { borderColor: colors.border },
                      value === "income" && {
                        backgroundColor: "#22c55e",
                        borderColor: "#22c55e",
                      },
                    ]}
                    onPress={() => onChange("income")}
                  >
                    <Text
                      style={[
                        s.typeBtnText,
                        { color: colors.subText },
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

            <Text style={[s.label, { color: colors.text }]}>Ícone</Text>
            <Controller
              name="icon"
              control={control}
              render={({ field: { onChange, value } }) => (
                <View style={s.iconGrid}>
                  {ICONS.map((i) => (
                    <TouchableOpacity
                      key={i.key}
                      style={[
                        s.iconBtn,
                        {
                          backgroundColor: colors.inputBg,
                          borderColor: colors.border,
                        },
                        value === i.key && {
                          borderColor: selectedColor,
                          backgroundColor: selectedColor + "20",
                        },
                      ]}
                      onPress={() => onChange(i.key)}
                    >
                      <Ionicons
                        name={i.name}
                        size={22}
                        color={value === i.key ? selectedColor : colors.subText}
                      />
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            />

            <Text style={[s.label, { color: colors.text }]}>Cor</Text>
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
                        value === c && [
                          s.colorBtnActive,
                          { borderColor: colors.text },
                        ],
                      ]}
                      onPress={() => onChange(c)}
                    />
                  ))}
                </View>
              )}
            />

            <View style={{ flexDirection: "row", gap: 12 }}>
              <TouchableOpacity
                style={[
                  s.saveBtn,
                  {
                    flex: 1,
                    backgroundColor: colors.inputBg,
                    borderWidth: 1,
                    borderColor: colors.border,
                  },
                ]}
                onPress={() => {
                  setModalVisible(false);
                  reset();
                }}
              >
                <Text style={[s.saveBtnText, { color: colors.text }]}>
                  Cancelar
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  s.saveBtn,
                  { flex: 1, backgroundColor: colors.primary },
                  isLoading && { opacity: 0.6 },
                ]}
                onPress={handleSubmit(onSubmit)}
                disabled={isLoading}
              >
                <Text style={s.saveBtnText}>
                  {isLoading ? "A guardar..." : "Criar"}
                </Text>
              </TouchableOpacity>
            </View>
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
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  title: { fontSize: 22, fontWeight: "bold" },
  addBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  addBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  tabs: { flexDirection: "row", borderBottomWidth: 1 },
  tab: { flex: 1, paddingVertical: 14, alignItems: "center" },
  tabText: { fontSize: 14, fontWeight: "600" },
  list: { padding: 16 },
  catCard: {
    flex: 1,
    margin: 6,
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    borderTopWidth: 3,
    borderWidth: 1,
  },
  catName: {
    fontSize: 14,
    fontWeight: "bold",
    marginTop: 8,
    textAlign: "center",
  },
  catDefault: { fontSize: 10, marginTop: 4 },
  catCustom: { fontSize: 10, fontWeight: "600", marginTop: 4 },
  hint: { textAlign: "center", fontSize: 12, paddingBottom: 16 },
  empty: { alignItems: "center", paddingVertical: 40 },
  emptyText: { fontSize: 14 },
  modal: { flex: 1 },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  modalTitle: { fontSize: 18, fontWeight: "bold" },
  modalClose: { fontWeight: "600" },
  form: { padding: 20, gap: 16 },
  label: { fontSize: 13, fontWeight: "600", marginBottom: 2 },
  typeRow: { flexDirection: "row", gap: 12 },
  typeBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
  },
  typeBtnText: { fontSize: 14, fontWeight: "600" },
  iconGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  iconBtn: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  colorRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  colorBtn: { width: 36, height: 36, borderRadius: 18 },
  colorBtnActive: { borderWidth: 3 },
  saveBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  saveBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
