import { decide, emptyBattle, evolve, replay } from '@rpg-chains/battle-engine';
import type {
  BattleContent,
  BattleEvent,
  BattleState,
  Command,
  Rejection,
} from '@rpg-chains/shared-types';

export interface BattleParticipant {
  profileId: string;
  userId: string;
  name: string;
}

export interface BattleNode {
  id: string;
  title: string;
  type: 'battle' | 'boss';
  /** Null for a boss node, which has no limit (spec §2.3). */
  participantLimit: number | null;
}

interface BattleRecord {
  battleId: string;
  roomId: string;
  node: BattleNode;
  needsMaster: boolean;
  /** The room master when the battle formed; a battle that needs him blocks the transfer. */
  masterId: string;
  /** The version the battle was formed on; it ends on it even if the room has a newer one. */
  campaignVersionId: string;
  participants: BattleParticipant[];
}

/** Gathering participants (Fase 3 plan decision 9). `starting` locks it while the roster loads. */
export interface FormingBattle extends BattleRecord {
  status: 'forming';
  starting: boolean;
}

/** A battle being fought, or resolved and waiting for its write-back. */
export interface RunningBattle extends BattleRecord {
  status: 'running';
  content: BattleContent;
  state: BattleState;
  /** The full server log, secret events included. An event's `seq` is its 1-based position. */
  log: BattleEvent[];
}

export type ActiveBattle = FormingBattle | RunningBattle;

/** Events just appended to a battle's log, spanning `fromSeq..fromSeq + events.length - 1`. */
export interface Appended {
  fromSeq: number;
  events: BattleEvent[];
}

/** Something that reacts to a battle's life: transport, timers, the profile write-back. */
export interface BattleListener {
  appended?(battle: RunningBattle, appended: Appended): void;
  removed?(battle: ActiveBattle): void;
}

export type ApplyResult = { ok: true } | Rejection;

/**
 * Every battle of the process, in memory (spec §3.7: a crash loses the battle; there is no
 * active-battle table). The concurrency unit is the battle: `apply` runs `decide` → append →
 * `evolve` with no `await` in between, so commands and timers of one battle are serialized by the
 * event loop and the loser of a race gets `stale_turn_token`. Transport, timers and the profile
 * write-back subscribe as listeners; the registry knows nothing about them.
 */
export class BattleRegistry {
  private readonly battles = new Map<string, ActiveBattle>();
  private readonly listeners: BattleListener[] = [];

  subscribe(listener: BattleListener): void {
    this.listeners.push(listener);
  }

  get(battleId: string): ActiveBattle | undefined {
    return this.battles.get(battleId);
  }

  /** Battles of a room, oldest first. */
  inRoom(roomId: string): ActiveBattle[] {
    return [...this.battles.values()].filter((b) => b.roomId === roomId);
  }

  /** Whether any battle of the room has open questions, so the master must stay (spec §3.2). */
  needsMaster(roomId: string): boolean {
    return this.inRoom(roomId).some((b) => b.needsMaster);
  }

  /** A forming battle counts: the room must not roll forward under it (Fase 3 plan M3). */
  hasActive(roomId: string): boolean {
    return this.inRoom(roomId).length > 0;
  }

  /** The battle a profile is in, forming or running — even if they left it, until it resolves. */
  battleOf(profileId: string): ActiveBattle | undefined {
    return [...this.battles.values()].find((b) =>
      b.participants.some((p) => p.profileId === profileId),
    );
  }

  add(battle: FormingBattle): void {
    this.battles.set(battle.battleId, battle);
  }

  /** Drops a battle (cancelled, or resolved and written back). Nothing of it is kept. */
  remove(battleId: string): void {
    const battle = this.battles.get(battleId);
    if (!battle) return;
    this.battles.delete(battleId);
    for (const listener of this.listeners) listener.removed?.(battle);
  }

  /**
   * Forgets every battle without telling anyone (server shutdown). Like a crash (spec §3.7), the
   * battles are simply lost: nobody is written back as having left or lost.
   */
  clear(): void {
    this.battles.clear();
  }

  /** Turns a formation into a running battle from the events `createBattle` produced. */
  run(forming: FormingBattle, content: BattleContent, events: BattleEvent[]): RunningBattle {
    const { status: _status, starting: _starting, ...record } = forming;
    const battle: RunningBattle = {
      ...record,
      status: 'running',
      content,
      state: replay(emptyBattle(forming.battleId), events),
      log: [...events],
    };
    this.battles.set(battle.battleId, battle);
    this.notify(battle, { fromSeq: 1, events });
    return battle;
  }

  /** Decides one command and, if accepted, appends and folds its events. Synchronous by design. */
  apply(battleId: string, command: Command): ApplyResult {
    const battle = this.battles.get(battleId);
    if (!battle || battle.status !== 'running') return { ok: false, reason: 'battle_not_running' };
    const result = decide(battle.state, command, battle.content);
    if (!result.ok) return result;

    const fromSeq = battle.log.length + 1;
    battle.log.push(...result.events);
    battle.state = result.events.reduce(evolve, battle.state);
    this.notify(battle, { fromSeq, events: result.events });
    return { ok: true };
  }

  private notify(battle: RunningBattle, appended: Appended): void {
    for (const listener of this.listeners) listener.appended?.(battle, appended);
  }
}
