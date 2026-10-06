import type { Prisma } from '@prisma/client';
import { CampaignSnapshotSchema } from '@rpg-chains/shared-types';
import { checkCompatibility, draftToSnapshot, draftWarnings } from '@rpg-chains/campaign-rules';
import { loadCampaignDraft } from './campaign-draft.js';

/**
 * Publishing (spec §2.2, Fase 1 plan M5): runs the validation gate and, from the second publish
 * on, the compatibility gate against the latest version, then stores the next immutable snapshot
 * with the non-blocking balancing warnings. Both gates are pure (`campaign-rules`); this only
 * loads, decides and persists. Run it inside a transaction.
 */
export async function publishCampaign(tx: Prisma.TransactionClient, campaignId: string) {
  const draft = await loadCampaignDraft(tx, campaignId);
  const latest = await tx.campaignVersion.findFirst({
    where: { campaignId },
    orderBy: { version: 'desc' },
  });
  const built = draftToSnapshot(draft, (latest?.version ?? 0) + 1);
  if (!built.ok) return { status: 'invalid', issues: built.issues } as const;

  if (latest) {
    const violations = checkCompatibility(
      CampaignSnapshotSchema.parse(latest.snapshot),
      built.snapshot,
    );
    if (violations.length > 0) return { status: 'incompatible', violations } as const;
  }
  const created = await tx.campaignVersion.create({
    data: {
      campaignId,
      version: built.snapshot.version,
      snapshot: built.snapshot as Prisma.InputJsonValue,
    },
    select: { id: true, version: true, publishedAt: true },
  });
  return { status: 'published', version: created, warnings: draftWarnings(draft) } as const;
}
