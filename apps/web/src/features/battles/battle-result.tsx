import Link from 'next/link';

interface BattleResultProps {
  result: 'victory' | 'defeat';
  roomId: string;
}

/** The end screen; HP, energy and downed are already back on the profiles. */
export function BattleResult({ result, roomId }: BattleResultProps) {
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
        {victory ? 'O grupo venceu a batalha.' : 'O grupo caiu. Descansem antes de lutar de novo.'}
      </p>
      <Link
        href={`/rooms/${roomId}`}
        className="text-sm font-medium text-indigo-700 hover:underline"
      >
        Voltar à sala
      </Link>
    </div>
  );
}
