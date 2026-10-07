'use client';

import { useEffect, useState } from 'react';
import type { LocalClock } from './use-battle-channel';

/**
 * The countdown of the stage that waits on a player (spec §3.3): signal, answer, action. It
 * shows only once the screen has caught up with the stage it measures (`turnToken`), since the
 * replay pauses can show an enemy turn after the server has already moved on.
 */
export function TurnClock({ clock, turnToken }: { clock: LocalClock | null; turnToken: number }) {
  const [now, setNow] = useState(() => Date.now());
  const live = clock !== null && clock.turnToken === turnToken;

  useEffect(() => {
    if (!live) return;
    const timer = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(timer);
  }, [live]);

  if (!live) return null;
  const remaining = Math.max(0, clock.deadline - now);
  const fraction = remaining / clock.durationMs;
  const seconds = Math.ceil(remaining / 1000);
  const color = fraction > 0.5 ? 'bg-indigo-500' : fraction > 0.25 ? 'bg-amber-500' : 'bg-red-500';

  return (
    <div className="mb-4 space-y-1">
      <div className="flex justify-end">
        <span
          aria-label="Tempo restante"
          className={`text-sm font-semibold tabular-nums ${fraction > 0.25 ? 'text-gray-700' : 'text-red-700'}`}
        >
          {seconds}s
        </span>
      </div>
      <div
        role="progressbar"
        aria-label="Prazo do turno"
        aria-valuemin={0}
        aria-valuemax={clock.durationMs}
        aria-valuenow={remaining}
        className="h-2 overflow-hidden rounded bg-gray-200"
      >
        <div className={`h-full ${color}`} style={{ width: `${fraction * 100}%` }} />
      </div>
    </div>
  );
}
