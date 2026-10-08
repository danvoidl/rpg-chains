'use client';

import { useEffect } from 'react';
import { useReactFlow } from '@xyflow/react';
import { TRAIL_COLUMN_WIDTH, TRAIL_ROW_HEIGHT, type TrailPosition } from '@rpg-chains/shared-types';

interface FocusNodeProps {
  /** Where the node to bring into view sits; a new value pans the canvas to it. */
  target: { id: string; position: TrailPosition } | null;
}

/**
 * Pans the editor canvas to a node just added, keeping the zoom: a new node goes below the lowest
 * one, often out of view. Rendered inside `ReactFlow`, whose instance it drives.
 */
export function FocusNode({ target }: FocusNodeProps) {
  const flow = useReactFlow();
  const id = target?.id;
  useEffect(() => {
    if (!target) return;
    void flow.setCenter(
      target.position.x + TRAIL_COLUMN_WIDTH / 2,
      target.position.y + TRAIL_ROW_HEIGHT / 2,
      { zoom: flow.getZoom(), duration: 300 },
    );
    // Only when another node is to be focused, not on every move of the same one.
  }, [id]);
  return null;
}
