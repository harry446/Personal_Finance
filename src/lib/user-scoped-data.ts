import 'server-only';

import { db } from '@/lib/db';

export function listActiveCategoriesForUser(userId: string) {
  return db.category.findMany({
    where: { userId, isActive: true },
    orderBy: { name: 'asc' },
  });
}

export function findOwnedCategory(userId: string, categoryId: string) {
  return db.category.findFirst({
    where: {
      id: categoryId,
      user: { id: userId },
    },
  });
}
