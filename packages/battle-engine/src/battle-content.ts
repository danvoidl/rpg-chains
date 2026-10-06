import type { BattleContent, CampaignSnapshot, Rejection } from '@rpg-chains/shared-types';

/**
 * The content one battle reads, cut from the snapshot version it starts on (Fase 3 plan decision
 * 3): the node's lineup, villains and question pool, plus every class and item of the version
 * (participants' skills and gear are looked up there). Only `battle` and `boss` nodes fight.
 */
export function buildBattleContent(
  snapshot: CampaignSnapshot,
  nodeId: string,
): BattleContent | Rejection {
  const node = snapshot.chapters.flatMap((ch) => ch.nodes).find((n) => n.id === nodeId);
  if (!node) return { ok: false, reason: 'unknown_node' };
  if (node.type !== 'battle' && node.type !== 'boss')
    return { ok: false, reason: 'not_a_battle_node' };

  const villainIds = new Set(node.villainIds);
  const questionIds = new Set(node.questionIds);
  return {
    nodeId,
    lineup: node.villainIds,
    villains: snapshot.villains.filter((v) => villainIds.has(v.id)),
    questions: snapshot.questions.filter((q) => questionIds.has(q.id)),
    classes: snapshot.classes,
    items: snapshot.items,
  };
}
