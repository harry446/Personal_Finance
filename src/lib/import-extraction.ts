import 'server-only';

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import { z } from 'zod';

import {
  CandidateReviewState,
  ExtractionLogStatus,
  ImportBatchStatus,
  TransactionType,
} from '@/generated/prisma/client';
import { normalizeCategoryName } from '@/lib/categories';
import { db } from '@/lib/db';
import { logImportEvent } from '@/lib/import-observability';
import { extractionExpiryDate } from '@/lib/import-retention';
import { transactionDateSchema } from '@/lib/ledger-validation';

export const OPENAI_EXTRACTION_MODEL = 'gpt-4.1-mini-2025-04-14';
export const EXTRACTION_PROMPT_VERSION = '2026-09-01-v1';

const MAX_AMOUNT_CENTS = 2_147_483_647;

export const importExtractionOutputSchema = z
  .object({
    transactions: z.array(
      z
        .object({
          amountCents: z
            .number()
            .int()
            .positive()
            .max(MAX_AMOUNT_CENTS)
            .nullable(),
          description: z.string().trim().max(160).nullable(),
          notes: z.string().trim().max(1_000).nullable(),
          suggestedCategory: z.string().trim().max(80).nullable(),
          transactionDate: z.string().trim().nullable(),
          type: z.enum(['expense', 'refund']).nullable(),
        })
        .strict(),
    ),
  })
  .strict();

export type ImportExtractionOutput = z.infer<
  typeof importExtractionOutputSchema
>;

export type ImportUpload = {
  bytes: Uint8Array;
  contentType:
    'application/pdf' | 'image/gif' | 'image/jpeg' | 'image/png' | 'image/webp';
  filename: string;
};

export type RawProviderExtraction = {
  model: string;
  output: unknown;
  providerRequestId: string | null;
  rawOutput: string;
};

export type ImportExtractionProvider = {
  extract(uploads: ImportUpload[]): Promise<RawProviderExtraction>;
  model: string;
};

type OpenAiClient = Pick<OpenAI, 'responses'>;

export class ImportExtractionConfigurationError extends Error {
  constructor() {
    super('Import extraction is not configured.');
    this.name = 'ImportExtractionConfigurationError';
  }
}

class InvalidProviderOutputError extends Error {
  constructor() {
    super('The provider returned an invalid extraction result.');
    this.name = 'InvalidProviderOutputError';
  }
}

export function createOpenAiImportExtractionProvider(options?: {
  apiKey?: string;
  client?: OpenAiClient;
  model?: string;
}): ImportExtractionProvider {
  const apiKey = options?.apiKey ?? process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new ImportExtractionConfigurationError();
  }

  const model = options?.model ?? OPENAI_EXTRACTION_MODEL;
  const client = options?.client ?? new OpenAI({ apiKey });

  return {
    model,
    async extract(uploads) {
      const response = await client.responses.parse({
        input: [
          {
            content: [
              {
                text: `Extract the actual financial transactions from these uploads. Prompt version: ${EXTRACTION_PROMPT_VERSION}.`,
                type: 'input_text',
              },
              ...uploads.map(toOpenAiInput),
            ],
            role: 'user',
          },
        ],
        instructions:
          'Return actual transactions only. Ignore balances, statement totals, credit limits, payment summaries, account summaries, and non-transaction rows. Use positive integer CAD cents for amountCents. Preserve dates exactly when known. Use null, never a guess, for uncertain date, type, amount, description, notes, or suggested category. A suggested category is only a suggestion; never create categories.',
        model,
        store: false,
        text: {
          format: zodTextFormat(
            importExtractionOutputSchema,
            'personal_finance_import_v1',
            {
              description:
                'Untrusted candidate financial transactions for mandatory human review.',
            },
          ),
        },
      });

      return {
        model,
        output: response.output_parsed,
        providerRequestId: response._request_id ?? null,
        rawOutput: response.output_text,
      };
    },
  };
}

