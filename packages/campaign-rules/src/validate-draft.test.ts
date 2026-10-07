import { describe, expect, it } from 'vitest';
import type { CampaignDraft, DraftChapter, DraftNode } from '@rpg-chains/shared-types';
import { validDraft } from './fixtures/load.js';
import { validateDraft } from './validate-draft.js';

function chapter(draft: CampaignDraft): DraftChapter {
  return draft.chapters[0]!;
}

function node(draft: CampaignDraft, id: string): DraftNode {
  return chapter(draft).nodes.find((n) => n.id === id)!;
}

function codes(draft: CampaignDraft): string[] {
  return validateDraft(draft).map((issue) => issue.code);
}

describe('validateDraft (publish validation gate)', () => {
  it('accepts the valid fixture, ignoring the incomplete under-construction chapter', () => {
    expect(validateDraft(validDraft())).toEqual([]);
  });

  it('requires at least one publishable chapter', () => {
    const draft = validDraft();
    chapter(draft).underConstruction = true;
    expect(codes(draft)).toEqual(['no_chapters']);
  });

  it('requires an entry and a boss', () => {
    const draft = validDraft();
    chapter(draft).entryNodeId = null;
    chapter(draft).bossNodeId = 'gone';
    expect(codes(draft)).toEqual(expect.arrayContaining(['entry_missing', 'boss_missing']));
  });

  it('requires the boss node to be of type boss, and only one boss', () => {
    const draft = validDraft();
    chapter(draft).bossNodeId = 'n-b';
    const issues = validateDraft(draft);
    expect(issues.map((i) => i.code)).toEqual(
      expect.arrayContaining(['boss_wrong_type', 'extra_boss']),
    );
    expect(issues.find((i) => i.code === 'extra_boss')?.nodeId).toBe('n-boss');
  });

  it('flags nodes unreachable from the entry, with a draft path', () => {
    const draft = validDraft();
    chapter(draft).edges = chapter(draft).edges.filter((e) => e.to !== 'n-b');
    const issue = validateDraft(draft).find((i) => i.code === 'unreachable_node');
    expect(issue).toMatchObject({ path: 'chapters[0].nodes[2]', nodeId: 'n-b', chapterId: 'ch-1' });
  });

  it('rejects cycles', () => {
    const draft = validDraft();
    chapter(draft).edges.push({ from: 'n-boss', to: 'n-entry' });
    expect(codes(draft)).toContain('cycle');
  });

  it('requires recommended level and participant limit on battles', () => {
    const draft = validDraft();
    const battle = node(draft, 'n-a');
    battle.recommendedLevel = null;
    battle.participantLimit = null;
    const issues = validateDraft(draft);
    expect(issues.map((i) => i.path)).toEqual([
      'chapters[0].nodes[1].recommendedLevel',
      'chapters[0].nodes[1].participantLimit',
    ]);
    expect(issues.every((i) => i.code === 'battle_incomplete')).toBe(true);
  });

  it('does not require a participant limit on the boss', () => {
    const draft = validDraft();
    node(draft, 'n-boss').participantLimit = null;
    expect(validateDraft(draft)).toEqual([]);
  });

  it('requires villains on battles and known ids everywhere', () => {
    const draft = validDraft();
    const battle = node(draft, 'n-a');
    if (battle.type !== 'battle') throw new Error('fixture drift');
    battle.config.villainIds = [];
    battle.config.questionIds = ['q-missing'];
    battle.prerequisites = ['n-missing'];
    const issues = validateDraft(draft);
    expect(issues.map((i) => [i.code, i.path])).toEqual([
      ['missing_reference', 'chapters[0].nodes[1].prerequisites[0]'],
      ['no_villains', 'chapters[0].nodes[1].villainIds'],
      ['missing_reference', 'chapters[0].nodes[1].questionIds[0]'],
    ]);
  });

  it('allows open questions on single-path nodes only (spec §3.2)', () => {
    const draft = validDraft();
    const battle = node(draft, 'n-a'); // parallel branch with n-b
    if (battle.type !== 'battle') throw new Error('fixture drift');
    battle.config.questionIds = ['q-open'];
    expect(codes(draft)).toEqual(['open_question_on_branch']);

    // Removing the parallel branch makes n-a a mandatory pass-through.
    chapter(draft).nodes = chapter(draft).nodes.filter((n) => n.id !== 'n-b');
    chapter(draft).edges = chapter(draft).edges.filter((e) => e.from !== 'n-b' && e.to !== 'n-b');
    expect(validateDraft(draft)).toEqual([]);
  });

  it('reports snapshot-schema problems such as a villain without attacks', () => {
    const draft = validDraft();
    draft.villains[0]!.attacks = [];
    expect(validateDraft(draft)).toEqual([
      expect.objectContaining({ code: 'schema', path: 'villains[0].attacks' }),
    ]);
  });

  it('requires known items in villain drops and caps their chance (spec §6)', () => {
    const draft = validDraft();
    draft.villains[0]!.drops = [
      { itemId: 'it-ghost', chance: 0.1 },
      { itemId: 'it-sword', chance: 1 },
    ];
    expect(validateDraft(draft)).toEqual([
      expect.objectContaining({ code: 'schema', path: 'villains[0].drops[1].chance' }),
      expect.objectContaining({ code: 'missing_reference', path: 'villains[0].drops[0].itemId' }),
    ]);
  });

  it('reports a boss that is not mandatory via the snapshot schema', () => {
    const draft = validDraft();
    node(draft, 'n-boss').mandatory = false;
    expect(validateDraft(draft)).toEqual([
      expect.objectContaining({
        code: 'schema',
        path: 'chapters[0].nodes[3].mandatory',
        nodeId: 'n-boss',
      }),
    ]);
  });
});
