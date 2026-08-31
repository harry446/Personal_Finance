import 'server-only';

import {
  TransactionSource,
  TransactionType,
  type Prisma,
} from '@/generated/prisma/client';
import {
  categoryNameSchema,
  normalizeCategoryName,
  resolveCategoryCreate,
} from '@/lib/categories';
import { db } from '@/lib/db';
import {
  parseManualTransactionInput,
  type ManualTransactionInput,
} from '@/lib/ledger-validation';

type LedgerWriter = Pick<Prisma.TransactionClient, 'category' | 'transaction'>;
type TransactionValues = ManualTransactionInput;

export class CategoryNameConflictError extends Error {
  constructor() {
    super('An active category already uses that name.');
    this.name = 'CategoryNameConflictError';
  }
}

export class OwnedRecordNotFoundError extends Error {
  constructor(resource: 'category' | 'transaction') {
    super(`The ${resource} was not found in your workspace.`);
    this.name = 'OwnedRecordNotFoundError';
  }
}

export class ArchivedCategoryError extends Error {
  constructor() {
    super('Archived categories cannot be used for new transactions.');
    this.name = 'ArchivedCategoryError';
  }
}

export async function listCategoriesForUser(userId: string) {
  return db.category.findMany({
    where: { userId, archivedAt: null },
    orderBy: { name: 'asc' },
  });
}
export async function listCategoryManagementForUser(userId: string) {
  return db.category.findMany({
    where: { userId },
    include: {
      _count: {
        select: { transactions: true },
      },
    },
    orderBy: [{ archivedAt: 'asc' }, { name: 'asc' }],
  });
}

export async function createCategoryForUser(userId: string, rawName: string) {
  const name = categoryNameSchema.parse(rawName);
  const normalizedName = normalizeCategoryName(name);

  return db.$transaction(async (transaction) => {
    const matchingCategory = await transaction.category.findUnique({
      where: {
        userId_normalizedName: { userId, normalizedName },
      },
    });

    const resolution = resolveCategoryCreate(matchingCategory);

    if (resolution === 'reactivate' && matchingCategory) {
      return {
        category: await transaction.category.update({
          where: { id: matchingCategory.id },
          data: { archivedAt: null, name },
        }),
        reactivated: true,
      };
    }

    if (resolution === 'conflict') {
      throw new CategoryNameConflictError();
    }

    return {
      category: await transaction.category.create({
        data: { userId, name, normalizedName },
      }),
      reactivated: false,
    };
  });
}

export async function renameCategoryForUser(
  userId: string,
  categoryId: string,
  rawName: string,
) {
  const name = categoryNameSchema.parse(rawName);
  const normalizedName = normalizeCategoryName(name);

  return db.$transaction(async (transaction) => {
    const category = await requireOwnedCategory(
      transaction,
      userId,
      categoryId,
    );
    const matchingCategory = await transaction.category.findUnique({
      where: {
        userId_normalizedName: { userId, normalizedName },
      },
    });

    if (matchingCategory && matchingCategory.id !== category.id) {
      throw new CategoryNameConflictError();
    }

    return transaction.category.update({
      where: { id: category.id },
      data: { name, normalizedName },
    });
  });
}

export async function archiveCategoryForUser(
  userId: string,
  categoryId: string,
) {
  return db.$transaction(async (transaction) => {
    const category = await requireOwnedCategory(
      transaction,
      userId,
      categoryId,
    );

    if (category.archivedAt) {
      return category;
    }

    return transaction.category.update({
      where: { id: category.id },
      data: { archivedAt: new Date() },
    });
  });
}

export async function listRecentTransactionsForUser(
  userId: string,
  limit = 20,
) {
  return db.transaction.findMany({
    where: { userId },
    include: {
      category: {
        select: { archivedAt: true, name: true },
      },
    },
    orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }],
    take: Math.max(1, Math.min(limit, 100)),
  });
}

export async function restoreCategoryForUser(
  userId: string,
  categoryId: string,
) {
  return db.$transaction(async (transaction) => {
    const category = await requireOwnedCategory(
      transaction,
      userId,
      categoryId,
    );

    if (!category.archivedAt) {
      return category;
    }

    return transaction.category.update({
      where: { id: category.id },
      data: { archivedAt: null },
    });
  });
}
export async function createManualTransactionForUser(
  userId: string,
  values: unknown,
) {
  const input = parseManualTransactionInput(values);

  return db.$transaction(async (transaction) => {
    await requireActiveOwnedCategory(transaction, userId, input.categoryId);

    return transaction.transaction.create({
      data: transactionData(userId, input),
    });
  });
}

export async function updateManualTransactionForUser(
  userId: string,
  transactionId: string,
  values: unknown,
) {
  const input = parseManualTransactionInput(values);

  return db.$transaction(async (transaction) => {
    const existingTransaction = await transaction.transaction.findFirst({
      where: { id: transactionId, userId },
    });

    if (!existingTransaction) {
      throw new OwnedRecordNotFoundError('transaction');
    }

    await requireActiveOwnedCategory(transaction, userId, input.categoryId);

    return transaction.transaction.update({
      where: { id: existingTransaction.id },
      data: transactionData(userId, input),
    });
  });
}

export async function deleteTransactionForUser(
  userId: string,
  transactionId: string,
) {
  const result = await db.transaction.deleteMany({
    where: { id: transactionId, userId },
  });

  if (result.count === 0) {
    throw new OwnedRecordNotFoundError('transaction');
  }
}

async function requireOwnedCategory(
  writer: LedgerWriter,
  userId: string,
  categoryId: string,
) {
  const category = await writer.category.findFirst({
    where: { id: categoryId, userId },
  });

  if (!category) {
    throw new OwnedRecordNotFoundError('category');
  }

  return category;
}

async function requireActiveOwnedCategory(
  writer: LedgerWriter,
  userId: string,
  categoryId: string,
) {
  const category = await requireOwnedCategory(writer, userId, categoryId);

  if (category.archivedAt) {
    throw new ArchivedCategoryError();
  }

  return category;
}

function transactionData(userId: string, input: TransactionValues) {
  return {
    userId,
    categoryId: input.categoryId,
    transactionDate: input.transactionDate,
    type:
      input.type === 'expense'
        ? TransactionType.EXPENSE
        : TransactionType.REFUND,
    amountCents: input.amountCents,
    description: input.description,
    notes: input.notes,
    source: TransactionSource.MANUAL,
  };
}
