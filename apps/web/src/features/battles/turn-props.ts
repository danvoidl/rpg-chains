import type { ClientIntent, Combatant, PublicBattleState } from '@rpg-chains/shared-types';

/** What every turn panel gets: the state on screen, the viewer's fighter, and a way to act. */
export interface TurnProps {
  view: PublicBattleState;
  /** The viewer's combatant; null for a spectator. */
  me: Combatant | null;
  act: (intent: ClientIntent) => void;
  /** An intent is waiting for its ack. */
  pending: boolean;
  /** The viewer is the room master: he picks questions and judges open answers (spec §3.2). */
  isMaster: boolean;
  battleId: string;
}

export const primaryButton =
  'rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50';
export const optionButton =
  'w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-left text-sm text-gray-800 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-60';
