import { randomUUID } from 'node:crypto';

import {
  CandidateReviewState,
  ExtractionLogStatus,
  ImportBatchStatus,
  TransactionType,
} from '@/generated/prisma/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { bootstrapDefaultCategories } from '@/lib/bootstrap';
import { db } from '@/lib/db';
import {
  decryptRawOutputForTest,
  processImportForUser,
  type ImportExtractionContext,
  type ImportExtractionProvider,
  type ImportUpload,
} from '@/lib/import-extraction';
import { getImportBatchForUser } from '@/lib/import-review';
import { purgeExpiredExtractionCiphertext } from '@/lib/import-retention';
import { OwnedRecordNotFoundError } from '@/lib/ledger';

const createdUserIds: string[] = [];
const encryptionKey = Buffer.alloc(32, 42).toString('base64');
const upload: ImportUpload = {
  bytes: new Uint8Array([80, 68, 70]),
  contentType: 'application/pdf',
  filename: 'upload-1.pdf',
};
const originalEncryptionKey = process.env.EXTRACTION_LOG_ENCRYPTION_KEY;

async function createUser(label: string) {
  const user = await db.user.create({
    data: { email: `m5-integration-${label}-${randomUUID()}@example.test` },
  });

  createdUserIds.push(user.id);
  await db.$transaction((transaction) =>
    bootstrapDefaultCategories(transaction, user.id),
  );

  return user;
}

async function createConfirmedTransaction({
  categoryId,
  description,
  transactionDate,
  userId,
}: {
  categoryId: string;
  description: string;
  transactionDate: string;
  userId: string;
}) {
  return db.transaction.create({
    data: {
      amountCents: 500,
      categoryId,
      description,
      transactionDate: new Date(`${transactionDate}T00:00:00.000Z`),
      type: TransactionType.EXPENSE,
      userId,
    },
  });
}

function provider(
  output: unknown,
  options?: {
    onExtract?: (context: ImportExtractionContext) => void;
    rawOutput?: string;
    throwFirstRetryable?: boolean;
  },
): ImportExtractionProvider {
  let attempts = 0;

  return {
    async extract(_uploads, context) {
      attempts += 1;

      options?.onExtract?.(context);

      if (options?.throwFirstRetryable && attempts === 1) {
        throw Object.assign(new Error('Temporary provider outage'), {
          status: 503,
        });
      }

      return {
        model: 'm5-mocked-model',
        output,
        providerRequestId: 'req_m5_integration',
        rawOutput: options?.rawOutput ?? JSON.stringify(output),
      };
    },
    model: 'm5-mocked-model',
  };
}

beforeEach(() => {
  process.env.EXTRACTION_LOG_ENCRYPTION_KEY = encryptionKey;
});

afterEach(async () => {
  await Promise.all(
    createdUserIds
      .splice(0)
      .map((userId) =>
        db.user.delete({ where: { id: userId } }).catch(() => undefined),
      ),
  );

  if (originalEncryptionKey === undefined) {
    delete process.env.EXTRACTION_LOG_ENCRYPTION_KEY;
  } else {
    process.env.EXTRACTION_LOG_ENCRYPTION_KEY = originalEncryptionKey;
  }
});

