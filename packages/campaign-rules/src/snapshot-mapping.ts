import type { DraftChapter, DraftClass, DraftNode, DraftVillain } from '@rpg-chains/shared-types';

/**
 * Pure draft → snapshot field mapping, without validation: `posX/posY` become `position`, the
 * per-type `config` is flattened, nullable draft fields become absent so the snapshot schema
 * reports them. Every draft column must be mapped here (round-trip test guards drift).
 */

export function toSnapshotNode(node: DraftNode): Record<string, unknown> {
  const base = {
    id: node.id,
    title: node.title,
    type: node.type,
    prerequisites: node.prerequisites,
    mandatory: node.mandatory,
    position: node.position,
  };
  switch (node.type) {
    case 'battle':
      return {
        ...base,
        recommendedLevel: node.recommendedLevel ?? undefined,
        participantLimit: node.participantLimit ?? undefined,
        villainIds: node.config.villainIds,
        questionIds: node.config.questionIds,
      };
    case 'boss':
      // Boss rooms have no participant limit (spec §2.3).
      return {
        ...base,
        recommendedLevel: node.recommendedLevel ?? undefined,
        villainIds: node.config.villainIds,
        questionIds: node.config.questionIds,
      };
    case 'shop':
      return { ...base, itemIds: node.config.itemIds };
    case 'campfire':
      return base;
    case 'narrative':
      return { ...base, text: node.config.text, videoUrl: node.config.videoUrl ?? undefined };
  }
}

/** An opening with neither text nor video is no opening. */
function toSnapshotOpening({ text, videoUrl }: DraftChapter['opening']) {
  if (text.trim() === '' && videoUrl === null) return undefined;
  return { text, videoUrl: videoUrl ?? undefined };
}

export function toSnapshotChapter(chapter: DraftChapter): Record<string, unknown> {
  return {
    id: chapter.id,
    name: chapter.name,
    underConstruction: chapter.underConstruction,
    entryNodeId: chapter.entryNodeId ?? undefined,
    bossNodeId: chapter.bossNodeId ?? undefined,
    background: chapter.background ?? undefined,
    opening: toSnapshotOpening(chapter.opening),
    nodes: chapter.nodes.map(toSnapshotNode),
    edges: chapter.edges.map(({ from, to }) => ({ from, to })),
  };
}

export function toSnapshotVillain(villain: DraftVillain): Record<string, unknown> {
  return {
    id: villain.id,
    name: villain.name,
    imageUrl: villain.imageUrl ?? undefined,
    hp: villain.hp,
    attributes: {
      strength: villain.strength,
      dexterity: villain.dexterity,
      intelligence: villain.intelligence,
      defense: villain.defense,
    },
    attacks: villain.attacks,
    xpReward: villain.xpReward,
    goldReward: villain.goldReward,
    drops: villain.drops,
  };
}

export function toSnapshotClass(cls: DraftClass): Record<string, unknown> {
  return {
    id: cls.id,
    name: cls.name,
    description: cls.description,
    artUrl: cls.artUrl ?? undefined,
    baseHp: cls.baseHp,
    baseEnergy: cls.baseEnergy,
    hpPerLevel: cls.hpPerLevel,
    energyPerLevel: cls.energyPerLevel,
    maxSlots: cls.maxSlots,
    baseWeaponId: cls.baseWeaponId ?? undefined,
    skills: cls.skills.map((skill) => ({
      id: skill.id,
      name: skill.name,
      iconUrl: skill.iconUrl ?? undefined,
      text: skill.text,
      energyCost: skill.energyCost,
      cooldownRounds: skill.cooldownRounds,
      unlockLevel: skill.unlockLevel,
      effect: skill.effect,
    })),
  };
}

/** Chapters that enter a snapshot: not under construction, in author order. */
export function publishableChapters(chapters: readonly DraftChapter[]): DraftChapter[] {
  return chapters
    .filter((chapter) => !chapter.underConstruction)
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
}

/** Chapters under construction, in author order: only their name enters a snapshot. */
export function upcomingChapters(
  chapters: readonly DraftChapter[],
): Array<{ id: string; name: string }> {
  return chapters
    .filter((chapter) => chapter.underConstruction)
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
    .map(({ id, name }) => ({ id, name }));
}
