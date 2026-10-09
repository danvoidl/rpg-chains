import type { Prisma } from '@prisma/client';

/** Upload limits (env `MEDIA_USER_QUOTA_BYTES`, `MEDIA_USER_DAILY_UPLOADS`, `MEDIA_TOTAL_QUOTA_BYTES`). */
export interface MediaQuotas {
  /** Bytes one user may have signed in total. */
  userBytes: number;
  /** Uploads one user may sign in any rolling 24 h. */
  userDailyUploads: number;
  /** Bytes signed by everyone together: the hard ceiling no number of accounts gets past. */
  totalBytes: number;
}

export type QuotaExceeded = 'daily' | 'user' | 'total';

export interface UploadReservation {
  userId: string;
  key: string;
  contentType: string;
  size: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Every reservation takes this one transaction-scoped advisory lock, so concurrent presigns are
 * checked one after another — the total ceiling is global, so a per-user row lock would not do.
 * Uploads are rare; serializing them costs nothing.
 */
const MEDIA_QUOTA_LOCK = 7_301_001;

/**
 * Records an upload in the quota ledger if it fits every limit; returns the limit it breaks
 * otherwise (nothing recorded). Run inside a transaction: the lock holds until it ends.
 */
export async function reserveUpload(
  tx: Prisma.TransactionClient,
  upload: UploadReservation,
  quotas: MediaQuotas,
  now: Date,
): Promise<QuotaExceeded | null> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${MEDIA_QUOTA_LOCK})`;
  const since = new Date(now.getTime() - DAY_MS);
  // SUM over an int column is a bigint in Postgres: summed in SQL, read back as a number.
  const [usage] = await tx.$queryRaw<
    Array<{ userBytes: bigint; userRecent: bigint; totalBytes: bigint }>
  >`
    SELECT
      COALESCE(SUM(size) FILTER (WHERE "userId" = ${upload.userId}), 0)::bigint AS "userBytes",
      COUNT(*) FILTER (WHERE "userId" = ${upload.userId} AND "createdAt" > ${since})::bigint
        AS "userRecent",
      COALESCE(SUM(size), 0)::bigint AS "totalBytes"
    FROM "MediaUpload"`;
  if (!usage) throw new Error('quota usage query returned no row');

  if (Number(usage.userRecent) + 1 > quotas.userDailyUploads) return 'daily';
  if (Number(usage.userBytes) + upload.size > quotas.userBytes) return 'user';
  if (Number(usage.totalBytes) + upload.size > quotas.totalBytes) return 'total';

  await tx.mediaUpload.create({ data: { ...upload, createdAt: now } });
  return null;
}
