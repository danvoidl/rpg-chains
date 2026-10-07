import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { evolvePublic } from '@rpg-chains/battle-engine';
import {
  BATTLE_EVENTS,
  type BattleClock,
  type BattleClosedMessage,
  type BattleCommandAck,
  type BattleEventsMessage,
  type BattleJoinAck,
  type BattleSync,
  type BattleSyncAck,
  type ClientIntent,
  type PublicBattleEvent,
  type PublicBattleState,
} from '@rpg-chains/shared-types';
import { config } from '@/lib/config';
import { pauseBefore } from './event-pacing';

/** How many recent events the feed keeps. */
const FEED_SIZE = 40;

/** A stage clock pinned to this device's time: the stage ends at `deadline` (`Date.now()` ms). */
export interface LocalClock {
  turnToken: number;
  durationMs: number;
  deadline: number;
}

function pin(clock: BattleClock | null): LocalClock | null {
  return (
    clock && {
      turnToken: clock.turnToken,
      durationMs: clock.durationMs,
      deadline: Date.now() + clock.remainingMs,
    }
  );
}

export interface BattleChannel {
  /** The state on screen; it trails the server only by the replay pauses. */
  view: PublicBattleState | null;
  /** Recent events, oldest first, as already shown. */
  feed: PublicBattleEvent[];
  /** The server's latest stage clock (spec §3.3); null when nobody is timed. */
  clock: LocalClock | null;
  /** Why the battle left the server, once it did. */
  closed: BattleClosedMessage['reason'] | null;
  /** The join was refused (not found, not allowed). */
  joinError: string | null;
  /** Sends an intent; resolves with the server's verdict. */
  send: (intent: ClientIntent) => Promise<BattleCommandAck>;
}

/**
 * The battle socket (Fase 3 plan M4): joins, starts from the `battle:sync` state, and folds every
 * batch with the engine's own `evolvePublic`. Batches carry server log positions: a duplicate is
 * dropped, a gap asks for a fresh sync. Events are then shown one at a time with short pauses
 * (`event-pacing.ts`), never changing what the final state is.
 */
export function useBattleChannel(battleId: string): BattleChannel {
  const [view, setView] = useState<PublicBattleState | null>(null);
  const [feed, setFeed] = useState<PublicBattleEvent[]>([]);
  const [closed, setClosed] = useState<BattleChannel['closed']>(null);
  const [clock, setClock] = useState<LocalClock | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = io(config.apiUrl, { withCredentials: true });
    socketRef.current = socket;
    /** Last server log position received (shown or queued); -1 before the first sync. */
    let seq = -1;
    let queue: PublicBattleEvent[] = [];
    let timer: ReturnType<typeof setTimeout> | null = null;

    const show = (event: PublicBattleEvent) => {
      setView((state) => (state ? evolvePublic(state, event) : state));
      setFeed((events) => [...events, event].slice(-FEED_SIZE));
    };
    const drain = () => {
      while (timer === null && queue.length > 0) {
        const event = queue[0]!;
        const pause = pauseBefore(event);
        if (pause === 0) {
          queue = queue.slice(1);
          show(event);
        } else {
          // The head stays queued while waiting; batches arriving meanwhile append behind it.
          timer = setTimeout(() => {
            timer = null;
            queue = queue.slice(1);
            show(event);
            drain();
          }, pause);
        }
      }
    };
    const resync = (sync: BattleSync) => {
      if (timer !== null) clearTimeout(timer);
      timer = null;
      queue = [];
      seq = sync.seq;
      setView(sync.state);
      setClock(pin(sync.clock));
    };
    const requestSync = () => {
      void (socket.emitWithAck(BATTLE_EVENTS.sync, { battleId }) as Promise<BattleSyncAck>).then(
        (ack) => {
          if (ack.ok) resync(ack.sync);
        },
      );
    };

    socket.on('connect', () => {
      void (socket.emitWithAck(BATTLE_EVENTS.join, { battleId }) as Promise<BattleJoinAck>).then(
        (ack) => {
          if (ack.ok) resync(ack.sync);
          else setJoinError(ack.error);
        },
      );
    });
    socket.on(BATTLE_EVENTS.events, (message: BattleEventsMessage) => {
      if (message.battleId !== battleId || seq < 0 || message.toSeq <= seq) return;
      if (message.fromSeq !== seq + 1) return requestSync();
      seq = message.toSeq;
      setClock(pin(message.clock));
      queue = [...queue, ...message.events];
      drain();
    });
    socket.on(BATTLE_EVENTS.closed, (message: BattleClosedMessage) => {
      if (message.battleId === battleId) setClosed(message.reason);
    });

    return () => {
      if (timer !== null) clearTimeout(timer);
      socket.emit(BATTLE_EVENTS.leave, { battleId });
      socket.disconnect();
      socketRef.current = null;
    };
  }, [battleId]);

  const send = useCallback(
    async (intent: ClientIntent): Promise<BattleCommandAck> => {
      const socket = socketRef.current;
      if (!socket?.connected) return { ok: false, reason: 'disconnected' };
      return (await socket.emitWithAck(BATTLE_EVENTS.command, {
        battleId,
        intent,
      })) as BattleCommandAck;
    },
    [battleId],
  );

  return { view, feed, clock, closed, joinError, send };
}