export async function processImportForUser(
  userId: string,
  uploads: ImportUpload[],
  options?: { provider?: ImportExtractionProvider },
) {
  const model = options?.provider?.model ?? OPENAI_EXTRACTION_MODEL;
  const batch = await createProcessingBatch(userId, uploads.length, model);
  const startedAt = Date.now();
  let encryptionKey: Buffer | null = null;
  let providerResult: RawProviderExtraction | null = null;

  logImportEvent({ event: 'started', status: 'processing', userId });

  try {
    encryptionKey = readExtractionEncryptionKey();
    const provider =
      options?.provider ?? createOpenAiImportExtractionProvider();

    providerResult = await extractWithOneRetry(provider, uploads);
    const output = parseProviderOutput(providerResult.output);
    const rawOutputCiphertext = encryptRawOutput(
      providerResult.rawOutput,
      encryptionKey,
    );
    const durationMs = Date.now() - startedAt;
    const completedBatch = await completeImportBatch({
      batchId: batch.id,
      durationMs,
      output,
      providerRequestId: providerResult.providerRequestId,
      rawOutputCiphertext,
      userId,
    });

    logImportEvent({
      durationMs,
      event: 'succeeded',
      providerRequestId: providerResult.providerRequestId,
      status: 'ready_for_review',
      userId,
    });

    return { batch: completedBatch, ok: true as const };
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    const failure = describeImportFailure(error);
    const rawOutputCiphertext = encryptFailureOutput(
      providerResult?.rawOutput,
      encryptionKey,
    );
    const failedBatch = await failImportBatch({
      batchId: batch.id,
      durationMs,
      errorCode: failure.code,
      providerRequestId: providerResult?.providerRequestId ?? null,
      rawOutputCiphertext,
      safeMessage: failure.safeMessage,
    });

    logImportEvent({
      durationMs,
      event: 'failed',
      providerRequestId: providerResult?.providerRequestId ?? null,
      status: 'failed',
      userId,
    });

    return {
      batch: failedBatch,
      ok: false as const,
      safeMessage: failure.safeMessage,
    };
  }
}

