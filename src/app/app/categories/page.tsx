import { CategoriesWorkspace } from '@/components/categories-workspace';
import { requireCurrentUser } from '@/lib/current-user';
import { listCategoryManagementForUser } from '@/lib/ledger';

export default async function CategoriesPage() {
  const user = await requireCurrentUser();
  const categories = await listCategoryManagementForUser(user.id);

  return (
    <CategoriesWorkspace
      activeCategories={categories
        .filter((category) => category.archivedAt === null)
        .map((category) => ({
          id: category.id,
          name: category.name,
          transactionCount: category._count.transactions,
        }))}
      archivedCategories={categories
        .filter((category) => category.archivedAt !== null)
        .map((category) => ({
          archivedAt: category.archivedAt?.toISOString() ?? null,
          id: category.id,
          name: category.name,
          transactionCount: category._count.transactions,
        }))}
    />
  );
}
