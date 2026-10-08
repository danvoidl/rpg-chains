'use client';

import { useParams } from 'next/navigation';
import { NarrativeView } from '@/features/narratives/narrative-view';

/** A narrative of the room. */
export default function NarrativePage() {
  const params = useParams();
  return <NarrativeView roomId={params.roomId as string} nodeId={params.nodeId as string} />;
}
