'use client';

import { ViewportPortal } from '@xyflow/react';
import {
  TRAIL_COLUMN_WIDTH,
  TRAIL_ROW_HEIGHT,
  TRAIL_WIDTH,
  type ChapterBackground,
} from '@rpg-chains/shared-types';

interface TrailColumnProps {
  /** World height to draw, in pixels. */
  height: number;
  background: ChapterBackground | null;
}

/**
 * The trail column behind the editor's nodes (Fase 5 plan decision 17): the fixed-width world
 * with its grid cells and the chapter's map, in flow coordinates so it pans and zooms with them.
 */
export function TrailColumn({ height, background }: TrailColumnProps) {
  return (
    <ViewportPortal>
      <div
        aria-hidden
        className="pointer-events-none absolute top-0 left-0 rounded border border-gray-300 bg-gray-50"
        style={{
          // Under the nodes and edges: the portal renders after them in the viewport.
          zIndex: -1,
          width: TRAIL_WIDTH,
          height,
          backgroundImage: [
            'linear-gradient(to right, rgb(209 213 219) 1px, transparent 1px)',
            'linear-gradient(to bottom, rgb(209 213 219) 1px, transparent 1px)',
            ...(background ? [`url(${background.imageUrl})`] : []),
          ].join(', '),
          backgroundSize: [
            `${TRAIL_COLUMN_WIDTH}px ${TRAIL_ROW_HEIGHT}px`,
            `${TRAIL_COLUMN_WIDTH}px ${TRAIL_ROW_HEIGHT}px`,
            ...(background ? ['100% auto'] : []),
          ].join(', '),
          backgroundRepeat: background ? 'repeat, repeat, no-repeat' : 'repeat',
        }}
      />
    </ViewportPortal>
  );
}
