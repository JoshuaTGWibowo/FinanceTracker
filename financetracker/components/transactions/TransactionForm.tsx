import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
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
import dayjs from "dayjs";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { useRouter } from "expo-router";

import { useAppTheme } from "../../theme";
import { SUPPORTED_CURRENCIES, formatCurrency } from "../../lib/currency";
import {
  Category,
  DEFAULT_ACCOUNT_ID,
  DEFAULT_CATEGORIES,
  RecurringTransaction,
  Transaction,
  TransactionType,
  useFinanceStore,
} from "../../lib/store";
import { isCategoryActiveForAccount } from "../../lib/categoryUtils";
import { formatDate } from "../../lib/text";

interface TransactionFormProps {
  title: string;
  submitLabel: string;
  onCancel: () => void;
  onSubmit: (transaction: Omit<Transaction, "id">) => Promise<void> | void;
  initialValues?: Partial<Transaction>;
  enableRecurringOption?: boolean;
  onSubmitRecurring?: (
    transaction: Omit<Transaction, "id">,
    config: { frequency: RecurringTransaction["frequency"]; startDate: string },
  ) => Promise<void> | void;
}

const MAX_PHOTOS = 3;

type LocaleSeparators = {
  decimal: string;
  group: string;
};

const getLocaleSeparators = (): LocaleSeparators => {
  const formatter = new Intl.NumberFormat(undefined);

  if (typeof formatter.formatToParts !== "function") {
    return { decimal: ".", group: "," };
  }

  try {
    const parts = formatter.formatToParts(12345.6);
    const group = parts.find((part) => part.type === "group")?.value ?? ",";
    const decimal = parts.find((part) => part.type === "decimal")?.value ?? ".";
    return { decimal, group };
  } catch {
    return { decimal: ".", group: "," };
  }
};

const formatNumberForInput = (
  value: number,
  separators: LocaleSeparators,
  groupingFormatter: Intl.NumberFormat,
): string => {
  if (Number.isNaN(value)) {
    return "";
  }

  const fixed = value.toString();
  const [integerPart, decimalPart] = fixed.split(".");
  const groupedInteger = groupingFormatter.format(Number(integerPart));

  if (decimalPart && decimalPart.length > 0) {
    return `${groupedInteger}${separators.decimal}${decimalPart}`;
  }

  return groupedInteger;
};

