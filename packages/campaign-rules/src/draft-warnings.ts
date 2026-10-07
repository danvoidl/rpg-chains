import {
  CLASS_BASE_RANGES,
  DISPEL_AMOUNT_BANDS,
  EFFECT_DURATION_BAND,
  MAX_HP_REDUCTION_MAX_DURATION,
  MIN_RECOMMENDED_TOTAL_SLOTS,
  PROVOKE_DURATION_BAND,
  REVIVE_HEALTH_PERCENT_BANDS,
  SKILL_COOLDOWN_RANGE,
  SKILL_ENERGY_COST_RANGE,
  SKILL_MAGNITUDE_BANDS,
  STAT_MODIFIER_BANDS,
  STUN_MAX_DURATION,
  type MagnitudeBands,
  type Range,
} from '@rpg-chains/game-config';
import type {
  CampaignDraft,
  DraftClass,
  DraftSkill,
  Effect,
  Magnitude,
  ModifiableStat,
} from '@rpg-chains/shared-types';
import { isAreaEffect } from '@rpg-chains/shared-types';
import { formatPath, type DraftWarning, type DraftWarningCode } from './issues.js';

type Path = Array<string | number>;

/** A value checked against a band, before it becomes a warning. */
interface BandCheck {
  code: DraftWarningCode;
  path: Path;
  value: number;
  band: Range;
  label: string;
}

function magnitudeChecks(magnitude: Magnitude, bands: MagnitudeBands, path: Path): BandCheck[] {
  const code: DraftWarningCode = 'magnitude_out_of_band';
  switch (magnitude.mode) {
    case 'fixed':
      return bands.fixed
        ? [
            {
              code,
              path: [...path, 'value'],
              value: magnitude.value,
              band: bands.fixed,
              label: 'Magnitude',
            },
          ]
        : [];
    case 'percent':
      return bands.percent
        ? [
            {
              code,
              path: [...path, 'percent'],
              value: magnitude.percent,
              band: bands.percent,
              label: 'Percent',
            },
          ]
        : [];
    case 'scaling':
      return [
        ...(bands.scalingBase
          ? [
              {
                code,
                path: [...path, 'base'],
                value: magnitude.base,
                band: bands.scalingBase,
                label: 'Scaling base',
              },
            ]
          : []),
        ...(bands.scalingScale
          ? [
              {
                code,
                path: [...path, 'scale'],
                value: magnitude.scale,
                band: bands.scalingScale,
                label: 'Scale',
              },
            ]
          : []),
      ];
  }
}

/** Kind of stat a flat buff/debuff modifies, which picks its flat band. */
function statKind(stat: ModifiableStat): 'attribute' | 'damage' | 'defense' {
  return stat === 'damage' || stat === 'defense' ? stat : 'attribute';
}

function effectChecks(effect: Effect, path: Path): BandCheck[] {
  const side = isAreaEffect(effect) ? 'area' : 'single';
  const code: DraftWarningCode = 'magnitude_out_of_band';
  const checks: BandCheck[] = [];
  switch (effect.type) {
    case 'damage':
    case 'heal':
    case 'restore_energy':
    case 'shield':
    case 'max_hp_reduction':
      checks.push(
        ...magnitudeChecks(effect.magnitude, SKILL_MAGNITUDE_BANDS[effect.type][side], [
          ...path,
          'magnitude',
        ]),
      );
      break;
    case 'damage_over_time':
    case 'heal_over_time':
      checks.push(
        ...magnitudeChecks(effect.magnitudePerRound, SKILL_MAGNITUDE_BANDS[effect.type][side], [
          ...path,
          'magnitudePerRound',
        ]),
      );
      break;
    case 'buff_attribute':
    case 'debuff_attribute': {
      const bands = STAT_MODIFIER_BANDS[side];
      checks.push(
        ...magnitudeChecks(
          effect.magnitude,
          { percent: bands.percent, fixed: bands.flat[statKind(effect.attribute)] },
          [...path, 'magnitude'],
        ),
      );
      break;
    }
    case 'revive':
      checks.push({
        code,
        path: [...path, 'healthPercent'],
        value: effect.healthPercent,
        band: REVIVE_HEALTH_PERCENT_BANDS[side],
        label: 'Revive health percent',
      });
      break;
    case 'dispel':
      checks.push({
        code,
        path: [...path, 'amount'],
        value: effect.amount,
        band: DISPEL_AMOUNT_BANDS[side],
        label: 'Dispel amount',
      });
      break;
    case 'provoke':
    case 'stun':
      break;
  }

  if ('duration' in effect) {
    // Over a hard cap is already a blocking issue; do not warn about it twice.
    const cap =
      effect.type === 'stun'
        ? STUN_MAX_DURATION
        : effect.type === 'max_hp_reduction'
          ? MAX_HP_REDUCTION_MAX_DURATION
          : Infinity;
    if (effect.duration <= cap) {
      checks.push({
        code: 'duration_out_of_band',
        path: [...path, 'duration'],
        value: effect.duration,
        band: effect.type === 'provoke' ? PROVOKE_DURATION_BAND : EFFECT_DURATION_BAND,
        label: 'Duration',
      });
    }
  }
  return checks;
}

