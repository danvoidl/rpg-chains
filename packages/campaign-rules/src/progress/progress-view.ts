import type {
  CampaignProgressView,
  CampaignSnapshot,
  ChapterNode,
  NodeProgressView,
} from '@rpg-chains/shared-types';
import { campaignCompleted, chapterState, clearedNodeIds, stateInChapter } from './node-state.js';
import type { RoomProgress } from './room-progress.js';

function needsMaster(snapshot: CampaignSnapshot, node: ChapterNode): boolean {
  if (node.type !== 'battle' && node.type !== 'boss') return false;
  return node.questionIds.some(
    (id) => snapshot.questions.find((q) => q.id === id)?.type === 'open',
  );
}

/**
 * The trail read model (Fase 5 plan decision 13): every published chapter in order with each
 * node's state, then the chapters under construction. `battleId` is left null — the server
 * overlays the battles it holds in memory.
 */
export function campaignProgress(
  snapshot: CampaignSnapshot,
  progress: RoomProgress,
): CampaignProgressView {
  const cleared = clearedNodeIds(progress);
  return {
    chapters: snapshot.chapters.map((chapter, index) => {
      const state = chapterState(snapshot, progress, index);
      const nodes = chapter.nodes.map((node): NodeProgressView => ({
        nodeId: node.id,
        type: node.type,
        title: node.title,
        position: node.position,
        mandatory: node.mandatory,
        state: stateInChapter(chapter, state !== 'locked', cleared, node.id),
        recommendedLevel:
          node.type === 'battle' || node.type === 'boss' ? node.recommendedLevel : null,
        participantLimit: node.type === 'battle' ? node.participantLimit : null,
        needsMaster: needsMaster(snapshot, node),
        battleId: null,
      }));
      return {
        chapterId: chapter.id,
        name: chapter.name,
        state,
        opening: chapter.opening ?? null,
        background: chapter.background ?? null,
        campfireNodeId: progress.campfires.find((c) => c.chapterId === chapter.id)?.nodeId ?? null,
        nodes,
      };
    }),
    upcomingChapters: snapshot.upcomingChapters.map(({ id, name }) => ({ id, name })),
    completed: campaignCompleted(snapshot, progress),
  };
}
