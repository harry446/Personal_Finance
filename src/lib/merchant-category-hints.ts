import 'server-only';

import { db } from '@/lib/db';

const MERCHANT_HINT_SOURCE_TRANSACTION_LIMIT = 200;
const MERCHANT_HINT_LIMIT = 40;

export type MerchantCategoryHint = {
  categoryName: string;
  merchantName: string;
};

type MerchantCategoryObservation = {
  categoryNames: Set<string>;
  merchantName: string;
};

export async function listMerchantCategoryHintsForUser(userId: string) {
  const transactions = await db.transaction.findMany({
    where: {
      category: { is: { archivedAt: null } },
      userId,
    },
    select: {
      category: { select: { name: true } },
      description: true,
    },
    orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }],
    take: MERCHANT_HINT_SOURCE_TRANSACTION_LIMIT,
  });
  const observations = new Map<string, MerchantCategoryObservation>();

  for (const transaction of transactions) {
    const merchantName = compactMerchantName(transaction.description);
    const merchantKey = normalizedMerchantKey(merchantName);

    if (!merchantKey) {
      continue;
    }

    const observation = observations.get(merchantKey) ?? {
      categoryNames: new Set<string>(),
      merchantName,
    };

    observation.categoryNames.add(transaction.category.name);
    observations.set(merchantKey, observation);
  }

  return [...observations.values()]
    .filter(({ categoryNames }) => categoryNames.size === 1)
    .slice(0, MERCHANT_HINT_LIMIT)
    .map(({ categoryNames, merchantName }) => ({
      categoryName: [...categoryNames][0]!,
      merchantName,
    }));
}

function compactMerchantName(value: string) {
  return value.normalize('NFKC').replace(/\s+/g, ' ').trim().slice(0, 160);
}

function normalizedMerchantKey(value: string) {
  return value.toLocaleLowerCase('en-CA');
}
