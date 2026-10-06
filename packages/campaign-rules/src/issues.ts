/** Why a draft cannot be published yet (validation gate, Fase 1 plan M3). */
export type DraftIssueCode =
  | 'no_chapters'
  | 'entry_missing'
  | 'boss_missing'
  | 'boss_wrong_type'
  | 'extra_boss'
  | 'unreachable_node'
  | 'cycle'
  | 'battle_incomplete'
  | 'no_villains'
  | 'missing_reference'
  | 'open_question_on_branch'
  | 'no_classes'
  | 'base_weapon_invalid'
  | 'skill_free'
  | 'invalid_target'
  | 'duration_over_cap'
  | 'revive_over_cap'
  | 'schema';

/** Ids that let the editor highlight where an issue or warning lives. */
export interface DraftLocation {
  chapterId?: string;
  nodeId?: string;
  classId?: string;
  skillId?: string;
}

/**
 * One blocking problem in the draft. `path` points into the draft using snapshot field names
 * (e.g. `chapters[0].nodes[2].villainIds`).
 */
export interface DraftIssue extends DraftLocation {
  code: DraftIssueCode;
  path: string;
  message: string;
}

/** Why a draft value is outside the recommended balancing bands (spec §4.3, §5.2, §5.6). */
export type DraftWarningCode =
  | 'class_base_out_of_band'
  | 'skill_cost_out_of_band'
  | 'skill_cooldown_out_of_band'
  | 'magnitude_out_of_band'
  | 'duration_out_of_band'
  | 'total_slots_low';

/**
 * A non-blocking balancing warning: publishing is allowed, the editor asks the author to confirm.
 * `band` is the recommended range the `value` falls outside of.
 */
export interface DraftWarning extends DraftLocation {
  code: DraftWarningCode;
  path: string;
  message: string;
  value: number;
  band: { min: number; max: number };
}

/** Renders a Zod-style path (`['chapters', 0, 'name']`) as `chapters[0].name`. */
export function formatPath(segments: ReadonlyArray<string | number>): string {
  return segments
    .map((segment, i) =>
      typeof segment === 'number' ? `[${segment}]` : i === 0 ? segment : `.${segment}`,
    )
    .join('');
}
