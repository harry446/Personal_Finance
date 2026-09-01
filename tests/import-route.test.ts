import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  authMock,
  getSessionUserIdMock,
  processImportMock,
  purgeMock,
  readUploadsMock,
  releaseUploadsMock,
} = vi.hoisted(() => ({
  authMock: vi.fn(),
  getSessionUserIdMock: vi.fn(),
  processImportMock: vi.fn(),
  purgeMock: vi.fn(),
  readUploadsMock: vi.fn(),
  releaseUploadsMock: vi.fn(),
}));

const { ImportUploadValidationError } = vi.hoisted(() => ({
  ImportUploadValidationError: class ImportUploadValidationError extends Error {},
}));

vi.mock('@/auth', () => ({ auth: authMock }));
vi.mock('@/lib/current-user', () => ({
  getSessionUserId: getSessionUserIdMock,
}));
vi.mock('@/lib/import-extraction', () => ({
  processImportForUser: processImportMock,
}));
vi.mock('@/lib/import-retention', () => ({
  purgeExpiredExtractionCiphertext: purgeMock,
}));
vi.mock('@/lib/import-upload', () => ({
  ImportUploadValidationError,
  readImportUploads: readUploadsMock,
  releaseImportUploads: releaseUploadsMock,
}));

import { POST } from '@/app/api/imports/route';
function multipartRequest(formData: FormData) {
  return {
    formData: () => Promise.resolve(formData),
    headers: new Headers({
      'content-type': 'multipart/form-data; boundary=playwright-test',
    }),
    url: 'http://localhost:3000/api/imports',
  } as unknown as Request;
}

describe('authenticated multipart import route', () => {
  beforeEach(() => {
    authMock.mockReset();
    getSessionUserIdMock.mockReset();
    processImportMock.mockReset();
    purgeMock.mockReset();
    readUploadsMock.mockReset();
    releaseUploadsMock.mockReset();
    authMock.mockResolvedValue({ user: { id: 'user-1' } });
    getSessionUserIdMock.mockReturnValue('user-1');
    purgeMock.mockResolvedValue(0);
  });

  it('rejects unauthenticated requests before reading multipart data', async () => {
    getSessionUserIdMock.mockReturnValue(null);

    const response = await POST(
      new Request('http://localhost:3000/api/imports', {
        method: 'POST',
      }),
    );

    expect(response.status).toBe(401);
    expect(readUploadsMock).not.toHaveBeenCalled();
  });

  it('rejects non-multipart and cross-origin requests with safe messages', async () => {
    const nonMultipart = await POST(
      new Request('http://localhost:3000/api/imports', { method: 'POST' }),
    );
    const crossOrigin = await POST(
      new Request('http://localhost:3000/api/imports', {
        headers: { origin: 'https://attacker.example' },
        method: 'POST',
      }),
    );

    expect(nonMultipart.status).toBe(400);
    expect(await nonMultipart.json()).toEqual({
      error: 'Upload files using the import form.',
    });
    expect(crossOrigin.status).toBe(403);
  });

  it('passes request-memory uploads to the user-scoped processor and returns the review batch', async () => {
    const formData = new FormData();

    formData.append(
      'files',
      new File(['PDF'], 'statement.pdf', { type: 'application/pdf' }),
    );
    const uploads = [
      {
        bytes: new Uint8Array([80, 68, 70]),
        contentType: 'application/pdf',
        filename: 'upload-1.pdf',
      },
    ];
    readUploadsMock.mockResolvedValue(uploads);
    processImportMock.mockResolvedValue({
      batch: { id: 'batch-ready', status: 'READY_FOR_REVIEW' },
      ok: true,
    });

    const response = await POST(multipartRequest(formData));

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      batchId: 'batch-ready',
      message: 'Your files are ready for review.',
      status: 'READY_FOR_REVIEW',
    });
    expect(processImportMock).toHaveBeenCalledWith('user-1', uploads);
    expect(releaseUploadsMock).toHaveBeenCalledWith(uploads);
  });

  it('returns a safe client error for invalid file metadata', async () => {
    const formData = new FormData();

    formData.append(
      'files',
      new File(['CSV'], 'history.csv', { type: 'text/csv' }),
    );
    readUploadsMock.mockRejectedValue(
      new ImportUploadValidationError(
        'Use PDF, PNG, JPEG, WEBP, or GIF files for import.',
      ),
    );

    const response = await POST(multipartRequest(formData));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: 'Use PDF, PNG, JPEG, WEBP, or GIF files for import.',
    });
  });
});
