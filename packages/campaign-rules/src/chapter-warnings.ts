import type { CampaignDraft } from '@rpg-chains/shared-types';
import { formatPath, type DraftWarning } from './issues.js';

/**
 * Non-blocking chapter-flow warnings (Fase 5 plan decision 8): a chapter with battles and no
 * campfire sends every defeat back to its entry. `value` is the campfire count, below the
 * open-ended band of at least one.
 */
export function chapterWarnings(draft: CampaignDraft): DraftWarning[] {
  return draft.chapters.flatMap((chapter, c): DraftWarning[] => {
    if (chapter.underConstruction) return [];
    const fights = chapter.nodes.some((n) => n.type === 'battle' || n.type === 'boss');
    const campfires = chapter.nodes.filter((n) => n.type === 'campfire').length;
    if (!fights || campfires > 0) return [];
    return [
      {
        code: 'chapter_without_campfire',
        path: formatPath(['chapters', c, 'nodes']),
        message: 'Chapter has battles and no campfire: every defeat goes back to its entry',
        value: campfires,
        band: { min: 1, max: Number.MAX_SAFE_INTEGER },
        chapterId: chapter.id,
      },
    ];
  });
}
