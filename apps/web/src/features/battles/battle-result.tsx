import Link from 'next/link';
import type { BattleReward, Combatant } from '@rpg-chains/shared-types';

interface BattleResultProps {
  result: 'victory' | 'defeat';
  roomId: string;
  rewards: BattleReward[];
  combatants: Combatant[];
  /** The viewer's profile in this battle, to highlight their own line. */
  myProfileId: string | null;
}

/** The end screen; the profiles already hold the battle's outcome and rewards. */
export function BattleResult({
  result,
  roomId,
  rewards,
  combatants,
  myProfileId,
}: BattleResultProps) {
  const victory = result === 'victory';
  return (
    <div
      role="status"
      className={`space-y-3 rounded-lg border p-6 text-center ${
        victory ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
      }`}
    >
      <p className="text-2xl font-bold text-gray-900">{victory ? 'Vitória!' : 'Derrota'}</p>
      <p className="text-sm text-gray-700">
        {victory
          ? 'O grupo venceu a batalha.'
          : 'O grupo caiu e perdeu parte do ouro. Descansem antes de lutar de novo.'}
      </p>
      {victory && rewards.length > 0 && (
        <RewardList rewards={rewards} combatants={combatants} myProfileId={myProfileId} />
      )}
      <Link
        href={`/rooms/${roomId}`}
        className="text-sm font-medium text-indigo-700 hover:underline"
      >
        Voltar à sala
      </Link>
    </div>
  );
}

/** What each participant earned (spec §6): XP, gold and the items their own rolls dropped. */
function RewardList({
  rewards,
  combatants,
  myProfileId,
}: Omit<BattleResultProps, 'result' | 'roomId'>) {
  return (
    <ul aria-label="Recompensas" className="mx-auto max-w-md space-y-1 text-left text-sm">
      {rewards.map((reward) => {
        const name = combatants.find((c) => c.profileId === reward.profileId)?.name ?? '?';
        const mine = reward.profileId === myProfileId;
        return (
          <li
            key={reward.profileId}
            className={`rounded px-3 py-1.5 ${mine ? 'bg-white font-medium' : ''}`}
          >
            <span className="text-gray-900">{mine ? `${name} (você)` : name}</span>
            <span className="text-gray-700">
              {' '}
              · {reward.xp} XP · {reward.gold} de ouro
              {reward.items.length > 0 && ` · ${reward.items.map((item) => item.name).join(', ')}`}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
