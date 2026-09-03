import { BudgetsWorkspace } from '@/components/budgets-workspace';
import {
  getBudgetDashboardForMonth,
  getBudgetSetupForUser,
} from '@/lib/budgets';
import { requireCurrentUser } from '@/lib/current-user';
import { parseDashboardMonth } from '@/lib/dashboard-calculations';

export default async function BudgetsPage() {
  const user = await requireCurrentUser();
  const budgetSetup = await getBudgetSetupForUser(user.id);
  const budget = await getBudgetDashboardForMonth(
    user.id,
    parseDashboardMonth(budgetSetup.currentMonth),
  );

  return <BudgetsWorkspace {...budgetSetup} progress={budget.progress} />;
}
