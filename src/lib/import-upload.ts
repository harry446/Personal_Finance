import 'server-only';

import type { ImportUpload } from '@/lib/import-extraction';

const supportedContentTypes = {
  'application/pdf': '.pdf',
  'image/gif': '.gif',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
} as const;

type SupportedImportContentType = keyof typeof supportedContentTypes;

export const importFileAccept =
  '.pdf,application/pdf,image/png,image/jpeg,image/webp,image/gif';

export class ImportUploadValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImportUploadValidationError';
  }
}

export async function readImportUploads(values: FormDataEntryValue[]) {
  if (values.length === 0) {
    throw new ImportUploadValidationError(
      'Choose at least one PDF, screenshot, or image to import.',
    );
  }

  const uploads: ImportUpload[] = [];

  try {
    for (const [index, value] of values.entries()) {
      if (typeof value === 'string' || !isFileUpload(value)) {
        throw new ImportUploadValidationError('Choose valid files to import.');
      }

      const contentType =
        value.type.toLowerCase() as SupportedImportContentType;

      if (!(contentType in supportedContentTypes)) {
        throw new ImportUploadValidationError(
          'Use PDF, PNG, JPEG, WEBP, or GIF files for import.',
        );
      }

      if (value.size <= 0) {
        throw new ImportUploadValidationError(
          'Uploaded files cannot be empty.',
        );
      }

      const bytes = new Uint8Array(await value.arrayBuffer());

      if (bytes.byteLength === 0) {
        throw new ImportUploadValidationError(
          'Uploaded files cannot be empty.',
        );
      }

      uploads.push({
        bytes,
        contentType,
        filename: `upload-${index + 1}${supportedContentTypes[contentType]}`,
      });
    }
  } catch (error) {
    releaseImportUploads(uploads);
    throw error;
  }

  return uploads;
}
export function releaseImportUploads(uploads: ImportUpload[]) {
  for (const upload of uploads) {
    upload.bytes.fill(0);
  }

  uploads.splice(0, uploads.length);
}

function isFileUpload(value: FormDataEntryValue): value is File {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof value.arrayBuffer === 'function' &&
    typeof value.size === 'number' &&
    typeof value.type === 'string'
  );
}
