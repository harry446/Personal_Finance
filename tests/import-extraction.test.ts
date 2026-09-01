import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db', () => ({ db: {} }));

import {
  createOpenAiImportExtractionProvider,
  importExtractionOutputSchema,
} from '@/lib/import-extraction';
import { redactImportLogEvent } from '@/lib/import-observability';
import {
  ImportUploadValidationError,
  readImportUploads,
  releaseImportUploads,
} from '@/lib/import-upload';

const output = {
  transactions: [
    {
      amountCents: 1234,
      description: 'Market run',
      notes: null,
      suggestedCategory: 'Groceries',
      transactionDate: '2026-09-05',
      type: 'expense',
    },
  ],
};

describe('M5 OpenAI extraction boundary', () => {
  it('sends direct PDF/image inputs with strict structured output and store disabled', async () => {
    const parse = vi.fn().mockResolvedValue({
      _request_id: 'req_m5_contract',
      output_parsed: output,
      output_text: JSON.stringify(output),
    });
    const provider = createOpenAiImportExtractionProvider({
      apiKey: 'test-key',
      client: { responses: { parse } } as never,
      model: 'test-extraction-model',
    });

    await expect(
      provider.extract([
        {
          bytes: new Uint8Array([112, 100, 102]),
          contentType: 'application/pdf',
          filename: 'upload-1.pdf',
        },
        {
          bytes: new Uint8Array([137, 80, 78, 71]),
          contentType: 'image/png',
          filename: 'upload-2.png',
        },
      ]),
    ).resolves.toMatchObject({
      model: 'test-extraction-model',
      providerRequestId: 'req_m5_contract',
    });

    const request = parse.mock.calls[0]?.[0];

    expect(request).toMatchObject({
      model: 'test-extraction-model',
      store: false,
      text: {
        format: {
          type: 'json_schema',
        },
      },
    });
    expect(request.input[0].content).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          file_data: 'cGRm',
          filename: 'upload-1.pdf',
          type: 'input_file',
        }),
        expect.objectContaining({
          image_url: 'data:image/png;base64,iVBORw==',
          type: 'input_image',
        }),
      ]),
    );
    expect(JSON.stringify(request)).not.toContain('file_id');
  });

  it('keeps the model response schema strict and nullable for uncertain values', () => {
    expect(
      importExtractionOutputSchema.parse({
        transactions: [
          {
            amountCents: null,
            description: null,
            notes: null,
            suggestedCategory: null,
            transactionDate: null,
            type: null,
          },
        ],
      }),
    ).toBeTruthy();
    expect(() =>
      importExtractionOutputSchema.parse({
        transactions: [{ description: 'Unexpected partial row' }],
      }),
    ).toThrow();
  });
});

describe('M5 upload validation and log redaction', () => {
  it('accepts only non-empty supported in-memory file types and releases byte buffers', async () => {
    const file = new File(['PDF'], 'statement.pdf', {
      type: 'application/pdf',
    });
    const uploads = await readImportUploads([file]);

    expect(uploads[0]).toMatchObject({
      contentType: 'application/pdf',
      filename: 'upload-1.pdf',
    });
    releaseImportUploads(uploads);
    expect(uploads).toEqual([]);

    await expect(
      readImportUploads([
        new File(['csv'], 'history.csv', { type: 'text/csv' }),
      ]),
    ).rejects.toBeInstanceOf(ImportUploadValidationError);
    const partiallyReadBuffer = new Uint8Array([9, 8, 7]);
    const inMemoryPdf = {
      arrayBuffer: () => Promise.resolve(partiallyReadBuffer.buffer),
      size: partiallyReadBuffer.byteLength,
      type: 'application/pdf',
    } as File;

    await expect(
      readImportUploads([
        inMemoryPdf,
        new File(['csv'], 'history.csv', { type: 'text/csv' }),
      ]),
    ).rejects.toBeInstanceOf(ImportUploadValidationError);
    expect([...partiallyReadBuffer]).toEqual([0, 0, 0]);
    await expect(
      readImportUploads([
        new File([], 'blank.pdf', { type: 'application/pdf' }),
      ]),
    ).rejects.toThrow(/cannot be empty/i);
  });

  it('redacts user identity and never creates fields for content or file names', () => {
    const event = redactImportLogEvent({
      durationMs: 48,
      event: 'succeeded',
      providerRequestId: 'req_m5_redacted',
      status: 'ready_for_review',
      userId: 'person@example.com',
    });

    expect(event).toMatchObject({
      event: 'succeeded',
      providerRequestId: 'req_m5_redacted',
      status: 'ready_for_review',
    });
    expect(event.userHash).not.toBe('person@example.com');
    expect(JSON.stringify(event)).not.toMatch(
      /person@example|statement|Market/,
    );
  });
});
