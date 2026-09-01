import { TransactionType } from '@/generated/prisma/client';
import { TransactionsWorkspace } from '@/components/transactions-workspace';
import { requireCurrentUser } from '@/lib/current-user';
import {
  listCategoriesForUser,
  listRecentTransactionsForUser,
} from '@/lib/ledger';

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string | string[] }>;
}) {
  const user = await requireCurrentUser();
  const { new: newTransaction } = await searchParams;
  const [categories, transactions] = await Promise.all([
    listCategoriesForUser(user.id),
    listRecentTransactionsForUser(user.id, 100),
  ]);

  return (
    <TransactionsWorkspace
      openOnLoad={newTransaction === '1'}
      categories={categories.map((category) => ({
        id: category.id,
        name: category.name,
      }))}
      transactions={transactions.map((transaction) => ({
        amountCents: transaction.amountCents,
        categoryId: transaction.categoryId,
        categoryName: transaction.category.name,
        description: transaction.description,
        id: transaction.id,
        notes: transaction.notes,
        transactionDate: transaction.transactionDate.toISOString(),
        type:
          transaction.type === TransactionType.EXPENSE ? 'expense' : 'refund',
      }))}
    />
  );
}
