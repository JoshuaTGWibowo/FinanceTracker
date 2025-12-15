import { useRouter } from "expo-router";
import { Alert } from "react-native";

import { TransactionForm } from "../../components/transactions/TransactionForm";
import { Transaction, useFinanceStore } from "../../lib/store";

export default function AddTransactionScreen() {
  const router = useRouter();
  const addTransaction = useFinanceStore((state) => state.addTransaction);
  const selectedAccountId = useFinanceStore((state) => state.selectedAccountId);

  const handleSubmit = async (transaction: Omit<Transaction, "id">) => {
    try {
      await addTransaction(transaction);
      router.back();
    } catch (error) {
      console.error("Failed to add transaction:", error);
      Alert.alert("Error", "Failed to add transaction. Please try again.");
    }
  };

  const handleCancel = () => {
    router.back();
  };

  return (
    <TransactionForm
      title="Add Transaction"
      submitLabel="Save"
      onCancel={handleCancel}
      onSubmit={handleSubmit}
      initialValues={selectedAccountId ? { accountId: selectedAccountId } : undefined}
    />
  );
}