describe('M5 in-memory extraction to candidate workflow', () => {
  it('supplies active category choices, normalizes safe textual dates, encrypts raw output, and never writes the ledger', async () => {
    const user = await createUser('successful-extraction');
    const [groceries, transportation] = await Promise.all([
      db.category.findFirstOrThrow({
        where: { normalizedName: 'groceries', userId: user.id },
      }),
      db.category.findFirstOrThrow({
        where: { normalizedName: 'transportation', userId: user.id },
      }),
    ]);

    await db.category.update({
      where: { id: transportation.id },
      data: { archivedAt: new Date() },
    });
    const categoryCount = await db.category.count({
      where: { userId: user.id },
    });
    const rawOutput = '{"private":"Market run"}';
    const suppliedCategoryNames: string[][] = [];
    const result = await processImportForUser(user.id, [upload], {
      provider: provider(
        {
          transactions: [
            {
              amountCents: 1234,
              description: 'Market run',
              notes: 'Weekly shopping',
              suggestedCategory: 'Groceries',
              transactionDate: 'Aug 14, 2026',
              type: 'expense',
            },
            {
              amountCents: 450,
              description: 'Archived category suggestion',
              notes: null,
              suggestedCategory: 'Transportation',
              transactionDate: '2026-09-06',
              type: 'expense',
            },
            {
              amountCents: 725,
              description: 'Unknown category suggestion',
              notes: null,
              suggestedCategory: 'Not a category',
              transactionDate: '2026-09-07',
              type: 'refund',
            },
          ],
        },
        {
          onExtract: ({ activeCategoryNames }) => {
            suppliedCategoryNames.push(activeCategoryNames);
          },
          rawOutput,
        },
      ),
    });

    expect(result.ok).toBe(true);
    const batch = await db.importBatch.findUniqueOrThrow({
      where: { id: result.batch.id },
      include: {
        candidates: { orderBy: { ordinal: 'asc' } },
        extractionLog: true,
      },
    });

    expect(batch).toMatchObject({
      candidateCount: 3,
      fileCount: 1,
      model: 'm5-mocked-model',
      status: ImportBatchStatus.READY_FOR_REVIEW,
    });
    expect(batch.candidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          categoryId: groceries.id,
          ordinal: 1,
          reviewState: CandidateReviewState.PENDING,
        }),
        expect.objectContaining({ categoryId: null, ordinal: 2 }),
        expect.objectContaining({ categoryId: null, ordinal: 3 }),
      ]),
    );
    expect(
      batch.candidates[0]?.transactionDate?.toISOString().slice(0, 10),
    ).toBe('2026-08-14');
    expect(suppliedCategoryNames).toEqual([
      expect.arrayContaining(['Groceries']),
    ]);
    expect(suppliedCategoryNames[0]).not.toContain('Transportation');
    expect(await db.category.count({ where: { userId: user.id } })).toBe(
      categoryCount,
    );
    await expect(
      db.transaction.count({ where: { importBatchId: batch.id } }),
    ).resolves.toBe(0);
    expect(batch.extractionLog).toMatchObject({
      providerRequestId: 'req_m5_integration',
      status: ExtractionLogStatus.SUCCEEDED,
    });
    expect(batch.extractionLog?.rawOutputCiphertext).not.toContain(
      'Market run',
    );
    expect(
      decryptRawOutputForTest(
        batch.extractionLog?.rawOutputCiphertext ?? '',
        encryptionKey,
      ),
    ).toBe(rawOutput);
  });

  it('supplies only active, consistent merchant/category hints from the importing user', async () => {
    const owner = await createUser('merchant-hints-owner');
    const otherUser = await createUser('merchant-hints-other-user');
    const [
      coffeeAndSnacks,
      groceries,
      restaurants,
      transportation,
      otherCoffee,
    ] = await Promise.all([
      db.category.findFirstOrThrow({
        where: { normalizedName: 'coffee and snacks', userId: owner.id },
      }),
      db.category.findFirstOrThrow({
        where: { normalizedName: 'groceries', userId: owner.id },
      }),
      db.category.findFirstOrThrow({
        where: { normalizedName: 'restaurants', userId: owner.id },
      }),
      db.category.findFirstOrThrow({
        where: { normalizedName: 'transportation', userId: owner.id },
      }),
      db.category.findFirstOrThrow({
        where: {
          normalizedName: 'coffee and snacks',
          userId: otherUser.id,
        },
      }),
    ]);

    await Promise.all([
      createConfirmedTransaction({
        categoryId: coffeeAndSnacks.id,
        description: 'ENGINEERING SOCIETY',
        transactionDate: '2026-09-04',
        userId: owner.id,
      }),
      createConfirmedTransaction({
        categoryId: groceries.id,
        description: 'FARM BOY',
        transactionDate: '2026-09-03',
        userId: owner.id,
      }),
      createConfirmedTransaction({
        categoryId: restaurants.id,
        description: 'farm boy',
        transactionDate: '2026-09-02',
        userId: owner.id,
      }),
      createConfirmedTransaction({
        categoryId: transportation.id,
        description: 'ARCHIVED TRANSIT SHOP',
        transactionDate: '2026-09-01',
        userId: owner.id,
      }),
      createConfirmedTransaction({
        categoryId: otherCoffee.id,
        description: 'OTHER USER CAFE',
        transactionDate: '2026-09-05',
        userId: otherUser.id,
      }),
    ]);
    await db.category.update({
      where: { id: transportation.id },
      data: { archivedAt: new Date() },
    });

    const suppliedContexts: ImportExtractionContext[] = [];
    const result = await processImportForUser(owner.id, [upload], {
      provider: provider(
        { transactions: [] },
        {
          onExtract: (context) => suppliedContexts.push(context),
        },
      ),
    });

    expect(result.ok).toBe(true);
    expect(suppliedContexts).toHaveLength(1);
    expect(suppliedContexts[0]?.merchantCategoryHints).toEqual([
      {
        categoryName: 'Coffee and snacks',
        merchantName: 'ENGINEERING SOCIETY',
      },
    ]);
  });

  it('records malformed provider output as a safe failed batch and requires a new upload for recovery', async () => {
    const user = await createUser('malformed-and-reupload');
    const failed = await processImportForUser(user.id, [upload], {
      provider: provider(
        { transactions: [{ description: 'Missing required nullable fields' }] },
        { rawOutput: '{"unsafe":"raw provider response"}' },
      ),
    });

    expect(failed).toMatchObject({ ok: false });
    const failedBatch = await db.importBatch.findUniqueOrThrow({
      where: { id: failed.batch.id },
      include: { extractionLog: true },
    });

    expect(failedBatch).toMatchObject({
      candidateCount: 0,
      failureCode: 'invalid_provider_output',
      status: ImportBatchStatus.FAILED,
    });
    expect(failedBatch.extractionLog).toMatchObject({
      status: ExtractionLogStatus.FAILED,
    });
    await expect(
      db.transaction.count({ where: { importBatchId: failedBatch.id } }),
    ).resolves.toBe(0);

    const recovered = await processImportForUser(user.id, [upload], {
      provider: provider({ transactions: [] }),
    });

    expect(recovered).toMatchObject({ ok: true });
    expect(recovered.batch.id).not.toBe(failed.batch.id);
  });

  it('retries a retryable provider failure once, then leaves the candidate batch reviewable', async () => {
    const user = await createUser('bounded-retry');
    let calls = 0;
    const retryProvider: ImportExtractionProvider = {
      async extract() {
        calls += 1;

        if (calls === 1) {
          throw Object.assign(new Error('Try again'), { status: 503 });
        }

        return {
          model: 'm5-retry-model',
          output: { transactions: [] },
          providerRequestId: 'req_m5_retry',
          rawOutput: '{"transactions":[]}',
        };
      },
      model: 'm5-retry-model',
    };

    const result = await processImportForUser(user.id, [upload], {
      provider: retryProvider,
    });

    expect(result).toMatchObject({ ok: true });
    expect(calls).toBe(2);
  });

  it('purges expired ciphertext idempotently and keeps batch metadata', async () => {
    const user = await createUser('retention');
    const result = await processImportForUser(user.id, [upload], {
      provider: provider({ transactions: [] }),
    });

    await db.extractionLog.update({
      where: { importBatchId: result.batch.id },
      data: { expiresAt: new Date('2026-01-01T00:00:00.000Z') },
    });

    await expect(
      purgeExpiredExtractionCiphertext(new Date('2026-02-01T00:00:00.000Z')),
    ).resolves.toBe(1);
    await expect(
      purgeExpiredExtractionCiphertext(new Date('2026-02-01T00:00:00.000Z')),
    ).resolves.toBe(0);
    await expect(
      db.extractionLog.findUniqueOrThrow({
        where: { importBatchId: result.batch.id },
      }),
    ).resolves.toMatchObject({ rawOutputCiphertext: null });
    await expect(
      db.importBatch.findUniqueOrThrow({ where: { id: result.batch.id } }),
    ).resolves.toMatchObject({ status: ImportBatchStatus.READY_FOR_REVIEW });
  });

  it('keeps a newly created extraction batch inaccessible to another user', async () => {
    const owner = await createUser('owner');
    const otherUser = await createUser('other');
    const result = await processImportForUser(owner.id, [upload], {
      provider: provider({ transactions: [] }),
    });

    await expect(
      getImportBatchForUser(otherUser.id, result.batch.id),
    ).rejects.toBeInstanceOf(OwnedRecordNotFoundError);
  });
});
