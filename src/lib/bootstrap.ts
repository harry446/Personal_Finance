import 'server-only';

import type { Prisma } from '@/generated/prisma/client';
import { createDefaultCategoryData } from '@/lib/categories';
import { db } from '@/lib/db';

type CategoryWriter = Pick<Prisma.TransactionClient, 'category'>;

export async function bootstrapDefaultCategories(
  writer: CategoryWriter,
  userId: string,
) {
  return writer.category.createMany({
    data: createDefaultCategoryData(userId),
    skipDuplicates: true,
  });
}

export async function ensureDefaultCategoriesForUser(userId: string) {
  return db.$transaction((transaction) =>
    bootstrapDefaultCategories(transaction, userId),
  );
}