const formatRawAmountInput = (
  rawValue: string,
  separators: LocaleSeparators,
  groupingFormatter: Intl.NumberFormat,
): string => {
  const trimmed = rawValue.replace(/[\s']/g, "");
  if (!trimmed) {
    return "";
  }

  const sanitized = trimmed.replace(/[^0-9.,]/g, "");
  if (!sanitized) {
    return "";
  }

  const endsWithSeparator = /[.,]$/.test(trimmed);
  const groupingRegex = new RegExp(`\\${separators.group}`, "g");
  const normalized = sanitized.replace(groupingRegex, "");
  const lastSeparatorIndex = Math.max(normalized.lastIndexOf("."), normalized.lastIndexOf(","));

  let integerPartRaw = normalized;
  let decimalPartRaw = "";
  let hasDecimalSeparator = false;

  if (lastSeparatorIndex !== -1) {
    hasDecimalSeparator = true;
    integerPartRaw = normalized.slice(0, lastSeparatorIndex);
    decimalPartRaw = normalized.slice(lastSeparatorIndex + 1).replace(/[^0-9]/g, "");
  }

  const integerDigits = integerPartRaw.replace(/[^0-9]/g, "");

  if (!integerDigits) {
    if (decimalPartRaw) {
      return `0${separators.decimal}${decimalPartRaw}`;
    }
    return endsWithSeparator ? `0${separators.decimal}` : "";
  }

  const groupedInteger = groupingFormatter.format(Number(integerDigits));

  if (decimalPartRaw) {
    return `${groupedInteger}${separators.decimal}${decimalPartRaw}`;
  }

  if (endsWithSeparator) {
    return `${groupedInteger}${separators.decimal}`;
  }

  if (!hasDecimalSeparator && sanitized.endsWith(separators.group)) {
    return `${groupedInteger}${separators.decimal}`;
  }

  return groupedInteger;
};

const parseAmountInput = (rawValue: string): number => {
  const sanitized = rawValue
    .replace(/[\s']/g, "")
    .replace(/[^0-9,.-]/g, "");
  if (!sanitized) {
    return Number.NaN;
  }

  const hasComma = sanitized.includes(",");
  const hasDot = sanitized.includes(".");
  let normalized = sanitized;

  if (hasComma && hasDot) {
    const lastComma = sanitized.lastIndexOf(",");
    const lastDot = sanitized.lastIndexOf(".");
    const decimalSeparator = lastComma > lastDot ? "," : ".";
    const thousandSeparator = decimalSeparator === "," ? "." : ",";
    const thousandPattern = new RegExp(`\\${thousandSeparator}`, "g");
    normalized = normalized.replace(thousandPattern, "");
    if (decimalSeparator === ",") {
      normalized = normalized.replace(/,/g, ".");
    }
  } else if (hasComma) {
    const parts = sanitized.split(",");
    // A comma is a decimal separator if:
    // - There are exactly 2 parts AND
    // - The decimal part has 1-2 digits (e.g., "100,5" or "100,50")
    // - OR the decimal part has exactly 3 digits BUT the integer part is 1-2 digits (e.g., "1,500" could be 1.5 but "100,500" is 100500)
    const isDecimalCandidate =
      parts.length === 2 &&
      (parts[1].length <= 2 || (parts[1].length === 3 && parts[0].length <= 2));

    normalized = isDecimalCandidate ? sanitized.replace(/,/g, ".") : sanitized.replace(/,/g, "");
  } else if (hasDot) {
    const parts = sanitized.split(".");
    // A dot is a decimal separator if:
    // - There are exactly 2 parts AND
    // - The decimal part has 1-2 digits (e.g., "100.5" or "100.50")
    // - OR the decimal part has exactly 3 digits BUT the integer part is 1-2 digits (e.g., "1.500" could be 1.5 but "100.500" is 100500)
    const isDecimalCandidate =
      parts.length === 2 &&
      (parts[1].length <= 2 || (parts[1].length === 3 && parts[0].length <= 2));
    normalized = isDecimalCandidate ? sanitized : sanitized.replace(/\./g, "");
  }

  const value = Number(normalized);
  if (Number.isNaN(value)) {
    return Number.NaN;
  }

  const decimalPart = normalized.split(".")[1];
  if (decimalPart && decimalPart.length > 2) {
    return Math.round(value * 100) / 100;
  }

  return value;
};

const recurringOptions: { label: string; value: RecurringTransaction["frequency"] }[] = [
  { label: "Weekly", value: "weekly" },
  { label: "Bi-weekly", value: "biweekly" },
  { label: "Monthly", value: "monthly" },
];

const toIconName = (value?: string | null) =>
  (value as keyof typeof Ionicons.glyphMap) || ("pricetag" as keyof typeof Ionicons.glyphMap);

export function TransactionForm({
  title,
  submitLabel,
  onCancel,
  onSubmit,
  initialValues,
  enableRecurringOption = false,
  onSubmitRecurring,
}: TransactionFormProps) {
  const router = useRouter();
  const theme = useAppTheme();
  const dateFormat = useFinanceStore((state) => state.preferences.dateFormat);
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(theme, insets), [theme, insets]);
  const currency = useFinanceStore((state) => state.profile.currency);
  const accounts = useFinanceStore((state) => state.accounts);
  const categories = useFinanceStore((state) => state.preferences.categories);
  const availableCategories = categories.length ? categories : DEFAULT_CATEGORIES;
  const activeAccounts = useMemo(() => accounts.filter((account) => !account.isArchived), [accounts]);
  const getSuggestedCategoryForAmount = useFinanceStore((state) => state.getSuggestedCategoryForAmount);
  const stickyDate = useFinanceStore((state) => state.stickyDate);
  const stickyDateLastUsed = useFinanceStore((state) => state.stickyDateLastUsed);
  const setStickyDate = useFinanceStore((state) => state.setStickyDate);

  const isCategoryActiveInAccount = (category: Category, accountIdValue: string) =>
    isCategoryActiveForAccount(category, accountIdValue, activeAccounts);

  const findInitialCategory = () => {
    if (!initialValues?.category) {
      return null;
    }

    return (
      availableCategories.find(
        (category) =>
          category.name === initialValues.category &&
          (!initialValues.type || category.type === initialValues.type),
      ) ?? null
    );
  };

  const separators = useMemo(() => getLocaleSeparators(), []);
  const groupingFormatter = useMemo(
    () => new Intl.NumberFormat(undefined, { useGrouping: true, maximumFractionDigits: 0 }),
    [],
  );

  const [amount, setAmount] = useState(() =>
    initialValues?.amount !== undefined
      ? formatNumberForInput(initialValues.amount, separators, groupingFormatter)
      : "",
  );
  const [note, setNote] = useState(initialValues?.note ?? "");
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(findInitialCategory);
  const normalizeCategoryType = (type?: Category["type"] | "transfer"): TransactionType =>
    type === "income" ? "income" : type === "transfer" ? "transfer" : "expense";
  const [transactionType, setTransactionType] = useState<TransactionType>(() => {
    if (initialValues?.type) {
      return initialValues.type;
    }
    const initialCategory = findInitialCategory();
    return normalizeCategoryType(initialCategory?.type) as TransactionType;
  });
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [categorySearch, setCategorySearch] = useState("");
  const [date, setDate] = useState(() => {
    if (initialValues?.date) {
      const base = new Date(initialValues.date);
      base.setHours(0, 0, 0, 0);
      return base;
    }
    // Check if we should use sticky date (within 2 minutes)
    const now = Date.now();
    if (stickyDate && stickyDateLastUsed && (now - stickyDateLastUsed) < 2 * 60 * 1000) {
      const stickyDateObj = new Date(stickyDate);
      stickyDateObj.setHours(0, 0, 0, 0);
      return stickyDateObj;
    }
    const base = new Date();
    base.setHours(0, 0, 0, 0);
    return base;
  });
  const [detailsExpanded, setDetailsExpanded] = useState(() =>
    Boolean(
      initialValues?.participants?.length ||
        initialValues?.location ||
        initialValues?.photos?.length ||
        initialValues?.excludeFromReports,
    ),
  );
  const [participants, setParticipants] = useState<string[]>(initialValues?.participants ?? []);
  const [participantDraft, setParticipantDraft] = useState("");
  const [location, setLocation] = useState(initialValues?.location ?? "");
  const [photos, setPhotos] = useState<string[]>(initialValues?.photos ?? []);
  const [excludeFromReports, setExcludeFromReports] = useState(
    Boolean(initialValues?.excludeFromReports),
  );
  const [accountId, setAccountId] = useState(initialValues?.accountId ?? DEFAULT_ACCOUNT_ID);
  const [toAccountId, setToAccountId] = useState<string | null>(initialValues?.toAccountId ?? null);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringFrequency, setRecurringFrequency] = useState<
    RecurringTransaction["frequency"]
  >("monthly");
  const [accountPickerVisible, setAccountPickerVisible] = useState(false);
  const [toAccountPickerVisible, setToAccountPickerVisible] = useState(false);
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [currencyPickerVisible, setCurrencyPickerVisible] = useState(false);
  
  // Currency state - defaults to transaction's saved currency, or account's currency, or profile currency
  const getDefaultCurrency = () => {
    if (initialValues?.currency) {
      return initialValues.currency;
    }
    const selectedAccountId = initialValues?.accountId ?? DEFAULT_ACCOUNT_ID;
    const selectedAccount = accounts.find((acc) => acc.id === selectedAccountId);
    return selectedAccount?.currency ?? currency;
  };
  const [transactionCurrency, setTransactionCurrency] = useState(getDefaultCurrency);

  const inheritedCategory = useMemo(() => {
    if (!initialValues?.category) {
      return undefined;
    }

    if (!initialValues?.type) {
      return initialValues.category;
    }

    return initialValues.type === transactionType ? initialValues.category : undefined;
  }, [initialValues?.category, initialValues?.type, transactionType]);

  useEffect(() => {
    if (initialValues?.amount !== undefined) {
      setAmount(formatNumberForInput(initialValues.amount, separators, groupingFormatter));
    } else {
      setAmount("");
    }
  }, [groupingFormatter, initialValues?.amount, separators]);

  useEffect(() => {
    if (!enableRecurringOption) {
      setIsRecurring(false);
    }
  }, [enableRecurringOption]);

  useEffect(() => {
    if (transactionType === "transfer") {
      return;
    }

    if (selectedCategory) {
      const derivedType = normalizeCategoryType(selectedCategory.type);
      if (derivedType !== transactionType) {
        setTransactionType(derivedType);
      }
    }
  }, [selectedCategory, transactionType]);

  useEffect(() => {
    if (transactionType !== "transfer" && toAccountId) {
      setToAccountId(null);
    }
  }, [transactionType, toAccountId]);

  useEffect(() => {
    if (selectedCategory && !isCategoryActiveInAccount(selectedCategory, accountId)) {
      setSelectedCategory(null);
    }
  }, [accountId, activeAccounts, isCategoryActiveInAccount, selectedCategory]);

  const groupedCategories = useMemo(() => {
    const query = categorySearch.trim().toLowerCase();
    const matchesSearch = (category: Category) =>
      query ? category.name.toLowerCase().includes(query) : true;

    const candidates = availableCategories
      .filter((category) => normalizeCategoryType(category.type) === transactionType)
      .filter((category) => (accountId ? isCategoryActiveInAccount(category, accountId) : true));

    const childrenMap = new Map<string, Category[]>();

    candidates.forEach((category) => {
      if (category.parentCategoryId) {
        const children = childrenMap.get(category.parentCategoryId) ?? [];
        children.push(category);
        childrenMap.set(category.parentCategoryId, children);
      }
    });

    const parents = candidates.filter((category) => !category.parentCategoryId);
    const orphans = candidates.filter(
      (category) => category.parentCategoryId && !parents.find((parent) => parent.id === category.parentCategoryId),
    );

    return [
      ...parents.map((parent) => ({ parent, children: childrenMap.get(parent.id) ?? [] })),
      ...orphans.map((parent) => ({ parent, children: [] })),
    ]
      .map((group) => {
        const visibleChildren = query ? group.children.filter((child) => matchesSearch(child)) : group.children;
        return {
          ...group,
          children: visibleChildren,
          visible: matchesSearch(group.parent) || visibleChildren.length > 0,
        };
      })
      .filter((group) => group.visible)
      .sort((a, b) => a.parent.name.localeCompare(b.parent.name));
  }, [accountId, availableCategories, categorySearch, isCategoryActiveInAccount, transactionType]);

  const handleNoteChange = (value: string) => {
    const words = value
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    if (!value.trim()) {
      setNote(value);
      return;
    }

    if (words.length <= 100) {
      setNote(value);
      return;
    }

    const limited = words.slice(0, 100).join(" ");
    setNote(limited);
  };

  const handleAddParticipant = () => {
    const value = participantDraft.trim();
    if (!value) {
      return;
    }

    setParticipants((prev) => (prev.includes(value) ? prev : [...prev, value]));
    setParticipantDraft("");
  };

  const handleRemoveParticipant = (person: string) => {
    setParticipants((prev) => prev.filter((item) => item !== person));
  };

  const handlePickPhoto = async () => {
    if (photos.length >= MAX_PHOTOS) {
      Alert.alert(
        "Photo limit reached",
        `You can attach up to ${MAX_PHOTOS} photos per transaction.`,
      );
      return;
    }

    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Permission needed", "We need gallery access to add a receipt photo.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        allowsMultipleSelection: false,
        mediaTypes: ['images'] as unknown as ImagePicker.MediaTypeOptions,
        quality: 0.7,
      });

      if (!result.canceled && result.assets.length > 0) {
        const asset = result.assets[0];
        if (asset.uri) {
          setPhotos((prev) => [...prev, asset.uri]);
        }
      }
    } catch (error) {
      console.error(error);
      Alert.alert("Something went wrong", "We couldn't open the photo library just now.");
    }
  };

  const handleRemovePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
  };

  const handleChangeType = (nextType: TransactionType) => {
    const wasTransfer = transactionType === "transfer";
    setTransactionType(nextType);
    
    if (nextType === "transfer") {
      setSelectedCategory(null);
      return;
    }

    // Switching from transfer to expense/income - clear category
    if (wasTransfer) {
      setSelectedCategory(null);
    }

    if (selectedCategory && normalizeCategoryType(selectedCategory.type) !== nextType) {
      setSelectedCategory(null);
    }
  };

  const handleAmountChange = useCallback(
    (value: string) => {
      setAmount(formatRawAmountInput(value, separators, groupingFormatter));
      
      // Check for suggested category based on amount
      const parsedAmount = parseAmountInput(value);
      if (!Number.isNaN(parsedAmount) && parsedAmount > 0 && transactionType !== "transfer") {
        const suggestedCategoryName = getSuggestedCategoryForAmount(parsedAmount, transactionType);
        if (suggestedCategoryName && !selectedCategory) {
          // Find the category object
          const categoryObj = availableCategories.find(
            (cat) => cat.name === suggestedCategoryName && cat.type === transactionType
          );
          if (categoryObj) {
            setSelectedCategory(categoryObj);
          }
        }
      }
    },
    [groupingFormatter, separators, transactionType, getSuggestedCategoryForAmount, selectedCategory, availableCategories],
  );

  const handleOpenCreateCategory = () => {
    const categoryType = transactionType === "income" ? "income" : "expense";
    setCategoryModalVisible(false);
    setCategorySearch("");
    router.push(`/categories/new?type=${categoryType}`);
  };

  const handleSubmit = async () => {
    const parsedAmount = parseAmountInput(amount);

    if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      Alert.alert("Hold up", "Enter a positive amount to continue.");
      return;
    }

    if (!accountId) {
      Alert.alert("Select an account", "Pick where this transaction should be recorded.");
      return;
    }

    if (transactionType !== "transfer" && !selectedCategory) {
      Alert.alert("Choose a category", "Pick a category to classify this transaction.");
      return;
    }

    if (transactionType === "transfer") {
      if (!toAccountId) {
        Alert.alert("Need a destination", "Pick which account you're moving money to.");
        return;
      }

      if (toAccountId === accountId) {
        Alert.alert("Check accounts", "Source and destination accounts must be different.");
        return;
      }
    }

    const trimmedNote = note.trim();
    const cleanedParticipants = participants.map((person) => person.trim()).filter(Boolean);
    const cleanedPhotos = photos.filter(Boolean);

    const transferCategory = initialValues?.type === "transfer" ? initialValues?.category : undefined;
    const resolvedCategory =
      transactionType === "transfer"
        ? transferCategory || "Transfer"
        : selectedCategory?.name ?? inheritedCategory ?? "General";
    const fallbackNote =
      transactionType === "transfer"
        ? "Transfer"
        : transactionType === "expense"
          ? "Expense"
          : "Income";

    const payload: Omit<Transaction, "id"> = {
      amount: parsedAmount,
      note: trimmedNote || fallbackNote,
      category: resolvedCategory,
      type: transactionType === "transfer" ? "transfer" : normalizeCategoryType(selectedCategory?.type) ?? transactionType,
      date: date.toISOString(),
      currency: transactionCurrency,
      participants: cleanedParticipants,
      location: location.trim() || undefined,
      photos: cleanedPhotos,
      excludeFromReports,
      accountId,
      toAccountId: transactionType === "transfer" ? toAccountId : null,
    };

    await onSubmit(payload);

    if (enableRecurringOption && isRecurring && onSubmitRecurring) {
      await onSubmitRecurring(payload, {
        frequency: recurringFrequency,
        startDate: date.toISOString(),
      });
    }
    
    // Refresh sticky date timer if we're using a non-today date
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (date.getTime() !== today.getTime()) {
      setStickyDate(date.toISOString());
    }
  };

  const handleDateChange = (direction: 'prev' | 'next') => {
    const newDate = new Date(date);
    if (direction === 'prev') {
      newDate.setDate(newDate.getDate() - 1);
    } else {
      newDate.setDate(newDate.getDate() + 1);
    }
    newDate.setHours(0, 0, 0, 0);
    setDate(newDate);
    
    // Update sticky date if it's not today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (newDate.getTime() !== today.getTime()) {
      setStickyDate(newDate.toISOString());
    } else {
      setStickyDate(null);
    }
  };

  const isFormValid = useMemo(() => {
    const parsedAmount = parseAmountInput(amount);
    if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      return false;
    }
    if (!accountId) {
      return false;
    }
    if (transactionType === "transfer") {
      return Boolean(toAccountId && toAccountId !== accountId);
    }
    return Boolean(selectedCategory);
  }, [amount, accountId, transactionType, selectedCategory, toAccountId]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={insets.top}
      >
        <View style={styles.header}>
          <Pressable onPress={onCancel} accessibilityRole="button">
            <Text style={styles.cancelButton}>Cancel</Text>
          </Pressable>
          <Text style={styles.title}>{title}</Text>
          <Pressable
            style={styles.autoAddButton}
            onPress={() => router.push('/transactions/auto-add')}
            accessibilityRole="button"
            accessibilityLabel="Auto add transaction from receipt"
          >
            <Ionicons name="sparkles" size={20} color={theme.colors.primary} />
          </Pressable>
        </View>

        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.content}
          contentInsetAdjustmentBehavior="automatic"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Type Tabs */}
          <View style={styles.typeTabsContainer}>
            {(["expense", "income", "transfer"] as TransactionType[]).map((typeOption) => {
              const active = transactionType === typeOption;
              return (
                <Pressable
                  key={typeOption}
                  style={styles.typeTab(active)}
                  onPress={() => handleChangeType(typeOption)}
                >
                  <Text style={styles.typeTabText(active)}>
                    {typeOption === "expense"
                      ? "Expense"
                      : typeOption === "income"
                        ? "Income"
                        : "Transfer"}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Main Transaction Card */}
          <View style={styles.mainCard}>
            {/* Account Row */}
            <Pressable
              style={styles.compactRow}
              onPress={() => setAccountPickerVisible(true)}
            >
              <View style={styles.compactRowIcon}>
                <Ionicons name="wallet" size={20} color={theme.colors.primary} />
              </View>
              <Text style={styles.compactRowText}>
                {activeAccounts.find((acc) => acc.id === accountId)?.name || "Select account"}
              </Text>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
            </Pressable>

            {/* Amount Row */}
            <View style={styles.amountRow}>
            <Pressable 
              style={styles.currencyBadge}
              onPress={() => setCurrencyPickerVisible(true)}
            >
              <Text style={styles.currencyText}>{transactionCurrency}</Text>
              <Ionicons name="chevron-down" size={14} color={theme.colors.text} />
            </Pressable>
            <TextInput
              value={amount}
              onChangeText={handleAmountChange}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={theme.colors.textMuted}
              style={styles.amountInput}
            />
          </View>

          {/* Category Row */}
          {transactionType !== "transfer" && (
            <Pressable
              style={styles.compactRow}
              onPress={() => setCategoryModalVisible(true)}
              accessibilityRole="button"
            >
              <View style={styles.compactRowIcon}>
                {selectedCategory ? (
                  <Ionicons
                    name={toIconName(selectedCategory.icon)}
                    size={20}
                    color={theme.colors.text}
                  />
                ) : (
                  <View style={styles.emptyCategoryIcon} />
                )}
              </View>
              <Text style={styles.compactRowText}>
                {selectedCategory ? selectedCategory.name : "Select category"}
              </Text>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
            </Pressable>
          )}

          {/* To Account Row for Transfer */}
          {transactionType === "transfer" && (
            <Pressable
              style={styles.compactRow}
              onPress={() => setToAccountPickerVisible(true)}
            >
              <View style={styles.compactRowIcon}>
                <Ionicons name="arrow-forward" size={20} color={theme.colors.success} />
              </View>
              <View style={styles.toAccountLabel}>
                <Text style={styles.toAccountLabelText}>To account</Text>
                <Text style={styles.compactRowText}>
                  {toAccountId 
                    ? activeAccounts.find((acc) => acc.id === toAccountId)?.name || "Select account"
                    : "Choose a destination account"}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
            </Pressable>
          )}

          {/* Note Row */}
          <Pressable
            style={styles.compactRow}
            onPress={() => {
              // For now just focus on the note field
            }}
          >
            <View style={styles.compactRowIcon}>
              <Ionicons name="menu" size={20} color={theme.colors.textMuted} />
            </View>
            <TextInput
              value={note}
              onChangeText={handleNoteChange}
              placeholder="Note"
              placeholderTextColor={theme.colors.textMuted}
              style={styles.noteInputCompact}
            />
            <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
          </Pressable>

            {/* Date Row with Navigation */}
            <View style={styles.dateRow}>
              <Pressable
                style={styles.dateNavButton}
                onPress={() => handleDateChange('prev')}
              >
                <Ionicons name="chevron-back" size={20} color={theme.colors.text} />
              </Pressable>
              <Pressable
                style={styles.dateCenterButton}
                onPress={() => setCalendarVisible(true)}
              >
                <Ionicons name="calendar-outline" size={20} color={theme.colors.textMuted} />
                <Text style={styles.dateTextCompact}>{dayjs(date).format("dddd")}, {formatDate(date, dateFormat)}</Text>
              </Pressable>
              <Pressable
                style={styles.dateNavButton}
                onPress={() => handleDateChange('next')}
              >
                <Ionicons name="chevron-forward" size={20} color={theme.colors.text} />
              </Pressable>
            </View>
          </View>

          {/* Add More Details Button */}
          <Pressable
            style={styles.addMoreButton}
            onPress={() => setDetailsExpanded((prev) => !prev)}
          >
            <Text style={styles.addMoreButtonText}>Add more details</Text>
          </Pressable>

          {detailsExpanded && (
            <View style={styles.detailsSection}>
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>With (optional)</Text>
                <View style={styles.participantRow}>
                  <TextInput
                    value={participantDraft}
                    onChangeText={setParticipantDraft}
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
                {participants.length > 0 && (
                  <View style={styles.participantChips}>
                    {participants.map((person) => (
                      <View key={person} style={styles.participantChip}>
                        <Text style={styles.participantChipText}>{person}</Text>
                        <Pressable
                          onPress={() => handleRemoveParticipant(person)}
                          style={styles.removeChip}
                        >
                          <Ionicons name="close" size={12} color={theme.colors.text} />
                        </Pressable>
                      </View>
                    ))}
                  </View>
                )}
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Location (optional)</Text>
                <TextInput
                  value={location}
                  onChangeText={setLocation}
                  placeholder="Add where this happened"
                  placeholderTextColor={theme.colors.textMuted}
                  style={styles.input}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Photos (optional)</Text>
                <View style={styles.photoRow}>
                  {photos.map((uri, index) => (
                    <View key={`${uri}-${index}`} style={styles.photoPreview}>
                      <Image source={{ uri }} style={styles.photoImage} contentFit="cover" />
                      <Pressable
                        onPress={() => handleRemovePhoto(index)}
                        style={styles.removePhotoButton}
                      >
                        <Ionicons name="close" size={14} color={theme.colors.text} />
                      </Pressable>
                    </View>
                  ))}
                  {photos.length < MAX_PHOTOS && (
                    <Pressable style={styles.photoAddButton} onPress={handlePickPhoto}>
                      <Ionicons name="image" size={22} color={theme.colors.textMuted} />
                      <Text style={styles.photoAddText}>Upload</Text>
                      <Text style={styles.photoLimit}>{`${photos.length}/${MAX_PHOTOS}`}</Text>
                    </Pressable>
                  )}
                </View>
              </View>

              <View style={styles.excludeRow}>
                <View style={styles.flex}>
                  <Text style={styles.label}>Exclude from reports</Text>
                  <Text style={styles.helperText}>
                    Keep this transaction visible in the log but out of summaries.
                  </Text>
                </View>
                <Switch
                  value={excludeFromReports}
                  onValueChange={setExcludeFromReports}
                  thumbColor={excludeFromReports ? theme.colors.primary : theme.colors.surface}
                  trackColor={{ true: `${theme.colors.primary}55`, false: theme.colors.border }}
                />
              </View>

              {enableRecurringOption && (
                <>
                  <View style={styles.sectionDivider} />
                  <View style={styles.recurringSection}>
                    <View style={styles.recurringHeader}>
                      <View style={styles.flex}>
                        <Text style={styles.label}>Make recurring</Text>
                        <Text style={styles.helperText}>
                          Repeat this transaction automatically on a schedule.
                        </Text>
                      </View>
                      <Switch
                        value={isRecurring}
                        onValueChange={setIsRecurring}
                        thumbColor={isRecurring ? theme.colors.primary : theme.colors.surface}
                        trackColor={{ true: `${theme.colors.primary}55`, false: theme.colors.border }}
                      />
                    </View>

                    {isRecurring && (
                      <View style={styles.recurringBody}>
                        <Text style={styles.label}>Repeats</Text>
                        <View style={styles.frequencyRow}>
                          {recurringOptions.map((option) => {
                            const active = recurringFrequency === option.value;
                            return (
                              <Pressable
                                key={option.value}
                                style={styles.frequencyPill(active)}
                                onPress={() => setRecurringFrequency(option.value)}
                              >
                                <Text style={styles.frequencyPillText(active)}>{option.label}</Text>
                              </Pressable>
                            );
                          })}
                        </View>
                      </View>
                    )}
                  </View>
                </>
              )}
            </View>
          )}
        </ScrollView>

        <Pressable 
          style={styles.submitButton(isFormValid)} 
          onPress={handleSubmit}
          disabled={!isFormValid}
        >
          <Text style={styles.submitButtonText(isFormValid)}>{submitLabel}</Text>
        </Pressable>
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
              accessibilityRole="button"
            >
              <Ionicons name="close" size={20} color={theme.colors.text} />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.modalContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.categoryHeroCard}>
              <View style={styles.categoryHeroBadge}>
                <Ionicons
                  name={transactionType === "income" ? "arrow-down-circle" : "arrow-up-circle"}
                  size={18}
                  color={theme.colors.text}
                />
                <Text style={styles.categoryHeroBadgeText}>
                  {transactionType === "income" ? "Income" : "Expense"}
                </Text>
              </View>
              <Text style={styles.categoryHeroTitle}>Pick the best fit</Text>
              <Text style={styles.helperText}>
                Categories shown here respect the wallet you&apos;re using.
              </Text>
            </View>

            <View style={styles.categorySearchRow}>
              <Ionicons name="search" size={16} color={theme.colors.textMuted} />
              <TextInput
                value={categorySearch}
                onChangeText={setCategorySearch}
                placeholder="Search categories"
                placeholderTextColor={theme.colors.textMuted}
                style={styles.categorySearchInput}
              />
              {categorySearch ? (
                <Pressable onPress={() => setCategorySearch("")}>
                  <Ionicons name="close" size={16} color={theme.colors.textMuted} />
                </Pressable>
              ) : null}
            </View>

            <Pressable
              style={styles.addCategoryButton}
              onPress={handleOpenCreateCategory}
              accessibilityRole="button"
            >
              <View style={styles.addCategoryIcon}>
                <Ionicons name="add-circle" size={20} color={theme.colors.primary} />
              </View>
              <Text style={styles.addCategoryText}>Add New Category</Text>
              <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
            </Pressable>

            <View style={styles.categoryGroupGrid}>
              {groupedCategories.length === 0 ? (
                <Text style={styles.helperText}>No categories available yet.</Text>
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
                          <Ionicons name={iconName} size={18} color={theme.colors.text} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.parentName}>{group.parent.name}</Text>
                          <Text style={styles.metaText}>Tap to choose this category</Text>
                        </View>
                        {isSelected ? (
                          <Ionicons name="checkmark-circle" size={18} color={theme.colors.primary} />
                        ) : (
                          <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
                        )}
                      </Pressable>

                      {group.children.length > 0 ? (
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
                                  <Ionicons name={childIcon} size={14} color={theme.colors.text} />
                                </View>
                                <View style={{ flex: 1 }}>
                                  <Text style={styles.childName}>{child.name}</Text>
                                  <Text style={styles.metaText}>Child category</Text>
                                </View>
                                {isChildSelected ? (
                                  <Ionicons name="checkmark-circle" size={18} color={theme.colors.primary} />
                                ) : (
                                  <Ionicons name="chevron-forward" size={16} color={theme.colors.textMuted} />
                                )}
                              </Pressable>
                            );
                          })}
                        </View>
                      ) : null}
                    </View>
                  );
                })
              )}
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <Modal
        visible={accountPickerVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setAccountPickerVisible(false)}
      >
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select account</Text>
            <Pressable
              onPress={() => setAccountPickerVisible(false)}
              style={styles.modalClose}
              accessibilityRole="button"
            >
              <Ionicons name="close" size={20} color={theme.colors.text} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.modalContent}>
            {activeAccounts.map((account) => {
              const active = account.id === accountId;
              const balance = account.balance || 0;
              return (
                <Pressable
                  key={account.id}
                  style={styles.accountRow(active)}
                  onPress={() => {
                    setAccountId(account.id);
                    // Update transaction currency to match the new account's currency
                    setTransactionCurrency(account.currency ?? currency);
                    setAccountPickerVisible(false);
                  }}
                >
                  <View style={styles.accountIconWrapper}>
                    <Ionicons name="wallet" size={20} color={theme.colors.text} />
                  </View>
                  <View style={styles.accountInfo}>
                    <Text style={styles.accountName}>{account.name}</Text>
                    <Text style={styles.accountMeta}>
                      {account.type.charAt(0).toUpperCase() + account.type.slice(1)} • {formatCurrency(
                        balance,
                        account.currency ?? currency,
                      )}
                    </Text>
                  </View>
                  {active && <Ionicons name="checkmark-circle" size={20} color={theme.colors.primary} />}
                </Pressable>
              );
            })}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <Modal
        visible={toAccountPickerVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setToAccountPickerVisible(false)}
      >
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select destination account</Text>
            <Pressable
              onPress={() => setToAccountPickerVisible(false)}
              style={styles.modalClose}
              accessibilityRole="button"
            >
              <Ionicons name="close" size={20} color={theme.colors.text} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.modalContent}>
            {activeAccounts
              .filter((acc) => acc.id !== accountId)
              .map((account) => {
                const active = account.id === toAccountId;
                const balance = account.balance || 0;
                return (
                  <Pressable
                    key={account.id}
                    style={styles.accountRow(active)}
                    onPress={() => {
                      setToAccountId(account.id);
                      setToAccountPickerVisible(false);
                    }}
                  >
                    <View style={styles.accountIconWrapper}>
                      <Ionicons name="wallet" size={20} color={theme.colors.text} />
                    </View>
                    <View style={styles.accountInfo}>
                      <Text style={styles.accountName}>{account.name}</Text>
                      <Text style={styles.accountMeta}>
                        {account.type.charAt(0).toUpperCase() + account.type.slice(1)} • {formatCurrency(
                          balance,
                          account.currency ?? currency,
                        )}
                      </Text>
                    </View>
                    {active && <Ionicons name="checkmark-circle" size={20} color={theme.colors.primary} />}
                  </Pressable>
                );
              })}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {calendarVisible && (
        <View style={styles.calendarOverlay}>
          <Pressable
            style={styles.calendarBackdrop}
            onPress={() => setCalendarVisible(false)}
          />
          <View style={styles.calendarCard}>
            <View style={styles.calendarHeader}>
              <Text style={styles.calendarTitle}>Select date</Text>
              <Pressable
                onPress={() => setCalendarVisible(false)}
                style={styles.calendarCloseButton}
              >
                <Ionicons name="close" size={20} color={theme.colors.text} />
              </Pressable>
            </View>
            <DateTimePicker
              value={date}
              mode="date"
              display="inline"
              onChange={(_, selectedDate) => {
                if (selectedDate) {
                  const next = new Date(selectedDate);
                  next.setHours(0, 0, 0, 0);
                  setDate(next);
                  setCalendarVisible(false);
                  
                  // Update sticky date if it's not today
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  if (next.getTime() !== today.getTime()) {
                    setStickyDate(next.toISOString());
                  } else {
                    setStickyDate(null);
                  }
                }
              }}
              themeVariant={theme.colors.background === "#050608" ? "dark" : "light"}
            />
          </View>
        </View>
      )}

      {/* Currency Picker Modal */}
      <Modal
        visible={currencyPickerVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setCurrencyPickerVisible(false)}
      >
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select currency</Text>
            <Pressable
              onPress={() => setCurrencyPickerVisible(false)}
              style={styles.modalClose}
              accessibilityRole="button"
            >
              <Ionicons name="close" size={20} color={theme.colors.text} />
            </Pressable>
          </View>
          <ScrollView 
            contentContainerStyle={styles.currencyPickerContent}
            showsVerticalScrollIndicator={true}
          >
            {SUPPORTED_CURRENCIES.map((currencyItem) => {
              const isActive = transactionCurrency === currencyItem.code;
              return (
                <Pressable
                  key={currencyItem.code}
                  style={styles.currencyPickerItem(isActive)}
                  onPress={() => {
                    setTransactionCurrency(currencyItem.code);
                    setCurrencyPickerVisible(false);
                  }}
                >
                  <View style={styles.currencyPickerItemLeft}>
                    <Text style={styles.currencyPickerCode(isActive)}>
                      {currencyItem.code}
                    </Text>
                    <Text style={styles.currencyPickerName}>
                      {currencyItem.name}
                    </Text>
                  </View>
                  <Text style={styles.currencyPickerSymbol}>
                    {currencyItem.symbol}
                  </Text>
                  {isActive && (
                    <Ionicons name="checkmark-circle" size={20} color={theme.colors.primary} />
                  )}
                </Pressable>
              );
            })}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (
  theme: ReturnType<typeof useAppTheme>,
  insets: ReturnType<typeof useSafeAreaInsets>,
) => {
  const baseStyles = StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    flex: {
      flex: 1,
    },
    header: {
      paddingHorizontal: theme.screen.isSmallDevice ? theme.spacing.sm : theme.spacing.md,
      paddingTop: theme.spacing.lg,
      paddingBottom: theme.spacing.md,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: theme.colors.background,
    },
    cancelButton: {
      fontSize: theme.screen.isSmallDevice ? 16 : 17,
      color: theme.colors.primary,
      fontWeight: "500",
    },
    headerSpacer: {
      width: theme.screen.isSmallDevice ? 50 : 60,
    },
    autoAddButton: {
      width: theme.screen.isSmallDevice ? 40 : 44,
      height: theme.screen.isSmallDevice ? 40 : 44,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: theme.radii.pill,
      backgroundColor: `${theme.colors.primary}15`,
    },
    title: {
      fontSize: theme.screen.isSmallDevice ? 16 : 18,
      fontWeight: "700",
      color: theme.colors.text,
      letterSpacing: 0.3,
    },
    content: {
      paddingHorizontal: theme.screen.isSmallDevice ? theme.spacing.sm : theme.spacing.md,
      paddingBottom: theme.spacing.xxl + 96 + insets.bottom,
      paddingTop: theme.spacing.xs,
      gap: theme.spacing.xs,
    },
    typeTabsContainer: {
      flexDirection: "row",
      backgroundColor: theme.colors.surface,
      borderRadius: 16,
      padding: 4,
      marginBottom: theme.spacing.md,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 2,
    },
    mainCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: 20,
      overflow: "hidden",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 2,
    },
    compactRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: theme.spacing.lg,
      paddingHorizontal: theme.spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: `${theme.colors.border}80`,
      gap: theme.spacing.md,
    },
    compactRowIcon: {
      width: 32,
      height: 32,
      alignItems: "center",
      justifyContent: "center",
    },
    emptyCategoryIcon: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: theme.colors.surfaceElevated,
    },
    compactRowText: {
      flex: 1,
      fontSize: 16,
      color: theme.colors.text,
      fontWeight: "500",
    },
    amountRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: theme.spacing.lg,
      paddingHorizontal: theme.spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: `${theme.colors.border}80`,
      gap: theme.spacing.md,
      backgroundColor: `${theme.colors.primary}08`,
    },
    currencyBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      backgroundColor: `${theme.colors.primary}22`,
      borderRadius: theme.radii.md,
      borderWidth: 1,
      borderColor: `${theme.colors.primary}44`,
    },
    currencyText: {
      fontSize: 15,
      fontWeight: "700",
      color: theme.colors.primary,
      letterSpacing: 0.5,
    },
    amountInput: {
      flex: 1,
      fontSize: 36,
      fontWeight: "700",
      color: theme.colors.text,
      letterSpacing: 1,
    },
    noteInputCompact: {
      flex: 1,
      fontSize: 16,
      color: theme.colors.text,
      fontWeight: "500",
    },
    dateRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: theme.spacing.lg,
      paddingHorizontal: theme.spacing.md,
      gap: theme.spacing.sm,
    },
    dateNavButton: {
      width: 36,
      height: 36,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: theme.radii.pill,
      backgroundColor: theme.colors.surfaceElevated,
    },
    dateCenterButton: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: theme.spacing.sm,
      paddingVertical: theme.spacing.sm,
    },
    dateTextCompact: {
      fontSize: 15,
      color: theme.colors.text,
      fontWeight: "600",
      letterSpacing: 0.2,
    },
    addMoreButton: {
      marginTop: theme.spacing.md,
      marginBottom: theme.spacing.md,
      paddingVertical: theme.spacing.lg,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 20,
      backgroundColor: theme.colors.surface,
      borderWidth: 2,
      borderColor: `${theme.colors.primary}33`,
      borderStyle: "dashed",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 4,
      elevation: 1,
    },
    addMoreButtonText: {
      fontSize: 15,
      fontWeight: "600",
      color: theme.colors.text,
      letterSpacing: 0.3,
    },
    detailsSection: {
      marginTop: theme.spacing.sm,
      gap: theme.spacing.lg,
      padding: theme.spacing.xl,
      backgroundColor: theme.colors.surface,
      borderRadius: 20,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 2,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    fieldGroup: {
      gap: theme.spacing.sm,
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
    sectionDivider: {
      height: 1,
      backgroundColor: theme.colors.border,
      opacity: 0.5,
    },
    helperText: {
      fontSize: 12,
      color: theme.colors.textMuted,
    },
    recurringSection: {
      gap: theme.spacing.md,
    },
    recurringHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: theme.spacing.md,
    },
    recurringBody: {
      gap: theme.spacing.sm,
    },
    frequencyRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: theme.spacing.sm,
    },
    participantRow: {
      flexDirection: "row",
      gap: theme.spacing.sm,
    },
    secondaryButton: {
      ...theme.components.buttonSecondary,
      paddingHorizontal: theme.spacing.lg,
    },
    secondaryButtonText: {
      ...theme.components.buttonSecondaryText,
    },
    participantChips: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: theme.spacing.sm,
    },
    participantChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.xs,
      paddingHorizontal: theme.spacing.md,
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
    removeChip: {
      marginLeft: theme.spacing.xs,
    },
    photoRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: theme.spacing.sm,
    },
    photoPreview: {
      width: 82,
      height: 82,
      borderRadius: theme.radii.md,
      overflow: "hidden",
      position: "relative",
    },
    photoImage: {
      width: "100%",
      height: "100%",
      borderRadius: theme.radii.md,
    },
    removePhotoButton: {
      position: "absolute",
      top: 4,
      right: 4,
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: theme.colors.surface,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: "#000",
      shadowOpacity: 0.15,
      shadowRadius: 4,
      elevation: 2,
    },
    photoAddButton: {
      width: 82,
      height: 82,
      borderRadius: theme.radii.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderStyle: "dashed",
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
    },
    photoAddText: {
      fontSize: 11,
      color: theme.colors.text,
      fontWeight: "600",
    },
    photoLimit: {
      fontSize: 11,
      color: theme.colors.textMuted,
    },
    excludeRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: theme.spacing.md,
    },
    modal: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    modalHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: theme.spacing.xl,
      paddingTop: theme.spacing.lg,
      paddingBottom: theme.spacing.md,
    },
    modalTitle: {
      ...theme.typography.title,
      fontSize: 18,
    },
    modalClose: {
      width: 32,
      height: 32,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: theme.radii.md,
      backgroundColor: theme.colors.surface,
    },
    modalContent: {
      paddingHorizontal: theme.spacing.xl,
      paddingBottom: insets.bottom + theme.spacing.lg,
      gap: theme.spacing.lg,
    },
    currencyPickerContent: {
      paddingHorizontal: theme.spacing.lg,
      paddingBottom: insets.bottom + theme.spacing.lg,
      gap: theme.spacing.xs,
    },
    categoryHeroCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radii.lg,
      padding: theme.spacing.lg,
      gap: theme.spacing.sm,
      borderWidth: 1,
      borderColor: theme.colors.border,
      shadowColor: theme.colors.background,
      shadowOpacity: 0.08,
      shadowOffset: { width: 0, height: 8 },
    },
    categoryHeroBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.xs,
      alignSelf: "flex-start",
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.xs,
      borderRadius: theme.radii.pill,
      backgroundColor: `${theme.colors.primary}15`,
    },
    categoryHeroBadgeText: {
      fontSize: 12,
      fontWeight: "700",
      color: theme.colors.text,
    },
    categoryHeroTitle: {
      fontSize: 18,
      fontWeight: "800",
      color: theme.colors.text,
    },
    categorySearchRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
      borderRadius: theme.radii.lg,
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.md,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    categorySearchInput: {
      flex: 1,
      fontSize: 15,
      color: theme.colors.text,
    },
    categoryGroupGrid: {
      gap: theme.spacing.md,
    },
    categoryGroupCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radii.lg,
      padding: theme.spacing.md,
      gap: theme.spacing.sm,
      borderWidth: 1,
      borderColor: theme.colors.border,
      shadowColor: theme.colors.background,
      shadowOpacity: 0.05,
      shadowOffset: { width: 0, height: 6 },
    },
    parentRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.md,
    },
    parentAvatar: {
      width: 44,
      height: 44,
      borderRadius: theme.radii.lg,
      backgroundColor: theme.colors.surfaceElevated,
      alignItems: "center",
      justifyContent: "center",
    },
    parentName: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.colors.text,
    },
    metaText: {
      fontSize: 12,
      color: theme.colors.textMuted,
    },
    childrenList: {
      marginLeft: theme.spacing.sm,
      gap: theme.spacing.sm,
    },
    childRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.md,
      paddingVertical: theme.spacing.xs,
      paddingHorizontal: theme.spacing.sm,
      borderRadius: theme.radii.md,
    },
    connectorColumn: {
      width: 18,
      alignItems: "center",
    },
    connectorLine: {
      width: 2,
      flex: 1,
      backgroundColor: theme.colors.border,
      marginBottom: 4,
      borderRadius: 4,
    },
    connectorLineEnd: {
      height: 10,
    },
    connectorDot: {
      width: 10,
      height: 10,
      borderRadius: 6,
      backgroundColor: theme.colors.border,
    },
    childAvatar: {
      width: 34,
      height: 34,
      borderRadius: theme.radii.md,
      backgroundColor: theme.colors.surfaceElevated,
      alignItems: "center",
      justifyContent: "center",
    },
    childName: {
      fontSize: 14,
      fontWeight: "700",
      color: theme.colors.text,
    },
    addCategoryButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.md,
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radii.lg,
      padding: theme.spacing.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      shadowColor: theme.colors.primary,
      shadowOpacity: 0.08,
      shadowOffset: { width: 0, height: 4 },
    },
    addCategoryIcon: {
      width: 44,
      height: 44,
      borderRadius: theme.radii.lg,
      backgroundColor: `${theme.colors.primary}15`,
      alignItems: "center",
      justifyContent: "center",
    },
    addCategoryText: {
      flex: 1,
      fontSize: 16,
      fontWeight: "700",
      color: theme.colors.text,
    },
    accountIconWrapper: {
      width: 44,
      height: 44,
      borderRadius: theme.radii.lg,
      backgroundColor: theme.colors.surfaceElevated,
      alignItems: "center",
      justifyContent: "center",
    },
    accountInfo: {
      flex: 1,
      gap: 4,
    },
    accountName: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.colors.text,
    },
    accountMeta: {
      fontSize: 12,
      color: theme.colors.textMuted,
    },
    toAccountLabel: {
      flex: 1,
      gap: 4,
    },
    toAccountLabelText: {
      fontSize: 11,
      fontWeight: "600",
      color: theme.colors.textMuted,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    calendarOverlay: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 1000,
      alignItems: "center",
      justifyContent: "center",
    },
    calendarBackdrop: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(0, 0, 0, 0.5)",
    },
    calendarCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: 20,
      padding: theme.spacing.xl,
      marginHorizontal: theme.spacing.xl,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.4,
      shadowRadius: 24,
      elevation: 10,
      borderWidth: 1,
      borderColor: `${theme.colors.primary}22`,
    },
    calendarHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: theme.spacing.xl,
      paddingBottom: theme.spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: `${theme.colors.border}66`,
    },
    calendarTitle: {
      fontSize: 20,
      fontWeight: "700",
      color: theme.colors.text,
      letterSpacing: 0.3,
    },
    calendarCloseButton: {
      width: 36,
      height: 36,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: theme.radii.pill,
      backgroundColor: theme.colors.surfaceElevated,
    },
  });

  return {
    ...baseStyles,
    typeTab: (active: boolean) => ({
      flex: 1,
      paddingVertical: theme.spacing.md,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      borderRadius: theme.radii.md,
      backgroundColor: active ? theme.colors.primary : "transparent",
    }),
    typeTabText: (active: boolean) => ({
      fontSize: 14,
      fontWeight: "600" as const,
      color: active ? "#FFFFFF" : theme.colors.textMuted,
      letterSpacing: 0.2,
    }),
    frequencyPill: (active: boolean) => ({
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.radii.pill,
      borderWidth: 1,
      borderColor: active ? theme.colors.primary : theme.colors.border,
      backgroundColor: active ? `${theme.colors.primary}22` : theme.colors.surface,
    }),
    frequencyPillText: (active: boolean) => ({
      fontSize: 13,
      fontWeight: "600" as const,
      color: active ? theme.colors.text : theme.colors.textMuted,
    }),
    accountRow: (active: boolean) => ({
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: theme.spacing.md,
      backgroundColor: active ? `${theme.colors.primary}15` : theme.colors.surface,
      borderRadius: theme.radii.lg,
      padding: theme.spacing.lg,
      borderWidth: 1,
      borderColor: active ? theme.colors.primary : theme.colors.border,
    }),
    currencyPickerItem: (active: boolean) => ({
      flexDirection: "row" as const,
      alignItems: "center" as const,
      padding: theme.spacing.md,
      backgroundColor: active ? `${theme.colors.primary}15` : theme.colors.surface,
      borderRadius: theme.radii.md,
      borderWidth: 1,
      borderColor: active ? theme.colors.primary : theme.colors.border,
      gap: theme.spacing.md,
    }),
    currencyPickerCode: (active: boolean) => ({
      fontSize: 15,
      fontWeight: "700" as const,
      color: active ? theme.colors.primary : theme.colors.text,
    }),
    currencyPickerItemLeft: {
      flex: 1,
      gap: 2,
    },
    currencyPickerName: {
      fontSize: 12,
      color: theme.colors.textMuted,
    },
    currencyPickerSymbol: {
      fontSize: 15,
      fontWeight: "600" as const,
      color: theme.colors.textMuted,
    },
    submitButton: (isValid: boolean) => ({
      ...theme.components.buttonPrimary,
      marginHorizontal: theme.spacing.xl,
      marginBottom: theme.spacing.xl + insets.bottom,
      marginTop: theme.spacing.xl,
      backgroundColor: isValid ? theme.colors.primary : theme.colors.surface,
      opacity: isValid ? 1 : 0.4,
      shadowColor: isValid ? theme.colors.primary : "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: isValid ? 0.3 : 0.05,
      shadowRadius: isValid ? 12 : 4,
      elevation: isValid ? 4 : 1,
      borderWidth: isValid ? 0 : 1,
      borderColor: theme.colors.border,
    }),
    submitButtonText: (isValid: boolean) => ({
      ...theme.components.buttonPrimaryText,
      color: isValid ? "#FFFFFF" : theme.colors.textMuted,
      fontSize: 17,
      fontWeight: "700" as const,
      letterSpacing: 0.5,
    }),
  };
};
