import { randomUUID } from 'node:crypto';

import { PrismaAdapter } from '@next-auth/prisma-adapter';
import { afterAll, afterEach, describe, expect, it } from 'vitest';

import { bootstrapDefaultCategories } from '@/lib/bootstrap';
import { DEFAULT_CATEGORY_NAMES } from '@/lib/categories';
import { db } from '@/lib/db';
import {
  findOwnedCategory,
  listActiveCategoriesForUser,
} from '@/lib/user-scoped-data';

const createdUserIds: string[] = [];

async function createUser(label: string) {
  const user = await db.user.create({
    data: {
      email: `m1-integration-${label}-${randomUUID()}@example.test`,
    },
  });

  createdUserIds.push(user.id);

  return user;
}

afterEach(async () => {
  await Promise.all(
    createdUserIds
      .splice(0)
      .map((userId) =>
        db.user.delete({ where: { id: userId } }).catch(() => undefined),
      ),
  );
});

afterAll(async () => {
  await db.$disconnect();
});

describe('M1 bootstrap and ownership isolation', () => {
  it('creates each default category once when bootstrap is repeated', async () => {
    const user = await createUser('bootstrap');

    await db.$transaction((transaction) =>
      bootstrapDefaultCategories(transaction, user.id),
    );
    await db.$transaction((transaction) =>
      bootstrapDefaultCategories(transaction, user.id),
    );

    const categories = await listActiveCategoriesForUser(user.id);

    expect(categories).toHaveLength(DEFAULT_CATEGORY_NAMES.length);
    expect(
      new Set(categories.map((category) => category.normalizedName)).size,
    ).toBe(DEFAULT_CATEGORY_NAMES.length);
  });

  it('retrieves a seeded session through the Auth.js Prisma adapter', async () => {
    const user = await createUser('session');
    const sessionToken = randomUUID();

    await db.session.create({
      data: {
        sessionToken,
        userId: user.id,
        expires: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    const adapter = PrismaAdapter(db as never);

    await expect(
      adapter.getSessionAndUser?.(sessionToken),
    ).resolves.toMatchObject({
      user: {
        id: user.id,
      },
      session: {
        sessionToken,
      },
    });
  });

  it('denies direct and relation-scoped category lookups across users', async () => {
    const owner = await createUser('owner');
    const otherUser = await createUser('other');

    await db.$transaction(async (transaction) => {
      await bootstrapDefaultCategories(transaction, owner.id);
      await bootstrapDefaultCategories(transaction, otherUser.id);
    });

    const ownerCategory = await db.category.findFirstOrThrow({
      where: { userId: owner.id, normalizedName: 'groceries' },
    });
    const otherCategory = await db.category.findFirstOrThrow({
      where: { userId: otherUser.id, normalizedName: 'groceries' },
    });

    await expect(
      findOwnedCategory(owner.id, ownerCategory.id),
    ).resolves.toMatchObject({
      id: ownerCategory.id,
      userId: owner.id,
    });
    await expect(
      findOwnedCategory(owner.id, otherCategory.id),
    ).resolves.toBeNull();

    const directForeignLookup = await db.category.findFirst({
      where: { id: otherCategory.id, userId: owner.id },
    });
    expect(directForeignLookup).toBeNull();
  });
});
