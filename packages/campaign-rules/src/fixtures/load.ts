import { readFileSync } from 'node:fs';
import { CampaignDraftSchema, type CampaignDraft } from '@rpg-chains/shared-types';

/** A fresh, deep copy of the valid draft fixture (tests mutate it freely). */
export function validDraft(): CampaignDraft {
  const raw: unknown = JSON.parse(
    readFileSync(new URL('./valid-draft.json', import.meta.url), 'utf8'),
  );
  return CampaignDraftSchema.parse(raw);
}
