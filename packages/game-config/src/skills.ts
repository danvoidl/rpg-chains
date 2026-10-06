/**
 * Skill balancing bands and hard caps (spec §5.6, docs/phase-1b-kit-draft.md). Bands are
 * recommendations — outside them the editor warns and asks for confirmation; caps block publish.
 * Percentages are in percentage points (`160` = 160%); debuff magnitudes are positive, the effect
 * type gives the sign. Values are at the skill's unlock level.
 */

export interface Range {
  min: number;
  max: number;
}

/** Recommended bands per magnitude mode; a missing mode has no recommendation. */
export interface MagnitudeBands {
  fixed?: Range;
  percent?: Range;
  scalingBase?: Range;
  scalingScale?: Range;
}

/** Bands for single-target and area (`all_allies`/`all_enemies`) versions of an effect. */
export interface TargetedBands<T> {
  single: T;
  area: T;
}

/** Magnitude bands of the effect types that carry a magnitude (buff/debuff excluded). */
export const SKILL_MAGNITUDE_BANDS = {
  damage: {
    single: {
      fixed: { min: 10, max: 40 },
      percent: { min: 120, max: 250 },
      scalingBase: { min: 5, max: 30 },
      scalingScale: { min: 0.5, max: 3 },
    },
    area: {
      fixed: { min: 6, max: 25 },
      percent: { min: 60, max: 120 },
      scalingBase: { min: 4, max: 20 },
      scalingScale: { min: 0.5, max: 1.5 },
    },
  },
  damage_over_time: {
    single: { fixed: { min: 3, max: 12 }, percent: { min: 2, max: 6 } },
    area: { fixed: { min: 2, max: 8 }, percent: { min: 1, max: 4 } },
  },
  heal: {
    single: {
      fixed: { min: 15, max: 50 },
      percent: { min: 10, max: 40 },
      scalingBase: { min: 10, max: 35 },
      scalingScale: { min: 0.5, max: 3 },
    },
    area: {
      fixed: { min: 8, max: 30 },
      percent: { min: 5, max: 30 },
      scalingBase: { min: 6, max: 20 },
      scalingScale: { min: 0.5, max: 1.5 },
    },
  },
  heal_over_time: {
    single: { fixed: { min: 4, max: 15 }, percent: { min: 3, max: 10 } },
    area: { fixed: { min: 3, max: 10 }, percent: { min: 2, max: 8 } },
  },
  restore_energy: {
    single: { fixed: { min: 10, max: 30 }, percent: { min: 15, max: 40 } },
    area: { fixed: { min: 5, max: 20 }, percent: { min: 10, max: 25 } },
  },
  shield: {
    single: { fixed: { min: 15, max: 60 }, percent: { min: 10, max: 35 } },
    area: { fixed: { min: 10, max: 40 }, percent: { min: 5, max: 20 } },
  },
  max_hp_reduction: {
    single: { percent: { min: 5, max: 25 } },
    area: { percent: { min: 5, max: 15 } },
  },
} as const satisfies Record<string, TargetedBands<MagnitudeBands>>;

/** Buff/debuff bands: percent channel, and flat by the kind of stat modified. */
export const STAT_MODIFIER_BANDS = {
  single: {
    percent: { min: 5, max: 30 },
    flat: {
      attribute: { min: 2, max: 10 },
      damage: { min: 3, max: 15 },
      defense: { min: 5, max: 30 },
    },
  },
  area: {
    percent: { min: 5, max: 20 },
    flat: {
      attribute: { min: 2, max: 6 },
      damage: { min: 2, max: 10 },
      defense: { min: 5, max: 20 },
    },
  },
} as const;

/** Health restored by revive, in percent of max HP. */
export const REVIVE_HEALTH_PERCENT_BANDS = {
  single: { min: 20, max: 50 },
  area: { min: 15, max: 30 },
} as const satisfies TargetedBands<Range>;

/** Number of effects removed by dispel. */
export const DISPEL_AMOUNT_BANDS = {
  single: { min: 1, max: 3 },
  area: { min: 1, max: 2 },
} as const satisfies TargetedBands<Range>;

/** Recommended duration, in group rounds, of effects that last. */
export const EFFECT_DURATION_BAND: Range = { min: 1, max: 4 };

/** Recommended provoke duration (spec §3.6). */
export const PROVOKE_DURATION_BAND: Range = { min: 1, max: 2 };

/**
 * Hard cap on stun duration. With one group action per round, two stunners alternating would
 * lock a solo boss forever (spec §5.6).
 */
export const STUN_MAX_DURATION = 1;

/** Hard cap on max-HP reduction duration; chained, it makes every heal useless (spec §5.6). */
export const MAX_HP_REDUCTION_MAX_DURATION = 3;

/** Hard cap on the health a revive restores, in percent of max HP. */
export const REVIVE_MAX_HEALTH_PERCENT = 100;

/** Below this sum of class slots the campaign may not fit a whole group (spec §5.2). */
export const MIN_RECOMMENDED_TOTAL_SLOTS = 8;

/** Max skills per class (spec §5.1). */
export const MAX_SKILLS_PER_CLASS = 4;
