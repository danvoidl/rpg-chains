'use client';

import { useParams } from 'next/navigation';
import { ShopView } from '@/features/shops/shop-view';

/** A shop of the room. */
export default function ShopPage() {
  const params = useParams();
  return <ShopView roomId={params.roomId as string} nodeId={params.nodeId as string} />;
}
