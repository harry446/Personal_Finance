import 'server-only';

import { db } from '@/lib/db';

export const RAW_EXTRACTION_RETENTION_DAYS = 30;

export function extractionExpiryDate(now = new Date()) {
  const expiresAt = new Date(now);

  expiresAt.setUTCDate(expiresAt.getUTCDate() + RAW_EXTRACTION_RETENTION_DAYS);

  return expiresAt;
}

export async function purgeExpiredExtractionCiphertext(now = new Date()) {
  const result = await db.extractionLog.updateMany({
    data: { rawOutputCiphertext: null },
    where: {
      expiresAt: { lte: now },
      rawOutputCiphertext: { not: null },
    },
  });

  return result.count;
}
