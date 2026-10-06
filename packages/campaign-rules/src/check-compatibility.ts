import {
  reachableNodeIds,
  type CampaignSnapshot,
  type Chapter,
  type CharacterClass,
} from '@rpg-chains/shared-types';

/** One row of the spec §2.2.1 "forbidden" table. */
export type CompatibilityRule =
  | 'entity_deleted'
  | 'class_base_changed'
  | 'class_slots_reduced'
  | 'skill_removed'
  | 'graph_entry_changed'
  | 'graph_boss_changed'
  | 'graph_reachability_broken';

export type ReferencedEntity = 'class' | 'skill' | 'question' | 'item' | 'villain' | 'node';

export interface CompatibilityViolation {
  rule: CompatibilityRule;
  entityType: ReferencedEntity;
  entityId: string;
  message: string;
}

/** Class fields that define existing characters' derived values (spec §2.2.1). */
const CLASS_BASE_FIELDS = [
  'baseHp',
  'baseEnergy',
  'hpPerLevel',
  'energyPerLevel',
  'baseWeaponId',
] as const satisfies ReadonlyArray<keyof CharacterClass>;

/** Every id a campaign profile or battle log may reference, grouped by entity type. */
function referencedIds(snapshot: CampaignSnapshot): Record<ReferencedEntity, Set<string>> {
  return {
    class: new Set(snapshot.classes.map((c) => c.id)),
    skill: new Set(snapshot.classes.flatMap((c) => c.skills.map((s) => s.id))),
    question: new Set(snapshot.questions.map((q) => q.id)),
    item: new Set(snapshot.items.map((i) => i.id)),
    villain: new Set(snapshot.villains.map((v) => v.id)),
    node: new Set(snapshot.chapters.flatMap((c) => c.nodes.map((n) => n.id))),
  };
}

function deletedEntities(prev: CampaignSnapshot, next: CampaignSnapshot): CompatibilityViolation[] {
  const before = referencedIds(prev);
  const after = referencedIds(next);
  const violations: CompatibilityViolation[] = [];
  for (const entityType of Object.keys(before) as ReferencedEntity[]) {
    for (const entityId of before[entityType]) {
      if (!after[entityType].has(entityId)) {
        violations.push({
          rule: 'entity_deleted',
          entityType,
          entityId,
          message: `A published ${entityType} cannot be deleted`,
        });
      }
    }
  }
  return violations;
}

function classChanges(prev: CampaignSnapshot, next: CampaignSnapshot): CompatibilityViolation[] {
  const nextClasses = new Map(next.classes.map((c) => [c.id, c]));
  const nextSkillIds = referencedIds(next).skill;
  const violations: CompatibilityViolation[] = [];
  for (const before of prev.classes) {
    const after = nextClasses.get(before.id);
    if (!after) continue; // reported as entity_deleted
    const changed = CLASS_BASE_FIELDS.filter((field) => before[field] !== after[field]);
    if (changed.length > 0) {
      violations.push({
        rule: 'class_base_changed',
        entityType: 'class',
        entityId: before.id,
        message: `Base attributes of a published class cannot change: ${changed.join(', ')}`,
      });
    }
    if (after.maxSlots < before.maxSlots) {
      violations.push({
        rule: 'class_slots_reduced',
        entityType: 'class',
        entityId: before.id,
        message: `Class slots cannot be reduced (${before.maxSlots} → ${after.maxSlots})`,
      });
    }
    const afterSkills = new Set(after.skills.map((s) => s.id));
    for (const skill of before.skills) {
      // A skill gone from the whole campaign is already an entity_deleted violation.
      if (!afterSkills.has(skill.id) && nextSkillIds.has(skill.id)) {
        violations.push({
          rule: 'skill_removed',
          entityType: 'skill',
          entityId: skill.id,
          message: `Skill cannot be removed from class "${before.id}"`,
        });
      }
    }
  }
  return violations;
}

function graphChanges(prev: CampaignSnapshot, next: CampaignSnapshot): CompatibilityViolation[] {
  const nextChapters = new Map<string, Chapter>(next.chapters.map((c) => [c.id, c]));
  const nextNodeIds = referencedIds(next).node;
  const violations: CompatibilityViolation[] = [];
  for (const before of prev.chapters) {
    const after = nextChapters.get(before.id);
    if (after && after.entryNodeId !== before.entryNodeId) {
      violations.push({
        rule: 'graph_entry_changed',
        entityType: 'node',
        entityId: before.entryNodeId,
        message: `The entry node of chapter "${before.id}" cannot change`,
      });
    }
    if (after && after.bossNodeId !== before.bossNodeId) {
      violations.push({
        rule: 'graph_boss_changed',
        entityType: 'node',
        entityId: before.bossNodeId,
        message: `The boss node of chapter "${before.id}" cannot change`,
      });
    }
    const reachableAfter = after ? reachableNodeIds(after) : new Set<string>();
    for (const nodeId of reachableNodeIds(before)) {
      // Deleted nodes are reported as entity_deleted; this catches nodes cut off by edge
      // removals (or moved out of their chapter).
      if (nextNodeIds.has(nodeId) && !reachableAfter.has(nodeId)) {
        violations.push({
          rule: 'graph_reachability_broken',
          entityType: 'node',
          entityId: nodeId,
          message: `Node became unreachable in chapter "${before.id}"`,
        });
      }
    }
  }
  return violations;
}

/**
 * The compatibility gate (spec §2.2.1): every reason `next` would break a room currently
 * playing `prev`. Empty means the new version may roll forward into live rooms. Additive
 * changes, text/art edits, question fixes and number rebalancing are all allowed.
 */
export function checkCompatibility(
  prev: CampaignSnapshot,
  next: CampaignSnapshot,
): CompatibilityViolation[] {
  return [...deletedEntities(prev, next), ...classChanges(prev, next), ...graphChanges(prev, next)];
}
