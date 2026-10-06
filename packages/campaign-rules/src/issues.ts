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
  | 'schema';

/**
 * One blocking problem in the draft. `path` points into the draft using snapshot field names
 * (e.g. `chapters[0].nodes[2].villainIds`); `chapterId`/`nodeId` let the editor highlight it.
 */
export interface DraftIssue {
  code: DraftIssueCode;
  path: string;
  message: string;
  chapterId?: string;
  nodeId?: string;
}

/** Renders a Zod-style path (`['chapters', 0, 'name']`) as `chapters[0].name`. */
export function formatPath(segments: ReadonlyArray<string | number>): string {
  return segments
    .map((segment, i) =>
      typeof segment === 'number' ? `[${segment}]` : i === 0 ? segment : `.${segment}`,
    )
    .join('');
}
