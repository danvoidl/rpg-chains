import type {
  BattleContent,
  Combatant,
  Enemy,
  InvestedAttributes,
  Rejection,
  Slot,
} from '@rpg-chains/shared-types';
import { createContext, draw, emit, finish } from './decide-context.js';
import type { DecideResult } from './decide.js';
import { deriveStats } from './derive-stats.js';
import { emptyBattle } from './evolve.js';
import { nextFloat } from './prng.js';
import { objectiveIds, shuffle } from './questions.js';
import { runEnemyPhase, startGroupTurn } from './turn-cycle.js';

/** A participant as the server reads it from their Campaign Profile (spec §2.1). */
export interface RosterEntry {
  profileId: string;
  userId: string;
  name: string;
  classId: string;
  level: number;
  attributes: InvestedAttributes;
  currentHp: number;
  currentEnergy: number;
  downed: boolean;
  /** Item id per equipped slot; a missing weapon falls back to the class base weapon. */
  equipment: Partial<Record<Slot, string>>;
  inventory: { itemId: string; quantity: number }[];
}

export interface BattleSetup {
  battleId: string;
  /** Seed of the battle PRNG; the server draws it once, everything else derives from it. */
  seed: number;
  /** Whether the room master is online when the battle starts (spec §3.2). */
  masterOnline: boolean;
}

const reject = (reason: string): Rejection => ({ ok: false, reason });

function toCombatant(content: BattleContent, entry: RosterEntry): Combatant | Rejection {
  const cls = content.classes.find((c) => c.id === entry.classId);
  if (!cls) return reject('unknown_class');
  const weaponItem = content.items.find(
    (i) => i.id === (entry.equipment.weapon ?? cls.baseWeaponId),
  );
  if (weaponItem?.category !== 'equipment' || !weaponItem.weapon) return reject('unknown_weapon');

  const { maxHp, maxEnergy } = deriveStats(cls, entry.level, entry.attributes);
  const currentHp = Math.min(entry.currentHp, maxHp);
  // Downed players stay out until revived at a campfire (spec §3.7, plan decision 11).
  if (entry.downed || currentHp <= 0) return reject('participant_downed');

  const equipped = Object.values(entry.equipment).map((id) =>
    content.items.find((i) => i.id === id),
  );
  return {
    profileId: entry.profileId,
    userId: entry.userId,
    name: entry.name,
    classId: cls.id,
    level: entry.level,
    attributes: entry.attributes,
    weapon: { itemId: weaponItem.id, name: weaponItem.name, ...weaponItem.weapon },
    equipmentDefense: equipped.reduce(
      (sum, item) => sum + (item?.category === 'equipment' ? item.defenseBonus : 0),
      0,
    ),
    currentHp,
    maxHp,
    currentEnergy: Math.min(entry.currentEnergy, maxEnergy),
    maxEnergy,
    downed: false,
    left: false,
    blockedFromSignal: false,
    skills: cls.skills.filter((s) => s.unlockLevel <= entry.level),
    consumables: entry.inventory.flatMap((slot) => {
      const item = content.items.find((i) => i.id === slot.itemId);
      return item?.category === 'consumable'
        ? [{ itemId: item.id, name: item.name, effect: item.effect, quantity: slot.quantity }]
        : [];
    }),
    effects: [],
    cooldowns: {},
  };
}

/** One enemy per lineup entry; repeated villains get a number in their name. */
function toEnemies(content: BattleContent): Enemy[] | Rejection {
  const enemies: Enemy[] = [];
  for (const [index, villainId] of content.lineup.entries()) {
    const villain = content.villains.find((v) => v.id === villainId);
    if (!villain) return reject('unknown_villain');
    const copies = content.lineup.filter((id) => id === villainId).length;
    const nth = content.lineup.slice(0, index + 1).filter((id) => id === villainId).length;
    enemies.push({
      instanceId: `enemy-${index + 1}`,
      villainId,
      name: copies > 1 ? `${villain.name} ${nth}` : villain.name,
      ...(villain.imageUrl ? { imageUrl: villain.imageUrl } : {}),
      currentHp: villain.hp,
      maxHp: villain.hp,
      defense: villain.attributes.defense,
      effects: [],
      attackCooldowns: {},
    });
  }
  return enemies;
}

/**
 * Starts a battle (Fase 3 plan decision 12): validates the roster against the content, draws the
 * initiative and the first question deck, and emits the self-contained `BattleStarted` followed
 * by the first turn — an enemy's or the group's (spec §3.1).
 */
export function createBattle(
  content: BattleContent,
  roster: readonly RosterEntry[],
  setup: BattleSetup,
): DecideResult {
  if (roster.length === 0) return reject('no_participants');
  if (new Set(roster.map((r) => r.profileId)).size !== roster.length) {
    return reject('duplicate_participant');
  }
  const needsMaster = content.questions.some((q) => q.type === 'open');
  if (!needsMaster && objectiveIds(content).length === 0) return reject('node_without_questions');

  const combatants: Combatant[] = [];
  for (const entry of roster) {
    const combatant = toCombatant(content, entry);
    if ('ok' in combatant) return combatant;
    combatants.push(combatant);
  }
  const enemies = toEnemies(content);
  if ('ok' in enemies) return enemies;

  const ctx = createContext(emptyBattle(setup.battleId), content);
  ctx.prng = { seed: setup.seed, cursor: 0 };
  const initiative = draw(ctx, nextFloat) < 0.5 ? 'group' : 'enemies';
  const questionDeck = draw(ctx, (prng) => shuffle(prng, objectiveIds(content)));

  emit(ctx, {
    type: 'BattleStarted',
    battleId: setup.battleId,
    nodeId: content.nodeId,
    initiative,
    combatants,
    enemies,
    enemyQueue: enemies.map((e) => e.instanceId),
    needsMaster,
    masterOnline: setup.masterOnline,
    seed: setup.seed,
    questionDeck,
  });
  if (initiative === 'group') startGroupTurn(ctx);
  else runEnemyPhase(ctx);
  return { ok: true, events: finish(ctx) };
}
