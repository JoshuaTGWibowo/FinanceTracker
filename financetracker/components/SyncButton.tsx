import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { syncMetricsToSupabase } from '../lib/sync-service';
import { useFinanceStore } from '../lib/store';
import { useAppTheme } from '../theme';

export default function SyncButton() {
  const theme = useAppTheme();
  const [isSyncing, setIsSyncing] = useState(false);
  const transactions = useFinanceStore((state) => state.transactions);
  const budgetGoals = useFinanceStore((state) => state.budgetGoals);

  const handleSync = async () => {
    setIsSyncing(true);
    const result = await syncMetricsToSupabase(transactions, budgetGoals);
    setIsSyncing(false);

    if (result.success) {
      Alert.alert('Success', 'Your anonymized stats have been synced to the leaderboard!');
    } else {
      Alert.alert('Error', result.error || 'Failed to sync stats');
    }
  };

  const styles = StyleSheet.create({
    syncButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: theme.colors.primary,
      borderRadius: 8,
      minWidth: 70,
      justifyContent: 'center',
    },
    syncButtonDisabled: {
      opacity: 0.6,
    },
    syncButtonText: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.colors.text,
    },
  });

  return (
    <Pressable
      style={[styles.syncButton, isSyncing && styles.syncButtonDisabled]}
      onPress={handleSync}
      disabled={isSyncing}
    >
      {isSyncing ? (
        <ActivityIndicator size="small" color={theme.colors.text} />
      ) : (
        <>
          <Ionicons name="cloud-upload-outline" size={18} color={theme.colors.text} />
          <Text style={styles.syncButtonText}>Sync</Text>
        </>
      )}
    </Pressable>
  );
}
