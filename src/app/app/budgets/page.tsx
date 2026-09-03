import { BudgetsWorkspace } from '@/components/budgets-workspace';
import { getBudgetSetupForUser } from '@/lib/budgets';
import { requireCurrentUser } from '@/lib/current-user';

export default async function BudgetsPage() {
  const user = await requireCurrentUser();
  const budgetSetup = await getBudgetSetupForUser(user.id);

  return <BudgetsWorkspace {...budgetSetup} />;
}
