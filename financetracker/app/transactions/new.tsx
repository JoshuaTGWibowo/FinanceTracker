import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import dayjs from "dayjs";
import { Ionicons } from "@expo/vector-icons";

import { useAppTheme } from "../../theme";
import { Category, TransactionType, useFinanceStore } from "../../lib/store";

const MAX_NOTE_WORDS = 100;

const getWordCount = (value: string) => {
  if (!value.trim()) {
    return 0;
  }
  return value.trim().split(/\s+/).filter(Boolean).length;
};

const ensureDateStartOfDay = (value: Date) => {
  const next = new Date(value);
  next.setHours(0, 0, 0, 0);
  return next;
};

const renderCategoryGroup = (
  title: string,
  items: Category[],
  activeId: string,
  onSelect: (categoryId: string) => void,
  styles: ReturnType<typeof createStyles>,
) => {
  if (!items.length) return null;

  return (
    <View style={styles.categoryGroup}>
      <Text style={styles.categoryGroupTitle}>{title}</Text>
      <View style={styles.categoryChips}>
        {items.map((category) => {
          const isActive = category.id === activeId;
          return (
            <Pressable
              key={category.id}
              style={[styles.categoryChip, isActive && styles.categoryChipActive]}
              onPress={() => onSelect(category.id)}
            >
              <Text style={[styles.categoryChipText, isActive && styles.categoryChipTextActive]}>
                {category.name}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

export default function NewTransactionModal() {
  const theme = useAppTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ transactionId?: string }>();
  const addTransaction = useFinanceStore((state) => state.addTransaction);
  const updateTransaction = useFinanceStore((state) => state.updateTransaction);
  const transactions = useFinanceStore((state) => state.transactions);
  const currency = useFinanceStore((state) => state.profile.currency);
  const categories = useFinanceStore((state) => state.preferences.categories);

  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState(() => categories[0]?.id ?? "");
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [date, setDate] = useState(() => ensureDateStartOfDay(new Date()));
  const [showPicker, setShowPicker] = useState(Platform.OS === "ios");
  const [showMoreDetails, setShowMoreDetails] = useState(false);
  const [participants, setParticipants] = useState<string[]>([]);
  const [participantInput, setParticipantInput] = useState("");
  const [location, setLocation] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [excludeFromReports, setExcludeFromReports] = useState(false);
  const [prefilled, setPrefilled] = useState(() => !params.transactionId);

  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(theme, insets), [theme, insets]);

  const selectedCategory = useMemo(
    () => categories.find((category) => category.id === selectedCategoryId) ?? null,
    [categories, selectedCategoryId],
  );
  const existingTransaction = useMemo(
    () => transactions.find((transaction) => transaction.id === params.transactionId) ?? null,
    [transactions, params.transactionId],
  );
  const isEditing = Boolean(params.transactionId && existingTransaction);
  const transactionType: TransactionType = selectedCategory?.type ?? "expense";
  const noteWordCount = useMemo(() => getWordCount(note), [note]);

  const expenseCategories = useMemo(
    () => categories.filter((category) => category.type === "expense"),
    [categories],
  );
  const incomeCategories = useMemo(
    () => categories.filter((category) => category.type === "income"),
    [categories],
  );

  const handleCategorySelect = (categoryId: string) => {
    setSelectedCategoryId(categoryId);
    setCategoryOpen(false);
  };

  useEffect(() => {
    if (!selectedCategory && categories.length) {
      setSelectedCategoryId(categories[0].id);
    }
  }, [categories, selectedCategory]);

  useEffect(() => {
    if (params.transactionId && !existingTransaction) {
      Alert.alert("Not found", "We couldn't find that transaction.", [
        {
          text: "OK",
          onPress: () => router.back(),
        },
      ]);
      return;
    }

    if (isEditing && existingTransaction && !prefilled) {
      setAmount(existingTransaction.amount.toString());
      setNote(existingTransaction.note);
      const matchedCategory = categories.find(
        (category) => category.name === existingTransaction.category,
      );
      setSelectedCategoryId(matchedCategory?.id ?? categories[0]?.id ?? "");
      setDate(ensureDateStartOfDay(new Date(existingTransaction.date)));
      setParticipants(existingTransaction.participants ? [...existingTransaction.participants] : []);
      setLocation(existingTransaction.location ?? "");
      setPhotos(existingTransaction.photos ? [...existingTransaction.photos] : []);
      setExcludeFromReports(Boolean(existingTransaction.excludeFromReports));
      setShowMoreDetails(
        Boolean(
          (existingTransaction.participants?.length ?? 0) > 0 ||
            existingTransaction.location ||
            (existingTransaction.photos?.length ?? 0) > 0 ||
            existingTransaction.excludeFromReports,
        ),
      );
      setPrefilled(true);
    }
  }, [
    categories,
    existingTransaction,
    isEditing,
    params.transactionId,
    prefilled,
    router,
  ]);

  const handleNoteChange = (value: string) => {
    const words = value.match(/\S+/g) ?? [];
    if (words.length <= MAX_NOTE_WORDS) {
      setNote(value);
      return;
    }

    const truncated = words.slice(0, MAX_NOTE_WORDS).join(" ");
    setNote(truncated);
  };

  const handleAddParticipant = () => {
    const value = participantInput.trim();
    if (!value) {
      return;
    }

    setParticipants((prev) => {
      if (prev.some((item) => item.toLowerCase() === value.toLowerCase())) {
        return prev;
      }
      return [...prev, value];
    });
    setParticipantInput("");
  };

  const handleRemoveParticipant = (value: string) => {
    setParticipants((prev) => prev.filter((participant) => participant !== value));
  };

  const handleAddPhoto = async () => {
    if (photos.length >= 3) {
      Alert.alert("Limit reached", "You can attach up to 3 photos per transaction.");
      return;
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission needed", "Allow photo library access to attach receipts.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    });

    if (!result.canceled && result.assets?.length) {
      setPhotos((prev) => {
        const uris = result.assets.map((asset) => asset.uri).filter(Boolean) as string[];
        const next: string[] = [...prev];

        for (const uri of uris) {
          if (next.length >= 3) {
            break;
          }

          if (!next.includes(uri)) {
            next.push(uri);
          }
        }

        return next;
      });
    }
  };

  const handleRemovePhoto = (uri: string) => {
    setPhotos((prev) => prev.filter((photo) => photo !== uri));
  };

  const handleSubmit = () => {
    const parsedAmount = Number(amount.replace(/,/g, "."));

    if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      Alert.alert("Hold up", "Enter a positive amount to continue.");
      return;
    }

    if (!selectedCategory) {
      Alert.alert("Heads up", "Please choose a category for this transaction.");
      return;
    }

    const normalizedDate = ensureDateStartOfDay(date);
    const finalNote = note.trim();

    const payload = {
      amount: parsedAmount,
      note: finalNote,
      category: selectedCategory.name,
      type: transactionType,
      date: normalizedDate.toISOString(),
      participants,
      location: location.trim() || undefined,
      photos,
      excludeFromReports,
    };

    if (isEditing && params.transactionId) {
      updateTransaction(params.transactionId, payload);
    } else {
      addTransaction(payload);
    }

    router.back();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={32 + insets.top}
      >
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.closeButton}>
            <Ionicons name="chevron-down" size={24} color={theme.colors.text} />
          </Pressable>
          <Text style={styles.title}>{isEditing ? "Edit transaction" : "Add transaction"}</Text>
          <View style={{ width: 32 }} />
        </View>

        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.content}
          contentInsetAdjustmentBehavior="automatic"
          showsVerticalScrollIndicator={false}
        >
          <View
            style={[
              styles.typeBadge,
              transactionType === "income"
                ? styles.typeBadgeIncome
                : styles.typeBadgeExpense,
            ]}
          >
            <Text style={styles.typeBadgeText}>
              {transactionType === "income" ? "Income" : "Expense"} transaction
            </Text>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Amount ({currency})</Text>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor={theme.colors.textMuted}
              style={styles.input}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Category</Text>
            <Pressable
              style={[styles.input, styles.selectorButton]}
              onPress={() => setCategoryOpen((prev) => !prev)}
            >
              <View style={styles.selectorContent}>
                <Text style={styles.selectorValue}>
                  {selectedCategory ? selectedCategory.name : "Choose a category"}
                </Text>
                {selectedCategory && (
                  <Text style={styles.selectorHint}>
                    {selectedCategory.type === "income" ? "Income" : "Expense"}
                  </Text>
                )}
              </View>
              <Ionicons
                name={categoryOpen ? "chevron-up" : "chevron-down"}
                size={18}
                color={theme.colors.textMuted}
              />
            </Pressable>
            {categoryOpen && (
              <View style={styles.categoryList}>
                {renderCategoryGroup(
                  "Expenses",
                  expenseCategories,
                  selectedCategoryId,
                  handleCategorySelect,
                  styles,
                )}
                {renderCategoryGroup(
                  "Income",
                  incomeCategories,
                  selectedCategoryId,
                  handleCategorySelect,
                  styles,
                )}
                {!categories.length && (
                  <Text style={styles.helperText}>
                    No categories yet. Add them from Account & preferences.
                  </Text>
                )}
              </View>
            )}
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Note</Text>
            <TextInput
              value={note}
              onChangeText={handleNoteChange}
              placeholder="Add a short note"
              placeholderTextColor={theme.colors.textMuted}
              style={[styles.input, styles.multilineInput]}
              multiline
            />
            <Text style={styles.wordCounter}>
              {noteWordCount} / {MAX_NOTE_WORDS} words
            </Text>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Date</Text>
            <Pressable
              style={[styles.input, styles.dateButton]}
              onPress={() => setShowPicker((prev) => !prev)}
            >
              <Text style={styles.dateText}>{dayjs(date).format("MMM D, YYYY")}</Text>
              <Ionicons name="calendar" size={20} color={theme.colors.textMuted} />
            </Pressable>
            {showPicker && (
              <DateTimePicker
                value={date}
                mode="date"
                display={Platform.OS === "ios" ? "inline" : "default"}
                onChange={(_, selectedDate) => {
                  if (selectedDate) {
                    setDate(ensureDateStartOfDay(selectedDate));
                  }
                  if (Platform.OS !== "ios") {
                    setShowPicker(false);
                  }
                }}
              />
            )}
          </View>

          <Pressable
            style={styles.detailsToggle}
            onPress={() => setShowMoreDetails((prev) => !prev)}
          >
            <Text style={styles.detailsToggleText}>
              {showMoreDetails ? "Hide additional details" : "Add more details"}
            </Text>
            <Ionicons
              name={showMoreDetails ? "chevron-up" : "chevron-down"}
              size={18}
              color={theme.colors.textMuted}
            />
          </Pressable>

          {showMoreDetails && (
            <View style={styles.detailsCard}>
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>With</Text>
                {participants.length > 0 && (
                  <View style={styles.participantChips}>
                    {participants.map((person) => (
                      <View key={person} style={styles.participantChip}>
                        <Text style={styles.participantChipText}>{person}</Text>
                        <Pressable
                          onPress={() => handleRemoveParticipant(person)}
                          style={styles.participantRemoveButton}
                        >
                          <Ionicons name="close" size={12} color={theme.colors.text} />
                        </Pressable>
                      </View>
                    ))}
                  </View>
                )}
                <View style={styles.row}>
                  <TextInput
                    value={participantInput}
                    onChangeText={setParticipantInput}
                    placeholder="Add a person"
                    placeholderTextColor={theme.colors.textMuted}
                    style={[styles.input, styles.flex]}
                    returnKeyType="done"
                    onSubmitEditing={handleAddParticipant}
                  />
                  <Pressable style={styles.secondaryButton} onPress={handleAddParticipant}>
                    <Text style={styles.secondaryButtonText}>Add</Text>
                  </Pressable>
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Location</Text>
                <TextInput
                  value={location}
                  onChangeText={setLocation}
                  placeholder="e.g. Soho Coffee"
                  placeholderTextColor={theme.colors.textMuted}
                  style={styles.input}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Photos</Text>
                <View style={styles.photoRow}>
                  {photos.map((uri) => (
                    <View key={uri} style={styles.photoItem}>
                      <Image source={{ uri }} style={styles.photoImage} contentFit="cover" />
                      <Pressable
                        onPress={() => handleRemovePhoto(uri)}
                        style={styles.photoRemoveButton}
                      >
                        <Ionicons name="close" size={14} color={theme.colors.text} />
                      </Pressable>
                    </View>
                  ))}
                  {photos.length < 3 && (
                    <Pressable style={styles.addPhotoButton} onPress={handleAddPhoto}>
                      <Ionicons name="camera" size={18} color={theme.colors.textMuted} />
                      <Text style={styles.addPhotoText}>Add photo</Text>
                    </Pressable>
                  )}
                </View>
              </View>

              <View style={styles.switchRow}>
                <View>
                  <Text style={styles.switchLabel}>Exclude from reports</Text>
                  <Text style={styles.switchHint}>
                    Keep this transaction out of summaries and insights.
                  </Text>
                </View>
                <Switch
                  value={excludeFromReports}
                  onValueChange={setExcludeFromReports}
                  trackColor={{ true: theme.colors.success, false: theme.colors.border }}
                  thumbColor={theme.colors.background}
                />
              </View>
            </View>
          )}
        </ScrollView>

        <Pressable style={styles.submitButton} onPress={handleSubmit}>
          <Text style={styles.submitButtonText}>
            {isEditing ? "Save changes" : "Add transaction"}
          </Text>
        </Pressable>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (
  theme: ReturnType<typeof useAppTheme>,
  insets: ReturnType<typeof useSafeAreaInsets>,
) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    flex: {
      flex: 1,
    },
    header: {
      paddingHorizontal: theme.spacing.xl,
      paddingVertical: theme.spacing.lg,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    closeButton: {
      width: 32,
      height: 32,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: theme.radii.md,
      backgroundColor: theme.colors.surface,
    },
    title: {
      ...theme.typography.title,
      fontSize: 22,
    },
    content: {
      paddingHorizontal: theme.spacing.xl,
      paddingBottom: theme.spacing.xl + insets.bottom,
      gap: theme.spacing.lg,
    },
    fieldGroup: {
      gap: theme.spacing.xs,
    },
    label: {
      ...theme.typography.subtitle,
      fontSize: 12,
      textTransform: "uppercase",
      letterSpacing: 1.2,
    },
    input: {
      ...theme.components.input,
      fontSize: 16,
      minHeight: 48,
    },
    multilineInput: {
      minHeight: 96,
      textAlignVertical: "top",
      paddingTop: theme.spacing.sm,
    },
    selectorButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingRight: theme.spacing.md,
    },
    selectorContent: {
      gap: 2,
    },
    selectorValue: {
      color: theme.colors.text,
      fontSize: 16,
      fontWeight: "600",
    },
    selectorHint: {
      fontSize: 12,
      fontWeight: "600",
      color: theme.colors.textMuted,
      textTransform: "uppercase",
      letterSpacing: 0.8,
    },
    categoryList: {
      ...theme.components.surface,
      padding: theme.spacing.md,
      gap: theme.spacing.md,
    },
    categoryGroup: {
      gap: theme.spacing.xs,
    },
    categoryGroupTitle: {
      fontSize: 12,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 1.2,
      color: theme.colors.textMuted,
    },
    categoryChips: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: theme.spacing.xs,
    },
    categoryChip: {
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.xs,
      borderRadius: theme.radii.pill,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
    categoryChipActive: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    categoryChipText: {
      fontSize: 13,
      fontWeight: "600",
      color: theme.colors.textMuted,
    },
    categoryChipTextActive: {
      color: theme.colors.text,
    },
    helperText: {
      fontSize: 12,
      color: theme.colors.textMuted,
    },
    wordCounter: {
      fontSize: 12,
      fontWeight: "600",
      color: theme.colors.textMuted,
      textAlign: "right",
    },
    dateButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    dateText: {
      color: theme.colors.text,
      fontSize: 16,
      fontWeight: "600",
    },
    detailsToggle: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: theme.spacing.xs,
    },
    detailsToggleText: {
      fontSize: 15,
      fontWeight: "600",
      color: theme.colors.text,
    },
    detailsCard: {
      ...theme.components.surface,
      gap: theme.spacing.lg,
      padding: theme.spacing.lg,
    },
    row: {
      flexDirection: "row",
      gap: theme.spacing.sm,
      alignItems: "center",
    },
    participantChips: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: theme.spacing.xs,
    },
    participantChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
      borderRadius: theme.radii.pill,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    participantChipText: {
      fontSize: 12,
      fontWeight: "600",
      color: theme.colors.text,
    },
    participantRemoveButton: {
      width: 20,
      height: 20,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.surfaceElevated,
    },
    photoRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: theme.spacing.sm,
    },
    photoItem: {
      position: "relative",
      width: 80,
      height: 80,
      borderRadius: theme.radii.md,
      overflow: "hidden",
      backgroundColor: theme.colors.surfaceElevated,
    },
    photoImage: {
      width: "100%",
      height: "100%",
    },
    photoRemoveButton: {
      position: "absolute",
      top: 6,
      right: 6,
      width: 24,
      height: 24,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.surface,
      shadowColor: theme.colors.background,
      shadowOpacity: 0.2,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 2 },
    },
    addPhotoButton: {
      height: 80,
      paddingHorizontal: theme.spacing.md,
      borderRadius: theme.radii.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderStyle: "dashed",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
    },
    addPhotoText: {
      fontSize: 12,
      fontWeight: "600",
      color: theme.colors.textMuted,
    },
    switchRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: theme.spacing.sm,
    },
    switchLabel: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.text,
    },
    switchHint: {
      fontSize: 12,
      color: theme.colors.textMuted,
    },
    submitButton: {
      ...theme.components.buttonPrimary,
      marginTop: theme.spacing.lg,
      marginHorizontal: theme.spacing.xl,
      marginBottom: theme.spacing.xl + insets.bottom,
    },
    submitButtonText: {
      ...theme.components.buttonPrimaryText,
    },
    secondaryButton: {
      ...theme.components.buttonSecondary,
      minWidth: 64,
      justifyContent: "center",
      height: 48,
    },
    secondaryButtonText: {
      ...theme.components.buttonSecondaryText,
    },
    typeBadge: {
      alignSelf: "flex-start",
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.xs,
      borderRadius: theme.radii.pill,
      shadowColor: theme.colors.background,
      shadowOpacity: 0.12,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
    },
    typeBadgeIncome: {
      backgroundColor: theme.colors.success,
    },
    typeBadgeExpense: {
      backgroundColor: theme.colors.danger,
    },
    typeBadgeText: {
      fontSize: 12,
      fontWeight: "700",
      color: theme.colors.background,
      textTransform: "uppercase",
      letterSpacing: 1,
    },
  });
