import type {
  Chapter as ChapterModel,
  ChapterNode as ChapterNodeModel,
  NodeEdge as NodeEdgeModel,
} from '@prisma/client';
import {
  DraftNodeSchema,
  type ChapterBackground,
  type DraftChapter,
  type DraftNode,
  type DraftOpening,
} from '@rpg-chains/shared-types';

/** Maps a database ChapterNode row to the DraftNode representation. */
export function toDraftNode(row: ChapterNodeModel): DraftNode {
  return DraftNodeSchema.parse({
    id: row.id,
    title: row.title,
    type: row.type,
    mandatory: row.mandatory,
    recommendedLevel: row.recommendedLevel ?? null,
    participantLimit: row.participantLimit ?? null,
    position: { x: row.posX, y: row.posY },
    prerequisites: row.prerequisites,
    config: row.config,
  });
}

/** Reads the optional map columns; the three are written together, so any null = no map. */
export function toChapterBackground(row: ChapterModel): ChapterBackground | null {
  const { backgroundImageUrl, backgroundWidth, backgroundHeight } = row;
  return backgroundImageUrl && backgroundWidth && backgroundHeight
    ? { imageUrl: backgroundImageUrl, width: backgroundWidth, height: backgroundHeight }
    : null;
}

/** Map columns for a write: `undefined` leaves them untouched, `null` clears all three. */
export function toBackgroundColumns(background: ChapterBackground | null | undefined) {
  if (background === undefined) return {};
  return {
    backgroundImageUrl: background?.imageUrl ?? null,
    backgroundWidth: background?.width ?? null,
    backgroundHeight: background?.height ?? null,
  };
}

/** Opening columns for a write: `undefined` leaves them untouched. */
export function toOpeningColumns(opening: DraftOpening | undefined) {
  if (opening === undefined) return {};
  return { openingText: opening.text, openingVideoUrl: opening.videoUrl };
}

/** Maps a chapter row with its nodes and edges to the DraftChapter representation. */
export function toDraftChapter(
  row: ChapterModel & { nodes: ChapterNodeModel[]; edges: NodeEdgeModel[] },
): DraftChapter {
  const nodes = [...row.nodes].sort((a, b) => a.id.localeCompare(b.id)).map(toDraftNode);
  const edges = [...row.edges]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((e) => ({ from: e.fromId, to: e.toId }));
  return {
    id: row.id,
    name: row.name,
    order: row.order,
    underConstruction: row.underConstruction,
    entryNodeId: row.entryNodeId ?? null,
    bossNodeId: row.bossNodeId ?? null,
    background: toChapterBackground(row),
    opening: { text: row.openingText, videoUrl: row.openingVideoUrl ?? null },
    nodes,
    edges,
  };
}
