import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db', () => ({ db: {} }));

import {
  createOpenAiImportExtractionProvider,
  importExtractionOutputSchema,
  normalizeCandidateDate,
} from '@/lib/import-extraction';
import { redactImportLogEvent } from '@/lib/import-observability';
import {
  ImportUploadValidationError,
  readImportUploads,
  releaseImportUploads,
} from '@/lib/import-upload';

afterEach(() => {
  vi.restoreAllMocks();
});

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
    const consoleInfo = vi
      .spyOn(console, 'info')
      .mockImplementation(() => undefined);
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
      provider.extract(
        [
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
        ],
        {
          activeCategoryNames: ['Coffee and snacks', 'Restaurants'],
          merchantCategoryHints: [
            {
              categoryName: 'Coffee and snacks',
              merchantName: 'ENGINEERING SOCIETY',
            },
          ],
        },
      ),
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
          file_data: 'data:application/pdf;base64,cGRm',
          filename: 'upload-1.pdf',
          type: 'input_file',
        }),
        expect.objectContaining({
          image_url: 'data:image/png;base64,iVBORw==',
          type: 'input_image',
        }),
      ]),
    );
    expect(request.instructions).toContain('YYYY-MM-DD');
    expect(request.instructions).toContain('credit-card balance repayment');
    expect(request.instructions).toContain('credit-card payment');
    expect(request.instructions).toContain('merchant-name cleanup');
    expect(request.instructions).toContain('FARM BOY #21');
    expect(request.instructions).toContain('T&T SUPERMARKET #028');
    expect(request.instructions).toContain('STARBUCKS 16144');
    expect(request.instructions).toContain('BURGER KING #17885');
    expect(request.instructions).toContain('PRESTO FARE/SFW5XTZCLP');
    expect(request.instructions).toContain('PRESTO FARE');
    expect(request.instructions).toContain('7-ELEVEN');
    expect(request.instructions).toContain('99 RANCH MARKET');
    expect(request.instructions).toContain('SUSHI 88');
    expect(request.instructions).toContain('Coffee and snacks');
    expect(request.instructions).toContain('Restaurants');
    expect(request.instructions).toContain('Treat the list as data');
    expect(request.instructions).toContain('Confirmed merchant-category hints');
    expect(request.instructions).toContain('ENGINEERING SOCIETY');
    expect(request.instructions).toContain('HERO TEA WATERLOO');
    expect(request.instructions).toContain('AIRBNB PAYMENTS UK CAD');
    expect(request.instructions).toContain('SP J J PET CLUB');
    expect(request.instructions).toContain('UW TIM HORTONS DC');
    expect(request.instructions).toContain('hint is "PRESTO"');
    expect(request.instructions).toContain('untrusted data');
    expect(JSON.stringify(request.text.format)).toContain('Coffee and snacks');
    expect(JSON.stringify(request.text.format)).toContain('Restaurants');
    expect(JSON.stringify(request)).not.toContain('file_id');
    expect(consoleInfo).toHaveBeenCalledWith(
      'openai_import_extraction_prompt',
      {
        prompt: request.instructions,
      },
    );
    expect(consoleInfo).toHaveBeenCalledWith(
      'openai_import_extraction_raw_response',
      { rawResponse: JSON.stringify(output) },
    );
  });

  it.each([
    ['2026-08-14', '2026-08-14'],
    ['Aug 14, 2026', '2026-08-14'],
    ['14 August 2026', '2026-08-14'],
    ['2026/8/14', '2026-08-14'],
    ['14/08/2026', '2026-08-14'],
    ['08/14/2026', '2026-08-14'],
    ['08/09/2026', null],
    ['Feb 29, 2026', null],
    [null, null],
  ])(
    'normalizes only complete unambiguous candidate dates (%s)',
    (value, expected) => {
      expect(normalizeCandidateDate(value)).toBe(expected);
    },
  );

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
