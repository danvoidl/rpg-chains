import type { PublicBattleEvent } from '@rpg-chains/shared-types';

/** One beat of the replay: long enough to read "the rat bites Ana" before the next line. */
export const BEAT_MS = 650;

/**
 * How long to wait before showing an event (Fase 3 plan M4). Presentation only: an enemy turn
 * arrives as one batch, and pausing at each turn change and enemy attack lets it read as a
 * sequence. The state shown always ends up exactly the folded state.
 */
export function pauseBefore(event: PublicBattleEvent): number {
  switch (event.type) {
    case 'TurnAdvanced':
    case 'EnemyActed':
    case 'EnemyTurnSkipped':
      return BEAT_MS;
    default:
      return 0;
  }
}