export function decryptRawOutputForTest(
  ciphertext: string,
  encodedKey: string,
) {
  const [version, ivEncoded, tagEncoded, payloadEncoded] =
    ciphertext.split('.');

  if (
    !version ||
    !ivEncoded ||
    !tagEncoded ||
    !payloadEncoded ||
    version !== 'v1'
  ) {
    throw new Error('Malformed extraction ciphertext.');
  }

  const key = parseExtractionEncryptionKey(encodedKey);
  const decipher = createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(ivEncoded, 'base64url'),
  );

  decipher.setAuthTag(Buffer.from(tagEncoded, 'base64url'));

  return Buffer.concat([
    decipher.update(Buffer.from(payloadEncoded, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

function toOpenAiInput(upload: ImportUpload) {
  const encoded = Buffer.from(upload.bytes).toString('base64');

  if (upload.contentType === 'application/pdf') {
    return {
      file_data: encoded,
      filename: upload.filename,
      type: 'input_file' as const,
    };
  }

  return {
    detail: 'high' as const,
    image_url: `data:${upload.contentType};base64,${encoded}`,
    type: 'input_image' as const,
  };
}

async function createProcessingBatch(
  userId: string,
  fileCount: number,
  model: string,
) {
  return db.importBatch.create({
    data: {
      fileCount,
      model,
      status: ImportBatchStatus.PROCESSING,
      userId,
      extractionLog: {
        create: {
          durationMs: 0,
          expiresAt: extractionExpiryDate(),
          model,
          status: ExtractionLogStatus.PENDING,
        },
      },
    },
  });
}

async function extractWithOneRetry(
  provider: ImportExtractionProvider,
  uploads: ImportUpload[],
) {
  let firstError: unknown;

  try {
    return await provider.extract(uploads);
  } catch (error) {
    firstError = error;
  }

  if (!isRetryableProviderError(firstError)) {
    throw firstError;
  }

  return provider.extract(uploads);
}

function parseProviderOutput(output: unknown): ImportExtractionOutput {
  const parsed = importExtractionOutputSchema.safeParse(output);

  if (!parsed.success) {
    throw new InvalidProviderOutputError();
  }

  return parsed.data;
}

async function completeImportBatch({
  batchId,
  durationMs,
  output,
  providerRequestId,
  rawOutputCiphertext,
  userId,
}: {
  batchId: string;
  durationMs: number;
  output: ImportExtractionOutput;
  providerRequestId: string | null;
  rawOutputCiphertext: string;
  userId: string;
}) {
  return db.$transaction(async (transaction) => {
    const categories = await transaction.category.findMany({
      where: { archivedAt: null, userId },
      select: { id: true, normalizedName: true },
    });
    const categoryIdsByName = new Map(
      categories.map((category) => [category.normalizedName, category.id]),
    );
    const candidates = output.transactions.map((candidate, index) =>
      candidateRecord(candidate, index + 1, categoryIdsByName),
    );

    return transaction.importBatch.update({
      where: { id: batchId },
      data: {
        candidateCount: candidates.length,
        candidates: { create: candidates },
        status: ImportBatchStatus.READY_FOR_REVIEW,
        extractionLog: {
          update: {
            durationMs,
            providerRequestId,
            rawOutputCiphertext,
            status: ExtractionLogStatus.SUCCEEDED,
          },
        },
      },
    });
  });
}

async function failImportBatch({
  batchId,
  durationMs,
  errorCode,
  providerRequestId,
  rawOutputCiphertext,
  safeMessage,
}: {
  batchId: string;
  durationMs: number;
  errorCode: string;
  providerRequestId: string | null;
  rawOutputCiphertext: string | null;
  safeMessage: string;
}) {
  return db.$transaction(async (transaction) =>
    transaction.importBatch.update({
      where: { id: batchId },
      data: {
        failureCode: errorCode,
        failureMessageSafe: safeMessage,
        status: ImportBatchStatus.FAILED,
        extractionLog: {
          update: {
            durationMs,
            errorCode,
            providerRequestId,
            rawOutputCiphertext,
            status: ExtractionLogStatus.FAILED,
          },
        },
      },
    }),
  );
}

function candidateRecord(
  candidate: ImportExtractionOutput['transactions'][number],
  ordinal: number,
  categoryIdsByName: Map<string, string>,
) {
  const suggestedCategoryText = candidate.suggestedCategory?.trim() || null;
  const normalizedCategory = normalizeSuggestedCategory(suggestedCategoryText);

  return {
    amountCents: candidate.amountCents,
    categoryId: normalizedCategory
      ? (categoryIdsByName.get(normalizedCategory) ?? null)
      : null,
    description: candidate.description?.trim() || null,
    notes: candidate.notes?.trim() || null,
    ordinal,
    reviewState: CandidateReviewState.PENDING,
    suggestedCategoryText,
    transactionDate: parseCandidateDate(candidate.transactionDate),
    type:
      candidate.type === 'expense'
        ? TransactionType.EXPENSE
        : candidate.type === 'refund'
          ? TransactionType.REFUND
          : null,
  };
}

function parseCandidateDate(value: string | null) {
  if (!value) {
    return null;
  }

  const parsed = transactionDateSchema.safeParse(value);

  if (!parsed.success) {
    return null;
  }

  return new Date(`${parsed.data}T00:00:00.000Z`);
}

function normalizeSuggestedCategory(value: string | null) {
  if (!value) {
    return null;
  }

  const parsed = z.string().trim().min(1).max(80).safeParse(value);

  return parsed.success ? normalizeCategoryName(parsed.data) : null;
}

function readExtractionEncryptionKey() {
  const encodedKey = process.env.EXTRACTION_LOG_ENCRYPTION_KEY;

  if (!encodedKey) {
    throw new ImportExtractionConfigurationError();
  }

  return parseExtractionEncryptionKey(encodedKey);
}

function parseExtractionEncryptionKey(encodedKey: string) {
  const key = Buffer.from(encodedKey, 'base64');

  if (key.length !== 32) {
    throw new ImportExtractionConfigurationError();
  }

  return key;
}

function encryptRawOutput(rawOutput: string, key: Buffer) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([
    cipher.update(rawOutput, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return `v1.${iv.toString('base64url')}.${tag.toString('base64url')}.${encrypted.toString('base64url')}`;
}

function encryptFailureOutput(
  rawOutput: string | undefined,
  key: Buffer | null,
) {
  if (!rawOutput || !key) {
    return null;
  }

  return encryptRawOutput(rawOutput, key);
}

function describeImportFailure(error: unknown) {
  if (
    error instanceof ImportExtractionConfigurationError ||
    error instanceof InvalidProviderOutputError
  ) {
    return {
      code:
        error instanceof ImportExtractionConfigurationError
          ? 'configuration'
          : 'invalid_provider_output',
      safeMessage:
        error instanceof ImportExtractionConfigurationError
          ? 'Import extraction is temporarily unavailable. No transactions were added.'
          : 'We could not safely prepare a transaction list from those files. No transactions were added.',
    };
  }

  return {
    code: 'provider_unavailable',
    safeMessage:
      'We could not prepare this upload right now. No transactions were added.',
  };
}

function isRetryableProviderError(error: unknown) {
  if (error instanceof ImportExtractionConfigurationError) {
    return false;
  }

  if (error instanceof Error && error.name === 'TypeError') {
    return true;
  }

  if (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    typeof error.status === 'number'
  ) {
    return (
      error.status === 408 ||
      error.status === 409 ||
      error.status === 429 ||
      error.status >= 500
    );
  }

  return false;
}
