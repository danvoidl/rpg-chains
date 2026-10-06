/**
 * Whether a room has a battle in progress. A room never rolls forward to a newer campaign version,
 * nor closes, mid-battle (spec §2.2, decision 6 of the Fase 2 plan). Battles do not exist until
 * Fase 3, whose in-memory battle registry answers this; until then no room is ever in battle.
 */
export function hasActiveBattle(_roomId: string): boolean {
  return false;
}
