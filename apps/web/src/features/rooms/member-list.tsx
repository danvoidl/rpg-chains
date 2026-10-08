import type { RoomMember } from '@rpg-chains/shared-types';

interface MemberListProps {
  members: RoomMember[];
  onlineUserIds: string[];
}

/** Members of a room with class, master tag and online indicator. */
export function MemberList({ members, onlineUserIds }: MemberListProps) {
  return (
    <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white">
      {members.map((member) => {
        const online = onlineUserIds.includes(member.userId);
        return (
          <li key={member.userId} className="flex items-center gap-3 p-3">
            <span
              aria-hidden="true"
              className={`h-2.5 w-2.5 rounded-full ${online ? 'bg-green-500' : 'bg-gray-300'}`}
            />
            <span className="sr-only">{online ? 'online' : 'offline'}</span>
            <span className="font-medium text-gray-900">{member.name}</span>
            <span className="text-sm text-gray-500">
              {member.profile ? member.profile.className : 'escolhendo classe…'}
            </span>
            {member.profile && (
              <span className="text-xs text-gray-500">
                Vida {member.profile.currentHp}/{member.profile.maxHp} · Energia{' '}
                {member.profile.currentEnergy}/{member.profile.maxEnergy}
              </span>
            )}
            {member.profile?.downed && (
              <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
                caído
              </span>
            )}
            {member.isMaster && (
              <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                Mestre
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