function skillChecks(skill: DraftSkill, path: Path): BandCheck[] {
  return [
    {
      code: 'skill_cost_out_of_band',
      path: [...path, 'energyCost'],
      value: skill.energyCost,
      band: SKILL_ENERGY_COST_RANGE,
      label: 'Energy cost',
    },
    {
      code: 'skill_cooldown_out_of_band',
      path: [...path, 'cooldownRounds'],
      value: skill.cooldownRounds,
      band: SKILL_COOLDOWN_RANGE,
      label: 'Cooldown',
    },
    ...effectChecks(skill.effect, [...path, 'effect']),
  ];
}

function toWarnings(checks: BandCheck[], ids: Pick<DraftWarning, 'classId' | 'skillId'>) {
  return checks
    .filter(({ value, band }) => value < band.min || value > band.max)
    .map(({ code, path, value, band, label }): DraftWarning => ({
      code,
      path: formatPath(path),
      message: `${label} ${value} is outside the recommended ${band.min}–${band.max}`,
      value,
      band: { min: band.min, max: band.max },
      ...ids,
    }));
}

/** Balancing warnings of one class and its skills (spec §4.3, §5.6); `index` builds the paths. */
export function classWarnings(cls: DraftClass, index: number): DraftWarning[] {
  const classId = cls.id;
  const base = (Object.keys(CLASS_BASE_RANGES) as Array<keyof typeof CLASS_BASE_RANGES>).map(
    (field): BandCheck => ({
      code: 'class_base_out_of_band',
      path: ['classes', index, field],
      value: cls[field],
      band: CLASS_BASE_RANGES[field],
      label: field,
    }),
  );
  return [
    ...toWarnings(base, { classId }),
    ...cls.skills.flatMap((skill, s) =>
      toWarnings(skillChecks(skill, ['classes', index, 'skills', s]), {
        classId,
        skillId: skill.id,
      }),
    ),
  ];
}

/**
 * Non-blocking balancing warnings of the whole draft (Fase 1b plan, decision 2): values outside
 * the recommended bands in `game-config`, and too few class slots for a whole group (spec §5.2).
 * Publishing is allowed; the editor asks the author to confirm.
 */
export function draftWarnings(draft: CampaignDraft): DraftWarning[] {
  const warnings = draft.classes.flatMap((cls, index) => classWarnings(cls, index));
  const totalSlots = draft.classes.reduce((sum, cls) => sum + cls.maxSlots, 0);
  if (draft.classes.length > 0 && totalSlots < MIN_RECOMMENDED_TOTAL_SLOTS) {
    warnings.push({
      code: 'total_slots_low',
      path: 'classes',
      message: `Classes add up to ${totalSlots} slots; at least ${MIN_RECOMMENDED_TOTAL_SLOTS} are recommended`,
      value: totalSlots,
      // Open-ended band: anything at or above the minimum is fine.
      band: { min: MIN_RECOMMENDED_TOTAL_SLOTS, max: Number.MAX_SAFE_INTEGER },
    });
  }
  return warnings;
}
