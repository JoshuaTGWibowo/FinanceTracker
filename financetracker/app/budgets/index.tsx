import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { useAppTheme } from "../../theme";
import { useFinanceStore } from "../../lib/store";

const goalPeriods = ["month", "week"] as const;

export default function BudgetsScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const categories = useFinanceStore((state) => state.preferences.categories);
  const budgetGoals = useFinanceStore((state) => state.budgetGoals);
  const addBudgetGoal = useFinanceStore((state) => state.addBudgetGoal);
  const removeBudgetGoal = useFinanceStore((state) => state.removeBudgetGoal);

  const [goalName, setGoalName] = useState("");
  const [goalTarget, setGoalTarget] = useState("");
  const [goalPeriod, setGoalPeriod] = useState<(typeof goalPeriods)[number]>("month");
  const [goalCategory, setGoalCategory] = useState<string | null>(null);

  const insets = useSafeAreaInsets();
  const styles = createStyles(theme, insets);

  const handleCreateGoal = async () => {
    if (!goalName.trim()) {
      Alert.alert("Heads up", "Give your goal a descriptive name.");
      return;
    }

    const targetValue = Number(goalTarget);
    if (!goalTarget.trim() || Number.isNaN(targetValue) || targetValue <= 0) {
      Alert.alert("Heads up", "Target amount must be a positive number.");
      return;
    }

    await addBudgetGoal({
      name: goalName.trim(),
      target: targetValue,
      period: goalPeriod,
      category: goalCategory || null,
    });

    setGoalName("");
    setGoalTarget("");
    Alert.alert("Success", "Budget goal created successfully.");
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={24}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          contentInsetAdjustmentBehavior="automatic"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Pressable onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
            </Pressable>
            <View style={styles.headerText}>
              <Text style={styles.title}>Budget Goals</Text>
              <Text style={styles.subtitle}>Set spending limits and savings targets.</Text>
            </View>
          </View>

          <View style={[theme.components.surface, styles.sectionCard]}>
            <Text style={styles.sectionTitle}>Create New Goal</Text>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Goal name</Text>
              <TextInput
                value={goalName}
                onChangeText={setGoalName}
                placeholder="Save $500 this month"
                placeholderTextColor={theme.colors.textMuted}
                style={styles.input}
              />
            </View>
            <View style={styles.row}>
              <View style={[styles.fieldGroup, styles.flex]}>
                <Text style={styles.label}>Target amount</Text>
                <TextInput
                  value={goalTarget}
                  onChangeText={setGoalTarget}
                  keyboardType="numeric"
                  placeholder="500"
                  placeholderTextColor={theme.colors.textMuted}
                  style={styles.input}
                />
              </View>
              <View style={[styles.fieldGroup, styles.periodField]}>
                <Text style={styles.label}>Period</Text>
                <View style={styles.periodRow}>
                  {goalPeriods.map((period) => {
                    const active = goalPeriod === period;
                    return (
                      <Pressable
                        key={period}
                        style={[styles.periodChip, active && styles.periodChipActive]}
                        onPress={() => setGoalPeriod(period)}
                      >
                        <Text style={[styles.periodChipText, active && styles.periodChipTextActive]}>
                          {period}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Track category (optional)</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipsRow}
              >
                <Pressable
                  key="all"
                  onPress={() => setGoalCategory(null)}
                  style={[styles.categoryChip, goalCategory === null && styles.categoryChipActive]}
                >
                  <Text style={[styles.categoryChipText, goalCategory === null && styles.categoryChipTextActive]}>
                    Savings goal
                  </Text>
                </Pressable>
                {categories.map((category) => {
                  const active = goalCategory === category.name;
                  return (
                    <Pressable
                      key={category.id}
                      onPress={() => setGoalCategory(category.name)}
                      style={[styles.categoryChip, active && styles.categoryChipActive]}
                    >
                      <Text
                        style={[styles.categoryChipText, active && styles.categoryChipTextActive]}
                      >
                        {category.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
            <Pressable style={styles.primaryButton} onPress={handleCreateGoal}>
              <Text style={styles.primaryButtonText}>Create goal</Text>
            </Pressable>
          </View>

          <View style={[theme.components.surface, styles.sectionCard]}>
            <Text style={styles.sectionTitle}>Your Goals</Text>
            <View style={styles.goalList}>
              {budgetGoals.length ? (
                budgetGoals.map((goal) => (
                  <View key={goal.id} style={styles.goalRow}>
                    <View style={styles.goalCopy}>
                      <Text style={styles.goalName}>{goal.name}</Text>
                      <Text style={styles.goalMeta}>
                        Target: {goal.target.toLocaleString()} • Period: {goal.period}
                        {goal.category ? ` • Category: ${goal.category}` : ""}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => void removeBudgetGoal(goal.id)}
                      style={styles.deleteButton}
                      accessibilityRole="button"
                    >
                      <Ionicons name="trash" size={16} color={theme.colors.danger} />
                    </Pressable>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyStateText}>No goals yet. Create one to stay motivated.</Text>
              )}
            </View>
          </View>
        </ScrollView>
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
    content: {
      flexGrow: 1,
      paddingTop: theme.spacing.xl,
      paddingHorizontal: theme.spacing.md,
      paddingBottom: theme.spacing.xl + insets.bottom,
      gap: theme.spacing.xl,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.md,
    },
    backButton: {
      padding: theme.spacing.xs,
    },
    headerText: {
      flex: 1,
      gap: theme.spacing.sm,
    },
    title: {
      ...theme.typography.title,
      fontSize: 26,
    },
    subtitle: {
      ...theme.typography.subtitle,
      fontSize: 14,
    },
    sectionCard: {
      gap: theme.spacing.lg,
    },
    sectionTitle: {
      ...theme.typography.subtitle,
      fontSize: 13,
      textTransform: "uppercase",
      letterSpacing: 1.2,
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
    },
    row: {
      flexDirection: "row",
      gap: theme.spacing.sm,
    },
    chipsRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: theme.spacing.sm,
    },
    categoryChip: {
      ...theme.components.chip,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    categoryChipActive: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    categoryChipText: {
      fontSize: 12,
      fontWeight: "600",
      color: theme.colors.textMuted,
    },
    categoryChipTextActive: {
      color: theme.colors.text,
    },
    periodField: {
      maxWidth: 150,
    },
    periodRow: {
      flexDirection: "row",
      gap: theme.spacing.sm,
      flexWrap: "wrap",
    },
    periodChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.xs,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.radii.pill,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    periodChipActive: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    periodChipText: {
      fontSize: 13,
      fontWeight: "600",
      color: theme.colors.textMuted,
      textTransform: "capitalize",
    },
    periodChipTextActive: {
      color: theme.colors.text,
    },
    emptyStateText: {
      ...theme.typography.subtitle,
      fontSize: 13,
      marginTop: theme.spacing.sm,
    },
    primaryButton: {
      ...theme.components.buttonPrimary,
      alignSelf: "flex-start",
      paddingHorizontal: theme.spacing.xl,
    },
    primaryButtonText: {
      ...theme.components.buttonPrimaryText,
    },
    goalList: {
      gap: theme.spacing.md,
    },
    goalRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    goalCopy: {
      flex: 1,
      gap: theme.spacing.xs,
    },
    goalName: {
      ...theme.typography.body,
      fontWeight: "600",
    },
    goalMeta: {
      ...theme.typography.subtitle,
      fontSize: 13,
    },
    deleteButton: {
      padding: theme.spacing.sm,
      borderRadius: theme.radii.md,
      borderWidth: 1,
      borderColor: theme.colors.danger,
    },
  });
