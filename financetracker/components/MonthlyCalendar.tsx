import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import dayjs, { Dayjs } from 'dayjs';
import { useAppTheme } from '../theme';
import { Transaction } from '../lib/types';
import { useFinanceStore } from '../lib/store';

interface MonthlyCalendarProps {
  transactions: Transaction[];
  selectedAccountId?: string | null;
  currency: string;
  onDatePress?: (date: string) => void;
}

// Calculate net for a specific day (with currency conversion)
const calculateDayNet = (
  transactions: Transaction[],
  date: Dayjs,
  selectedAccountId: string | null | undefined,
  convertAmount: (t: Transaction) => number,
): number => {
  return transactions
    .filter((t) => dayjs(t.date).isSame(date, 'day'))
    .reduce((acc, t) => {
      const amount = convertAmount(t);
      // Handle transfers
      if (t.type === 'transfer') {
        if (selectedAccountId) {
          if (t.accountId === selectedAccountId) return acc - amount;
          if (t.toAccountId === selectedAccountId) return acc + amount;
          return acc;
        }
        return acc; // Transfers are neutral for all accounts view
      }
      
      // Handle income and expenses
      if (t.type === 'income') return acc + amount;
      if (t.type === 'expense') return acc - amount;
      return acc;
    }, 0);
};

export function MonthlyCalendar({ transactions, selectedAccountId, currency, onDatePress }: MonthlyCalendarProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [currentMonth, setCurrentMonth] = useState(dayjs());
  const getTransactionAmountInBaseCurrency = useFinanceStore((state) => state.getTransactionAmountInBaseCurrency);

  const canGoNext = useMemo(() => {
    const now = dayjs();
    return currentMonth.isBefore(now, 'month');
  }, [currentMonth]);

  const handlePrevMonth = () => {
    setCurrentMonth(prev => prev.subtract(1, 'month'));
  };

  const handleNextMonth = () => {
    if (canGoNext) {
      setCurrentMonth(prev => prev.add(1, 'month'));
    }
  };

  const calendarData = useMemo(() => {
    const now = dayjs();
    const startOfMonth = currentMonth.startOf('month');
    const endOfMonth = currentMonth.endOf('month');
    const daysInMonth = endOfMonth.date();
    const firstDayOfWeek = startOfMonth.day(); // 0 = Sunday

    // Create array of days
    const days: Array<{ date: Dayjs; net: number; isToday: boolean; isFuture: boolean }> = [];
    
    // Add empty cells for days before month starts
    for (let i = 0; i < firstDayOfWeek; i++) {
      days.push({ 
        date: startOfMonth.subtract(firstDayOfWeek - i, 'day'), 
        net: 0, 
        isToday: false, 
        isFuture: false 
      });
    }

    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = startOfMonth.date(day);
      const net = calculateDayNet(transactions, date, selectedAccountId, getTransactionAmountInBaseCurrency);
      const isToday = date.isSame(now, 'day');
      // Only mark as future if it's in a future month, not if it's in the current month
      const isFuture = date.isAfter(now, 'day') && !currentMonth.isSame(now, 'month');
      days.push({ date, net, isToday, isFuture });
    }

    return {
      monthName: currentMonth.format('MMMM YYYY'),
      days,
    };
  }, [transactions, selectedAccountId, currentMonth, getTransactionAmountInBaseCurrency]);

  const getNetColor = (net: number, isFuture: boolean) => {
    if (isFuture) return theme.colors.textMuted;
    if (net > 0) return theme.colors.success;
    if (net < 0) return theme.colors.danger;
    return theme.colors.text;
  };

  const formatCurrency = (value: number) => {
    if (value === 0) return '-';
    const abs = Math.abs(value);
    if (abs >= 1000) {
      return `${value > 0 ? '+' : '-'}${(abs / 1000).toFixed(1)}k`;
    }
    return value > 0 ? `+${abs.toFixed(0)}` : `-${abs.toFixed(0)}`;
  };

  return (
    <View style={[theme.components.card, styles.container]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.monthTitle}>{calendarData.monthName}</Text>
          <Text style={styles.subtitle}>Daily net income</Text>
        </View>
        <View style={styles.navigationButtons}>
          <Pressable
            style={styles.navButton}
            onPress={handlePrevMonth}
          >
            <Ionicons name="chevron-back" size={20} color={theme.colors.text} />
          </Pressable>
          <Pressable
            style={[styles.navButton, !canGoNext && styles.navButtonDisabled]}
            onPress={handleNextMonth}
            disabled={!canGoNext}
          >
            <Ionicons 
              name="chevron-forward" 
              size={20} 
              color={canGoNext ? theme.colors.text : theme.colors.textMuted} 
            />
          </Pressable>
        </View>
      </View>

      {/* Weekday headers */}
      <View style={styles.weekdayRow}>
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
          <View key={index} style={styles.weekdayCell}>
            <Text style={styles.weekdayText}>{day}</Text>
          </View>
        ))}
      </View>

      {/* Calendar grid */}
      <View style={styles.calendarGrid}>
        {calendarData.days.map((day, index) => {
          const isCurrentMonth = day.date.month() === currentMonth.month();
          const hasTransactions = isCurrentMonth && day.net !== 0;
          
          return (
            <Pressable
              key={index}
              style={[
                styles.dayCell,
                day.isToday && styles.todayCell,
              ]}
              onPress={() => {
                if (isCurrentMonth && hasTransactions && onDatePress) {
                  onDatePress(day.date.format('YYYY-MM-DD'));
                }
              }}
              disabled={!isCurrentMonth || !hasTransactions || !onDatePress}
            >
              <Text
                style={[
                  styles.dayNumber,
                  !isCurrentMonth && styles.dayNumberInactive,
                  day.isToday && styles.todayText,
                ]}
              >
                {day.date.date()}
              </Text>
              {isCurrentMonth && !day.isFuture && (
                <Text
                  style={[
                    styles.netAmount,
                    { color: day.net === 0 ? theme.colors.text : getNetColor(day.net, day.isFuture) },
                  ]}
                >
                  {formatCurrency(day.net)}
                </Text>
              )}
              {isCurrentMonth && day.isFuture && (
                <Text style={styles.futureIndicator}>•</Text>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const createStyles = (theme: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    container: {
      padding: theme.spacing.md,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: theme.spacing.md,
      gap: 4,
    },
    monthTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.colors.text,
    },
    subtitle: {
      fontSize: 13,
      color: theme.colors.textMuted,
    },
    navigationButtons: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
    },
    navButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme.colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    navButtonDisabled: {
      opacity: 0.5,
    },
    weekdayRow: {
      flexDirection: 'row',
      marginBottom: 0,
    },
    weekdayCell: {
      flex: 1,
      alignItems: 'center',
    },
    weekdayText: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.colors.textMuted,
      textTransform: 'uppercase',
    },
    calendarGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignSelf: 'center',
      width: '100%',
      marginBottom: -20,
    },
    dayCell: {
      width: `${100 / 7}%`,
      aspectRatio: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 4,
      gap: 2,
    },
    todayCell: {
      backgroundColor: theme.colors.primary + '20',
      borderRadius: theme.radii.sm,
    },
    dayNumber: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text,
    },
    dayNumberInactive: {
      color: theme.colors.textMuted,
      opacity: 0.3,
    },
    todayText: {
      color: theme.colors.primary,
      fontWeight: '700',
    },
    netAmount: {
      fontSize: 11,
      fontWeight: '600',
    },
    futureIndicator: {
      fontSize: 8,
      color: theme.colors.textMuted,
    },
  });
