import { DEFENSE_CONSTANT } from '@rpg-chains/game-config';

/** Damage reduction fraction from defense (spec §4.2). Never reaches 1. */
export function damageReduction(defesa: number): number {
  return defesa / (defesa + DEFENSE_CONSTANT);
}

/** Final damage after defense (spec §4.2): DanoBruto × (1 − Redução%). */
export function finalDamage(danoBruto: number, defesa: number): number {
  return danoBruto * (1 - damageReduction(defesa));
}

/** Raw damage before defense (spec §4.2): DanoBase + (Atributo × Escala). */
export function rawDamage(danoBase: number, atributo: number, escala: number): number {
  return danoBase + atributo * escala;
}
