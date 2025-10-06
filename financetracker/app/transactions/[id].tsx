import { useMemo } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import dayjs from "dayjs";
import { Image } from "expo-image";

import { useAppTheme } from "../../theme";
import { useFinanceStore } from "../../lib/store";

export default function TransactionDetailsScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(theme, insets), [theme, insets]);

  const { id } = useLocalSearchParams<{ id?: string }>();
  const transaction = useFinanceStore((state) =>
    state.transactions.find((item) => item.id === id),
  );
  const duplicateTransaction = useFinanceStore((state) => state.duplicateTransaction);
  const removeTransaction = useFinanceStore((state) => state.removeTransaction);

  if (!transaction) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={[styles.flex, styles.emptyState]}>
          <Ionicons name="alert-circle" size={48} color={theme.colors.textMuted} />
          <Text style={styles.emptyTitle}>Transaction not found</Text>
          <Pressable style={styles.primaryButton} onPress={() => router.back()}>
            <Text style={styles.primaryButtonText}>Go back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const isIncome = transaction.type === "income";
  const amountSign = isIncome ? "+" : "−";
  const participants = transaction.participants ?? [];
  const photos = transaction.photos ?? [];
  const noteDisplay = transaction.note.trim() || "—";

  const handleDuplicate = () => {
    duplicateTransaction(transaction.id);
    Alert.alert("Duplicated", "A copy was added to your transactions.");
  };

  const handleDelete = () => {
    Alert.alert("Delete transaction", "This action cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          removeTransaction(transaction.id);
          router.back();
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable style={styles.headerButton} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={22} color={theme.colors.text} />
          </Pressable>
          <Text style={styles.title}>Transaction details</Text>
          <Pressable
            style={styles.headerButton}
            onPress={() => router.push({ pathname: "/transactions/new", params: { transactionId: transaction.id } })}
          >
            <Ionicons name="pencil" size={20} color={theme.colors.text} />
          </Pressable>
        </View>

        <View style={[theme.components.surface, styles.summaryCard]}>
          <View style={styles.amountRow}>
            <Text style={[styles.amount, isIncome ? styles.amountIncome : styles.amountExpense]}>
              {amountSign}
              {transaction.amount.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </Text>
            <View
              style={[
                styles.typeBadge,
                isIncome ? styles.typeBadgeIncome : styles.typeBadgeExpense,
              ]}
            >
              <Text style={styles.typeBadgeText}>
                {isIncome ? "Income" : "Expense"}
              </Text>
            </View>
          </View>
          <Text style={styles.category}>{transaction.category}</Text>
          <Text style={styles.date}>{dayjs(transaction.date).format("MMMM D, YYYY")}</Text>
          {transaction.excludeFromReports && (
            <View style={styles.excludedPill}>
              <Ionicons name="shield" size={14} color={theme.colors.textMuted} />
              <Text style={styles.excludedText}>Excluded from reports</Text>
            </View>
          )}
        </View>

        <View style={[theme.components.surface, styles.sectionCard]}>
          <Text style={styles.sectionTitle}>Details</Text>
          <DetailRow label="Note" value={noteDisplay} styles={styles} />
          <DetailRow
            label="Type"
            value={isIncome ? "Income" : "Expense"}
            styles={styles}
          />
          <DetailRow label="Category" value={transaction.category} styles={styles} />
          <DetailRow
            label="Date"
            value={dayjs(transaction.date).format("MMMM D, YYYY")}
            styles={styles}
          />
          {transaction.location ? (
            <DetailRow label="Location" value={transaction.location} styles={styles} />
          ) : null}
          {participants.length ? (
            <View style={styles.detailGroup}>
              <Text style={styles.detailLabel}>With</Text>
              <View style={styles.chipRow}>
                {participants.map((person) => (
                  <View key={person} style={styles.chip}>
                    <Text style={styles.chipText}>{person}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}
          {photos.length ? (
            <View style={styles.detailGroup}>
              <Text style={styles.detailLabel}>Photos</Text>
              <View style={styles.photoGrid}>
                {photos.map((uri) => (
                  <Image key={uri} source={{ uri }} style={styles.photo} contentFit="cover" />
                ))}
              </View>
            </View>
          ) : null}
        </View>
      </ScrollView>

      <View style={styles.actionBar}>
        <Pressable style={styles.actionButton} onPress={handleDuplicate}>
          <Ionicons name="copy" size={18} color={theme.colors.text} />
          <Text style={styles.actionButtonText}>Duplicate</Text>
        </Pressable>
        <Pressable style={styles.deleteButton} onPress={handleDelete}>
          <Ionicons name="trash" size={18} color={theme.colors.background} />
          <Text style={styles.deleteButtonText}>Delete</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function DetailRow({
  label,
  value,
  styles,
}: {
  label: string;
  value: string;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.detailGroup}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
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
    content: {
      paddingHorizontal: theme.spacing.xl,
      paddingBottom: theme.spacing.xxl + insets.bottom + 72,
      gap: theme.spacing.lg,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingTop: theme.spacing.lg,
      marginBottom: theme.spacing.lg,
    },
    headerButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    title: {
      ...theme.typography.title,
      fontSize: 22,
    },
    summaryCard: {
      gap: theme.spacing.md,
      padding: theme.spacing.xl,
      borderRadius: 18,
      shadowColor: theme.colors.background,
      shadowOpacity: 0.12,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
    },
    amountRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    amount: {
      fontSize: 34,
      fontWeight: "700",
    },
    amountIncome: {
      color: theme.colors.success,
    },
    amountExpense: {
      color: theme.colors.danger,
    },
    typeBadge: {
      paddingHorizontal: theme.spacing.md,
      paddingVertical: 6,
      borderRadius: theme.radii.pill,
    },
    typeBadgeIncome: {
      backgroundColor: `${theme.colors.success}22`,
    },
    typeBadgeExpense: {
      backgroundColor: `${theme.colors.danger}22`,
    },
    typeBadgeText: {
      fontSize: 12,
      fontWeight: "700",
      letterSpacing: 1,
      textTransform: "uppercase",
      color: theme.colors.text,
    },
    category: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.text,
    },
    date: {
      fontSize: 14,
      color: theme.colors.textMuted,
    },
    excludedPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      alignSelf: "flex-start",
      paddingHorizontal: theme.spacing.md,
      paddingVertical: 6,
      borderRadius: theme.radii.pill,
      backgroundColor: `${theme.colors.textMuted}20`,
    },
    excludedText: {
      fontSize: 12,
      fontWeight: "600",
      color: theme.colors.textMuted,
    },
    sectionCard: {
      gap: theme.spacing.lg,
      padding: theme.spacing.xl,
      borderRadius: 18,
    },
    sectionTitle: {
      fontSize: 15,
      fontWeight: "700",
      color: theme.colors.text,
      textTransform: "uppercase",
      letterSpacing: 0.8,
    },
    detailGroup: {
      gap: theme.spacing.xs,
    },
    detailLabel: {
      fontSize: 12,
      fontWeight: "600",
      color: theme.colors.textMuted,
      letterSpacing: 0.6,
      textTransform: "uppercase",
    },
    detailValue: {
      fontSize: 15,
      color: theme.colors.text,
    },
    chipRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: theme.spacing.xs,
    },
    chip: {
      paddingHorizontal: theme.spacing.md,
      paddingVertical: 6,
      borderRadius: theme.radii.pill,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    chipText: {
      fontSize: 13,
      fontWeight: "600",
      color: theme.colors.text,
    },
    photoGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: theme.spacing.sm,
    },
    photo: {
      width: 96,
      height: 96,
      borderRadius: theme.radii.md,
    },
    actionBar: {
      position: "absolute",
      left: theme.spacing.xl,
      right: theme.spacing.xl,
      bottom: theme.spacing.xl + insets.bottom,
      flexDirection: "row",
      gap: theme.spacing.sm,
    },
    actionButton: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 14,
      borderRadius: theme.radii.md,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    actionButtonText: {
      fontSize: 15,
      fontWeight: "600",
      color: theme.colors.text,
    },
    deleteButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingHorizontal: theme.spacing.lg,
      borderRadius: theme.radii.md,
      backgroundColor: theme.colors.danger,
    },
    deleteButtonText: {
      fontSize: 15,
      fontWeight: "600",
      color: theme.colors.background,
    },
    emptyState: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: theme.spacing.md,
      padding: theme.spacing.xl,
    },
    emptyTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.text,
      textAlign: "center",
    },
    primaryButton: {
      ...theme.components.buttonPrimary,
      paddingHorizontal: theme.spacing.xl,
    },
    primaryButtonText: {
      ...theme.components.buttonPrimaryText,
    },
  });
