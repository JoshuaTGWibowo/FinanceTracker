import { useRouter } from "expo-router";

import { TransactionForm } from "../../components/transactions/TransactionForm";
import { ErrorBoundary } from "../../components/ErrorBoundary";
import { useFinanceStore } from "../../lib/store";

export default function NewTransactionModal() {
  const router = useRouter();
  const addTransaction = useFinanceStore((state) => state.addTransaction);
  const addRecurringTransaction = useFinanceStore(
    (state) => state.addRecurringTransaction,
  );
  const selectedAccountId = useFinanceStore((state) => state.selectedAccountId);
  const accounts = useFinanceStore((state) => state.accounts);

  // Prefer the user's currently selected account, then fallback to the first active account
  const initialAccountId = selectedAccountId ?? accounts.find((a) => !a.isArchived)?.id ?? accounts[0]?.id;

  return (
    <ErrorBoundary>
      <TransactionForm
        title="Add transaction"
        submitLabel="Add transaction"
        onCancel={() => router.back()}
        onSubmit={async (transaction) => {
          await addTransaction(transaction);
          router.back();
        }}
        initialValues={initialAccountId ? { accountId: initialAccountId } : undefined}
        enableRecurringOption
        onSubmitRecurring={async (transaction, config) => {
          await addRecurringTransaction({
            amount: transaction.amount,
            note: transaction.note,
            type: transaction.type,
            category: transaction.category,
            accountId: transaction.accountId,
            toAccountId: transaction.toAccountId,
            frequency: config.frequency,
            nextOccurrence: config.startDate,
            isActive: true,
          });
        }}
      />
    </ErrorBoundary>
  );
}
