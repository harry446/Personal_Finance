import { auth } from '@/auth';
import { getSessionUserId } from '@/lib/current-user';
import {
  processImportForUser,
  type ImportUpload,
} from '@/lib/import-extraction';
import {
  ImportUploadValidationError,
  readImportUploads,
  releaseImportUploads,
} from '@/lib/import-upload';
import { purgeExpiredExtractionCiphertext } from '@/lib/import-retention';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return Response.json(
      { error: 'This request was not accepted.' },
      { status: 403 },
    );
  }

  const userId = getSessionUserId(await auth());

  if (!userId) {
    return Response.json(
      { error: 'Sign in to import transactions.' },
      { status: 401 },
    );
  }

  let uploads: ImportUpload[] = [];

  try {
    if (
      !request.headers.get('content-type')?.startsWith('multipart/form-data')
    ) {
      throw new ImportUploadValidationError(
        'Upload files using the import form.',
      );
    }

    const formData = await request.formData();

    uploads = await readImportUploads(formData.getAll('files'));
    await purgeExpiredExtractionCiphertext().catch(() => undefined);

    const result = await processImportForUser(userId, uploads);

    return Response.json(
      {
        batchId: result.batch.id,
        message: result.ok
          ? 'Your files are ready for review.'
          : result.safeMessage,
        status: result.batch.status,
      },
      { status: result.ok ? 201 : 422 },
    );
  } catch (error) {
    if (error instanceof ImportUploadValidationError) {
      return Response.json({ error: error.message }, { status: 400 });
    }

    return Response.json(
      { error: 'We could not start this import. Please try a new upload.' },
      { status: 500 },
    );
  } finally {
    releaseImportUploads(uploads);
  }
}

function isSameOriginRequest(request: Request) {
  const origin = request.headers.get('origin');

  if (!origin) {
    return true;
  }

  try {
    const expectedOrigin = new URL(
      process.env.NEXT_PUBLIC_APP_URL ?? request.url,
    ).origin;

    return new URL(origin).origin === expectedOrigin;
  } catch {
    return false;
  }
}
