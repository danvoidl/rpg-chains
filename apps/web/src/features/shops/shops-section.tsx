import Link from 'next/link';
import type { RoomDetail } from '@rpg-chains/shared-types';

interface ShopsSectionProps {
  room: RoomDetail;
}

/** The version's shops (provisional list until the map, like the battle nodes). */
export function ShopsSection({ room }: ShopsSectionProps) {
  if (room.shopNodes.length === 0) return null;
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-gray-900">Lojas</h2>
      <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white">
        {room.shopNodes.map((shop) => (
          <li key={shop.nodeId} className="flex items-center justify-between p-3">
            <span className="text-sm">
              <span className="font-medium text-gray-900">{shop.title || 'Loja'}</span>
              <span className="text-gray-500"> · {shop.chapterName}</span>
            </span>
            <Link
              href={`/rooms/${room.id}/shops/${shop.nodeId}`}
              className="text-sm font-medium text-indigo-700 hover:underline"
            >
              Entrar
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
