import { useRouter } from "expo-router";

import { TransactionForm } from "../../components/transactions/TransactionForm";
import { useFinanceStore } from "../../lib/store";

export default function NewTransactionModal() {
  const router = useRouter();
  const addTransaction = useFinanceStore((state) => state.addTransaction);
  const addRecurringTransaction = useFinanceStore(
    (state) => state.addRecurringTransaction,
  );

  return (
    <TransactionForm
      title="Add transaction"
      submitLabel="Add transaction"
      allowRecurring
      onCancel={() => router.back()}
      onSubmit={(transaction, meta) => {
        addTransaction(transaction);
        if (meta?.recurring) {
          addRecurringTransaction({
            amount: transaction.amount,
            note: transaction.note,
            type: transaction.type,
            category: transaction.category,
            frequency: meta.recurring.frequency,
            nextOccurrence: meta.recurring.startDate,
          });
        }
        router.back();
      }}
    />
  );
}
