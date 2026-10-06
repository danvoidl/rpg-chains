import type { FastifyInstance } from 'fastify';
import { loadCampaignDraft } from '../services/campaign-draft.js';

/** Campaign draft route: returns the full editable draft for a campaign. */
export default async function campaignDraftRoutes(app: FastifyInstance): Promise<void> {
  const preHandler = [app.authenticate, app.requireCampaignOwner];

  /** GET / — load and return the full campaign draft. */
  app.get<{ Params: { campaignId: string } }>('/', { preHandler }, async (request) => {
    return loadCampaignDraft(app.prisma, request.params.campaignId);
  });
}
