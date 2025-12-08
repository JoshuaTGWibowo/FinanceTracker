import { useMemo, useState, useEffect } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Switch,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { useAppTheme } from "../../theme";
import { Category, useFinanceStore } from "../../lib/store";
import { doesCategoryMatchBudget } from "../../lib/categoryUtils";

const goalPeriods = ["month", "week"] as const;

const toIconName = (value?: string | null) =>
  (value as keyof typeof Ionicons.glyphMap) || ("pricetag" as keyof typeof Ionicons.glyphMap);

export default function BudgetsScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const categories = useFinanceStore((state) => state.preferences.categories);
  const budgetGoals = useFinanceStore((state) => state.budgetGoals);
  const addBudgetGoal = useFinanceStore((state) => state.addBudgetGoal);
  const removeBudgetGoal = useFinanceStore((state) => state.removeBudgetGoal);
  const currency = useFinanceStore((state) => state.profile.currency);

  const [goalName, setGoalName] = useState("");
  const [goalTarget, setGoalTarget] = useState("");
  const [goalPeriod, setGoalPeriod] = useState<(typeof goalPeriods)[number]>("month");
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [categorySearch, setCategorySearch] = useState("");
  const [isRepeating, setIsRepeating] = useState(true);

  const transactions = useFinanceStore((state) => state.transactions);

  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(theme, insets), [theme, insets]);

  // Calculate budget progress based on transactions
  const budgetsWithProgress = useMemo(() => {
    console.log('[Budget Progress] Calculating for', budgetGoals.length, 'budgets with', transactions.length, 'transactions');
    console.log('[Budget Progress] Sample transaction categories:', transactions.slice(0, 3).map(t => ({ cat: t.category, type: t.type })));
    console.log('[Budget Progress] Available categories:', categories.slice(0, 5).map(c => ({ id: c.id, name: c.name, parent: c.parentCategoryId })));
    
    return budgetGoals.map(goal => {
        const goalStartDate = new Date(goal.createdAt);
        const now = new Date();
        
        // Calculate period dates
        let periodStart: Date;
        let periodEnd: Date;
        
        if (goal.period === 'week') {
          // Weekly: Monday to Sunday
          const dayOfWeek = now.getDay();
          const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
          periodStart = new Date(now);
          periodStart.setDate(now.getDate() + diffToMonday);
          periodStart.setHours(0, 0, 0, 0);
          
          periodEnd = new Date(periodStart);
          periodEnd.setDate(periodStart.getDate() + 6);
          periodEnd.setHours(23, 59, 59, 999);
        } else {
          // Monthly: 1st to end of month
          periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
          periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        }
        
        // Only count if goal was created before period end
        if (goalStartDate > periodEnd) {
          return { ...goal, currentSpending: 0, progress: 0 };
        }
        
        // Filter transactions matching budget
        const matchingTransactions = transactions.filter(t => {
          const txDate = new Date(t.date);
          const inDateRange = txDate >= periodStart && txDate <= periodEnd;
          const isExpense = t.type === 'expense';
          const matchesCategory = doesCategoryMatchBudget(t.category, goal.category, categories, true);
          
          if (isExpense && inDateRange) {
            console.log('[Budget Filter]', goal.name, '- checking tx:', {
              amount: t.amount,
              txCategory: t.category,
              budgetCategory: goal.category,
              matches: matchesCategory,
              date: txDate.toISOString()
            });
          }
          
          return isExpense && matchesCategory && inDateRange;
        });
        
        const spending = matchingTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
        const progress = goal.target > 0 ? Math.min((spending / goal.target) * 100, 100) : 0;
        
        // Debug logging
        console.log(`[Budget Result] ${goal.name} (${goal.category}):`, {
          matchingTxCount: matchingTransactions.length,
          spending,
          target: goal.target,
          progress: `${progress}%`,
          periodStart: periodStart.toISOString(),
          periodEnd: periodEnd.toISOString(),
          totalExpenses: transactions.filter(t => t.type === 'expense' && new Date(t.date) >= periodStart && new Date(t.date) <= periodEnd).length
        });
        
        return {
          ...goal,
          currentSpending: spending,
          progress: Math.round(progress)
        };
    });
  }, [budgetGoals, transactions, categories]);

  const groupedCategories = useMemo(() => {
    const parentCategories = categories.filter((category) => !category.parentCategoryId);
    const searchLower = categorySearch.toLowerCase();
    
    return parentCategories
      .map((parent) => {
        const children = categories.filter((category) => category.parentCategoryId === parent.id);
        
        const parentMatches = parent.name.toLowerCase().includes(searchLower);
        const matchingChildren = children.filter((child) =>
          child.name.toLowerCase().includes(searchLower)
        );
        
        if (!searchLower || parentMatches || matchingChildren.length > 0) {
          return {
            parent,
            children: !searchLower ? children : matchingChildren,
          };
        }
        return null;
      })
      .filter((group): group is { parent: Category; children: Category[] } => group !== null);
  }, [categories, categorySearch]);

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

    if (!selectedCategory) {
      Alert.alert("Heads up", "Please select a category for this budget goal.");
      return;
    }

    await addBudgetGoal({
      name: goalName.trim(),
      target: targetValue,
      period: goalPeriod,
      category: selectedCategory.name,
      isRepeating,
      createdAt: new Date().toISOString(),
    });

    setGoalName("");
    setGoalTarget("");
    setSelectedCategory(null);
    setIsRepeating(true);
    Alert.alert("Success", "Budget goal created successfully.");
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.backgroundAccent} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={24}
      >
        <View style={styles.headerContainer}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={22} color={theme.colors.text} />
          </Pressable>
          <View style={styles.headerText}>
            <Text style={styles.title}>Budget Goals</Text>
            <Text style={styles.subtitle}>Track spending by category</Text>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          contentInsetAdjustmentBehavior="automatic"
          showsVerticalScrollIndicator={false}
        >
          <View style={[theme.components.surface, styles.formCard]}>
            <View style={styles.formHeader}>
              <View style={styles.formIconContainer}>
                <Ionicons name="add-circle" size={20} color={theme.colors.primary} />
              </View>
              <View style={styles.flex}>
                <Text style={styles.formTitle}>Create New Budget</Text>
                <Text style={styles.formSubtitle}>Set a spending target for a category</Text>
              </View>
            </View>

            <View style={styles.formBody}>
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Budget name</Text>
                <TextInput
                  value={goalName}
                  onChangeText={setGoalName}
                  placeholder="e.g., Monthly groceries"
                  placeholderTextColor={theme.colors.textMuted}
                  style={styles.input}
                />
              </View>

              <View style={styles.row}>
                <View style={[styles.fieldGroup, styles.flex]}>
                  <Text style={styles.label}>Target amount</Text>
                  <View style={styles.amountInputContainer}>
                    <Text style={styles.currencySymbol}>{currency}</Text>
                    <TextInput
                      value={goalTarget}
                      onChangeText={setGoalTarget}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor={theme.colors.textMuted}
                      style={styles.amountInput}
                    />
                  </View>
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
                            {period === "month" ? "Monthly" : "Weekly"}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Category</Text>
                <Pressable
                  style={styles.categorySelector}
                  onPress={() => setCategoryModalVisible(true)}
                >
                  <View style={styles.categorySelectorContent}>
                    {selectedCategory ? (
                      <>
                        <View style={styles.categoryIconSmall}>
                          <Ionicons
                            name={toIconName(selectedCategory.icon)}
                            size={14}
                            color={theme.colors.text}
                          />
                        </View>
                        <Text style={styles.categorySelectorText}>{selectedCategory.name}</Text>
                      </>
                    ) : (
                      <Text style={styles.categorySelectorPlaceholder}>Choose a category</Text>
                    )}
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
                </Pressable>
              </View>

              <View style={styles.fieldGroup}>
                <View style={styles.switchRow}>
                  <View style={styles.flex}>
                    <Text style={styles.label}>Repeating budget</Text>
                    <Text style={styles.switchDescription}>
                      Automatically track every {goalPeriod === 'week' ? 'week' : 'month'}
                    </Text>
                  </View>
                  <Switch
                    value={isRepeating}
                    onValueChange={setIsRepeating}
                    trackColor={{ false: theme.colors.border, true: theme.colors.primary + '80' }}
                    thumbColor={isRepeating ? theme.colors.primary : theme.colors.surface}
                  />
                </View>
              </View>

              <Pressable style={styles.primaryButton} onPress={handleCreateGoal}>
                <Ionicons name="add" size={18} color={theme.colors.text} />
                <Text style={styles.primaryButtonText}>Create budget</Text>
              </Pressable>
            </View>
          </View>

          <View style={[theme.components.surface, styles.goalsCard]}>
            <View style={styles.goalsHeader}>
              <View style={styles.flex}>
                <Text style={styles.goalsTitle}>Active Budgets</Text>
                <Text style={styles.goalsSubtitle}>
                  {budgetGoals.length} {budgetGoals.length === 1 ? "budget" : "budgets"} tracking
                </Text>
              </View>
              <View style={styles.goalsBadge}>
                <Ionicons name="stats-chart" size={16} color={theme.colors.primary} />
              </View>
            </View>

            {budgetsWithProgress.length > 0 ? (
              <View style={styles.goalsList}>
                {budgetsWithProgress.map((goal) => {
                  const category = categories.find((c) => c.name === goal.category);
                  const spending = goal.currentSpending ?? 0;
                  const progress = goal.progress ?? 0;
                  const remaining = Math.max(goal.target - spending, 0);
                  const isOverBudget = spending > goal.target;
                  
                  return (
                    <Pressable 
                      key={goal.id} 
                      style={styles.goalCard}
                      onPress={() => router.push(`/budgets/${goal.id}`)}
                    >
                      <View style={styles.goalCardHeader}>
                        <View style={styles.goalCardIcon}>
                          <Ionicons
                            name={toIconName(category?.icon)}
                            size={18}
                            color={theme.colors.text}
                          />
                        </View>
                        <View style={styles.goalCardInfo}>
                          <Text style={styles.goalCardName}>{goal.name}</Text>
                          <View style={styles.goalCardMeta}>
                            <View style={styles.goalMetaBadge}>
                              <Ionicons name="pricetag" size={11} color={theme.colors.textMuted} />
                              <Text style={styles.goalMetaText}>{goal.category}</Text>
                            </View>
                            <Text style={styles.goalMetaDivider}>•</Text>
                            <View style={styles.goalMetaBadge}>
                              <Ionicons name="calendar" size={11} color={theme.colors.textMuted} />
                              <Text style={styles.goalMetaText}>{goal.period}ly</Text>
                            </View>
                            {goal.isRepeating && (
                              <>
                                <Text style={styles.goalMetaDivider}>•</Text>
                                <View style={styles.goalMetaBadge}>
                                  <Ionicons name="repeat" size={11} color={theme.colors.textMuted} />
                                  <Text style={styles.goalMetaText}>Repeating</Text>
                                </View>
                              </>
                            )}
                          </View>
                        </View>
                        <Pressable
                          onPress={(e) => {
                            e.stopPropagation();
                            Alert.alert(
                              "Delete Budget",
                              `Are you sure you want to delete "${goal.name}"?`,
                              [
                                { text: "Cancel", style: "cancel" },
                                {
                                  text: "Delete",
                                  style: "destructive",
                                  onPress: () => void removeBudgetGoal(goal.id),
                                },
                              ]
                            );
                          }}
                          style={styles.deleteButton}
                        >
                          <Ionicons name="trash-outline" size={16} color={theme.colors.danger} />
                        </Pressable>
                      </View>

                      {/* Progress Section */}
                      <View style={styles.progressSection}>
                        <View style={styles.progressHeader}>
                          <Text style={styles.progressText}>
                            {currency}{spending.toFixed(2)} of {currency}{goal.target.toFixed(2)}
                          </Text>
                          <Text style={[styles.progressPercentage, isOverBudget && styles.progressPercentageOver]}>
                            {progress}%
                          </Text>
                        </View>
                        <View style={styles.progressBar}>
                          <View 
                            style={[
                              styles.progressFill, 
                              { width: `${Math.min(progress, 100)}%` },
                              isOverBudget ? styles.progressFillOver : styles.progressFillGood
                            ]} 
                          />
                        </View>
                        {isOverBudget ? (
                          <View style={styles.progressWarning}>
                            <Ionicons name="warning" size={14} color={theme.colors.danger} />
                            <Text style={styles.progressWarningText}>
                              Over budget by {currency}{(spending - goal.target).toFixed(2)}
                            </Text>
                          </View>
                        ) : (
                          <Text style={styles.progressRemaining}>
                            {currency}{remaining.toFixed(2)} remaining
                          </Text>
                        )}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <View style={styles.emptyState}>
                <View style={styles.emptyIconContainer}>
                  <Ionicons name="stats-chart-outline" size={48} color={theme.colors.textMuted} />
                </View>
                <Text style={styles.emptyStateTitle}>No budgets yet</Text>
                <Text style={styles.emptyStateText}>
                  Create your first budget above to start tracking spending by category.
                </Text>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={categoryModalVisible}
        animationType="slide"
        onRequestClose={() => {
          setCategoryModalVisible(false);
          setCategorySearch("");
        }}
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select category</Text>
            <Pressable
              onPress={() => {
                setCategoryModalVisible(false);
                setCategorySearch("");
              }}
              style={styles.modalClose}
            >
              <Ionicons name="close" size={24} color={theme.colors.text} />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.modalContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.categoryHeroCard}>
              <View style={styles.categoryHeroIcon}>
                <Ionicons name="pricetags" size={32} color={theme.colors.primary} />
              </View>
              <Text style={styles.categoryHeroTitle}>Pick a category</Text>
              <Text style={styles.categoryHeroSubtitle}>
                Choose which category to track with this budget
              </Text>
            </View>

            <View style={styles.categorySearchRow}>
              <Ionicons name="search" size={18} color={theme.colors.textMuted} />
              <TextInput
                value={categorySearch}
                onChangeText={setCategorySearch}
                placeholder="Search categories"
                placeholderTextColor={theme.colors.textMuted}
                style={styles.categorySearchInput}
              />
              {categorySearch ? (
                <Pressable onPress={() => setCategorySearch("")}>
                  <Ionicons name="close-circle" size={18} color={theme.colors.textMuted} />
                </Pressable>
              ) : null}
            </View>

            <View style={styles.categoryGroupGrid}>
              {groupedCategories.length === 0 ? (
                <Text style={styles.helperText}>No categories found.</Text>
              ) : (
                groupedCategories.map((group) => {
                  const iconName = toIconName(group.parent.icon);
                  const isSelected = selectedCategory?.id === group.parent.id;
                  return (
                    <View key={group.parent.id} style={styles.categoryGroupCard}>
                      <Pressable
                        style={styles.parentRow}
                        onPress={() => {
                          setSelectedCategory(group.parent);
                          setCategoryModalVisible(false);
                          setCategorySearch("");
                        }}
                      >
                        <View style={styles.parentAvatar}>
                          <Ionicons name={iconName} size={20} color={theme.colors.text} />
                        </View>
                        <View style={styles.flex}>
                          <Text style={styles.parentName}>{group.parent.name}</Text>
                          <Text style={styles.metaText}>Parent category</Text>
                        </View>
                        {isSelected ? (
                          <Ionicons name="checkmark-circle" size={22} color={theme.colors.primary} />
                        ) : (
                          <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
                        )}
                      </Pressable>

                      {group.children.length > 0 && (
                        <View style={styles.childrenList}>
                          {group.children.map((child, index) => {
                            const isLast = index === group.children.length - 1;
                            const childIcon = toIconName(child.icon);
                            const isChildSelected = selectedCategory?.id === child.id;
                            return (
                              <Pressable
                                key={child.id}
                                style={styles.childRow}
                                onPress={() => {
                                  setSelectedCategory(child);
                                  setCategoryModalVisible(false);
                                  setCategorySearch("");
                                }}
                              >
                                <View style={styles.connectorColumn}>
                                  <View style={[styles.connectorLine, isLast && styles.connectorLineEnd]} />
                                  <View style={styles.connectorDot} />
                                </View>
                                <View style={styles.childAvatar}>
                                  <Ionicons name={childIcon} size={16} color={theme.colors.text} />
                                </View>
                                <View style={styles.flex}>
                                  <Text style={styles.childName}>{child.name}</Text>
                                  <Text style={styles.metaText}>Child category</Text>
                                </View>
                                {isChildSelected ? (
                                  <Ionicons name="checkmark-circle" size={22} color={theme.colors.primary} />
                                ) : (
                                  <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
                                )}
                              </Pressable>
                            );
                          })}
                        </View>
                      )}
                    </View>
                  );
                })
              )}
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
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
      position: "relative",
    },
    backgroundAccent: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      height: 160,
      backgroundColor: `${theme.colors.primary}15`,
      borderBottomLeftRadius: 28,
      borderBottomRightRadius: 28,
    },
    flex: {
      flex: 1,
    },
    headerContainer: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
      paddingHorizontal: theme.screen.isSmallDevice ? theme.spacing.sm : theme.spacing.md,
      paddingTop: theme.screen.isSmallDevice ? theme.spacing.md : theme.spacing.lg,
      paddingBottom: theme.spacing.sm,
    },
    backButton: {
      padding: theme.spacing.xs,
    },
    headerText: {
      flex: 1,
    },
    title: {
      ...theme.typography.title,
      fontSize: theme.screen.isSmallDevice ? 20 : 24,
      fontWeight: "700",
    },
    subtitle: {
      ...theme.typography.subtitle,
      fontSize: 13,
      marginTop: 2,
    },
    content: {
      flexGrow: 1,
      paddingHorizontal: theme.screen.isSmallDevice ? theme.spacing.sm : theme.spacing.md,
      paddingBottom: theme.spacing.lg + insets.bottom,
      gap: theme.screen.isSmallDevice ? theme.spacing.sm : theme.spacing.md,
    },
    formCard: {
      overflow: "hidden",
    },
    formHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
      paddingBottom: theme.spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    formIconContainer: {
      width: 36,
      height: 36,
      borderRadius: theme.radii.md,
      backgroundColor: `${theme.colors.primary}22`,
      alignItems: "center",
      justifyContent: "center",
    },
    formTitle: {
      ...theme.typography.subtitle,
      fontSize: 16,
      fontWeight: "700",
    },
    formSubtitle: {
      fontSize: 12,
      color: theme.colors.textMuted,
      marginTop: 2,
    },
    formBody: {
      gap: theme.spacing.md,
      paddingTop: theme.spacing.sm,
    },
    fieldGroup: {
      gap: 6,
    },
    label: {
      ...theme.typography.label,
      fontSize: 13,
      fontWeight: "600",
      color: theme.colors.text,
    },
    input: {
      ...theme.components.input,
      fontSize: 15,
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
    },
    row: {
      flexDirection: "row",
      gap: theme.spacing.sm,
    },
    amountInputContainer: {
      ...theme.components.input,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
    },
    currencySymbol: {
      fontSize: 15,
      fontWeight: "600",
      color: theme.colors.textMuted,
    },
    amountInput: {
      flex: 1,
      fontSize: 15,
      color: theme.colors.text,
      padding: 0,
    },
    periodField: {
      minWidth: 140,
    },
    periodRow: {
      flexDirection: "row",
      gap: 6,
    },
    periodChip: {
      flex: 1,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: 6,
      borderRadius: theme.radii.pill,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    periodChipActive: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    periodChipText: {
      fontSize: 12,
      fontWeight: "600",
      color: theme.colors.textMuted,
    },
    periodChipTextActive: {
      color: theme.colors.text,
    },
    categorySelector: {
      ...theme.components.input,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
    },
    categorySelectorContent: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      flex: 1,
    },
    categoryIconSmall: {
      width: 28,
      height: 28,
      borderRadius: theme.radii.sm,
      backgroundColor: `${theme.colors.primary}22`,
      alignItems: "center",
      justifyContent: "center",
    },
    categorySelectorText: {
      fontSize: 15,
      color: theme.colors.text,
      fontWeight: "500",
    },
    categorySelectorPlaceholder: {
      fontSize: 15,
      color: theme.colors.textMuted,
    },
    primaryButton: {
      ...theme.components.buttonPrimary,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: theme.spacing.sm,
    },
    primaryButtonText: {
      ...theme.components.buttonPrimaryText,
    },
    goalsCard: {},
    goalsHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingBottom: theme.spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    goalsTitle: {
      ...theme.typography.subtitle,
      fontSize: 16,
      fontWeight: "700",
    },
    goalsSubtitle: {
      fontSize: 12,
      color: theme.colors.textMuted,
      marginTop: 2,
    },
    goalsBadge: {
      width: 34,
      height: 34,
      borderRadius: theme.radii.md,
      backgroundColor: `${theme.colors.primary}22`,
      alignItems: "center",
      justifyContent: "center",
    },
    goalsList: {
      gap: theme.spacing.sm,
      paddingTop: theme.spacing.sm,
    },
    goalCard: {
      padding: theme.spacing.sm,
      borderRadius: theme.radii.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      gap: theme.spacing.sm,
    },
    goalCardHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
    },
    goalCardIcon: {
      width: 36,
      height: 36,
      borderRadius: theme.radii.md,
      backgroundColor: `${theme.colors.primary}22`,
      alignItems: "center",
      justifyContent: "center",
    },
    goalCardInfo: {
      flex: 1,
      gap: 2,
    },
    goalCardName: {
      fontSize: 15,
      fontWeight: "600",
      color: theme.colors.text,
    },
    goalCardMeta: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    goalMetaBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
    },
    goalMetaText: {
      fontSize: 12,
      color: theme.colors.textMuted,
    },
    goalMetaDivider: {
      fontSize: 11,
      color: theme.colors.textMuted,
    },
    deleteButton: {
      width: 32,
      height: 32,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: theme.radii.md,
      borderWidth: 1,
      borderColor: theme.colors.danger,
    },
    goalCardTarget: {
      paddingTop: theme.spacing.sm,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    goalCardTargetLabel: {
      fontSize: 12,
      color: theme.colors.textMuted,
    },
    goalCardTargetAmount: {
      fontSize: 15,
      fontWeight: "600",
      color: theme.colors.text,
    },
    emptyState: {
      alignItems: "center",
      paddingVertical: theme.spacing.xl,
      gap: theme.spacing.sm,
    },
    emptyIconContainer: {
      width: 80,
      height: 80,
      borderRadius: theme.radii.lg,
      backgroundColor: `${theme.colors.primary}15`,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: theme.spacing.sm,
    },
    emptyStateTitle: {
      fontSize: 18,
      fontWeight: "600",
      color: theme.colors.text,
    },
    emptyStateText: {
      fontSize: 14,
      color: theme.colors.textMuted,
      textAlign: "center",
      maxWidth: 280,
      lineHeight: 20,
    },
    modal: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    modalHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    modalTitle: {
      ...theme.typography.title,
      fontSize: 20,
      fontWeight: "700",
    },
    modalClose: {
      padding: theme.spacing.xs,
    },
    modalContent: {
      flexGrow: 1,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.lg,
      gap: theme.spacing.lg,
    },
    categoryHeroCard: {
      alignItems: "center",
      gap: theme.spacing.sm,
      paddingVertical: theme.spacing.lg,
    },
    categoryHeroIcon: {
      width: 72,
      height: 72,
      borderRadius: theme.radii.lg,
      backgroundColor: `${theme.colors.primary}22`,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: theme.spacing.sm,
    },
    categoryHeroTitle: {
      fontSize: 22,
      fontWeight: "700",
      color: theme.colors.text,
    },
    categoryHeroSubtitle: {
      fontSize: 14,
      color: theme.colors.textMuted,
      textAlign: "center",
      maxWidth: 280,
    },
    categorySearchRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
      ...theme.components.input,
    },
    categorySearchInput: {
      flex: 1,
      fontSize: 16,
      color: theme.colors.text,
      padding: 0,
    },
    categoryGroupGrid: {
      gap: theme.spacing.md,
    },
    categoryGroupCard: {
      ...theme.components.surface,
      overflow: "hidden",
    },
    parentRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
    },
    parentAvatar: {
      width: 48,
      height: 48,
      borderRadius: theme.radii.lg,
      backgroundColor: `${theme.colors.primary}22`,
      alignItems: "center",
      justifyContent: "center",
    },
    parentName: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.text,
    },
    metaText: {
      fontSize: 12,
      color: theme.colors.textMuted,
      marginTop: 2,
    },
    childrenList: {
      paddingTop: theme.spacing.xs,
      paddingLeft: theme.spacing.md,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    childRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
      paddingVertical: theme.spacing.sm,
    },
    connectorColumn: {
      width: 20,
      alignItems: "center",
      position: "relative",
    },
    connectorLine: {
      position: "absolute",
      left: 9,
      top: 0,
      bottom: 0,
      width: 1,
      backgroundColor: theme.colors.border,
    },
    connectorLineEnd: {
      bottom: "50%",
    },
    connectorDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: theme.colors.border,
      zIndex: 1,
    },
    childAvatar: {
      width: 36,
      height: 36,
      borderRadius: theme.radii.md,
      backgroundColor: `${theme.colors.primary}15`,
      alignItems: "center",
      justifyContent: "center",
    },
    childName: {
      fontSize: 15,
      fontWeight: "500",
      color: theme.colors.text,
    },
    helperText: {
      fontSize: 14,
      color: theme.colors.textMuted,
      textAlign: "center",
      paddingVertical: theme.spacing.xl,
    },
    switchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing.md,
    },
    switchDescription: {
      fontSize: 12,
      color: theme.colors.textMuted,
      marginTop: 2,
    },
    progressSection: {
      paddingTop: theme.spacing.md,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
      gap: theme.spacing.xs,
    },
    progressHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 6,
    },
    progressText: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.colors.text,
    },
    progressPercentage: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.colors.primary,
    },
    progressPercentageOver: {
      color: theme.colors.danger,
    },
    progressBar: {
      height: 8,
      backgroundColor: theme.colors.border,
      borderRadius: theme.radii.pill,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      borderRadius: theme.radii.pill,
    },
    progressFillGood: {
      backgroundColor: theme.colors.success,
    },
    progressFillOver: {
      backgroundColor: theme.colors.danger,
    },
    progressRemaining: {
      fontSize: 12,
      color: theme.colors.textMuted,
      marginTop: 2,
    },
    progressWarning: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginTop: 2,
    },
    progressWarningText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.colors.danger,
    },
  });
