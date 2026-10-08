import { describe, expect, it } from 'vitest';
import { chapterWarnings } from './chapter-warnings.js';
import { validDraft } from './fixtures/load.js';

describe('chapterWarnings (Fase 5 plan decision 8)', () => {
  it('is quiet when the chapter has a campfire', () => {
    expect(chapterWarnings(validDraft())).toEqual([]);
  });

  it('warns about a chapter with battles and no campfire, but not one under construction', () => {
    const draft = validDraft();
    for (const chapter of draft.chapters) {
      chapter.nodes = chapter.nodes.filter((n) => n.type !== 'campfire');
    }
    expect(chapterWarnings(draft)).toEqual([
      expect.objectContaining({
        code: 'chapter_without_campfire',
        chapterId: 'ch-1',
        path: 'chapters[0].nodes',
        value: 0,
      }),
    ]);
  });
});
