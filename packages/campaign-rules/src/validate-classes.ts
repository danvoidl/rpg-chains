import {
  MAX_HP_REDUCTION_MAX_DURATION,
  REVIVE_MAX_HEALTH_PERCENT,
  STUN_MAX_DURATION,
} from '@rpg-chains/game-config';
import {
  CharacterClassSchema,
  type CampaignDraft,
  type DraftClass,
  type DraftSkill,
  type Item,
} from '@rpg-chains/shared-types';
import { ALLOWED_TARGETS } from '@rpg-chains/shared-types';
import { formatPath, type DraftIssue } from './issues.js';
import { toSnapshotClass } from './snapshot-mapping.js';

/** Hard rules of one skill (spec §5.6): no free spam, sane target, capped control effects. */
function skillIssues(skill: DraftSkill, at: (...rest: Array<string | number>) => string) {
  const issues: Array<Omit<DraftIssue, 'classId' | 'skillId'>> = [];
  const { effect } = skill;
  if (skill.energyCost === 0 && skill.cooldownRounds === 0) {
    issues.push({
      code: 'skill_free',
      path: at('energyCost'),
      message: 'A skill cannot have zero energy cost and zero cooldown',
    });
  }
  if (effect.type !== 'provoke' && !ALLOWED_TARGETS[effect.type].includes(effect.target)) {
    issues.push({
      code: 'invalid_target',
      path: at('effect', 'target'),
      message: `Target "${effect.target}" is not allowed for effect "${effect.type}"`,
    });
  }
  const cap =
    effect.type === 'stun'
      ? STUN_MAX_DURATION
      : effect.type === 'max_hp_reduction'
        ? MAX_HP_REDUCTION_MAX_DURATION
        : null;
  if (cap !== null && 'duration' in effect && effect.duration > cap) {
    issues.push({
      code: 'duration_over_cap',
      path: at('effect', 'duration'),
      message: `Duration of "${effect.type}" is capped at ${cap} round(s)`,
    });
  }
  if (effect.type === 'revive' && effect.healthPercent > REVIVE_MAX_HEALTH_PERCENT) {
    issues.push({
      code: 'revive_over_cap',
      path: at('effect', 'healthPercent'),
      message: `Revive restores at most ${REVIVE_MAX_HEALTH_PERCENT}% health`,
    });
  }
  return issues;
}

/** Blocking issues of one class; usable on its own by the class editor for live feedback. */
export function validateClass(
  cls: DraftClass,
  index: number,
  items: ReadonlyMap<string, Item>,
): DraftIssue[] {
  const classId = cls.id;
  const at = (...rest: Array<string | number>) => formatPath(['classes', index, ...rest]);
  const issues: DraftIssue[] = [];

  const weapon = cls.baseWeaponId === null ? undefined : items.get(cls.baseWeaponId);
  if (!weapon || weapon.category !== 'equipment' || weapon.slot !== 'weapon') {
    issues.push({
      code: 'base_weapon_invalid',
      path: at('baseWeaponId'),
      message: 'The class needs a base weapon (an equipment item in the weapon slot)',
      classId,
    });
  }

  cls.skills.forEach((skill, s) => {
    const skillAt = (...rest: Array<string | number>) => at('skills', s, ...rest);
    for (const issue of skillIssues(skill, skillAt)) {
      issues.push({ ...issue, classId, skillId: skill.id });
    }
  });

  // Shape check against the snapshot schema; skip paths already explained above.
  const parsed = CharacterClassSchema.safeParse(toSnapshotClass(cls));
  if (!parsed.success) {
    const covered = issues.map((i) => i.path);
    for (const zodIssue of parsed.error.issues) {
      const path = at(...zodIssue.path);
      if (covered.some((p) => path.startsWith(p))) continue;
      const skillIndex = zodIssue.path[0] === 'skills' ? zodIssue.path[1] : undefined;
      const skillId = typeof skillIndex === 'number' ? cls.skills[skillIndex]?.id : undefined;
      issues.push({ code: 'schema', path, message: zodIssue.message, classId, skillId });
    }
  }
  return issues;
}

/**
 * Validation-gate checks for classes and skills (spec §5, Fase 1b plan decision 2): at least one
 * class, a valid base weapon per class, and the hard skill rules. Balancing bands are warnings,
 * see `draftWarnings`.
 */
export function validateClasses(draft: CampaignDraft): DraftIssue[] {
  if (draft.classes.length === 0) {
    return [{ code: 'no_classes', path: 'classes', message: 'At least one class is required' }];
  }
  const items = new Map(draft.items.map((item) => [item.id, item]));
  return draft.classes.flatMap((cls, index) => validateClass(cls, index, items));
}
