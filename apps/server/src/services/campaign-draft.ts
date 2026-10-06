import type { Prisma } from '@prisma/client';
import { CampaignDraftSchema, type CampaignDraft } from '@rpg-chains/shared-types';
import { toDraftChapter } from '../mappers/chapter.js';
import { toDraftVillain } from '../mappers/villain.js';
import { toQuestion } from '../mappers/question.js';
import { toItem } from '../mappers/item.js';
import { toDraftClass } from '../mappers/character-class.js';

/**
 * Loads the full editable campaign draft for a given campaign, including all chapters (with
 * their nodes and edges), villains, questions, classes (with skills) and items. Validates the assembled result against
 * `CampaignDraftSchema` before returning.
 */
export async function loadCampaignDraft(
  prisma: Prisma.TransactionClient,
  campaignId: string,
): Promise<CampaignDraft> {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: {
      chapters: {
        orderBy: [{ order: 'asc' }, { id: 'asc' }],
        include: {
          nodes: true,
          edges: true,
        },
      },
      villains: {
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
      },
      questions: {
        orderBy: { id: 'asc' },
      },
      classes: {
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        include: { skills: { orderBy: [{ unlockLevel: 'asc' }, { id: 'asc' }] } },
      },
      items: {
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
      },
    },
  });

  if (!campaign) {
    throw new Error(`Campaign not found: ${campaignId}`);
  }

  return CampaignDraftSchema.parse({
    id: campaign.id,
    name: campaign.name,
    description: campaign.description,
    chapters: campaign.chapters.map(toDraftChapter),
    villains: campaign.villains.map(toDraftVillain),
    questions: campaign.questions.map(toQuestion),
    classes: campaign.classes.map(toDraftClass),
    items: campaign.items.map(toItem),
  });
}
