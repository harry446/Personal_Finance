import { timingSafeEqual } from 'node:crypto';

import { purgeExpiredExtractionCiphertext } from '@/lib/import-retention';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  const secret = process.env.EXTRACTION_PURGE_SECRET;
  const authorization = request.headers.get('authorization');

  if (!secret || !hasMatchingBearerToken(authorization, secret)) {
    return Response.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const deleted = await purgeExpiredExtractionCiphertext();

  console.info('extraction_retention_purged', { deleted });

  return Response.json({ deleted });
}

function hasMatchingBearerToken(
  authorization: string | null,
  expectedSecret: string,
) {
  const suppliedSecret = authorization?.replace(/^Bearer\s+/, '');

  if (!suppliedSecret) {
    return false;
  }

  const supplied = Buffer.from(suppliedSecret);
  const expected = Buffer.from(expectedSecret);

  return (
    supplied.length === expected.length && timingSafeEqual(supplied, expected)
  );
}
