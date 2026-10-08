import { CampaignSnapshotSchema, type CampaignSnapshot } from '@rpg-chains/shared-types';
import basic from './snapshot-basic.json';
import catalog from './snapshot-catalog.json';

export { kitSnapshot } from './kit-snapshot.js';

/**
 * Engine fixtures are published snapshots (Fase 3 plan M0): battle content is derived from a
 * snapshot, exactly as the server will do it. Parsing proves each fixture matches the shared
 * contract and returns a fresh copy tests may mutate.
 */

/** Stage A: two basic-attack classes, one villain, objective questions only. */
export function basicSnapshot(): CampaignSnapshot {
  return CampaignSnapshotSchema.parse(structuredClone(basic));
}

/** Stage B: all 13 effect types as level-1 skills, plus a heal and an energy consumable. */
export function catalogSnapshot(): CampaignSnapshot {
  return CampaignSnapshotSchema.parse(structuredClone(catalog));
}
